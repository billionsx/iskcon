#!/usr/bin/env python3
"""
plan.py — КАРТА ЗАЛИВКИ: каталог goswami.ru → циклы, имена файлов, названия.

═══ ПОЧЕМУ КАРТА ОТДЕЛЬНО ОТ ЗАЛИВКИ (ЗКН-Пл010) ═══

Адрес файла у источника не годится ни в архив, ни в витрину:

    …/2024.12.21%20-%20%D0%A3%D0%BD%D0%B8%D0%B2… .mp3

Имя файла в архиве, название дорожки и её цикл решаются ЗДЕСЬ, кладутся в
репозиторий и проверяются глазами ДО того, как поедут гигабайты. Заливка потом
только исполняет.

═══ ГЛАВНОЕ: ЦИКЛЫ НЕ ВЫДУМЫВАЮТСЯ ═══

Соблазн был разбирать заголовки: «…Лекция 11» → цикл, «Bhagavad-gita 15.5» →
книга. Разбор заголовков — всегда угадывание, а у сайта раскладка УЖЕ ЕСТЬ:
1142 именованных цикла, и у каждой записи `in_collections` говорит, в какие она
входит. Имена там человеческие и точные — «Бхагавад-гита, Глава 1», «Ретриты
Святого имени», «1998. Паломничества». Их и берём.

Запись обычно входит В НЕСКОЛЬКО циклов сразу: и в «2026. Семинары», и в
«2026. Все лекции». В плеере у дорожки цикл ОДИН, поэтому:

  1. отбрасываем вёдра-сборники («Все лекции», «Все», «NNNN год») — они
     проглотили бы всё и оставили одну плоскую кучу;
  2. из оставшихся берём САМЫЙ УЗКИЙ (где записей меньше) — узкий цикл несёт
     больше смысла: «Ретрит Школы джапа-медитации 2025» полезнее, чем «Семинары»;
  3. если ничего не осталось — запись уходит в годовой цикл по дате.

Порядок внутри цикла: у циклов по писаниям — по песни/главе/стиху (это чтение
книги, а не хроника), у остальных — по дате, в ту сторону, которую сайт сам
указал в `direction`.

Вход:  docs/diagnostics/goswami-catalog.json
Выход: tools/goswami/goswami_plan.json + сводка в лог
"""
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
CATALOG = Path(os.getenv("CATALOG") or (HERE.parent.parent / "docs" / "diagnostics" / "goswami-catalog.json"))
OUT = Path(os.getenv("PLAN") or (HERE / "goswami_plan.json"))

SPEAKER = "bhakti-vijnana-goswami"
SPEAKER_NAME = "Бхакти Вигьяна Госвами Махарадж"
IA_PREFIX = "iskcone-katha-bvg-"

# цикл длиннее этого режется на части: очередь в плеере должна оставаться обозримой
MAX_ALBUM = int(os.getenv("MAX_ALBUM") or 220)

MONTHS = {1: "января", 2: "февраля", 3: "марта", 4: "апреля", 5: "мая", 6: "июня",
          7: "июля", 8: "августа", 9: "сентября", 10: "октября", 11: "ноября", 12: "декабря"}
ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]

# Вёдра-сборники: попадание сюда не считается принадлежностью к циклу.
# «Диск 92» — отдельная история: это не тема, а номер болванки, которую когда-то
# печатали. Такой «цикл» оказывается самым узким для сотен записей и побеждает
# осмысленные — поэтому он тоже ведро.
GENERIC = re.compile(
    r"^(все|all)$"
    r"|все\s+лекции"
    r"|^\d{4}\s*год"
    r"|^по\s+(годам|священным\s+писаниям)$"
    r"|^(тематические|диски|english|переводы)\b"
    r"|^диск\s*[№#]?\s*\d+\s*$"
    r"|^disc\s*\d+\s*$"
    r"|^cd\s*\d+\s*$", re.I)

TRANS = {"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
         "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
         "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
         "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
         "я": "ya"}

# краткие коды книг для имён файлов: bg-15-05.mp3 читается и сортируется
SCRIPTURE_CODE = {1: "bg", 2: "sb", 3: "cc", 4: "nod", 5: "noi", 6: "iso", 7: "mk", 8: "ram"}


def slugify(s: str, limit: int = 46) -> str:
    s = (s or "").lower().strip()
    s = unicodedata.normalize("NFKD", s)
    out = []
    for ch in s:
        if ch in TRANS:
            out.append(TRANS[ch])
        elif ch.isascii() and ch.isalnum():
            out.append(ch)
        elif ch in " -_/·.,:;()[]«»\"'№":
            out.append("-")
    r = re.sub(r"-+", "-", "".join(out)).strip("-")
    r = re.sub(r"[^a-z0-9-]", "", r)
    return r[:limit].strip("-") or "lek"


def human_date(d):
    if not d:
        return ""
    y, m, dd = int(d[:4]), int(d[5:7]), int(d[8:10])
    return "%d %s %d" % (dd, MONTHS.get(m, ""), y)


def ref_key(lec):
    """Порядок чтения книги: песнь → глава → стих."""
    def n(v):
        try:
            return int(re.sub(r"\D", "", str(v)) or 0)
        except Exception:
            return 0
    return (n(lec.get("canto")), n(lec.get("chapter")), n(lec.get("verse")))


def ref_file(code, lec):
    parts = [x for x in (lec.get("canto"), lec.get("chapter"), lec.get("verse")) if x]
    if not parts:
        return None
    return code + "-" + "-".join(str(re.sub(r"\D", "", str(p)) or "0").zfill(2) for p in parts)


def main() -> int:
    if not CATALOG.exists():
        print("::error::нет каталога %s — сначала catalog.py" % CATALOG)
        return 1
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    lectures = cat["lectures"]
    cols = {c["id"]: c for c in cat.get("collections", [])}
    print("каталог: %d записей · %d циклов" % (len(lectures), len(cols)))

    withu = [x for x in lectures if x.get("file_url")]
    print("со звуком: %d · без ссылки: %d" % (len(withu), len(lectures) - len(withu)))

    # ── 1. насколько узок каждый цикл ──────────────────────────────────
    weight = Counter()
    for lec in withu:
        for cid in lec.get("collections") or []:
            weight[cid] += 1

    def usable(cid):
        c = cols.get(cid)
        if not c:
            return False
        name = (c.get("full_name") or "").strip()
        return bool(name) and not GENERIC.search(name)

    # ── 2. каждой записи — ровно один цикл ─────────────────────────────
    #
    # Соблазн был: нет цикла — сгруппировать по `scripture_id`. Проверка карты
    # показала, чем это кончается: в «Бхагавад-гите» оказались «Даршан» и
    # «Брахмотсава в ашраме». `scripture_id` у записи значит «имеет отношение к
    # книге», а не «разбор такого-то стиха», и на нём цикл не построить.
    # Поразбирать по главам тоже нельзя: главы у сайта заведены (id 19–36), но
    # НИ ОДНА запись на них не ссылается — они пустые.
    # Поэтому: нет своего цикла — запись честно уходит в годовой. «Лекции 2014»
    # ничего не обещает и не обманывает.
    buckets = defaultdict(list)
    src = Counter()
    for lec in withu:
        cands = [c for c in (lec.get("collections") or []) if usable(c)]
        if cands:
            cid = min(cands, key=lambda c: (weight[c], c))
            buckets[("c", cid)].append(lec)
            src["цикл сайта"] += 1
            continue
        y = (lec.get("date") or "")[:4] or "0000"
        buckets[("y", y)].append(lec)
        src["по году"] += 1
    print("откуда цикл: %s" % dict(src))

    # ── 3. сборка ──────────────────────────────────────────────────────
    scripts = {str(p["id"]): p["name"] for p in cat.get("presets", {}).get("getPresetScripture", [])}
    albums = []
    used_id, used_ident = set(), set()

    for key, items in buckets.items():
        kind = key[0]
        if kind == "c":
            c = cols[key[1]]
            title = (c.get("full_name") or "").strip()
            sid = c.get("scripture_id")
            desc = (c.get("direction") or "ASC").upper() == "DESC"
        else:
            sid = None
            title = "Лекции %s" % (key[1] if key[1] != "0000" else "без даты")
            desc = True
        base = slugify(title, 42)

        # порядок внутри цикла: у циклов по книге — по ссылке на стих, иначе по
        # дате в ту сторону, которую сайт указал сам
        if sid:
            items.sort(key=lambda x: (ref_key(x), x.get("date") or "", x.get("id") or 0))
        else:
            items.sort(key=lambda x: (x.get("date") or "", x.get("id") or 0), reverse=desc)

        # Длинный цикл режем. Резать «частью I» и «частью II» нельзя: римская
        # цифра ничего не сообщает о содержимом. Если цикл растянут по годам —
        # режем по годам, и название остаётся говорящим.
        chunks, labels = [items], [None]
        if len(items) > MAX_ALBUM:
            byyear = defaultdict(list)
            for x in items:
                byyear[(x.get("date") or "")[:4] or "—"].append(x)
            if len(byyear) > 1 and max(len(v) for v in byyear.values()) <= MAX_ALBUM:
                ys = sorted(byyear, reverse=desc)
                chunks = [byyear[y] for y in ys]
                labels = list(ys)
            else:
                chunks = [items[i:i + MAX_ALBUM] for i in range(0, len(items), MAX_ALBUM)]
                labels = [ROMAN[i] if i < len(ROMAN) else str(i)
                          for i in range(1, len(chunks) + 1)]

        for ci, (chunk, lab) in enumerate(zip(chunks, labels), 1):
            t = title if lab is None else "%s · %s" % (title, lab)
            aid, k = (base if lab is None else slugify("%s-%s" % (base[:36], lab), 46)), 2
            while aid in used_id:
                aid = "%s-%d" % (base, k)
                k += 1
            used_id.add(aid)
            ident = IA_PREFIX + aid
            while ident in used_ident:
                ident = "%s%s-%d" % (IA_PREFIX, aid, k)
                k += 1
            used_ident.add(ident)

            code = SCRIPTURE_CODE.get(sid) if sid else None
            tracks, seen_f = [], set()
            for i, lec in enumerate(chunk, 1):
                fb = (ref_file(code, lec) if code else None) or "%s-%s" % (base[:30], str(i).zfill(3))
                fname = "%s.mp3" % slugify(fb, 56)
                if fname in seen_f:
                    fname = "%s-%d.mp3" % (slugify(fb, 52), i)
                seen_f.add(fname)

                name = (lec.get("title") or "").strip() or "Лекция"
                note = " · ".join(x for x in (human_date(lec.get("date")), lec.get("place")) if x)
                ttl = "%s · %s" % (name, note) if (note and kind == "y") else name
                tracks.append({
                    "url": lec["file_url"],
                    "file": fname,
                    "title": ttl[:180],
                    "duration": int(lec.get("duration") or 0),
                    "sort": i,
                    "src_id": lec.get("id"),
                    "src_page": lec.get("page"),
                    "date": lec.get("date"),
                    "place": lec.get("place"),
                    "size_mb": lec.get("size_mb") or 0,
                })

            years = sorted({t["date"][:4] for t in tracks if t.get("date")})
            albums.append({
                "id": aid, "speaker": SPEAKER, "title": t, "identifier": ident,
                "kind": {"c": "цикл", "s": "писание", "y": "год"}[kind],
                "scripture_id": sid,
                "year": ("%s–%s" % (years[0], years[-1])) if len(years) > 1 else (years[0] if years else None),
                "note": None, "sort": 0, "tracks": tracks,
            })

    # витрина: писания → циклы → годы; внутри — крупные выше
    rank = {"писание": 0, "цикл": 1, "год": 2}
    albums.sort(key=lambda a: (rank.get(a["kind"], 9), -len(a["tracks"]), a["title"]))
    for i, a in enumerate(albums, 1):
        a["sort"] = i

    plan = {
        "source": "goswami.ru",
        "speaker": SPEAKER,
        "speaker_name": SPEAKER_NAME,
        "speaker_full": "Его Святейшество Бхакти Вигьяна Госвами Махарадж",
        "speaker_role": "Лекции и катха",
        "speaker_sort": 0,
        "n_lectures": len(lectures),
        "n_with_audio": len(withu),
        "n_albums": len(albums),
        "albums": albums,
    }
    OUT.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")

    hours = sum(t["duration"] for a in albums for t in a["tracks"]) / 3600
    gb = sum(t["size_mb"] for a in albums for t in a["tracks"]) / 1024
    print("\n═══ КАРТА ═══")
    print("циклов: %d · записей: %d · звучание: %.0f ч · объём: %.1f ГБ"
          % (len(albums), sum(len(a["tracks"]) for a in albums), hours, gb))
    by = Counter()
    for a in albums:
        by[a["kind"]] += len(a["tracks"])
    print("по типам: %s" % dict(by))
    print("\n── крупнейшие циклы ──")
    for a in sorted(albums, key=lambda x: -len(x["tracks"]))[:30]:
        h = sum(t["duration"] for t in a["tracks"]) / 3600
        print("  %-48s %4d зап · %6.1f ч · %s" % (a["title"][:48], len(a["tracks"]), h, a["identifier"]))
    dup = [i for i, c in Counter(a["identifier"] for a in albums).items() if c > 1]
    print("\nповторов идентификатора: %d %s" % (len(dup), dup[:5]))
    print("→ %s (%d КБ)" % (OUT, OUT.stat().st_size // 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
