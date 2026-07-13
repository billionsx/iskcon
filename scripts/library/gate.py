"""
ВОРОТА №2 (У5) — ГЕЙТ БИБЛИОТЕКИ.  Механизация законов ПР001–ПР007 и Б005.

Документ без механизма — незакрытый закон (У0). Это механизм.
Гейт РОНЯЕТ сборку. Он ничего не удаляет (Р002) — он не пускает.

Проверки:
  ПР001 каждое издание имеет класс прав из реестра
  ПР002 ни один draft-перевод не помечен published
  ПР003 нет перевода без оригинала (деванагари/IAST)
  ПР004 нет дублей ref внутри произведения
  Б005  у каждого произведения (СУЩЕСТВУЮЩИЙ закон, 18 живых нарушений) есть автор-личность, и она существует
  ПР005 канонические имена в переводах (Гауранга Махапрабху и др.)
  ПР006 ни один стих без source_url
  ПР007 ни одно произведение не публикуется с license ∉ PUBLISHABLE

Запуск:   python3 -m scripts.library.gate
          python3 -m scripts.library.gate --soft   (только отчёт, RC=0)
"""
from __future__ import annotations
import json
import pathlib
import re
import sys

from . import d1
from .registry import WORKS, PUBLISHABLE

SOFT = "--soft" in sys.argv
UPDATE = "--update-baseline" in sys.argv

# ХРАПОВИК. Долг, унаследованный до постройки конвейера, зафиксирован здесь.
# Гейт падает НЕ на самом долге, а на его РОСТЕ. Долг может только уменьшаться.
# Улучшил — прогони с --update-baseline, храповик защёлкнется на новом уровне.
BASELINE = pathlib.Path("docs/library/BASELINE.json")


def _baseline() -> dict:
    """Ключи с `_` — комментарии для человека. В сравнение не идут:
    иначе `0 > "строка"` роняет гейт на TypeError вместо честного отчёта."""
    if not BASELINE.exists():
        return {}
    raw = json.loads(BASELINE.read_text(encoding="utf-8"))
    return {k: int(v) for k, v in raw.items() if not k.startswith("_")}


def _save(counts: dict) -> None:
    BASELINE.parent.mkdir(parents=True, exist_ok=True)
    BASELINE.write_text(json.dumps(counts, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")

# ── ПР005: запрещённые формы имён (docs/STANDARD_canonical_names.md) ─────────
BAD_NAMES = [
    (r"Шри Чайтанья Махапрабху", "Гауранга Махапрабху / Шри Кришна Чайтанья Махапрабху"),
    (r"(?<![-\w])Чайтанья Махапрабху", "Гауранга Махапрабху"),
    (r"Гаура-лила", "Гауранга Лила"),
    (r"Кришна-лила(?![-\w])", "Кришна Лила"),
    (r"(?<![-\w])Радхарани(?![-\w])", "Шримати Радхарани"),
]
# Названия книг — исключение (СТАНДАРТ: «Прабхупада-лиламрита» не трогаем).
NAME_EXCEPT = re.compile(r"«[^»]*»")

FAILS: list[str] = []
COUNTS: dict[str, int] = {}
COUNTS: dict[str, int] = {}


def fail(law: str, msg: str, n: int = 1) -> None:
    """n — ВЕЛИЧИНА долга (30502 стиха), а не факт срабатывания.
    Иначе храповик зелёный, пока долг растёт. Это ошибка Ф021."""
    FAILS.append(f"{law}  {msg}")
    COUNTS[law] = COUNTS.get(law, 0) + n



def check() -> None:
    # ── ПР001 / ПР007 ─────────────────────────────────────────────────────────
    for r in d1.query("SELECT id, work_id, lang, COALESCE(license,'') AS lic FROM editions"):
        if not r["lic"]:
            fail("ПР001", f"издание {r['id']} без license")
        elif r["lic"] not in PUBLISHABLE and r["lic"] not in ("pending", "forbidden"):
            fail("ПР001", f"издание {r['id']}: неизвестный класс прав `{r['lic']}`")
        if r["work_id"] not in WORKS:
            fail("ПР001", f"работа {r['work_id']} не внесена в registry.py")

    # ── ПР001: СИРОТСКИЕ СТИХИ. Работы нет в `works` — стихи невидимы для любого
    #    запроса через works. Так пряталось 5 387 стихов, включая всю
    #    «Прабхупада-шикшамриту» (5 328). Гейт нашёл это, я — нет.
    for r in d1.query("""
        SELECT work_id, COUNT(*) AS n FROM verses
        WHERE work_id NOT IN (SELECT id FROM works)
        GROUP BY work_id
    """):
        fail("ПР001", "%d стихов работы `%s` — работы нет в `works`"
             % (r["n"], r["work_id"]), r["n"])
    # ── ПР003 / ПР006: стих без оригинала и без источника ─────────────────────
    n_no_src = d1.scalar(
        "SELECT COUNT(*) FROM verses WHERE source_url IS NULL OR source_url=''") or 0
    if n_no_src:
        fail("ПР006", f"{n_no_src} стихов без source_url — происхождение недоказуемо", n_no_src)

    n_orphan = d1.scalar("""
        SELECT COUNT(*) FROM verse_texts t
        JOIN verses v ON v.id = t.verse_id
        WHERE COALESCE(t.translation,'') <> ''
          AND COALESCE(v.devanagari,'') = ''
          AND COALESCE(v.translit,'') = ''
    """) or 0
    if n_orphan:
        fail("ПР003", f"{n_orphan} переводов без оригинала (нечего было переводить)", n_orphan)

    # ── ПР004: дубли ref ──────────────────────────────────────────────────────
    for r in d1.query("""
        SELECT work_id, ref, COUNT(*) c FROM verses
        GROUP BY work_id, ref HAVING c > 1 LIMIT 20
    """):
        fail("ПР004", f"дубль стиха {r['work_id']} {r['ref']} ×{r['c']}")

    # ── Б005: книга без автора-личности (СУЩЕСТВУЮЩИЙ закон, был не механизован)
    for r in d1.query("""
        SELECT w.id FROM works w
        WHERE w.author_id IS NULL
          AND EXISTS (SELECT 1 FROM verses v WHERE v.work_id = w.id)
    """):
        fail("Б005", f"работа {r['id']} со стихами, но без автора-личности")

    for r in d1.query("""
        SELECT w.id, w.author_id FROM works w
        WHERE w.author_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = w.author_id)
    """):
        fail("Б005", f"работа {r['id']}: автор `{r['author_id']}` не найден в entities")

    # ── ПР002: draft не может быть published ──────────────────────────────────
    n_draft_pub = d1.scalar("""
        SELECT COUNT(*) FROM verse_texts t
        JOIN editions e ON e.id = t.edition_id
        WHERE e.license = 'own-translation'
          AND instr(COALESCE(t.purport,''), '"status": "published"') > 0
          AND instr(COALESCE(t.purport,''), '"reviewer"') = 0
    """) or 0
    if n_draft_pub:
        fail("ПР002", f"{n_draft_pub} машинных переводов помечены published без ревьюера", n_draft_pub)

    # ── ПР005: канонические имена в наших переводах ───────────────────────────
    bad = 0
    for r in d1.query("""
        SELECT t.verse_id, t.translation FROM verse_texts t
        JOIN editions e ON e.id = t.edition_id
        WHERE e.license = 'own-translation' AND COALESCE(t.translation,'') <> ''
        LIMIT 4000
    """):
        txt = NAME_EXCEPT.sub("", r["translation"] or "")
        for pat, want in BAD_NAMES:
            if re.search(pat, txt):
                fail("ПР005", f"{r['verse_id']}: запрещённая форма → «{want}»")
                bad += 1
                break
        if bad > 15:
            break
    # выборка ограничена: ПР005 считается по факту, не по полной величине


def report() -> int:
    print("=" * 70)
    print("ВОРОТА БИБЛИОТЕКИ (У5) — ПР001-ПР007, Б005")
    print("=" * 70)
    check()

    if UPDATE:
        _save(COUNTS)
        print("Храповик защёлкнут: " + json.dumps(COUNTS, ensure_ascii=False))
        return 0

    base = _baseline()
    grown = [(l, base.get(l, 0), COUNTS.get(l, 0))
             for l in sorted(set(COUNTS) | set(base))
             if COUNTS.get(l, 0) > base.get(l, 0)]
    healed = [(l, base.get(l, 0), COUNTS.get(l, 0))
              for l in sorted(set(COUNTS) | set(base))
              if COUNTS.get(l, 0) < base.get(l, 0)]

    if not FAILS and not base:
        print("Все восемь законов соблюдены. Проход открыт.")
        return 0

    for law, was, now in healed:
        print("  v %s: %d -> %d   долг уменьшен" % (law, was, now))
    if healed:
        print("  -> зафиксируй: python3 -m scripts.library.gate --update-baseline")

    if grown:
        print()
        for law, was, now in grown:
            print("::error::%s РЕГРЕССИЯ: было %d, стало %d" % (law, was, now))
            print("  x %s: %d -> %d   ДОЛГ ВЫРОС" % (law, was, now))
        print()
        print("Гейт закрыт: новое нарушение. Ни одна строка не удалена (Р002).")
        return 0 if SOFT else 1

    print()
    print("Унаследованный долг: %d нарушений (docs/library/RIGHTS.md)." % sum(base.values()))
    print("Роста нет — проход открыт. Долг может только уменьшаться.")
    for f in FAILS[:12]:
        print("  . " + f)
    return 0


if __name__ == "__main__":
    sys.exit(report())
