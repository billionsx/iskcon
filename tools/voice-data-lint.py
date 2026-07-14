#!/usr/bin/env python3
"""
ЗКН-Д013 · ЛИНТ ДАННЫХ. Закон, проверенный на коде, проверен наполовину.

`voice-lint.py` смотрит ИСХОДНИКИ: правильно ли написан рендер.
Этот линт смотрит ДАННЫЕ: получит ли голос КАЖДЫЙ реальный текст приложения —
все комментарии, все переводы, все описания личностей, все бхаджаны, все статьи.

Он переносит В ТОЧНОСТИ логику фронта (`ui/Skt.tsx`: classify + verseRuns) и
отвечает на один вопрос:

    ЕСТЬ ЛИ В БАЗЕ ТЕКСТ, ГДЕ ШАСТРА ОСТАНЕТСЯ НЕМОЙ?

Два вида источников:
  · ПОЛЕВЫЕ — рисуются голосом по самому факту поля (стих, куплет, пословный
    перевод, транслитерация). Покрыты по построению: там нечему промахнуться.
  · ПРОЗА — идёт через `renderTerms`, где стих распознаётся ПОЛОСОЙ. Вот тут
    промах возможен, и вот это проверяется построчно.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from goldforge import d1  # noqa: E402

# ═══ ТОЧНАЯ КОПИЯ ЛОГИКИ ФРОНТА (apps/web/src/ui/Skt.tsx) ══════════════════
SCRIPT_MARK = re.compile(
    r"[\u0300-\u036F\u0483-\u0489\u04E3\u04EF\u0100-\u017F\u1E00-\u1EFF\u00F1\u00D1]")
TRANSLIT_CYR = re.compile(r"(йа|йо|йу|йе|кша|джн|шча|сйа|нйа|тйа|рйа|хйа|дхй|бхй|ттв)")
PUNCT_EDGE = re.compile(r"[.,;:!?»)]$|^[«(]")
RU_STOP = set(
    "и в на с не что как это но а или то же бы ли из за по для о об от до при над под без "
    "у к во со он она они мы вы я его ее её их этот эта этом этой этого эти все всё так там "
    "тут где когда чтобы если есть был была было были быть может можно должен слово слова "
    "словами стих стихе стиха стихом только даже уже ещё еще очень более менее также тоже "
    "здесь том говорит сказано пишет значит например однако поэтому таким образом господь "
    "господа бог бога один одна два три цитирует приводит".split())
STOP_NAMES = {"кршна", "радха", "чайтанйа", "бхакти", "карма", "йога", "майа", "раса",
              "дхарма", "krsna", "radha", "caitanya", "arjuna", "prabhupada"}


def fold(w):
    w = unicodedata.normalize("NFD", w)
    w = "".join(c for c in w if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-zа-я-]", "", w)


def classify(w):
    bare = re.sub(r"[^\wа-яёА-ЯЁ\u0300-\u036F'\u2019-]", "", w)
    if not bare:
        return "stop"
    f = fold(bare)
    if SCRIPT_MARK.search(bare):
        return "stop" if f in STOP_NAMES else "strong"
    if f in RU_STOP or f in STOP_NAMES:
        return "stop"
    if TRANSLIT_CYR.search(f):
        return "weak"
    return "unknown"


def verse_runs(words):
    cls = [classify(w) for w in words]
    runs, i = [], 0
    while i < len(words):
        if cls[i] not in ("strong", "weak"):
            i += 1
            continue
        a = b = i
        while a > 0 and cls[a - 1] != "stop" and not PUNCT_EDGE.search(words[a - 1]):
            a -= 1
        while b + 1 < len(words) and cls[b + 1] != "stop":
            b += 1
            if PUNCT_EDGE.search(words[b]):
                break
        runs.append((a, b))
        i = b + 1
    return runs


def has_scripture(t):
    return bool(SCRIPT_MARK.search(t) or TRANSLIT_CYR.search(t.lower()))


def voiced(t):
    words = t.split()
    if not words:
        return False
    marked = sum(1 for w in words if classify(w) in ("strong", "weak"))
    if marked / len(words) >= 0.45:
        return True
    return bool(verse_runs(words))


# ═══ ПОЛЕВЫЕ ИСТОЧНИКИ — голос по построению ══════════════════════════════
FIELDS = [
    ("стихи · транслитерация", "SELECT COUNT(*) n FROM verses WHERE coalesce(translit,'')<>''"),
    ("стихи · деванагари", "SELECT COUNT(*) n FROM verses WHERE coalesce(devanagari,'')<>''"),
    ("стихи · перевод", "SELECT COUNT(*) n FROM verse_texts WHERE coalesce(translation,'')<>''"),
    ("пословный перевод", "SELECT COUNT(*) n FROM verse_tokens"),
    ("бхаджаны · куплет", "SELECT COUNT(*) n FROM prayer_verses WHERE coalesce(verse_translit,'')<>''"),
    ("бхаджаны · перевод", "SELECT COUNT(*) n FROM prayer_verses WHERE coalesce(verse_text,'')<>''"),
    ("бхаджаны · пословный", "SELECT COUNT(*) n FROM prayer_verses WHERE coalesce(word_by_word,'')<>''"),
    ("молитвы · транслитерация", "SELECT COUNT(*) n FROM prayers WHERE coalesce(translit,'')<>''"),
    ("молитвы · перевод", "SELECT COUNT(*) n FROM prayers WHERE coalesce(translation,'')<>''"),
    ("цитаты", "SELECT COUNT(*) n FROM quotes WHERE coalesce(text,'')<>''"),
]


# Признаки шастры — прямо в SQL: тянуть все 18 723 комментария по REST нельзя,
# ответ не пролезает, `query` возвращает None — и линт отчитывается ЗЕЛЁНЫМ,
# НЕ ПОСМОТРЕВ НИЧЕГО. Ложный зелёный хуже красного.
MARK_SQL = ("(instr({c},'а̄')>0 OR instr({c},'н̣')>0 OR instr({c},'ш́')>0 OR "
            "instr({c},'х̣')>0 OR instr({c},'м̇')>0 OR instr({c},'т̣')>0 OR "
            "instr({c},'р̣')>0 OR instr({c},'ā')>0 OR instr({c},'ṛ')>0 OR "
            "instr({c},'йа')>0 OR instr({c},'йо')>0 OR instr({c},'кша')>0)")
PAGE = 150


def paged(sql_count, sql_page, kind):
    """Постранично: REST не отдаёт мегабайты одним ответом."""
    total = (d1.query(sql_count) or [{"n": 0}])[0]["n"]
    got, off = [], 0
    while off < total:
        rows = d1.query(sql_page + " LIMIT %d OFFSET %d" % (PAGE, off))
        if not rows:
            break
        for r in rows:
            v = list(r.values())
            got.append((kind, str(v[0]), str(v[1] or "")))
        off += PAGE
    return total, got


def prose_rows():
    """Всё, что идёт через renderTerms: комментарии · карточки · статьи."""
    out, expected = [], 0

    n, rows = paged(
        "SELECT COUNT(*) n FROM verse_texts WHERE coalesce(purport,'')<>'' AND " + MARK_SQL.format(c="purport"),
        "SELECT verse_id, purport FROM verse_texts WHERE coalesce(purport,'')<>'' AND "
        + MARK_SQL.format(c="purport") + " ORDER BY verse_id", "комментарий")
    expected += n
    out += rows

    n, rows = paged(
        "SELECT COUNT(*) n FROM entity_profiles p, json_tree(p.longform) j WHERE j.key='p' AND "
        + MARK_SQL.format(c="j.value"),
        "SELECT p.entity_id, j.value FROM entity_profiles p, json_tree(p.longform) j "
        "WHERE j.key='p' AND " + MARK_SQL.format(c="j.value") + " ORDER BY p.entity_id", "карточка")
    expected += n
    out += rows

    n, rows = paged(
        "SELECT COUNT(*) n FROM content_blocks WHERE kind IN ('para','lead','accent') AND "
        + MARK_SQL.format(c="text"),
        "SELECT slug, text FROM content_blocks WHERE kind IN ('para','lead','accent') AND "
        + MARK_SQL.format(c="text") + " ORDER BY slug", "статья")
    expected += n
    out += rows

    # ЛИНТ, КОТОРОМУ НЕЧЕГО БЫЛО ПРОВЕРЯТЬ, ОБЯЗАН УПАСТЬ.
    if expected and len(out) < expected * 0.9:
        print("\n✗ ЛИНТ НЕ ПРОЧИТАЛ ДАННЫЕ: ждал %d строк, получил %d." % (expected, len(out)))
        print("  Зелёный отчёт на пустой выборке — ложь. Падаю.")
        sys.exit(2)
    if not out:
        print("\n✗ ЛИНТ НЕ ПОЛУЧИЛ НИ ОДНОЙ СТРОКИ. Падаю.")
        sys.exit(2)
    return out


def main():
    print("ЛИНТ ДАННЫХ · ЧУЖОЙ ГОЛОС (ЗКН-Д013)")
    print("=" * 76)
    print("ПОЛЕВЫЕ ИСТОЧНИКИ — голос по построению (поле = шастра):")
    total = 0
    for name, sql in FIELDS:
        n = (d1.query(sql) or [{"n": 0}])[0]["n"]
        total += n
        print("  ✓ %-28s %9d" % (name, n))
    print("    %-28s %9d" % ("ВСЕГО", total))

    print("\nПРОЗА — стих распознаётся ПОЛОСОЙ (тут возможен промах):")
    stat, missed = {}, []
    for kind, key, txt in prose_rows():
        s = stat.setdefault(kind, [0, 0, 0])
        s[0] += 1
        if not has_scripture(txt):
            continue
        s[1] += 1
        if voiced(txt):
            s[2] += 1
        else:
            missed.append((kind, key, re.sub(r"\s+", " ", txt)[:66]))
    for kind, (n, sc, v) in sorted(stat.items()):
        pct = (100.0 * v / sc) if sc else 100.0
        print("  %s %-13s всего %6d · со шастрой %5d · озвучено %5d (%.1f%%)"
              % ("✓" if v == sc else "✗", kind, n, sc, v, pct))

    print("\n" + "=" * 76)
    if not missed:
        print("НЕМОЙ ШАСТРЫ В БАЗЕ НЕТ. Закон применён ко ВСЕМ текстам приложения.")
        return 0
    print("ШАСТРА ОСТАНЕТСЯ НЕМОЙ: %d" % len(missed))
    for kind, key, t in missed[:25]:
        print("  ✗ %-12s %-22s %s" % (kind, key, t))
    return 1


if __name__ == "__main__":
    sys.exit(main())
