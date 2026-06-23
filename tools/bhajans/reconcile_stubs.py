#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сверка импортированных bhajanamrita-песен (плоские слаги) с книжными заглушками
Saranagati/Gitavali/Kalyana-kalpataru (is_catalog=1).

Цель: где импортированная песня = канонической заглушке, перенести контент в
КНИЖНЫЙ слаг (сохранив структуру книги: book/section/ord/имя), а плоский дубль
снести. Чего не уверены — не трогаем (остаётся как есть, помечаем на ручной разбор).

Матч: тот же автор + префиксное сходство кириллических имён ≥ порога + уникальность.
Романизация источников расходится (дехо/деха), поэтому строгий префикс не годится —
используем difflib по нормализованному префиксу (без диакритики, латинские гомоглифы
свёрнуты в кириллицу).

Режимы:
  --plan   query D1 + payload → RECONCILE.json (на ревью), в БД НЕ пишет
  --apply  по RECONCILE.json: заполнить заглушку из дубля, перенести куплеты
           (переподписать именем заглушки), удалить плоский дубль. Идемпотентно.
"""

from __future__ import annotations
import json, os, re, sys, unicodedata, difflib, urllib.request, pathlib

ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
THRESHOLD = 0.85

_LAT2CYR = {  # латинские гомоглифы → кириллица (только для ключа матчинга)
    "a":"а","e":"е","o":"о","c":"с","p":"р","x":"х","y":"у","k":"к","m":"м",
    "t":"т","h":"н","b":"в","n":"н","i":"и","u":"у","r":"р","s":"с",
}


def norm(s: str) -> str:
    """Ключ матчинга: NFKD, снять диакритику, латинские гомоглифы → кириллица, только буквы/цифры."""
    if not s:
        return ""
    s = s.replace("\u04E3", "и").replace("\u04EF", "у")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = "".join(_LAT2CYR.get(c, c) for c in s)
    s = re.sub(r"[^0-9а-яё]+", "", s)
    return s


def similarity(song_title: str, stub_name: str) -> float:
    """Сходство заголовка песни с НАЧАЛОМ имени заглушки (заглушка = заголовок + остаток строки)."""
    a = norm(song_title)
    b = norm(stub_name)
    if not a or not b:
        return 0.0
    bp = b[:len(a)]                      # префикс заглушки длиной с заголовок
    return difflib.SequenceMatcher(None, a, bp).ratio()


# ─────────────────────────────────────────────── D1
def d1(sql, params=None, token=None):
    token = token or os.environ.get("CF") or os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        raise RuntimeError("нет CF в окружении")
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1_URL, data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(rq, timeout=60) as r:
        return json.loads(r.read())["result"][0]["results"]


# ─────────────────────────────────────────────── план
def plan(payload_path, out_path, token):
    songs = json.load(open(payload_path, encoding="utf-8"))
    stubs = d1("SELECT slug,name,author_name FROM prayers WHERE COALESCE(is_catalog,0)=1", token=token)
    flat_now = {r["slug"]: r for r in
                d1("SELECT slug,COALESCE(is_catalog,0) c, "
                   "CASE WHEN text IS NOT NULL AND length(text)>0 THEN 1 ELSE 0 END filled FROM prayers", token=token)}

    by_author = {}
    for st in stubs:
        by_author.setdefault((st["author_name"] or "").strip(), []).append(st)

    matched, ambiguous, unmatched = [], [], []
    for s in songs:
        flat = s["slug"]
        # песня должна реально существовать как плоская залитая (мы её только что записали)
        cand = by_author.get((s["author_name"] or "").strip(), [])
        scored = sorted(((similarity(s["name"], st["name"]), st) for st in cand),
                        key=lambda x: x[0], reverse=True)
        top = scored[0] if scored else (0.0, None)
        second = scored[1][0] if len(scored) > 1 else 0.0
        rec = {"flat_slug": flat, "name": s["name"], "author": s["author_name"],
               "best_stub": (top[1]["slug"] if top[1] else None),
               "best_stub_name": (top[1]["name"] if top[1] else None),
               "score": round(top[0], 3), "runner_up": round(second, 3)}
        if top[0] >= THRESHOLD and (top[0] - second) >= 0.04:
            matched.append(rec)
        elif top[0] >= THRESHOLD:
            rec["why"] = "неоднозначно (близкий второй)"
            ambiguous.append(rec)
        else:
            unmatched.append(rec)

    out = {"threshold": THRESHOLD,
           "counts": {"matched": len(matched), "ambiguous": len(ambiguous), "unmatched": len(unmatched)},
           "matched": sorted(matched, key=lambda r: -r["score"]),
           "ambiguous": ambiguous,
           "unmatched_sample": unmatched[:80]}
    pathlib.Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(out_path).write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(json.dumps({"counts": out["counts"],
                      "matched": [(m["flat_slug"], "→", m["best_stub"], m["score"]) for m in out["matched"]],
                      "ambiguous": [(a["flat_slug"], a["best_stub"], a["score"], a["runner_up"]) for a in ambiguous]},
                     ensure_ascii=False, indent=2))


# ─────────────────────────────────────────────── применение
def apply(plan_path, token, min_score=THRESHOLD):
    rc = json.load(open(plan_path, encoding="utf-8"))
    done = 0
    for m in rc["matched"]:
        if m["score"] < min_score:
            continue
        flat, stub = m["flat_slug"], m["best_stub"]
        src = d1("SELECT text,translit,translation FROM prayers WHERE slug=?", [flat], token=token)
        st = d1("SELECT name,author_name FROM prayers WHERE slug=?", [stub], token=token)
        if not src or not st:
            print(f"  пропуск (нет строки): {flat} / {stub}"); continue
        src, st = src[0], st[0]
        # 1) заполнить книжную заглушку контентом дубля (имя/мета заглушки сохраняем)
        d1("UPDATE prayers SET text=?, translit=?, translation=?, is_catalog=0, is_section=0, "
           "updated_at=datetime('now') WHERE slug=?",
           [src["text"], src["translit"], src["translation"], stub], token=token)
        # 2) перенести куплеты flat→stub и переподписать именем заглушки
        d1("DELETE FROM prayer_verses WHERE slug=?", [stub], token=token)
        d1("UPDATE prayer_verses SET slug=? WHERE slug=?", [stub, flat], token=token)
        d1("UPDATE prayer_verses SET signature = ? || ' · ' || ? || ' · ' || ord || '-й стих' WHERE slug=?",
           [(st["author_name"] or "").strip(), (st["name"] or "").strip(), stub], token=token)
        # 3) снести плоский дубль
        d1("DELETE FROM prayers WHERE slug=?", [flat], token=token)
        done += 1
        print(f"  слито: {flat} → {stub}")
    print(f"DONE: применено {done} из {len(rc['matched'])}")


def _cli():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--payload", default="data/bhajanamrita_payload.json")
    ap.add_argument("--out", default="tools/bhajans/recon/RECONCILE.json")
    a = ap.parse_args()
    tok = os.environ.get("CF") or os.environ.get("CLOUDFLARE_API_TOKEN")
    if a.plan:
        plan(a.payload, a.out, tok)
    elif a.apply:
        apply(a.out, tok)
    else:
        ap.print_help()


if __name__ == "__main__":
    _cli()
