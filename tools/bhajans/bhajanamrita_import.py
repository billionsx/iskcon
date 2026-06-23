#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Импортёр бхаджанов с публичного API bhajanamrita (admin.bhajanamrita.com).
Используется С РАЗРЕШЕНИЯ правообладателя (Sri Rupa Seva Kunj).

Слой над загрузчиком: тянет JSON с их API, декодирует PUA-шрифт-хак в нормальный
Unicode (наш BBT-кириллический стандарт), мапит в payload-схему bhajan_loader,
классифицирует против нашей базы (заполнить заглушку / новая песня / коллизия с
уже залитой — не трогаем). Сам в БД не пишет — выдаёт payload, пишет загрузчик.

Чистые функции (decode_pua, map_full, normalize_key, canon_author) тестируются
локально на снятых карточках; сеть нужна только для fetch в CI.

API (выверено разведкой):
  список : GET https://admin.bhajanamrita.com/api/public/bhajans/?lang=ru&page=N
           → {data:[{id,slug,title,firstLine,author,theme,themes,...}], pagination:{total,totalPages,...}}
  полный : GET https://admin.bhajanamrita.com/api/public/bhajans/{slug}/full?lang=ru
           → {title, titleTransliteration, author:{name,...}, book:{title,...}, meter,
              verses:[{verseNumber, original, transliteration, translation, wordByWord:[...]}],
              recordings:[...], comments:[...], scores:[...]}
"""

from __future__ import annotations
import json, os, re, sys, time, unicodedata, urllib.request, urllib.error, pathlib

API = "https://admin.bhajanamrita.com"
UA = "gaurangers-bhajan-sync/1.0 (ISKCON ONE LOVE; by permission of Sri Rupa Seva Kunj; ceo@billionsx.com)"
SOURCE_CREDIT = "Тексты — Bhajanāmṛta / Sri Rupa Seva Kunj, с разрешения"

# ─────────────────────────────────────────────── PUA → Unicode (выверено по глифам Gaura PT Serif)
# Смешанная схема под нашу базу: комбинируемые знаки, НО прекомпозиция для долгих и/у (ӣ/ӯ).
COMB_MACRON, COMB_DOT_BELOW, COMB_DOT_ABOVE, COMB_TILDE, COMB_ACUTE = "\u0304","\u0323","\u0307","\u0303","\u0301"
PUA_MAP = {
    "\uF101": "а" + COMB_MACRON,      # ā
    "\uF103": "д" + COMB_DOT_BELOW,   # ḍ
    "\uF109": "м" + COMB_DOT_ABOVE,   # ṁ  (анусвара)
    "\uF10F": "н" + COMB_DOT_ABOVE,   # ṅ
    "\uF111": "н" + COMB_DOT_BELOW,   # ṇ
    "\uF113": "н" + COMB_TILDE,       # ñ
    "\uF115": "р" + COMB_DOT_BELOW,   # ṛ
    "\uF119": "т" + COMB_DOT_BELOW,   # ṭ
    "\uF11B": "х" + COMB_DOT_BELOW,   # ḥ
    "\uF11D": "ш" + COMB_ACUTE,       # ś
    "\uF11F": "\u04EF",               # ū  (прекомпозиция ӯ)
    "\uF121": "\u04E3",               # ī  (прекомпозиция ӣ)
}
_PUA_TABLE = {ord(k): v for k, v in PUA_MAP.items()}


def decode_pua(s: str) -> str:
    """PUA-коды → нормальный Unicode. Прочий текст не трогаем."""
    if not s:
        return s
    return s.translate(_PUA_TABLE)


def residual_pua(s: str) -> list[str]:
    """Любые оставшиеся PUA-символы (должно быть пусто после decode)."""
    return sorted({f"U+{ord(c):04X}" for c in (s or "") if 0xE000 <= ord(c) <= 0xF8FF})


# ─────────────────────────────────────────────── канон авторов (API-имя → наш канон + slug)
AUTHORS = {
    "Бхактивинода Тхакур":            ("Бхактивинод Тхакур",            "bhaktivinod-thakur"),
    "Лочана дас Тхакур":              ("Лочан дас Тхакур",             "lochan-das-thakur"),
    "Нароттам дас Тхакур":            ("Нароттам дас Тхакур",          "narottam-das-thakur"),
    "Вишванатха Чакраварти Тхакур":   ("Вишванатха Чакраварти Тхакур", "visvanatha-chakravarti-thakur"),
    "Васудева Гхош":                  ("Васудева Гхош",                "vasudeva-ghosh"),
    "Рагхунатха дас Госвами":         ("Рагхунатх дас Госвами",        "raghunath-das-goswami"),
    "Говинда дас Кавираджа":          ("Говинда дас Кавираджа",        "govinda-das-kaviraja"),
    "Джаядева Госвами":               ("Джаядева Госвами",             "jayadeva-goswami"),
    "Вьясадева":                      ("Вьясадева",                    "vyasadeva"),
    "Сатьяврата Муни":                ("Сатьяврата Муни",              "satyavrata-muni"),
    "Сарвабхаума Бхаттачарья":        ("Сарвабхаума Бхаттачарья",      "sarvabhauma-bhattacharya"),
    "Рупа Госвами":                   ("Рупа Госвами",                 "rupa-goswami"),
    "Автор неизвестен":               ("Автор неизвестен",             None),
}

_TRANSLIT_SLUG = str.maketrans({
    COMB_MACRON: "", COMB_DOT_BELOW: "", COMB_DOT_ABOVE: "", COMB_TILDE: "", COMB_ACUTE: "",
    "\u04E3": "i", "\u04EF": "u",
})
_CYR2LAT = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z","и":"i","й":"y",
    "к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f",
    "х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya",
}


def canon_author(api_name: str | None):
    if not api_name:
        return None, None
    s = re.sub(r"\s+", " ", api_name).strip()
    if s in AUTHORS:
        return AUTHORS[s]
    # фолбэк: имя как есть, slug транслитом
    base = s.translate(_TRANSLIT_SLUG).lower()
    slug = "".join(_CYR2LAT.get(c, c) for c in base)
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return s, (slug or None)


# ─────────────────────────────────────────────── нормализация для сопоставления с базой
def normalize_key(s: str) -> str:
    """Ключ для матчинга: убрать диакритику/регистр/пунктуацию, оставить буквы."""
    if not s:
        return ""
    s = decode_pua(s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("\u04E3", "и").replace("\u04EF", "у")
    s = s.lower()
    s = re.sub(r"[^0-9a-zа-яё]+", "", s)
    return s


# ─────────────────────────────────────────────── маппинг полной карточки → payload-песня
def _clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def map_full(full: dict, theme: str | None = None) -> dict:
    """full-JSON API → одна песня payload-схемы загрузчика (без финального slug-решения)."""
    author_api = (full.get("author") or {}).get("name")
    author_name, author_slug = canon_author(author_api)
    api_slug = full.get("_slug") or full.get("slug") or ""
    name = _clean(full.get("title")) or _clean(full.get("titleTransliteration"))
    book = _clean((full.get("book") or {}).get("title"))

    verses = []
    for v in full.get("verses") or []:
        tr = decode_pua(v.get("transliteration") or "")
        # сохраняем межстрочные переводы строк, чистим только хвостовые пробелы построчно
        tr = "\n".join(line.rstrip() for line in tr.replace("\r\n", "\n").split("\n")).strip()
        tx = _clean(v.get("translation"))
        verses.append({"translit": tr, "translation": tx})

    song = {
        "slug": f"/ru/bhajans/{author_slug or 'unknown'}/{api_slug}".replace("//", "/"),
        "name": name,
        "translit_name": api_slug.replace("-", " ") or None,
        "author_name": author_name,
        "author_slug": author_slug,
        "source_text": book or None,
        "section": _clean(theme) or None,
        "category": "Песни ачарьев",
        "ord": None,
        "verses": verses,
        # метаданные импорта (не для загрузчика — для отчёта/будущего расширения схемы)
        "_meta": {
            "bhajanamrita_slug": api_slug,
            "author_api": author_api,
            "meter": _clean(full.get("meter")) or None,
            "match_key": normalize_key(name),
            "counts": {
                "verses": len(verses),
                "wordByWord": sum(len(v.get("wordByWord") or []) for v in (full.get("verses") or [])),
                "recordings": len(full.get("recordings") or []),
                "comments": len(full.get("comments") or []),
                "scores": len(full.get("scores") or []),
            },
            "credit": SOURCE_CREDIT,
        },
    }
    return song


# ─────────────────────────────────────────────── HTTP (только CI)
def _get(path: str, timeout: int = 45) -> bytes:
    rq = urllib.request.Request(API + path, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(rq, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(1.5 * (attempt + 1)); continue
            raise
    return b""


def fetch_list(lang: str = "ru") -> list[dict]:
    items, page = [], 1
    while True:
        j = json.loads(_get(f"/api/public/bhajans/?lang={lang}&page={page}"))
        data = j.get("data") or []
        items += data
        pg = j.get("pagination") or {}
        if page >= int(pg.get("totalPages") or 1) or not data:
            break
        page += 1
        time.sleep(0.5)
    return items


def fetch_full(slug: str, lang: str = "ru") -> dict:
    j = json.loads(_get(f"/api/public/bhajans/{slug}/full?lang={lang}"))
    j["_slug"] = slug
    return j


# ─────────────────────────────────────────────── D1 чтение (для классификации)
def d1_existing(token: str):
    ACCT = "d5cbe19470dc38599873eabfe148e6d1"; DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
    body = json.dumps({"sql":
        "SELECT slug, name, translit_name, COALESCE(is_catalog,0) c, "
        "CASE WHEN text IS NOT NULL AND length(text)>0 THEN 1 ELSE 0 END filled FROM prayers"}).encode()
    rq = urllib.request.Request(url, data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(rq, timeout=60) as r:
        return json.loads(r.read())["result"][0]["results"]


# ─────────────────────────────────────────────── классификация + сборка пакета (CI)
def build(out_payload: str, out_match: str, token: str | None, lang: str = "ru") -> dict:
    lst = fetch_list(lang)
    rows = d1_existing(token) if token else []
    by_slug = {r["slug"]: r for r in rows}
    stub_key = {}   # match_key → canonical stub slug (только незаполненные заглушки)
    for r in rows:
        if int(r["c"]) == 1 or not int(r["filled"]):
            k = normalize_key(r.get("translit_name") or r.get("name") or "")
            if k:
                stub_key.setdefault(k, r["slug"])

    songs, match = [], []
    for it in lst:
        slug = it.get("slug")
        try:
            full = fetch_full(slug, lang)
        except Exception as e:
            match.append({"slug": slug, "status": "FETCH_ERROR", "err": str(e)[:160]}); continue
        song = map_full(full, it.get("theme"))
        meta = song.pop("_meta")
        flat = song["slug"]
        key = meta["match_key"]

        # решение по slug-у
        if flat in by_slug and int(by_slug[flat]["filled"]) and int(by_slug[flat]["c"]) == 0:
            status, target = "COLLISION_FILLED", flat       # уже залитая песня — не трогаем
        elif flat in by_slug:
            status, target = "FILL_SAME_SLUG", flat          # заглушка с тем же slug
        elif key in stub_key:
            status, target = "FILL_MATCHED_STUB", stub_key[key]   # каноническая заглушка по имени
            song["slug"] = target
        else:
            status, target = "NEW", flat                     # новая песня

        residual = []
        for v in song["verses"]:
            residual += residual_pua(v["translit"]) + residual_pua(v["translation"])
        rec = {"bhajanamrita_slug": slug, "name": song["name"], "author": song["author_name"],
               "status": status, "target_slug": target, "verses": meta["counts"]["verses"],
               "extras": {k: meta["counts"][k] for k in ("wordByWord","recordings","comments","scores")},
               "residual_pua": sorted(set(residual))}
        match.append(rec)
        if status != "COLLISION_FILLED":
            songs.append(song)
        time.sleep(0.35)

    pathlib.Path(out_payload).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(out_payload).write_text(json.dumps(songs, ensure_ascii=False, indent=2))
    summary = {"total_api": len(lst), "to_write": len(songs),
               "by_status": _count(match, "status"),
               "with_residual_pua": [m["bhajanamrita_slug"] for m in match if m.get("residual_pua")],
               "credit": SOURCE_CREDIT, "items": match}
    pathlib.Path(out_match).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(out_match).write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps({k: summary[k] for k in
          ("total_api","to_write","by_status","with_residual_pua")}, ensure_ascii=False, indent=2))
    return summary


def _count(rows, key):
    out = {}
    for r in rows:
        out[r.get(key)] = out.get(r.get(key), 0) + 1
    return out


# ─────────────────────────────────────────────── selftest (локально, без сети)
def selftest(recon_dir="tools/bhajans/recon"):
    import glob
    ok = True
    files = sorted(glob.glob(f"{recon_dir}/api_full_*.json"))
    assert files, "нет снятых api_full_*.json для теста"
    for f in files:
        full = json.load(open(f, encoding="utf-8"))
        full["_slug"] = pathlib.Path(f).stem.replace("api_full_", "").replace("_slug", "")
        song = map_full(full, "—")
        res = []
        for v in song["verses"]:
            res += residual_pua(v["translit"]) + residual_pua(v["translation"])
        has_dia = any(("\u0304" in v["translit"] or "\u0323" in v["translit"]
                       or "\u04E3" in v["translit"] or "\u04EF" in v["translit"]) for v in song["verses"])
        good = bool((not res) and song["verses"] and has_dia and song["name"])
        ok &= good
        print(f"  {'ok ' if good else 'FAIL'} {song['slug']:48s} куплетов={len(song['verses']):2d} "
              f"автор={song['author_name']} остаток-PUA={res or 'нет'} диакритика={'да' if has_dia else 'НЕТ'}")
    # показать декод первого куплета gurudev для глаз
    gp = f"{recon_dir}/api_full_gurudev_slug.json"
    if os.path.exists(gp):
        g = json.load(open(gp, encoding="utf-8")); g["_slug"] = "gurudev"
        s = map_full(g, None)
        print("\n  gurudev v1 translit:", repr(s["verses"][0]["translit"]))
        print("  gurudev v1 перевод :", repr(s["verses"][0]["translation"][:90]))
    print("\n" + ("SELFTEST ЗЕЛЁНЫЙ" if ok else "SELFTEST УПАЛ"))
    return ok


def _cli():
    import argparse
    ap = argparse.ArgumentParser(description="Импорт бхаджанов с API bhajanamrita (по разрешению)")
    ap.add_argument("--selftest", action="store_true", help="локальный тест декодера/маппера на снятых карточках")
    ap.add_argument("--build", action="store_true", help="CI: fetch+decode+map+classify → payload + match-отчёт")
    ap.add_argument("--payload", default="data/bhajanamrita_payload.json")
    ap.add_argument("--match", default="tools/bhajans/recon/MATCH.json")
    ap.add_argument("--lang", default="ru")
    a = ap.parse_args()
    if a.selftest:
        sys.exit(0 if selftest() else 1)
    if a.build:
        build(a.payload, a.match, os.environ.get("CF") or os.environ.get("CLOUDFLARE_API_TOKEN"), a.lang)
        return
    ap.print_help()


if __name__ == "__main__":
    _cli()
