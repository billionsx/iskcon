#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Перенос медиа бхаджанов (записи/лекции/ноты/PDF-комментарии), размещённых на
cdn.bhajanamrita.com, в Internet Archive — чтобы приложение ходило в archive.org,
а не на чужой CDN.

Один объiekt archive.org на бхаджан: iskcone-bhajan-<slug>, файлы вида
<kind>-<ord>.<ext> (recording-1.mp3, lecture-2.mp3, score-1.pdf, commentary-1.pdf).
После заливки prayer_media.url переписывается на https://archive.org/download/...

Идемпотентно: уже залитые файлы (есть в объекте) — пропускаются, URL всё равно
проставляется. YouTube и сторонние ссылки не трогаются (это не bhajanamrita CDN).

Запуск в CI: нужны IA_ACCESS_KEY/IA_SECRET_KEY (S3-ключи) + CF (D1) + интернет.
"""
from __future__ import annotations
import json, os, re, sys, time, tempfile, pathlib, urllib.request, threading

ACCT = "d5cbe19470dc38599873eabfe148e6d1"; DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
APP = "https://gaurangers.com"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"


def d1(sql, params=None, token=None):
    token = token or os.environ.get("CF") or os.environ.get("CLOUDFLARE_API_TOKEN")
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


def final_map(payload_path, plan_path):
    songs = json.load(open(payload_path, encoding="utf-8"))
    moved = {}
    if os.path.exists(plan_path):
        rc = json.load(open(plan_path, encoding="utf-8"))
        moved = {m["flat_slug"]: m["best_stub"] for m in rc.get("matched", [])}
    return {moved.get(s["slug"], s["slug"]): s["slug"].rstrip("/").split("/")[-1] for s in songs}


def ext_of(url: str, kind: str) -> str:
    path = re.sub(r"[?#].*$", "", url or "")
    m = re.search(r"\.([A-Za-z0-9]{2,4})$", path)
    if m:
        return m.group(1).lower()
    return {"recording": "mp3", "lecture": "mp3", "score": "pdf", "commentary": "pdf"}.get(kind, "bin")


def download(url: str, dest: str, deadline: int = 360, stall: int = 45):
    """Качает файл с жёстким дедлайном (deadline c) и анти-столлом (stall c без новых байт)."""
    rq = urllib.request.Request(url, headers={
        "User-Agent": UA, "Referer": "https://bhajanamrita.com/", "Accept": "*/*"})
    t0 = time.time(); last = t0; got = 0
    with urllib.request.urlopen(rq, timeout=30) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1 << 16)
            now = time.time()
            if not chunk:
                break
            f.write(chunk); got += len(chunk)
            if chunk:
                last = now
            if now - t0 > deadline:
                raise TimeoutError(f"дедлайн {deadline}c ({got//1024} КБ)")
            if now - last > stall:
                raise TimeoutError(f"столл >{stall}c без данных ({got//1024} КБ)")
    return os.path.getsize(dest)


def sniff_ext(path, fallback):
    """Расширение по сигнатуре файла (CDN отдаёт аудио в mp4-контейнере под /audio/ —
    archive.org такой .mp3 отвергает: «improper extension, try .mp4»)."""
    try:
        with open(path, "rb") as f:
            head = f.read(16)
    except Exception:
        return fallback
    if len(head) >= 8 and head[4:8] == b"ftyp":
        return "mp4"
    if head[:3] == b"ID3" or (len(head) >= 2 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0):
        return "mp3"
    if head[:4] == b"OggS":
        return "ogg"
    if head[:4] == b"RIFF":
        return "wav"
    if head[:4] == b"%PDF":
        return "pdf"
    if head[:3] == b"\xff\xd8\xff":
        return "jpg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    return fallback


def run(payload_path, plan_path, token):
    from internetarchive import upload as ia_upload, get_item
    ak = os.environ["IA_ACCESS_KEY"]; sk = os.environ["IA_SECRET_KEY"]

    fmap = final_map(payload_path, plan_path)                 # final_slug -> bhaj_slug
    names = {r["slug"]: (r["name"], r.get("author_name"))
             for r in d1("SELECT slug,name,author_name FROM prayers WHERE source_credit IS NOT NULL", token=token)}
    rows = d1("SELECT slug,kind,ord,url,media_type,title FROM prayer_media "
              "WHERE url LIKE '%bhajanamrita.com%' ORDER BY slug,kind,ord", token=token)

    by_song: dict[str, list] = {}
    for r in rows:
        by_song.setdefault(r["slug"], []).append(r)

    report, n_up, n_skip, n_err, n_url = [], 0, 0, 0, 0
    for slug, items in sorted(by_song.items()):
        bhaj = fmap.get(slug) or slug.rstrip("/").split("/")[-1]
        ident = "iskcone-bhajan-" + re.sub(r"[^a-z0-9._-]+", "-", bhaj.lower()).strip("-")
        name, author = names.get(slug, (bhaj, None))
        has_audio = any(x["media_type"] in ("audio", "video", "youtube") or x["kind"] in ("recording", "lecture") for x in items)
        md = {
            "title": f"{name} — записи, лекции и ноты",
            "mediatype": "audio" if has_audio else "texts",
            "creator": author or "ISKCON ONE LOVE",
            "subject": ["Gaudiya Vaishnava", "bhajan", "kirtan", "ISKCON", "Bhajanamrita"],
            "language": "rus",
            "external-identifier": f"urn:related-bhajan:{slug}",
            "description": (f'Записи, лекции и ноты к бхаджану «{name}» в библиотеке '
                            f'ISKCON ONE LOVE (<a href="{APP}">gaurangers.com</a>). '
                            f'Источник: Bhajanāmṛta / Sri Rupa Seva Kunj, с разрешения.'),
        }

        try:
            existing = {f.name for f in get_item(ident).files}
        except Exception:
            existing = set()

        md_pending = md  # метаданные ставим на первой реальной заливке объекта
        for it in items:
            base = f'{it["kind"]}-{it["ord"]}.'
            url_ext = ext_of(it["url"], it["kind"])
            fname = None
            try:
                existing_match = next((f for f in existing if f.startswith(base)), None)
                if existing_match is None:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tf:
                        tmp = tf.name
                    # Качаем+заливаем в отдельном демон-потоке с жёстким join:
                    # любой зависший файл (download ИЛИ upload) бросается, цикл идёт дальше.
                    res: dict = {}
                    def _work(_it=it, _tmp=tmp, _ident=ident, _mdp=md_pending, _base=base, _uext=url_ext):
                        try:
                            sz = download(_it["url"], _tmp, deadline=900)
                            fn = _base + sniff_ext(_tmp, _uext)   # расширение по сигнатуре файла
                            ia_upload(_ident, files={fn: _tmp},
                                      metadata=(_mdp if _mdp else {}),
                                      access_key=ak, secret_key=sk, retries=4, verbose=True)
                            res["sz"] = sz; res["fname"] = fn
                        except Exception as e:  # noqa: BLE001
                            res["err"] = e
                    th = threading.Thread(target=_work, daemon=True)
                    th.start(); th.join(960)
                    if th.is_alive():
                        raise TimeoutError("файл >960с — поток брошен")
                    if "err" in res:
                        raise res["err"]
                    fname = res["fname"]
                    md_pending = None
                    existing.add(fname)
                    try: os.unlink(tmp)
                    except Exception: pass
                    n_up += 1
                    print(f"  ↑ {ident}/{fname}  ({res.get('sz', 0)//1024} КБ)", flush=True)
                else:
                    fname = existing_match
                    n_skip += 1
                ia_url = f"https://archive.org/download/{ident}/{fname}"
                # переписываем ссылку в БД на archive.org
                d1("UPDATE prayer_media SET url=? WHERE slug=? AND kind=? AND ord=?",
                   [ia_url, it["slug"], it["kind"], it["ord"]], token=token)
                n_url += 1
                report.append({"slug": slug, "ident": ident, "file": fname, "ia_url": ia_url})
            except Exception as e:
                n_err += 1
                report.append({"slug": slug, "file": (fname or base + url_ext), "src": it["url"][:80], "err": str(e)[:160]})
                print(f"  ✗ {ident}/{base}: {str(e)[:120]}", flush=True)
            time.sleep(0.5)

    out = {"songs": len(by_song), "uploaded": n_up, "skipped_existing": n_skip,
           "urls_rewritten": n_url, "errors": n_err, "items": report}
    pathlib.Path("tools/bhajans/recon").mkdir(parents=True, exist_ok=True)
    pathlib.Path("tools/bhajans/recon/IA_REHOST.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(json.dumps({k: out[k] for k in ("songs", "uploaded", "skipped_existing", "urls_rewritten", "errors")},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    run("data/bhajanamrita_payload.json", "tools/bhajans/recon/RECONCILE.json",
        os.environ.get("CF") or os.environ.get("CLOUDFLARE_API_TOKEN"))
