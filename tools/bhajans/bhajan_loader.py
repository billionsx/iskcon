#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Профессиональный загрузчик бхаджанов в базу gaurangers (D1).

Источник-агностик: на вход — нормализованный JSON (массив песен), на выход —
строки в таблицах `prayers` и `prayer_verses` ровно в эталонной форме
(см. «Гурудев» Бхактивинода Тхакура как образец).

Парсер конкретного источника (HTML/PDF/сайт) — отдельный слой, который обязан
выдавать payload именно этой схемы. Загрузчик его не знает и знать не должен.

Эталон одной песни:
  prayers.text        = служебная строка + транслит-тело (куплеты через \\n\\n)
  prayers.translit    = транслит, куплеты через \\n\\n, строки через \\n
  prayers.translation = литературный перевод, куплеты через \\n\\n
  prayer_verses[i]    = {ord, verse_translit, verse_text,
                         signature = "Автор · Название · N-й стих"}

Свойства движка:
  • идемпотентность   — UPSERT prayers + полная замена prayer_verses по slug;
  • матч на каталог   — заглушка (is_catalog=1) заполняется, дубль не плодится;
  • валидация         — до записи; --dry-run печатает план без изменений в БД;
  • сохранность       — пустой payload-куплет не затирает уже залитый текст;
  • канон             — лёгкая нормализация имён (никогда голый «Прабхупада»).

JSON-схема одной песни (поля помимо verses — опциональны, кроме slug/name/verses):
{
  "slug":         "/ru/bhajans/<author-slug>/<book>/<NN-translit>",   # обязателен
  "name":         "Кириллическое название",                            # обязателен
  "translit_name":"latin translit name",
  "author_name":  "Бхактивинод Тхакур",
  "author_slug":  "bhaktivinod-thakur",
  "source_text":  "Шаранагати",
  "category":     "Песни ачарьев",
  "section":      "Дайнья — смирение",
  "ord":          5,
  "hero_image":   "https://...",
  "verses": [                                                           # обязателен, ≥1
    {"translit": "строка1\\nстрока2", "translation": "перевод куплета"},
    ...
  ]
}
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from typing import Any, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from divine_caps import capitalize_divine  # noqa: E402  (капитализация имён божеств в названии)

# ------------------------------------------------------------------ конфигурация D1
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"

DEFAULT_HERO = "https://static.tildacdn.net/tild3063-6561-4534-a539-336262316565/iskcon.png"


# ------------------------------------------------------------------ канон-нормализация
def canon_author(name: Optional[str]) -> Optional[str]:
    """Минимальная защита канона имён. Контент не выдумываем — только чиним явное."""
    if not name:
        return name
    s = re.sub(r"\s+", " ", name).strip()
    # «Прабхупада» без титула — запрещён каноном проекта.
    if re.fullmatch(r"(?i)прабхупада", s):
        return "Шрила Прабхупада"
    return s


def normalize_slug(slug: str) -> str:
    s = (slug or "").strip()
    if not s.startswith("/"):
        s = "/" + s
    return re.sub(r"/{2,}", "/", s)


# ------------------------------------------------------------------ трансформация
def _verse_translit(v: dict) -> str:
    return re.sub(r"[ \t]+\n", "\n", (v.get("translit") or "").strip())


def _verse_text(v: dict) -> str:
    return re.sub(r"\s+", " ", (v.get("translation") or "")).strip()


def build_record(b: dict) -> dict:
    """payload-песня → готовые поля prayers + строки prayer_verses. Чистая функция."""
    slug = normalize_slug(b["slug"])
    name = capitalize_divine(re.sub(r"\s+", " ", str(b["name"])).strip())
    author = canon_author(b.get("author_name"))
    verses_in = b.get("verses") or []

    verses = []
    for i, v in enumerate(verses_in, start=1):
        tr = _verse_translit(v)
        tx = _verse_text(v)
        sig_author = author or (b.get("source_text") or "").strip() or "—"
        verses.append(
            {
                "ord": i,
                "verse_translit": tr or None,
                "verse_text": tx or None,
                "signature": f"{sig_author} · {name} · {i}-й стих",
            }
        )

    translit = "\n\n".join(v["verse_translit"] for v in verses if v["verse_translit"]).strip()
    translation = "\n\n".join(v["verse_text"] for v in verses if v["verse_text"]).strip()

    # Служебная первая строка ровно как в существующей базе; рендер её срезает.
    service = f"{name}. {author or 'ISKCON'}. ISKCON. ИСККОН"
    text = (service + ("\n" + translit if translit else "")).strip()

    return {
        "prayer": {
            "slug": slug,
            "lang": "ru",
            "name": name,
            "author_slug": (b.get("author_slug") or None),
            "author_name": author,
            "text": text or None,
            "hero_image": (b.get("hero_image") or DEFAULT_HERO),
            "is_section": 0,
            "translit": translit or None,
            "translation": translation or None,
            "category": (b.get("category") or None),
            "source_text": (b.get("source_text") or None),
            "translit_name": (b.get("translit_name") or None),
            "section": (b.get("section") or None),
            "ord": (b.get("ord") if isinstance(b.get("ord"), int) else None),
            "is_catalog": 0,
        },
        "verses": verses,
    }


# ------------------------------------------------------------------ валидация
def validate(b: dict, idx: int) -> list[str]:
    errs: list[str] = []
    if not b.get("slug"):
        errs.append(f"[{idx}] нет slug")
    if not b.get("name"):
        errs.append(f"[{idx}] нет name")
    verses = b.get("verses")
    if not isinstance(verses, list) or not verses:
        errs.append(f"[{idx}] {b.get('slug','?')}: пустой verses")
        return errs
    for j, v in enumerate(verses, 1):
        has_tr = bool((v.get("translit") or "").strip())
        has_tx = bool((v.get("translation") or "").strip())
        if not has_tr and not has_tx:
            errs.append(f"[{idx}] {b.get('slug','?')}: куплет {j} пуст (ни транслита, ни перевода)")
    return errs


# ------------------------------------------------------------------ D1 I/O
def d1(sql: str, params: Optional[list] = None, token: Optional[str] = None) -> list[dict]:
    token = token or os.environ.get("CF") or os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        raise RuntimeError("нет CF / CLOUDFLARE_API_TOKEN в окружении")
    body = json.dumps({"sql": sql, "params": params or []}).encode("utf-8")
    rq = urllib.request.Request(
        D1_URL,
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(rq, timeout=60) as r:
                payload = json.loads(r.read().decode("utf-8"))
                return payload["result"][0]["results"]
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    return []


def existing_slugs(token: str) -> dict[str, int]:
    rows = d1("SELECT slug, COALESCE(is_catalog,0) AS c FROM prayers", token=token)
    return {r["slug"]: int(r["c"]) for r in rows}


def upsert(rec: dict, token: str) -> None:
    p = rec["prayer"]
    d1(
        """INSERT INTO prayers
             (slug,lang,name,author_slug,author_name,text,hero_image,is_section,
              translit,translation,category,source_text,translit_name,section,ord,is_catalog,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
           ON CONFLICT(slug) DO UPDATE SET
             lang=excluded.lang, name=excluded.name,
             author_slug=COALESCE(excluded.author_slug, prayers.author_slug),
             author_name=COALESCE(excluded.author_name, prayers.author_name),
             text=excluded.text, hero_image=excluded.hero_image, is_section=0,
             translit=excluded.translit, translation=excluded.translation,
             category=COALESCE(excluded.category, prayers.category),
             source_text=COALESCE(excluded.source_text, prayers.source_text),
             translit_name=COALESCE(excluded.translit_name, prayers.translit_name),
             section=COALESCE(excluded.section, prayers.section),
             ord=COALESCE(excluded.ord, prayers.ord),
             is_catalog=0, updated_at=datetime('now')""",
        [
            p["slug"], p["lang"], p["name"], p["author_slug"], p["author_name"], p["text"],
            p["hero_image"], p["is_section"], p["translit"], p["translation"], p["category"],
            p["source_text"], p["translit_name"], p["section"], p["ord"], p["is_catalog"],
        ],
        token=token,
    )
    d1("DELETE FROM prayer_verses WHERE slug=?", [p["slug"]], token=token)
    for v in rec["verses"]:
        d1(
            "INSERT INTO prayer_verses (slug,ord,verse_translit,verse_text,signature) VALUES (?,?,?,?,?)",
            [p["slug"], v["ord"], v["verse_translit"], v["verse_text"], v["signature"]],
            token=token,
        )


# ------------------------------------------------------------------ оркестрация
def run(payload_path: str, dry_run: bool = False, token: Optional[str] = None) -> dict:
    with open(payload_path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise SystemExit("payload должен быть JSON-массивом песен")

    # 1) валидация всего пакета — до единой записи в БД
    all_errs: list[str] = []
    for i, b in enumerate(data):
        all_errs += validate(b, i)
    if all_errs:
        print("ВАЛИДАЦИЯ НЕ ПРОШЛА:", file=sys.stderr)
        for e in all_errs[:50]:
            print("  •", e, file=sys.stderr)
        raise SystemExit(f"{len(all_errs)} ошибок — запись отменена")

    recs = [build_record(b) for b in data]

    if dry_run or token is None:
        token_local = token or os.environ.get("CF") or os.environ.get("CLOUDFLARE_API_TOKEN")
        have_db = bool(token_local)
        ex = existing_slugs(token_local) if (have_db and dry_run) else {}
        new = filled = 0
        for r in recs:
            s = r["prayer"]["slug"]
            if s in ex and ex[s] == 1:
                filled += 1
            elif s not in ex:
                new += 1
        print(f"DRY-RUN: песен={len(recs)}"
              + (f" · заполнят заглушек={filled} · новых={new}" if have_db and dry_run else " (БД не опрошена)"))
        for r in recs[:5]:
            p = r["prayer"]
            print(f"  · {p['slug']}  «{p['name']}»  куплетов={len(r['verses'])}"
                  f"  translit={'да' if p['translit'] else 'нет'}"
                  f"  translation={'да' if p['translation'] else 'нет'}")
        return {"songs": len(recs), "filled": filled, "new": new, "dry_run": True}

    # 2) запись
    ex = existing_slugs(token)
    new = filled = updated = 0
    for r in recs:
        s = r["prayer"]["slug"]
        if s in ex and ex[s] == 1:
            filled += 1
        elif s in ex:
            updated += 1
        else:
            new += 1
        upsert(r, token)

    try:
        d1(
            "INSERT INTO deploy_checks (checked_at,target,http_code,body) "
            "VALUES (datetime('now'),'bhajans loader',?,?)",
            [str(len(recs)), f"filled={filled} new={new} updated={updated}"],
            token=token,
        )
    except Exception:
        pass

    print(f"DONE: песен={len(recs)} · заполнено заглушек={filled} · новых={new} · перезалито={updated}")
    return {"songs": len(recs), "filled": filled, "new": new, "updated": updated, "dry_run": False}


def _cli() -> None:
    import argparse

    ap = argparse.ArgumentParser(description="Загрузчик бхаджанов → D1 (prayers + prayer_verses)")
    ap.add_argument("payload", help="путь к JSON-массиву песен")
    ap.add_argument("--dry-run", action="store_true", help="проверить и показать план, не писать в БД")
    ap.add_argument("--write", action="store_true", help="реально записать в D1 (нужен CF в окружении)")
    args = ap.parse_args()
    run(args.payload, dry_run=not args.write, token=(None if not args.write else os.environ.get("CF")))


if __name__ == "__main__":
    _cli()
