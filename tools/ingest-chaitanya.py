#!/usr/bin/env python3
"""
ИНГЕСТ «ЧАЙТАНЬЯ-БХАГАВАТЫ» и «ЧАЙТАНЬЯ-МАНГАЛЫ» (ЗКН-Пр007 · ЗКН-БТ001).

ПОЧЕМУ.

В досье уже стоят **15 цитат** из этих книг — а сами книги в приложении отсутствуют.
Читатель жмёт на ссылку под цитатой и упирается в пустоту. Закон проекта прям:
дословная цитата из книги = обязательство внести книгу целиком.

При этом РУССКИЙ ТЕКСТ ОБЕИХ УЖЕ ЛЕЖИТ В РЕПОЗИТОРИИ (`docs/sources/chaitanya-lila/`),
93 165 строк «Чайтанья-бхагаваты» с комментариями Шрилы Бхактисиддханты Сарасвати.
Книги числились «нечитаемыми» не потому, что текста нет, а потому, что его не внесли.

УСТРОЙСТВО ИСТОЧНИКА.

    Ади-кханда  /  Мадхья-кханда  /  Антья-кханда        ← раздел
    Глава N. Название                                    ← глава
    Стих N                                               ← номер
    নমস্ত্রিকাল-সত্যায়…                                    ← бенгали
    намас трика̄ла сатйа̄йа                                ← транслитерация
    О мой Господь! Ты — Высшая Истина…                   ← перевод
    Комментарий:                                         ← пурпорт (Гаудия-бхашья)
    Во втором стихе молитв мангалачараны…

ЧЕСТНОСТЬ. Скрипт НИЧЕГО не досочиняет. Стих без перевода вносится с пустым
переводом, а не с выдуманным (ЗКН-БТ001). Разбор проверяется гейтом: если число
стихов подозрительно мало — не пишем в базу.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "sources" / "chaitanya-lila"

BENGALI = re.compile(r"[\u0980-\u09FF]")
VERSE_RX = re.compile(r"^Стих\s+(\d+)\s*$")
CHAPTER_RX = re.compile(r"^Глава\s+(\d+)\.?\s*(.*)$")
KHANDA_RX = re.compile(r"^(Ади|Мадхья|Антья)-кханда\s*$")
PURPORT_RX = re.compile(r"^Комментарий\s*:?\s*$")

# ⚠️ ЛОВУШКА (ЗКН-Ф012): нельзя писать набор диакритики как set("а̄ӣӯр̣н̣ш́…").
# Комбинирующие знаки идут ОТДЕЛЬНЫМИ символами, и set() разбивает строку на
# базовые буквы + знаки. В наборе оказываются обычные «а», «р», «н», «ш», «м»,
# «т», «д», «х», «ч» — они есть в КАЖДОМ русском слове, и определитель считает
# транслитерацией любую русскую строку.
#
# Берём ТОЛЬКО комбинирующие знаки (U+0304 макрон, U+0323 точка снизу,
# U+0301 акут, U+0307 точка сверху, U+0306 бревис) и отдельные буквы ӣ ӯ.
DIACRITICS = set("\u0304\u0323\u0301\u0307\u0306" + "ӣӯ")

KHANDA_SLUG = {"Ади": "adi", "Мадхья": "madhya", "Антья": "antya"}
KHANDA_RU = {"adi": "Ади-кханда", "madhya": "Мадхья-кханда", "antya": "Антья-кханда"}


LATIN = re.compile(r"[A-Za-z]")
CYRILLIC = re.compile(r"[А-Яа-яЁё]")


def is_translit(line: str) -> bool:
    """Строка транслитерации.

    ⚠️ В этом издании ДВА способа транслитерации:
      • Ади-кханда — кириллица с диакритикой: «а̄джа̄ну-ламбита-бхуджау»
      • Антья-кханда — ЛАТИНИЦА: «advaita balaye,—ara ki karya jivane»
    Первая версия определителя знала только про диакритику — и в Антье
    поменяла местами транслитерацию и перевод (проверка это поймала).
    """
    if not line:
        return False

    # Кириллическая транслитерация — по диакритике. Она короткая (строка стиха).
    if len(line) <= 110 and any(ch in DIACRITICS for ch in line):
        return True

    # ЛАТИНСКАЯ транслитерация — по СОСТАВУ, а не по длине.
    # Ограничение длины отвергало 593-знаковую строку в Мадхье, и латиница
    # уходила в перевод. Признак — латиница ПРИ ОТСУТСТВИИ кириллицы.
    lat = len(LATIN.findall(line))
    cyr = len(CYRILLIC.findall(line))
    return lat >= 6 and cyr <= 2


# РАЗМЕТКА ГЛАВ — ДВУМЯ РАЗНЫМИ СПОСОБАМИ (это и сбивало с толку).
#
#   Ади-кханда    — ЗАГОЛОВКАМИ  «Глава 7. Вишварупа принимает санньясу»   → 17 глав
#   Мадхья, Антья — МАРКЕРАМИ КОНЦА:                                        → 28 и 10
#       «Так заканчивается двадцать восьмая глава … Мадхья-кханды —
#        "Господь принимает санньясу"»
#
# Первый заход искал только заголовки, не нашёл их в Мадхье — и я решил, что
# структуры нет. Она была: просто в другом месте строки и словами, а не цифрой.
# Маркеры конца идут ПОДРЯД без пропусков (1…28, 1…10) — это и есть сверка.
#
# Заодно маркер отдаёт НАЗВАНИЕ главы — не нужно тянуть его из оглавления.
ZONES = [("adi", 95, 29037, 17)]        # Ади — по заголовкам

ORD = {"первая": 1, "вторая": 2, "третья": 3, "четвёртая": 4, "четвертая": 4,
       "пятая": 5, "шестая": 6, "седьмая": 7, "восьмая": 8, "девятая": 9,
       "десятая": 10, "одиннадцатая": 11, "двенадцатая": 12, "тринадцатая": 13,
       "четырнадцатая": 14, "пятнадцатая": 15, "шестнадцатая": 16,
       "семнадцатая": 17, "восемнадцатая": 18, "девятнадцатая": 19, "двадцатая": 20}
TENS = {"двадцать": 20, "тридцать": 30}

END_RX = re.compile(
    r"^(?:Так|На этом)\s+заканчивается\s+((?:двадцать|тридцать)\s+)?([а-яё]+)\s+глава"
    r"[^«\"]*?(Ади|Мадхья|Мадхьяк|Антья)", re.I)
TITLE_RX = re.compile(r"[«\"]([^»\"]+)[»\"]")


def end_marker(line):
    """Маркер конца главы → (кханда, номер, название). Иначе None."""
    m = END_RX.match(line)
    if not m:
        return None
    n = ORD.get(m.group(2).lower(), 0)
    if m.group(1):
        n += TENS.get(m.group(1).strip().lower(), 0)
    if not n:
        return None
    kh = m.group(3).lower().replace("мадхьяк", "мадхья")
    kh = {"ади": "adi", "мадхья": "madhya", "антья": "antya"}[kh]
    t = TITLE_RX.search(line)
    return kh, n, (t.group(1).strip() if t else None)


def parse_cb(path: Path):
    """«Чайтанья-бхагавата» целиком: Ади 17 · Мадхья 28 · Антья 10 = 55 глав."""
    lines = [l.strip() for l in path.read_text(encoding="utf-8-sig").split("\n")]
    out = []
    titles = {}

    # ── 1. АДИ — по заголовкам «Глава N.» ──
    for kh, a, b, expect in ZONES:
        chapter, prev, cur, in_purport = 0, 0, None, False
        for i in range(a, min(b, len(lines))):
            line = lines[i]
            if not line:
                continue
            m = VERSE_RX.match(line)
            if m:
                num = int(m.group(1))
                if num == 1 and (prev >= 2 or prev == 0):
                    chapter += 1
                prev = num
                if cur:
                    out.append(cur)
                cur = {"kh": kh, "ch": chapter, "num": num,
                       "bengali": [], "translit": [], "translation": [], "purport": []}
                in_purport = False
                continue
            if not cur:
                continue
            if PURPORT_RX.match(line):
                in_purport = True
                continue
            if in_purport:
                cur["purport"].append(line)
            elif BENGALI.search(line):
                cur["bengali"].append(line)
            elif is_translit(line):
                cur["translit"].append(line)
            else:
                cur["translation"].append(line)
        if cur:
            out.append(cur)
        got = len({(v["kh"], v["ch"]) for v in out if v["kh"] == kh})
        if got != expect:
            raise SystemExit("::error title=PARSE::%s: глав %d вместо %d" % (kh, got, expect))
        print("  ✓ %-6s глав=%2d (по заголовкам)" % (kh, got))

    # ── 2. МАДХЬЯ и АНТЬЯ — по МАРКЕРАМ КОНЦА главы ──
    # Стихи копим, пока не встретим «Так заканчивается N-я глава …-кханды».
    # Тогда весь накопленный блок — это глава N. Так адрес берётся из книги.
    buf, cur, in_purport = [], None, False
    seen = {"madhya": 0, "antya": 0}
    for i in range(29037, len(lines)):
        line = lines[i]
        if not line:
            continue

        em = end_marker(line)
        if em:
            kh, n, title = em
            if kh in ("madhya", "antya"):
                if cur:
                    buf.append(cur)
                    cur = None
                for v in buf:
                    v["kh"], v["ch"] = kh, n
                out.extend(buf)
                buf = []
                seen[kh] = max(seen[kh], n)
                if title:
                    titles[(kh, n)] = title
                continue

        m = VERSE_RX.match(line)
        if m:
            if cur:
                buf.append(cur)
            cur = {"kh": None, "ch": None, "num": int(m.group(1)),
                   "bengali": [], "translit": [], "translation": [], "purport": []}
            in_purport = False
            continue
        if not cur:
            continue
        if PURPORT_RX.match(line):
            in_purport = True
            continue
        if in_purport:
            cur["purport"].append(line)
        elif BENGALI.search(line):
            cur["bengali"].append(line)
        elif is_translit(line):
            cur["translit"].append(line)
        else:
            cur["translation"].append(line)

    for kh, expect in (("madhya", 28), ("antya", 10)):
        if seen[kh] != expect:
            raise SystemExit("::error title=PARSE::%s: глав %d вместо %d — в базу НЕ пишу"
                             % (kh, seen[kh], expect))
        print("  ✓ %-6s глав=%2d (по маркерам конца)" % (kh, seen[kh]))

    KH_RU = {"adi": "Ади", "madhya": "Мадхья", "antya": "Антья"}
    verses, uniq = [], {}
    for v in out:
        if v["kh"] is None or v["ch"] is None:
            continue                      # стих вне главы — не вносим
        base = "cb.%s.%d.%d" % (v["kh"], v["ch"], v["num"])
        uniq[base] = uniq.get(base, 0) + 1
        vid = base if uniq[base] == 1 else "%s-%d" % (base, uniq[base])
        verses.append({
            "id": vid, "work_id": "cb",
            "division_id": "cb.%s.%d" % (v["kh"], v["ch"]),
            "ref": "ЧБ %s %d.%d" % (KH_RU[v["kh"]], v["ch"], v["num"]),
            "ordinal": v["num"],
            "devanagari": "\n".join(v["bengali"]) or None,
            "translit": "\n".join(v["translit"]) or None,
            "translation": "\n".join(v["translation"]) or None,
            "purport": "\n".join(v["purport"]) or None,
        })
    return verses, titles


def parse(path: Path, work: str, abbr: str):
    """Разобрать книгу в список стихов. Ничего не выдумывать."""
    lines = path.read_text(encoding="utf-8-sig").split("\n")

    khanda = None
    chapter = None
    chapter_title = None
    verses = []
    cur = None
    in_purport = False
    seen_body = False          # оглавление идёт ДО первого «Стих», его пропускаем

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        m = KHANDA_RX.match(line)
        if m:
            khanda = KHANDA_SLUG[m.group(1)]
            continue

        m = CHAPTER_RX.match(line)
        if m and seen_body:
            chapter = int(m.group(1))
            chapter_title = m.group(2).strip() or None
            continue
        if m and not seen_body:
            # это ещё оглавление — но запомним последнюю главу на всякий случай
            chapter = int(m.group(1))
            chapter_title = m.group(2).strip() or None
            continue

        m = VERSE_RX.match(line)
        if m:
            seen_body = True
            if cur:
                verses.append(cur)
            cur = {
                "khanda": khanda, "chapter": chapter, "chapter_title": chapter_title,
                "num": int(m.group(1)),
                "bengali": [], "translit": [], "translation": [], "purport": [],
            }
            in_purport = False
            continue

        if not cur:
            continue                       # предисловие/оглавление

        if PURPORT_RX.match(line):
            in_purport = True
            continue

        if in_purport:
            cur["purport"].append(line)
        elif BENGALI.search(line):
            cur["bengali"].append(line)
        elif is_translit(line):
            cur["translit"].append(line)
        else:
            cur["translation"].append(line)

    if cur:
        verses.append(cur)

    out = []
    for v in verses:
        if v["khanda"] is None or v["chapter"] is None:
            continue                       # без адреса стих не вносим
        vid = "%s.%s.%d.%d" % (work, v["khanda"], v["chapter"], v["num"])
        out.append({
            "id": vid,
            "work_id": work,
            "division_id": "%s.%s.%d" % (work, v["khanda"], v["chapter"]),
            "ref": "%s %s %d.%d" % (abbr, KHANDA_RU[v["khanda"]].split("-")[0], v["chapter"], v["num"]),
            "ordinal": v["num"],
            "devanagari": "\n".join(v["bengali"]) or None,
            "translit": "\n".join(v["translit"]) or None,
            "translation": "\n".join(v["translation"]) or None,
            "purport": "\n".join(v["purport"]) or None,
        })
    return out


def main():
    path = SRC / "VrindavanaDasa_Chaitanya-Bhagavata.RU.txt"
    if not path.exists():
        raise SystemExit("::error::нет файла %s" % path)

    print("«Чайтанья-бхагавата» — сверка разбора с оглавлением:")
    vs, titles = parse_cb(path)
    with_tr = sum(1 for v in vs if v["translation"])
    with_pu = sum(1 for v in vs if v["purport"])
    print("\nстихов=%d  с переводом=%d  с комментарием Бхактисиддханты=%d"
          % (len(vs), with_tr, with_pu))

    out = ROOT / "build/cb-verses.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(vs, ensure_ascii=False), encoding="utf-8")
    print("→ %s" % out)

    if not os.environ.get("CLOUDFLARE_API_TOKEN"):
        print("нет токена — в базу не пишу (локальный прогон)")
        return 0

    load(vs, titles)
    return 0


# ── запись в D1 ──────────────────────────────────────────────────────────────
def ids():
    cfg = (ROOT / "apps" / "web" / "wrangler.toml").read_text(encoding="utf-8")
    a = re.search(r'account_id\s*=\s*"([^"]+)"', cfg).group(1)
    d = re.search(r'database_id\s*=\s*"([^"]+)"', cfg).group(1)
    return a, d


def d1(sql: str, params=None):
    acc, dbid = ids()
    tok = os.environ["CLOUDFLARE_API_TOKEN"]
    url = "https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query" % (acc, dbid)
    body = {"sql": sql}
    if params:
        body["params"] = params
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + tok,
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = json.load(r)
    except urllib.error.HTTPError as e:
        # ЗКН-Ц003: молча падать нельзя — скажи, ЧТО именно не так.
        detail = e.read().decode("utf-8", "replace")[:400]
        raise SystemExit("::error title=D1::HTTP %s — %s\n  SQL: %s"
                         % (e.code, detail, sql[:120]))
    if not out.get("success", True):
        raise SystemExit("::error title=D1::%s\n  SQL: %s"
                         % (json.dumps(out.get("errors"), ensure_ascii=False)[:300], sql[:120]))
    return out


# Названия глав из оглавления источника — чтобы читатель видел не «Глава 7»,
# а «Вишварупа принимает санньясу».
CHAPTERS = {
    "adi": ["Описание деяний Шри Чайтаньи", "Явление Золотого Господа", "Гороскоп Господа",
            "Церемония наречения именем. Детские игры и похищение Господа",
            "Нимай вкушает подношение странствующего брахмана",
            "Начальная школа и детские шалости Нимая", "Вишварупа принимает санньясу",
            "Уход Джаганнатхи Мишры",
            "Детские игры Нитьянанды и Его паломничество по святым местам",
            "Женитьба Господа на Лакшмиприе", "Встреча с Ишварой Пури",
            "Странствия Господа по Навадвипе", "Победа над великим ученым Кешавой",
            "Господь посещает Восточную Бенгалию. Уход Лакшмиприи",
            "Женитьба на Вишнуприе", "Величие Харидаса Тхакура",
            "Господь отправляется в Гаю"],
    "antya": ["Новая встреча в доме Адвайты Ачарьи",
              "Описание путешествий Господа по Бхуванешваре и другим местам",
              "Махапрабху освобождает Сарвабхауму, проявление шестирукой формы",
              "Описания игр Шри Ачьютананды и поклонение Шри Мадхавендре Пури",
              "Игры Нитьянанды Прабху", "Слава Нитьянанды",
              "Игры в саду Шри Гададхары",
              "Развлечения Махапрабху на озере Нарендра-саровара",
              "Слава Адвайты Прабху", "Слава Шри Пундарики Видьянидхи"],
}
KH_TITLE = {"adi": "Ади-кханда", "antya": "Антья-кханда"}


def load(vs, titles=None):
    """Пишем стихи пачками. Параметризовано — кавычки в тексте не ломают SQL."""
    titles = titles or {}
    # 1) издание
    d1("INSERT OR REPLACE INTO editions (id, work_id, lang, title, translator, source) "
       "VALUES ('cb-ru','cb','ru','Шри Чайтанья-бхагавата',"
       "'Комментарии Шрилы Бхактисиддханты Сарасвати','«Шри Гаурамрита»')")

    # 2) разделы: кханда → главы (с названиями из оглавления)
    for kh, titles in CHAPTERS.items():
        d1("INSERT OR REPLACE INTO divisions (id, work_id, parent_id, level, number, title, ordinal) "
           "VALUES (?,'cb',NULL,'division',?,?,?)",
           ["cb." + kh, kh, json.dumps({"ru": KH_TITLE[kh]}, ensure_ascii=False),
            str(1 if kh == "adi" else 3)])
        for i, t in enumerate(titles, 1):
            d1("INSERT OR REPLACE INTO divisions (id, work_id, parent_id, level, number, title, ordinal) "
               "VALUES (?,'cb',?,'chapter',?,?,?)",
               ["cb.%s.%d" % (kh, i), "cb." + kh, str(i),
                json.dumps({"ru": t}, ensure_ascii=False), str(i)])
    print("издание и %d разделов записаны" % (2 + sum(len(t) for t in CHAPTERS.values())))

    # ⚠️ ЛИМИТ D1: «too many SQL variables». У verses 6 полей на стих,
    # 40 стихов = 240 переменных — сверх предела. Держим ≤ 100 переменных:
    # 16 стихов × 6 = 96.
    B = 16
    total = 0
    for i in range(0, len(vs), B):
        chunk = vs[i:i + B]
        ph_v = ",".join(["(?,'cb',?,?,?,?,?,NULL,NULL)"] * len(chunk))
        pr_v = []
        for v in chunk:
            pr_v += [v["id"], v["division_id"], v["ref"], str(v["ordinal"]),
                     v["devanagari"] or "", v["translit"] or ""]
        d1("INSERT OR REPLACE INTO verses "
           "(id,work_id,division_id,ref,ordinal,devanagari,translit,uvaca,source_url) "
           "VALUES " + ph_v, pr_v)

        # verse_texts.id — INTEGER AUTOINCREMENT: свой id передавать НЕЛЬЗЯ.
        ph_t = ",".join(["(?,'cb-ru',?,?)"] * len(chunk))
        pr_t = []
        for v in chunk:
            pr_t += [v["id"], v["translation"] or "", v["purport"] or ""]
        d1("INSERT OR REPLACE INTO verse_texts (verse_id,edition_id,translation,purport) "
           "VALUES " + ph_t, pr_t)

        total += len(chunk)
        if (i // B) % 60 == 0:
            print("  ...%d/%d" % (total, len(vs)))

    r = d1("SELECT COUNT(*) AS n FROM verses WHERE work_id='cb'")
    n = r["result"][0]["results"][0]["n"]
    print("::notice title=CB::в базе стихов ЧБ: %d" % n)

    # ЗКН-Пр007: кнопка «читать» появляется ТОЛЬКО когда текст реально внесён
    d1("UPDATE book_catalog SET readable = 1 WHERE id = 'cb'")
    print("«Чайтанья-бхагавата» помечена читаемой (текст внесён)")


if __name__ == "__main__":
    sys.exit(main())
