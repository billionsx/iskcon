#!/usr/bin/env python3
"""
yandex_resolve — разрешает превью-ссылки Яндекс.Видео (yandex.ru/video/.../preview/<id>)
к реальному источнику через yt-dlp. Если за превью стоит YouTube — переводит строку
prayer_media в media_type='youtube' с канонической watch-ссылкой (тогда лекция играет
во встроенном плеере приложения без перезаливки). Невстраиваемые источники (vk и пр.)
оставляет как есть и только логирует. Идемпотентно: после конверсии строка уже youtube
и под выборку не попадает. Полный отчёт пишется в таблицу _yandex_resolve_log (читаю
через D1 MCP). Запуск — в GitHub Actions (песочница до yandex.ru не достаёт).
"""
from __future__ import annotations
import json, os, re, subprocess, sys, time, urllib.request

ACCT = "d5cbe19470dc38599873eabfe148e6d1"; DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"


def d1(sql, params=None):
    token = os.environ.get("CF") or os.environ.get("CLOUDFLARE_API_TOKEN")
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1_URL, data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    for a in range(4):
        try:
            with urllib.request.urlopen(rq, timeout=60) as r:
                return json.loads(r.read())["result"][0]["results"]
        except Exception:
            if a < 3: time.sleep(1.5 * (a + 1)); continue
            raise
    return []


def yt_watch(url: str, vid: str) -> str:
    m = re.search(r"(?:youtube(?:-nocookie)?\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|v/)|youtu\.be/)([A-Za-z0-9_-]{6,})", url or "")
    if m: return f"https://www.youtube.com/watch?v={m.group(1)}"
    if vid and re.fullmatch(r"[A-Za-z0-9_-]{6,}", vid): return f"https://www.youtube.com/watch?v={vid}"
    return url


def resolve(url: str):
    """→ (kind, target, extractor) where kind in {youtube, other, fail}."""
    try:
        p = subprocess.run(
            ["yt-dlp", "-J", "--no-warnings", "--no-playlist", "--socket-timeout", "30", url],
            capture_output=True, text=True, timeout=110)
    except subprocess.TimeoutExpired:
        return ("fail", "", "timeout")
    if p.returncode != 0 or not p.stdout.strip():
        err = (p.stderr or "").strip().splitlines()
        return ("fail", "", (err[-1][:120] if err else "exit %d" % p.returncode))
    try:
        info = json.loads(p.stdout)
    except Exception as e:
        return ("fail", "", "json:%s" % e)
    if isinstance(info, dict) and info.get("entries"):
        info = info["entries"][0]
    ek = (info.get("extractor_key") or info.get("extractor") or "").lower()
    wpu = info.get("webpage_url") or info.get("original_url") or ""
    vid = info.get("id") or ""
    if "youtube" in ek or "youtube.com" in wpu or "youtu.be" in wpu:
        return ("youtube", yt_watch(wpu, vid), ek or "youtube")
    return ("other", wpu or vid, ek or "?")


def main():
    d1("""CREATE TABLE IF NOT EXISTS _yandex_resolve_log (
        orig TEXT, kind TEXT, target TEXT, extractor TEXT, rows INTEGER, ts TEXT)""")
    d1("DELETE FROM _yandex_resolve_log")
    rows = d1("""SELECT DISTINCT url FROM prayer_media
                  WHERE kind='lecture' AND media_type='video'
                    AND (url LIKE '%yandex.%/video/%')""")
    urls = [r["url"] for r in rows if r.get("url")]
    print(f"[yandex] {len(urls)} unique preview url(s)", flush=True)
    conv = other = fail = 0
    for i, u in enumerate(urls, 1):
        kind, target, ek = resolve(u)
        n = 0
        if kind == "youtube" and target:
            res = d1("""UPDATE prayer_media SET url=?1, media_type='youtube'
                         WHERE kind='lecture' AND media_type='video' AND url=?2""", [target, u])
            # count affected via follow-up
            cnt = d1("SELECT COUNT(*) c FROM prayer_media WHERE url=?1 AND media_type='youtube'", [target])
            n = (cnt[0]["c"] if cnt else 0)
            conv += 1
        elif kind == "other":
            other += 1
        else:
            fail += 1
        d1("INSERT INTO _yandex_resolve_log (orig,kind,target,extractor,rows,ts) VALUES (?1,?2,?3,?4,?5,datetime('now'))",
           [u, kind, target, ek, n])
        print(f"[{i}/{len(urls)}] {kind:7} {ek:18} -> {target[:70]}", flush=True)
        time.sleep(0.4)
    print(f"[yandex] done: youtube={conv} other={other} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
