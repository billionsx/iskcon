"""
СТАДИЯ 4 — ЗАГРУЗКА И СВЯЗЫВАНИЕ.  (законы ПР001, ПР003, ПР006 + Б005)

Пишет переведённые стихи в D1 и — главное — СВЯЗЫВАЕТ их с библиотекой личностей.
Сейчас в БД `entity_citations` = 0 и 18 из 35 работ без автора. Это и чиним.

Три уровня связи:
  works.author_id        книга  → личность автора        (Б005)
  entity_citations       стих   → личность, о ком он     (сейчас 0!)
  verse_tokens.entity_id слово  → личность               (сейчас 0)

Издание OWN создаётся отдельным `editions`-рядом с license='own-translation'.
Оригинал (санскрит) идёт в `verses`, перевод — в `verse_texts`. Так устроена
схема, и она изначально правильная: одно произведение, много изданий, у каждого
свои права.
"""
from __future__ import annotations
import json
import pathlib
import sys

from . import d1
from .registry import WORKS, OWN, PD, PUBLISHABLE


def ensure_work(work_id: str) -> None:
    """works + связь с личностью автора (Б005)."""
    w = WORKS[work_id]
    d1.query(
        "INSERT OR IGNORE INTO works (id, kind, author_id, abbrev, verse_scheme) "
        "VALUES (?1,?2,?3,?4,?5)",
        [work_id, "scripture", w.author_entity, work_id.upper(), w.scheme],
    )
    if w.author_entity:
        # Б005: у книги обязан быть автор-личность. Проверяем, что он существует.
        ok = d1.scalar("SELECT COUNT(*) FROM entities WHERE id=?1", [w.author_entity])
        if not ok:
            raise SystemExit(
                f"Б005: автор `{w.author_entity}` для «{w.title_ru}» отсутствует "
                f"в entities. Сначала личность — потом книга."
            )
        d1.update_one("works", {"author_id": w.author_entity}, "id", work_id)


def ensure_editions(work_id: str) -> tuple[str, str]:
    """Два издания: оригинал (PD) и наш перевод (OWN, draft до ревью)."""
    w = WORKS[work_id]
    orig_id = f"{work_id}-{w.orig_lang}"
    ru_id = f"{work_id}-ru-own"

    d1.insert_batch(
        "editions",
        ["id", "work_id", "lang", "title", "translator", "source", "license", "source_url"],
        [
            (orig_id, work_id, w.orig_lang, w.iast, None,
             w.sources[0].id if w.sources else "public", PD,
             w.sources[0].url if w.sources else ""),
            (ru_id, work_id, "ru", w.title_ru, "ISKCON ONE LOVE",
             "own-translation", OWN, ""),
        ],
        mode="INSERT OR REPLACE",
    )
    return orig_id, ru_id


def load_verses(work_id: str, path: pathlib.Path) -> dict:
    """JSONL переводов → verses + verse_texts + verse_tokens + entity_citations."""
    w = WORKS[work_id]
    ensure_work(work_id)
    _, ru_ed = ensure_editions(work_id)

    src_url = w.sources[0].url if w.sources else ""

    verses, texts, tokens, cites = [], [], [], []
    seen_refs = set()

    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines()):
        if not line.strip():
            continue
        v = json.loads(line)
        ref = v["ref"]
        if ref in seen_refs:
            raise SystemExit(f"ПР004: дубль стиха {work_id} {ref}")
        seen_refs.add(ref)

        vid = f"{work_id}.{ref}"

        # ПР003: перевод без оригинала не существует.
        deva = v.get("devanagari") or ""
        trl = v.get("translit") or ""
        if not deva and not trl:
            raise SystemExit(f"ПР003: {vid} — перевод без оригинала")

        # ПР006: стих без источника не существует.
        if not src_url:
            raise SystemExit(f"ПР001: {work_id} — нет source_url в реестре")

        verses.append((vid, work_id, None, ref, i + 1, deva, trl, None, src_url))

        # ПР002: только draft. Публикует человек.
        status = "draft"
        payload = json.dumps({"status": status,
                              "confidence": v.get("confidence"),
                              "uncertain": v.get("uncertain", []),
                              "engine": v.get("engine")}, ensure_ascii=False)
        texts.append((vid, ru_ed, v.get("translation", ""),
                      v.get("purport") or payload))

        for j, s in enumerate(v.get("synonyms", [])):
            tokens.append((vid, j + 1, s.get("term", ""), None, s.get("gloss", ""), None))

        # ── СВЯЗЬ СТИХ ↔ ЛИЧНОСТЬ. Ради этого всё и строится. ────────────────
        for ent in v.get("entities", []) or []:
            cites.append((ent, work_id, ref, "mention", None))

        ident = v.get("identity") or {}
        if ident.get("gauranga") and ident.get("krishna"):
            cites.append((ident["gauranga"], work_id, ref, "identity",
                          f"Кришна Лила: {ident['krishna']}"))
            cites.append((ident["krishna"], work_id, ref, "identity",
                          f"Гауранга Лила: {ident['gauranga']}"))

    n_v = d1.insert_batch("verses",
                          ["id", "work_id", "division_id", "ref", "ordinal",
                           "devanagari", "translit", "uvaca", "source_url"],
                          verses)
    n_t = d1.insert_batch("verse_texts",
                          ["verse_id", "edition_id", "translation", "purport"], texts)
    n_k = d1.insert_batch("verse_tokens",
                          ["verse_id", "ordinal", "term", "lemma", "gloss", "entity_id"],
                          tokens, mode="INSERT")
    n_c = d1.insert_batch("entity_citations",
                          ["entity_id", "work_id", "ref", "kind", "note"],
                          cites, mode="INSERT")

    r = {"verses": n_v, "texts": n_t, "tokens": n_k, "citations": n_c}
    print(f"{work_id}: стихов {n_v} · переводов {n_t} (draft) · "
          f"пословно {n_k} · связей с личностями {n_c}")
    return r


def backfill_authors() -> int:
    """Б005: 18 работ без author_id. Проставляем по реестру."""
    fixed = 0
    for wid, w in WORKS.items():
        if not w.author_entity:
            continue
        cur = d1.scalar("SELECT author_id FROM works WHERE id=?1", [wid])
        if cur:
            continue
        ok = d1.scalar("SELECT COUNT(*) FROM entities WHERE id=?1", [w.author_entity])
        if not ok:
            print(f"  ⚠ {wid}: личности `{w.author_entity}` нет в entities")
            continue
        d1.update_one("works", {"author_id": w.author_entity}, "id", wid)
        print(f"  {wid:<22} → {w.author_entity}")
        fixed += 1
    print(f"\nСвязано книга→автор: {fixed}")
    return fixed


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    if cmd == "authors":
        backfill_authors()
    elif cmd == "verses":
        load_verses(sys.argv[2], pathlib.Path(sys.argv[3]))
    else:
        print(__doc__)
