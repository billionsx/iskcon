#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Augment богатых данных bhajanamrita поверх уже залитых песен (НЕ пере-импорт).

Один проход на 71 песню (65 плоских + 6 слитых в книжные слаги):
  • пословный перевод  → prayer_verses.word_by_word (JSON [{t,m}], PUA декодирован)
  • записи/лекции/ноты → таблица prayer_media

Идемпотентно. Порядок куплетов сверяется по числу (verseNumber == ord).
Запускается в CI (нужна сеть к admin.bhajanamrita.com + CF к D1).
"""
from __future__ import annotations
import json, os, sys, time, re, pathlib
sys.path.insert(0, os.path.dirname(__file__))
from bhajanamrita_import import decode_pua, fetch_full, d1_existing  # переиспользуем выверенное
import urllib.request

ACCT = "d5cbe19470dc38599873eabfe148e6d1"; DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"


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
            if a < 3: time.sleep(1.2 * (a + 1)); continue
            raise
    return []


def ensure_schema(token):
    try:
        d1("ALTER TABLE prayer_verses ADD COLUMN word_by_word TEXT", token=token)
        print("  + prayer_verses.word_by_word")
    except Exception as e:
        print(f"  word_by_word уже есть ({str(e)[:50]})")
    d1("""CREATE TABLE IF NOT EXISTS prayer_media (
            slug TEXT NOT NULL, kind TEXT NOT NULL, ord INTEGER NOT NULL,
            title TEXT, subtitle TEXT, duration TEXT, url TEXT, media_type TEXT,
            platform TEXT, ext_id TEXT, description TEXT, date TEXT, lang TEXT,
            PRIMARY KEY (slug, kind, ord))""", token=token)
    print("  prayer_media готова")


def media_type_of(url: str, default: str) -> str:
    u = (url or "").lower()
    if re.search(r"\.pdf(\?|$)", u): return "pdf"
    if re.search(r"\.(jpg|jpeg|png|webp|gif)(\?|$)", u): return "image"
    if re.search(r"\.(mp3|m4a|aac|ogg|wav)(\?|$)", u): return "audio"
    if re.search(r"\.(mp4|webm|mov)(\?|$)", u): return "video"
    return default


def _final_map(payload_path, plan_path):
    songs = json.load(open(payload_path, encoding="utf-8"))
    moved = {}
    if os.path.exists(plan_path):
        rc = json.load(open(plan_path, encoding="utf-8"))
        moved = {m["flat_slug"]: m["best_stub"] for m in rc.get("matched", [])}
    # final_slug -> bhajanamrita slug (последний сегмент плоского слага)
    return {moved.get(s["slug"], s["slug"]): s["slug"].rstrip("/").split("/")[-1] for s in songs}


def run(payload_path, plan_path, token, lang="ru"):
    ensure_schema(token)
    fmap = _final_map(payload_path, plan_path)
    tot_words = tot_media = touched = skipped = 0
    report = []
    for final_slug, bhaj_slug in sorted(fmap.items()):
        try:
            full = fetch_full(bhaj_slug, lang)
        except Exception as e:
            report.append({"slug": final_slug, "err": str(e)[:120]}); continue
        api_verses = full.get("verses") or []
        # сверка числа куплетов с БД
        dbn = d1("SELECT COUNT(*) n FROM prayer_verses WHERE slug=?", [final_slug], token=token)
        dbn = int(dbn[0]["n"]) if dbn else 0
        wbw_written = 0
        if dbn and dbn == len(api_verses):
            for i, v in enumerate(api_verses, start=1):
                pairs = []
                for w in (v.get("wordByWord") or []):
                    t = decode_pua((w.get("wordTransliteration") or "").strip())
                    m = re.sub(r"\s+", " ", (w.get("translation") or "")).strip()
                    if t or m:
                        pairs.append({"t": t, "m": m})
                if pairs:
                    d1("UPDATE prayer_verses SET word_by_word=? WHERE slug=? AND ord=?",
                       [json.dumps(pairs, ensure_ascii=False), final_slug, i], token=token)
                    wbw_written += len(pairs)
            tot_words += wbw_written
        else:
            skipped += 1  # рассинхрон числа куплетов — пословный пропускаем (безопасность)

        # медиа: полная замена по слагу
        d1("DELETE FROM prayer_media WHERE slug=?", [final_slug], token=token)
        n_media = 0
        def ins(kind, ord_, title, subtitle, duration, url, mtype, platform, ext_id, desc, date, mlang):
            nonlocal n_media
            d1("INSERT INTO prayer_media (slug,kind,ord,title,subtitle,duration,url,media_type,platform,ext_id,description,date,lang) "
               "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
               [final_slug, kind, ord_, title, subtitle, duration, url, mtype, platform, ext_id, desc, date, mlang],
               token=token)
            n_media += 1
        for k, r in enumerate(full.get("recordings") or [], 1):
            ins("recording", k, (r.get("title") or "").strip(), (r.get("performer") or "").strip(),
                (r.get("duration") or "").strip(), (r.get("audioUrl") or "").strip(),
                media_type_of(r.get("audioUrl"), "audio"), "", "", "", (r.get("date") or "").strip(), lang)
        for k, c in enumerate(full.get("comments") or [], 1):
            url = (c.get("videoUrl") or c.get("audioUrl") or "").strip()
            plat = (c.get("platform") or "").strip()
            mt = "youtube" if (plat == "youtube" or c.get("youtubeId")) else media_type_of(url, (c.get("type") or "video"))
            ins("lecture", k, (c.get("title") or "").strip(), (c.get("author") or "").strip(),
                (c.get("duration") or "").strip(), url, mt, plat,
                (c.get("youtubeId") or c.get("videoId") or "").strip(),
                (c.get("description") or "").strip(), (c.get("date") or "").strip(), (c.get("language") or lang))
        for k, s in enumerate(full.get("scores") or [], 1):
            ins("score", k, (s.get("title") or "").strip(), (s.get("author") or "").strip(),
                "", (s.get("imageUrl") or "").strip(), media_type_of(s.get("imageUrl"), "image"),
                "", "", (s.get("description") or "").strip(), (s.get("date") or "").strip(), (s.get("language") or lang))
        tot_media += n_media; touched += 1
        report.append({"slug": final_slug, "verses_db": dbn, "verses_api": len(api_verses),
                        "wbw_pairs": wbw_written, "media": n_media})
        time.sleep(0.3)

    out = {"songs": len(fmap), "touched": touched, "wbw_skipped_count_mismatch": skipped,
           "total_wbw_pairs": tot_words, "total_media": tot_media, "items": report}
    pathlib.Path("tools/bhajans/recon/AUGMENT.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(json.dumps({k: out[k] for k in
          ("songs","touched","wbw_skipped_count_mismatch","total_wbw_pairs","total_media")},
          ensure_ascii=False, indent=2))


if __name__ == "__main__":
    run("data/bhajanamrita_payload.json", "tools/bhajans/recon/RECONCILE.json",
        os.environ.get("CF") or os.environ.get("CLOUDFLARE_API_TOKEN"))
