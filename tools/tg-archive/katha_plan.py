#!/usr/bin/env python3
"""
katha_plan.py — КАРТА ЗАЛИВКИ катхи: разведка каналов → альбомы, имена файлов, названия.

═══ ПОЧЕМУ КАРТА ОТДЕЛЬНО ОТ ЗАЛИВКИ ═══

Имя файла в канале — это не название лекции. Там имя лектора, подчёркивания,
кириллица и латиница вперемешку, даты внутри имени:

    «Радха_Говинда_Свами_Вопросы_Парикшита_1.mp3»
    «Шрила_Прабхупада_30_12_1974_Бомбей.mp3»      ← имя обрезано на первом слове места

Такое имя нельзя ни положить в archive.org (кириллица в URL), ни показать
человеку. Поэтому карта строится ОТДЕЛЬНЫМ ШАГОМ, её результат КОММИТИТСЯ в
репозиторий и его видно глазами ДО того, как 28 ГБ уедут в архив. Заливка потом
только исполняет карту — гадать ей не о чем (ЗКН-Пл010).

    файл в архиве:  sb-01-16-03-1973-12-31.mp3   латиница, сортируется стихом
    название:       «1.16.3 · Вы можете видеть Бога»
    альбом:         «Шримад-Бхагаватам · Песнь Первая»

═══ ИСТОЧНИКОВ НЕСКОЛЬКО ═══

Раньше файл знал ровно один канал и одного рассказчика — они были вписаны в
константы. Второй рассказчик потребовал бы копию файла, а копия расходится с
оригиналом на первой же правке. Теперь канал — СТРОКА РЕЕСТРА `SOURCES`, и у
каждого свой разборщик: разметка у каналов разная и общей она не станет.

Вход:  docs/diagnostics/katha-probe-<slug>.json  (katha_probe.py)
Выход: tools/tg-archive/katha_plan.json
Запуск: python katha_plan.py            (--check — только проверить, не писать)
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
DIAG = HERE.parent.parent / "docs" / "diagnostics"
OUT = HERE / "katha_plan.json"

MONTHS = {
    1: "января", 2: "февраля", 3: "марта", 4: "апреля", 5: "мая", 6: "июня",
    7: "июля", 8: "августа", 9: "сентября", 10: "октября", 11: "ноября", 12: "декабря",
}

# ═════════════════════════ ОБЩЕЕ ═════════════════════════

# ЛАТИНСКИЕ БУКВЫ ВНУТРИ РУССКИХ СЛОВ. В канале Прабхупады их 14 штук: «Речь пo
# прибытию» (o латинская), «Шри Ишопанишaд» (a латинская), «40 pупий». Глазом не
# видно, а поиск по слову молча не находит запись. Меняем ТОЛЬКО в словах, где
# уже есть кириллица: «KPFK» должно остаться собой.
HOMOGLYPH = str.maketrans({
    "a": "а", "c": "с", "e": "е", "o": "о", "p": "р", "x": "х", "y": "у",
    "A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н", "K": "К", "M": "М",
    "O": "О", "P": "Р", "T": "Т", "X": "Х", "Y": "У",
})
CYR = re.compile(r"[а-яА-ЯёЁ]")


def fix_homoglyphs(s: str) -> str:
    out = []
    for tok in re.split(r"(\s+)", s):
        out.append(tok.translate(HOMOGLYPH) if CYR.search(tok) else tok)
    return "".join(out)


def ru_date(d: int, mo: int, y: int) -> str:
    """«31 декабря 1973». Нули в канале значат «неизвестно» — их не показываем."""
    if not y:
        return ""
    if not mo:
        return str(y)
    if not d:
        return "%s %d" % (MONTHS[mo], y)
    return "%d %s %d" % (d, MONTHS[mo], y)


def title_line(*parts: str) -> str:
    """Строка очереди однострочная — собираем её из непустых кусков через « · »."""
    return " · ".join(p for p in parts if p)


# ═════════════ ИСТОЧНИК 1 · @radhagovindasw ═════════════
# Разметки в метаданных нет вовсе (title/performer пусты у всех 42), альбом
# узнаётся по слову-метке в имени файла — канал держит его строго.
RGS_ALBUMS = [
    {"id": "parikshit-questions", "title": "Вопросы Махараджа Парикшита",
     "identifier": "iskcone-katha-rgs-parikshit-questions", "file": "parikshit-questions",
     "match": "Вопросы_Парикшита"},
    {"id": "vritrasura-katha", "title": "Вритрасура-катха",
     "identifier": "iskcone-katha-rgs-vritrasura", "file": "vritrasura",
     "match": "Вритрасура"},
    {"id": "aghasura-katha", "title": "Агхасура-катха",
     "identifier": "iskcone-katha-rgs-aghasura", "file": "aghasura",
     "match": "Вриндаван", "dated": True},
    {"id": "janma-lila", "title": "Джанма-лила",
     "identifier": "iskcone-katha-rgs-janma-lila", "file": "janma-lila",
     "match": "Джанма"},
    {"id": "ajamila-katha", "title": "Аджамила-катха",
     "identifier": "iskcone-katha-rgs-ajamila", "file": "ajamila",
     "match": "Аджамила"},
    {"id": "gopi-gita", "title": "Гопи-гита",
     "identifier": "iskcone-katha-rgs-gopi-gita", "file": "gopi-gita",
     "match": "Гопи"},
]

DATE_RX = re.compile(r"(\d{1,2})[._](\d{1,2})[._](20\d\d)")


def rgs_parts(stem: str):
    """Номер лекции и — если она разбита — номер куска. «Аджамила_катха_2_1» → (2, 1).

    ⚠️ ДАТУ ВЫРЕЗАЕМ ПЕРВОЙ. «…Вриндаван_24_10_2015» давал (1, 24): день месяца
    вставал вторым номером и превращался в «Часть 1 · 24», а файл — в
    `aghasura-01-24.mp3`. Число в имени не значит «номер»; сперва убираем то,
    что заведомо не номер.
    """
    s = DATE_RX.sub(" ", stem)
    nums = [int(x) for x in re.findall(r"(?<![\d.])(\d{1,3})(?![\d])", s) if int(x) <= 60]
    if not nums:
        return None, None
    return nums[0], (nums[1] if len(nums) > 1 else None)


def rgs_date(stem: str):
    m = DATE_RX.search(stem)
    if not m:
        return None
    return ru_date(int(m.group(1)), int(m.group(2)), int(m.group(3)))


def build_rgs(audio):
    plan, used = [], set()
    for al in RGS_ALBUMS:
        rows = [m for m in audio
                if al["match"] in (m.get("file_name") or "") and m["msg_id"] not in used]
        rows.sort(key=lambda m: m["msg_id"])
        tracks = []
        for i, m in enumerate(rows, 1):
            used.add(m["msg_id"])
            stem = re.sub(r"\.mp3$", "", m["file_name"] or "", flags=re.I)
            n, sub = rgs_parts(re.sub(r"^Радха[ _]Говинда[ _]Свами[ _\-]*", "", stem))
            if not n or n > len(rows) + 6:
                n, sub = i, None
            title = "Часть %d" % n
            if sub:
                title += " · %d" % sub
            if al.get("dated"):
                d = rgs_date(stem)
                if d:
                    title += " · %s" % d
            fname = "%s-%02d%s.mp3" % (al["file"], n, "-%d" % sub if sub else "")
            tracks.append({"msg_id": m["msg_id"], "file": fname, "title": title,
                           "duration": m.get("duration") or 0, "size": m.get("size") or 0,
                           "source": m.get("file_name")})
        tracks.sort(key=lambda t: t["file"])
        for i, t in enumerate(tracks, 1):
            t["sort"] = i
        plan.append({"id": al["id"], "title": al["title"], "identifier": al["identifier"],
                     "tracks": tracks})
    orphans = [m.get("file_name") for m in audio if m["msg_id"] not in used]
    return plan, orphans


# ═════════════ ИСТОЧНИК 2 · @prabhupada_katha ═════════════
#
# Канал размечен образцово — вся разметка лежит в поле title:
#
#     «31.12.1973 - Лос-Анджелес - ШБ 01.16.03 - Вы можете видеть Бога»
#      ↑дата        ↑место         ↑писание      ↑тема
#
# Отсюда и структура: АЛЬБОМ = книга (у «Шримад-Бхагаватам» — песнь, как в самой
# книге), ДОРОЖКА = стих + тема. Место и дата — архивный штемпель: он встаёт
# туда, где темы нет.
#
# ⚠️ ТЕМА В КАНАЛЕ ОБРЕЗАНА У 340 ЗАПИСЕЙ («Деградация брахманов начинает…»).
# Обрезанную не показываем: оборванная фраза в списке хуже отсутствующей. На её
# место встаёт штемпель — он всегда полон.

PLACES = {
    "нью йорк": "Нью-Йорк", "нью-йорк": "Нью-Йорк", "ньюйорк": "Нью-Йорк",
    "лос анджелес": "Лос-Анджелес", "лос-анджелес": "Лос-Анджелес",
    "сан франциско": "Сан-Франциско", "сан-франциско": "Сан-Франциско",
    "майапур": "Маяпур", "майяпур": "Маяпур", "маяпур": "Маяпур", "майапура": "Маяпур",
    "хайдарабад": "Хайдарабад", "хайдерабад": "Хайдарабад",
    "нью-дели": "Нью-Дели", "нью дели": "Нью-Дели",
    "нью вриндаван": "Нью-Вриндаван", "нью-вриндаван": "Нью-Вриндаван",
    "неизвестно": "", "неизвестрно": "", "?": "", "": "",
}

# Опечатки канала. Правим ТОЛЬКО служебную разметку — по ней сходятся альбомы.
# Тему (чужой голос, ЗКН-БТ004) не переписываем.
TYPOS = [
    (r"Утрен+[ия]+[ея]\s+прогулк\w*", "Утренние прогулки"),
    (r"Утренние\s+прогулк\w*", "Утренние прогулки"),
    (r"Утренняя\s+прогулк\w*", "Утренние прогулки"),
    (r"\bШ\.Б\b", "ШБ"),
    (r"\bЛекцияна\b", "Лекция на"),
    (r"\bМадхйа\b", "Мадхья"),
    (r"\bАди[ -]Лила\b", "Ади-лила"),
    (r"\bМадхья[ -]Лила\b", "Мадхья-лила"),
    (r"\bАнтйа[ -]Лила\b", "Антья-лила"),
    (r"\bАнтья[ -]Лила\b", "Антья-лила"),
    (r"\bПресс\s+конференц", "Пресс-конференц"),
    (r"\bпосвещени", "посвящени"),
    (r"\bРепорёр", "Репортёр"),
    (r"\bоткытия\b", "открытия"),
    (r"\bзачитаный\b", "зачитанный"),
    (r"\bСиетл\b", "Сиэтл"),
    (r"\bпрограма\b", "программа"),
    (r"\bпрограмаt\b", "программа"),
    (r"\bпрограме\b", "программе"),
]

SP_ALBUMS = {
    "bg": {"title": "Бхагавад-гита как она есть", "identifier": "iskcone-katha-sp-bg", "file": "bg"},
    "cc": {"title": "Шри Чайтанья-чаритамрита", "identifier": "iskcone-katha-sp-cc", "file": "cc"},
    "nod": {"title": "Нектар преданности", "identifier": "iskcone-katha-sp-nod", "file": "nod"},
    "iso": {"title": "Шри Ишопанишад", "identifier": "iskcone-katha-sp-iso", "file": "iso"},
    "walks": {"title": "Утренние прогулки", "identifier": "iskcone-katha-sp-walks", "file": "walk"},
    "talks": {"title": "Беседы", "identifier": "iskcone-katha-sp-talks", "file": "talk"},
    "festivals": {"title": "Праздники и дни явления",
                  "identifier": "iskcone-katha-sp-festivals", "file": "festival"},
    "lectures": {"title": "Лекции и выступления",
                 "identifier": "iskcone-katha-sp-lectures", "file": "lecture"},
    "interviews": {"title": "Интервью и пресс-конференции",
                   "identifier": "iskcone-katha-sp-interviews", "file": "interview"},
}
SP_ORDER = ["sb-%02d" % c for c in range(1, 13)] + [
    "bg", "cc", "iso", "nod", "walks", "talks", "lectures", "festivals", "interviews"]

CANTO_RU = {1: "Первая", 2: "Вторая", 3: "Третья", 4: "Четвёртая", 5: "Пятая",
            6: "Шестая", 7: "Седьмая", 8: "Восьмая", 9: "Девятая", 10: "Десятая",
            11: "Одиннадцатая", 12: "Двенадцатая"}

WALK_RX = re.compile(r"Утренние\s+прогулки", re.I)
INTERVIEW_RX = re.compile(r"Интервью|Пресс[- ]?конференц|Радио", re.I)
FESTIVAL_RX = re.compile(
    r"Гаура[- ]Пурнима|Джанмаштами|Нрисимха|Ратха|Говардхана|Вьяса[- ]?пуджа|"
    r"явлени|Уход\b|ухода\b|Радха[- ]Ятра|Инициация", re.I)
TALK_RX = re.compile(r"Бесед", re.I)
LECTURE_RX = re.compile(
    r"Лекция|Речь|Выступление|Обращение|програм|Публичн|Даршан|Ответы\s+на|"
    r"Комментарий|Описание|прибыти", re.I)


def num(s: str):
    s = (s or "").strip().lstrip("0") or "0"
    return int(s) if s.isdigit() else None


def head_num(s: str) -> int:
    return num(re.split(r"[–\-]", str(s or ""))[0]) or 0


def parse_ref(field: str):
    """«ШБ 01.16.03» → ('sb', ключ сортировки, «1.16.3»). Не писание → (None, …)."""
    f = (field or "").strip()

    m = re.match(r"^ШБ\s*(\d{1,2})[.\s]*(\d{1,2}|xx)?[.\s]*([\d\-–]{1,9}|xx)?", f, re.I)
    if m and m.group(1):
        c = num(m.group(1)) or 0
        ch = num(m.group(2)) if (m.group(2) or "").isdigit() else 0
        vs = (m.group(3) or "").replace("-", "–") if (m.group(3) or "").lower() != "xx" else ""
        show = ".".join(str(x) for x in (c, ch) if x)
        if vs and show:
            show += "." + "–".join(p.lstrip("0") or "0" for p in vs.split("–"))
        return "sb", (c, ch, head_num(vs)), show

    m = re.match(r"^БГ\s*(\d{1,2})[.\s]*([\d\-–]{1,9})?", f, re.I)
    if m and m.group(1):
        ch = num(m.group(1)) or 0
        vs = (m.group(2) or "").replace("-", "–")
        show = (str(ch) + ("." + "–".join(p.lstrip("0") or "0" for p in vs.split("–")) if vs else "")
                ) if ch else ""
        return "bg", (ch, head_num(vs)), show

    m = re.match(r"^ЧЧ\s*(Ади|Мадхья|Антья)[- ]?лила\s*([\d.\-–]*)", f, re.I)
    if m:
        lila = {"ади": "Ади-лила", "мадхья": "Мадхья-лила", "антья": "Антья-лила"}[m.group(1).lower()]
        vs = (m.group(2) or "").replace("-", "–").strip(".")
        show = ".".join("–".join(x.lstrip("0") or "0" for x in g.split("–"))
                        for g in vs.split(".")) if vs else ""
        order = {"Ади-лила": 1, "Мадхья-лила": 2, "Антья-лила": 3}[lila]
        return "cc", (order, head_num(vs), vs), title_line(lila, show)

    if re.match(r"^НП\b", f, re.I):
        pg = num((re.findall(r"\d+", f) or [""])[0])
        return "nod", (pg or 0,), ("стр. %d" % pg if pg else "")

    m = re.match(r"^Шри\s+Ишопанишад\s*([\d\-–]*)", f, re.I)
    if m:
        vs = (m.group(1) or "").replace("-", "–")
        return "iso", (head_num(vs),), ("мантра " + vs if head_num(vs) else "Обращение")

    if re.match(r"^ШБ\b", f, re.I):
        return "sb", (0, 0, 0), ""
    if re.match(r"^БГ\b", f, re.I):
        return "bg", (0, 0), ""

    m = re.match(r"^(\d{2})\.(\d{2})\.(\d{2})$", f)          # голая ссылка «02.03.22»
    if m:
        c, ch, v = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return "sb", (c, ch, v), "%d.%d.%d" % (c, ch, v)
    return None, None, ""


def build_prabhupada(audio):
    """Разбор канала: title → альбом + название + имя файла. Гадать не о чем."""
    buckets, orphans = {}, []

    for m in audio:
        raw = fix_homoglyphs((m.get("title") or "").strip())
        for rx, to in TYPOS:
            raw = re.sub(rx, to, raw)
        parts = [p.strip() for p in raw.split(" - ")]
        dm = re.match(r"^(\d{2})\.(\d{2})\.(\d{4})$", parts[0] if parts else "")
        if dm:
            d, mo, y = int(dm.group(1)), int(dm.group(2)), int(dm.group(3))
            rest = parts[1:]
        else:
            d = mo = y = 0
            rest = parts
        place = PLACES.get((rest[0] if rest else "").lower(), (rest[0] if rest else ""))
        body = rest[1:]
        field = body[0] if body else ""
        theme = " — ".join(x for x in body[1:] if x)

        # обрезанное каналом не показываем — вместо него встанет штемпель
        if "…" in theme:
            theme = ""
        theme = theme.replace("…", "").strip(" -·")
        book, key, ref = parse_ref(field)
        stamp = title_line(ru_date(d, mo, y), place)

        if book:
            album_id = ("sb-%02d" % key[0]) if book == "sb" else book
            title = title_line(ref, theme or stamp) or stamp or "Запись"
            if book == "sb":
                sortkey = (key[0], key[1], key[2], y, mo, d)
                fbase = "sb-%02d-%02d-%03d" % (key[0], key[1], key[2])
            elif book == "bg":
                sortkey = (key[0], key[1], y, mo, d)
                fbase = "bg-%02d-%03d" % (key[0], key[1])
            elif book == "cc":
                sortkey = (key[0], key[1], y, mo, d)
                fbase = "cc-%d-%s" % (key[0], re.sub(r"[^\d]+", "-", key[2]).strip("-") or "00")
            else:
                sortkey = (key[0], y, mo, d)
                fbase = "%s-%03d" % (SP_ALBUMS[book]["file"], key[0])
            if y:
                fbase += "-%04d-%02d-%02d" % (y, mo, d)
        else:
            blob = title_line(field, theme) or field
            if WALK_RX.search(blob):
                album_id = "walks"
            elif INTERVIEW_RX.search(blob):
                album_id = "interviews"
            elif FESTIVAL_RX.search(blob):
                album_id = "festivals"
            elif TALK_RX.search(blob):
                album_id = "talks"
            else:
                # Содержательного поля нет вовсе — «00.00.1966 - Неизвестно». Это
                # ТРИ ЗАПИСИ ПРАБХУПАДЫ, и выбросить их за неполноту разметки
                # нельзя: неизвестно, о чём лекция, — но известно, что она есть.
                album_id = "lectures"
            # тип уже назван альбомом — в строке остаётся дата, место и о чём речь
            head = re.sub(WALK_RX, "", field).strip(" -·")
            head = re.sub(r"^(Беседа|Лекция|Речь|Интервью)\b[ \-–]+(?=[А-ЯЁ])", "", head).strip(" -·")
            head = "" if "…" in head else head
            title = title_line(stamp, head, theme) or "Запись"
            sortkey = (y or 9999, mo, d, m["msg_id"])
            fbase = SP_ALBUMS[album_id]["file"] + (
                "-%04d-%02d-%02d" % (y, mo, d) if y else "-undated-%05d" % m["msg_id"])

        buckets.setdefault(album_id, []).append({
            "msg_id": m["msg_id"], "_sort": list(sortkey), "_base": fbase, "title": title,
            "duration": m.get("duration") or 0, "size": m.get("size") or 0,
            "source": m.get("title"),
        })

    plan = []
    for aid in SP_ORDER:
        rows = buckets.pop(aid, None)
        if not rows:
            continue
        if aid.startswith("sb-"):
            c = int(aid.split("-")[1])
            title = "Шримад-Бхагаватам · Песнь %s" % CANTO_RU.get(c, str(c))
            identifier = "iskcone-katha-sp-sb-%02d" % c
        else:
            title, identifier = SP_ALBUMS[aid]["title"], SP_ALBUMS[aid]["identifier"]
        rows.sort(key=lambda r: (r["_sort"], r["msg_id"]))
        seen = {}
        for i, r in enumerate(rows, 1):
            n = seen.get(r["_base"], 0) + 1
            seen[r["_base"]] = n
            r["file"] = r.pop("_base") + ("" if n == 1 else "-%d" % n) + ".mp3"
            r["sort"] = i
            r.pop("_sort")
        plan.append({"id": aid, "title": title, "identifier": identifier, "tracks": rows})
    for rows in buckets.values():                    # альбом вне порядка — не теряем
        orphans.extend(r["title"] for r in rows)
    return plan, orphans


# ═════════════════════════ РЕЕСТР ═════════════════════════
SOURCES = [
    # ЗКН-И004: в приложении — каноническая краткая форма имени. Полусокращённая
    # «А.Ч. Бхактиведанта Свами» запрещена: это ни полный титул, ни краткая форма.
    {"channel": "@prabhupada_katha", "speaker": "prabhupada",
     "speaker_name": "Шрила Прабхупада",
     "probe": "katha-probe-prabhupada.json", "build": build_prabhupada},
    {"channel": "@radhagovindasw", "speaker": "radha-govinda-goswami",
     "speaker_name": "Радха Говинда Госвами Махарадж",
     "probe": "katha-probe-radhagovindasw.json", "build": build_rgs},
]


def main() -> int:
    check = "--check" in sys.argv
    sources, albums, n_audio, n_orphans = [], [], 0, 0
    for src in SOURCES:
        p = DIAG / src["probe"]
        if not p.exists():
            print("::warning::нет разведки: %s" % p)
            continue
        ch = json.loads(p.read_text(encoding="utf-8"))["channels"][0]
        audio = [m for m in ch["messages"] if m.get("audio")]
        plan, orphans = src["build"](audio)
        n_audio += len(audio)
        n_orphans += len(orphans)
        for a in plan:
            a.update({"speaker": src["speaker"], "speaker_name": src["speaker_name"],
                      "channel": src["channel"], "n": len(a["tracks"])})
        albums.extend(plan)
        sources.append({"channel": src["channel"], "speaker": src["speaker"],
                        "speaker_name": src["speaker_name"], "n_audio": len(audio),
                        "n_planned": sum(a["n"] for a in plan), "orphans": orphans})
        print("── %s · %s" % (src["channel"], src["speaker_name"]))
        for a in plan:
            print("   %-16s %4d  %s" % (a["id"], a["n"], a["title"]))
        if orphans:
            print("::warning::вне альбомов %d: %s" % (len(orphans), orphans[:4]))

    total = sum(a["n"] for a in albums)
    names = [t["file"] for a in albums for t in a["tracks"]]
    dups = sorted({x for x in names if names.count(x) > 1})
    bad = [t["title"] for a in albums for t in a["tracks"] if "…" in t["title"] or not t["title"]]
    print("\nальбомов: %d · записей: %d из %d · вне альбомов: %d · дублей имён: %d · кривых названий: %d"
          % (len(albums), total, n_audio, n_orphans, len(dups), len(bad)))
    if dups:
        print("::error::дубли имён: %s" % dups[:6])
    if bad:
        print("::error::кривые названия: %s" % bad[:6])
    if not check:
        OUT.write_text(json.dumps({"sources": sources, "n_audio": n_audio,
                                   "n_planned": total, "albums": albums},
                                  ensure_ascii=False, indent=1), encoding="utf-8")
    return 1 if (dups or bad or n_orphans) else 0


if __name__ == "__main__":
    raise SystemExit(main())
