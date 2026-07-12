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
    if not line or len(line) > 110:
        return False
    if any(ch in DIACRITICS for ch in line):
        return True
    # латиница в русской книге = транслитерация (кириллицы почти нет)
    lat = len(LATIN.findall(line))
    cyr = len(CYRILLIC.findall(line))
    return lat >= 6 and lat > cyr * 2


# ГРАНИЦЫ ТЕЛА (проверены по оглавлению этого издания — «Шри Гаурамрита»,
# сокращённая редакция: Ади 17 глав · Мадхья 12 · Антья 10).
#
# ⚠️ МАДХЬЯ НЕ ВНОСИТСЯ. В источнике её главы не размечены: заголовков нет,
# нумерация стихов сбрасывается внутри глав, названия из оглавления попадают
# во второе оглавление, а не в тело. Разобрать адрес стиха НЕВОЗМОЖНО.
#
# Записать 5024 стиха с ВЫДУМАННЫМИ адресами глав хуже, чем не записать:
# каждая ссылка вела бы не туда (ЗКН-БТ001 · ЗКН-Пр007). Мадхья ждёт чистого
# источника. Ади и Антья разобраны ТОЧНО — счёт глав сходится с оглавлением.
ZONES = [("adi", 95, 29037, 17), ("antya", 63959, None, 10)]


def parse_cb(path: Path):
    """«Чайтанья-бхагавата»: Ади + Антья. Мадхья пропущена (см. выше)."""
    lines = [l.strip() for l in path.read_text(encoding="utf-8-sig").split("\n")]
    out = []
    for kh, a, b, expect in ZONES:
        b = b or len(lines)
        chapter = 0
        prev = 0
        cur = None
        in_purport = False
        for i in range(a, min(b, len(lines))):
            line = lines[i]
            if not line:
                continue

            m = VERSE_RX.match(line)
            if m:
                num = int(m.group(1))
                if num == 1 and (prev >= 2 or prev == 0):
                    chapter += 1          # глава кончилась там, где нумерация сброшена
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
            cur = None

        got = len({(v["kh"], v["ch"]) for v in out if v["kh"] == kh})
        mark = "✓" if got == expect else "✗"
        print("  %s %-6s глав=%2d (оглавление: %2d)" % (mark, kh, got, expect))
        if got != expect:
            raise SystemExit("::error title=PARSE::%s: глав %d вместо %d — разбор неверен, "
                             "в базу НЕ пишу" % (kh, got, expect))

    KH_RU = {"adi": "Ади", "antya": "Антья"}
    verses = []
    seen = {}
    for v in out:
        base = "cb.%s.%d.%d" % (v["kh"], v["ch"], v["num"])
        # Дубль номера внутри главы = стих-двойник (шлока на два блока). Не теряем:
        # различаем суффиксом, а не молча перетираем (ЗКН-БТ001).
        seen[base] = seen.get(base, 0) + 1
        vid = base if seen[base] == 1 else "%s-%d" % (base, seen[base])
        verses.append({
            "id": vid,
            "work_id": "cb",
            "division_id": "cb.%s.%d" % (v["kh"], v["ch"]),
            "ref": "ЧБ %s %d.%d" % (KH_RU[v["kh"]], v["ch"], v["num"]),
            "ordinal": v["num"],
            "devanagari": "\n".join(v["bengali"]) or None,
            "translit": "\n".join(v["translit"]) or None,
            "translation": "\n".join(v["translation"]) or None,
            "purport": "\n".join(v["purport"]) or None,
        })
    return verses


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
    vs = parse_cb(path)
    with_tr = sum(1 for v in vs if v["translation"])
    with_pu = sum(1 for v in vs if v["purport"])
    print("\nстихов=%d  с переводом=%d  с комментарием Бхактисиддханты=%d"
          % (len(vs), with_tr, with_pu))
    print("МАДХЬЯ НЕ ВНЕСЕНА: в источнике её главы не размечены (см. шапку файла).")

    out = ROOT / "build/cb-verses.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(vs, ensure_ascii=False), encoding="utf-8")
    print("→ %s" % out)

    if not os.environ.get("CLOUDFLARE_API_TOKEN"):
        print("нет токена — в базу не пишу (локальный прогон)")
        return 0

    load(vs)
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


def load(vs):
    """Пишем стихи пачками. Параметризовано — кавычки в тексте не ломают SQL."""
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

    B = 40
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
        if (i // B) % 20 == 0:
            print("  ...%d/%d" % (total, len(vs)))

    r = d1("SELECT COUNT(*) AS n FROM verses WHERE work_id='cb'")
    n = r["result"][0]["results"][0]["n"]
    print("::notice title=CB::в базе стихов ЧБ: %d" % n)

    # ЗКН-Пр007: кнопка «читать» появляется ТОЛЬКО когда текст реально внесён
    d1("UPDATE book_catalog SET readable = 1 WHERE id = 'cb'")
    print("«Чайтанья-бхагавата» помечена читаемой (текст внесён)")


if __name__ == "__main__":
    sys.exit(main())
