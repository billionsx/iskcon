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


MONTHS_NOM = ["", "январь", "февраль", "март", "апрель", "май", "июнь",
              "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]


def ru_date(d: int, mo: int, y: int) -> str:
    """«31 декабря 1973». Нули в канале значат «неизвестно» — их не показываем."""
    if not y:
        return ""
    if not mo:
        return str(y)
    if not d:
        # ⚠️ «октября 1966» — это обрубок: родительный падеж просит числа («12 октября»).
        # Без числа месяц обязан стоять в ИМЕНИТЕЛЬНОМ: «октябрь 1966».
        return "%s %d" % (MONTHS_NOM[mo], y)
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
    # Имена ачарьев — КАНОН приложения, а не тема. Написание держит
    # docs/STANDARD_canonical_names.md: подпись под записью в этом приложении
    # не может звать основателя гаудия-матхов иначе, чем зовут его книги.
    (r"Бхакти\s*Сидханты\s+Госвами\s+Прабхупады", "Шрилы Бхактисиддханты Сарасвати Тхакура"),
    (r"Бхакти\s*Сидханта\s+Госвами\s+Прабхупада", "Шрила Бхактисиддханта Сарасвати Тхакур"),
    (r"\bРАДХАШТАМИ\b", "Радхаштами"),
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
        # ⚠️ У «Мадхья-лилы» канал пишет ТРИ числа: «8.20.144-146». Первое —
        # ВСЕГДА 8 (64 записи из 64) и никакая это не глава: в Мадхья-лиле главы
        # 20–22, и это в точности нью-йоркский цикл наставлений Санатане 1966 года.
        # «8» — метка серии канала. Оставить её значило бы дать читателю ложную
        # ссылку на писание. Отбрасываем — но лишь когда за ней стоит правдоподобная
        # глава, иначе молчим и показываем как есть.
        # Метку серии убираем ТОЛЬКО из показа. Имя файла и порядок строятся из
        # исходного `vs`: под этими именами записи уже лежат в архиве, и переименование
        # означало бы перезалив гигабайтов и двойники в плеере. Файл — служебный
        # идентификатор, человек его не видит; видит он ссылку на писание.
        vs_show = vs
        pr = vs.split(".")
        if lila == "Мадхья-лила" and len(pr) == 3 and pr[0].lstrip("0") == "8" and 1 <= num(pr[1]) <= 25:
            vs_show = ".".join(pr[1:])
        show = ".".join("–".join(x.lstrip("0") or "0" for x in g.split("–"))
                        for g in vs_show.split(".")) if vs_show else ""
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


# ══════════════ @purnacandragoswami · Пурначандра Госвами ══════════════
PCG_ALBUMS = [
    {"id": "sochi-1997", "file": "sochi-1997", "title": "Сочи · 1997", "year": "1997",
     "note": "Первые записи канала: «Бхагавад-гита», «Шримад-Бхагаватам», предание.",
     "msgs": [42, 43, 44, 45, 46, 47, 49, 50, 72, 71], "dated": True, "strip": ("Сочи",)},

    {"id": "ishopanishad", "file": "ishopanishad", "title": "Шри Ишопанишад", "year": "1997",
     "note": "Полный цикл: введение, парибхаша-сутра и все шестнадцать мантр.",
     "msgs": list(range(53, 71)), "dated": False},

    {"id": "upadeshamrita", "file": "upadeshamrita", "title": "Упадешамрита", "year": "1998",
     "note": "Полный цикл по «Нектару наставлений» Шрилы Рупы Госвами.",
     "msgs": list(range(74, 90)), "dated": False},

    {"id": "brihad-bhagavatamrita", "file": "brihad-bhagavatamrita",
     "title": "Брихад-Бхагаватамрита", "year": "1998",
     "note": "Десять лекций по «Брихад-Бхагаватамрите» Шрилы Санатаны Госвами.",
     "msgs": list(range(91, 101)), "dated": False},

    {"id": "names-of-the-lord", "file": "names-of-the-lord",
     "title": "Имена Господа · Брихад-Бхагаватамрита", "year": "2004",
     "note": "Бхаума-нама, дивья-нама, прапанчатита-нама, бхакта-нама, прия-нама, приятама-нама, пурна-нама.",
     "msgs": list(range(104, 113)), "dated": False},

    {"id": "prema-bhakti-chandrika", "file": "prema-bhakti-chandrika",
     "title": "Према-бхакти-чандрика · Одесса", "year": "2005",
     "note": "Цикл по «Према-бхакти-чандрике» Шрилы Нароттамы даса Тхакура.",
     "msgs": list(range(134, 139)), "dated": False},

    {"id": "krishna-lila", "file": "krishna-lila", "title": "Кришна Лила", "year": "1998–2010",
     "note": "Повествования о играх Господа: ягьяпатни, Тринаварта, Калия, Дамодара, раса-лила.",
     "msgs": [101, 102, 118, 119, 120, 121, 122, 123, 124,
              261, 262, 263, 264, 345, 346, 347, 368, 369, 370, 371], "dated": True},

    {"id": "vraja-lila-odessa", "file": "vraja-lila-odessa",
     "title": "Враджа-лила · Одесский фестиваль", "year": "2004",
     "note": "Фестивальный цикл в Одессе.", "msgs": [114, 115, 116, 117], "dated": False},

    {"id": "heart-opening", "file": "heart-opening", "title": "Открытие сердца · Одесса",
     "year": "1999", "note": "О любви и доверии, о препятствиях на пути преданного служения.",
     "msgs": [188, 189, 190, 191], "dated": False},

    {"id": "divine-love", "file": "divine-love", "title": "Основы божественной любви",
     "year": "2006", "note": "Шестидневный семинар.", "msgs": list(range(140, 146)), "dated": True},

    {"id": "odessa-festival", "file": "odessa-festival", "title": "Фестиваль в Одессе",
     "year": "2003", "note": "Джапа, культура, плач о Кришне, сражение с грехами.",
     "msgs": [225, 226, 227, 228], "dated": False},

    {"id": "japa-workshop", "file": "japa-workshop", "title": "Мастерская джапы",
     "year": "1997–2008", "note": "Все мастерские джапы канала — от Сочи до Ахтубы.",
     "msgs": [48, 187, 162, 185, 231, 232, 233, 234, 235, 274, 532], "dated": True},

    {"id": "prabhupada-katha", "file": "prabhupada-katha", "title": "Прабхупада-катха",
     "year": "2002–2010", "note": "Воспоминания о Шриле Прабхупаде и отрывки из фильмов о нём.",
     "msgs": [194, 229, 256, 257, 258, 147, 148, 149, 150, 151, 154, 275,
              277, 278, 279, 280, 281, 282, 283, 333, 359, 362, 363, 364, 385], "dated": True},

    {"id": "russia-yatra", "file": "russia-yatra", "title": "Ятра по России · Урал и Поволжье",
     "year": "2002", "note": "Курган, Уфа, Стерлитамак, Кумертау, Златоуст, Челябинск, Екатеринбург, Нижний Тагил, Пермь, Березники, Суздаль.",
     "msgs": [192, 193] + list(range(195, 223)), "dated": True},

    {"id": "akhtuba", "file": "akhtuba", "title": "Шримад-Бхагаватам · Ахтуба", "year": "2008",
     "note": "Цикл по первой песни «Шримад-Бхагаватам».",
     "msgs": [267, 268, 269, 270, 271, 272, 273], "dated": False, "strip": ("Ахтуба",)},

    {"id": "vrindavan-parikrama", "file": "vrindavan-parikrama", "title": "Вриндаван-парикрама",
     "year": "2008–2009", "note": "Святые места Враджа: Калия-гхата, Говардхан, Радха-кунда, Кусум-саровара.",
     "msgs": list(range(285, 296)) + [326, 327, 328, 329, 330, 331, 332, 334, 335, 336,
                                      337, 338, 339, 340, 341, 342, 343, 344], "dated": True, "fallback": "Парикрама"},

    {"id": "perm-2001", "file": "perm-2001", "title": "Пермь · 2001", "year": "2001",
     "note": "Воскресная программа и цикл по третьей песни «Шримад-Бхагаватам».",
     "msgs": list(range(418, 424)), "dated": False, "strip": ("Пермь",)},
]

# Хвосты — лекции, не входящие в циклы. Собираются по году записи.
PCG_BUCKETS = [
    ("lectures-2003-2005", "Лекции · 2003–2005", "2003–2005", (2003, 2005)),
    ("lectures-2007", "Лекции · 2007", "2007", (2007, 2007)),
    ("lectures-2008", "Лекции · 2008", "2008", (2008, 2008)),
    ("lectures-2009-2010", "Лекции · 2009–2010", "2009–2010", (2009, 2010)),
]

# Киртаны и бхаджаны — не катха. В карту катхи не попадают (см. отчёт скрипта).
PCG_KIRTAN_FROM = 454

# ═══════════════════════════ ИМЕНА ═══════════════════════════
# Двойники канала: одна и та же запись выложена дважды под разными именами
# (совпадают и размер, и длительность до байта и секунды). Оставляем ту, что
# стоит на своём месте в цикле, вторую выбрасываем — иначе плеер играет одно и
# то же подряд.
PCG_DROP = {155, 156, 157, 153, 154, 259, 165}
PCG_FORCE = {158: "lectures-2007"}          # запись без даты в имени — вручную

PCG_DATE_HEAD = re.compile(r"^\s*((?:19|20)?\d\d)[._](\d\d)[._](\d\d)[\s_.-]*")
PCG_DATE_TAIL = re.compile(r"[\s_](\d\d)[._](\d\d)[._](\d\d)\s*$")

# Сокращения канала → полное имя писания (ЗКН-С001).
PCG_EXPAND = [
    (r"HG Purnacandra Prabhu\s*-\s*Osnovi Bozjestvennoj lubvi", "Лекция"),
    (r"ПУРНАЧАНДРА[ _]ПР[ _.]*", ""), (r"Пурначандра[ _]Пр[ _.]*№?\s*\d*[ _]*", ""),
    (r"\bЕ[.\s]?С[.\s]+Пурначандра\s+Госвами\b", ""), (r"\bЕС Пурначандра Госвами\b", ""),
    (r"\bКришна[ _]бук[ _]глава[ _]?", "«Кришна», глава "),
    (r"\bБ\.?\s?Г\.?", "Бхагавад-гита"), (r"\bБГ\b", "Бхагавад-гита"),
    (r"\bБхагавад\s+Гита\b", "Бхагавад-гита"), (r"\bB\.?\s?G\.?\b", "Бхагавад-гита"),
    (r"\bШ\.?\s?Б\.?", "Шримад-Бхагаватам"), (r"\bШБ\b", "Шримад-Бхагаватам"),
    (r"\bSB\b", "Шримад-Бхагаватам"),
    (r"\bЧЧ\b", "Чайтанья-чаритамрита"), (r"\bЧайтанья\s+Чаритамрита\b", "Чайтанья-чаритамрита"),
    (r"\bББхаг\b", "Брихад-Бхагаватамрита"),
    (r"\bИВН\b", "Источник вечного наслаждения"),
    (r"\bпо книге Источник", "Источник"),
    (r"\bMantra\b", "Мантра"), (r"\bLection\b", "Лекция"), (r"\bLec\s*", "Лекция "),
]

# Написание имён и терминов — как принято в приложении.
PCG_CANON = [
    (r"Парибхаса-?Сутра", "Парибхаша-сутра"),
    (r"Прабхупада\s+катха", "Прабхупада-катха"),
    (r"Ягья\s*Патни(\s*лила|\s*ли\s*ла)?", "Ягьяпатни-лила"),
    (r"Ягьяпатни(\s*ли\s*ла|\s*лила)?(?!-)", "Ягьяпатни-лила"),
    (r"Калия[\s-]*Даман[аы]?\s*лила", "Калия-дамана-лила"), (r"Калия\s+Гхата", "Калия-гхата"),
    (r"Дама-Бандана\s*лила\s*\(Дамодара\)", "Дамодара-лила · дама-бандхана"),
    (r"Дамодара\s+лила", "Дамодара-лила"), (r"Тринаварта\s+вадха", "Тринаварта-вадха"),
    (r"Раса\s+лила", "раса-лила"),
    (r"Мадана\s+Мохана", "Мадана-мохана"), (r"Сакши\s+Гопал", "Сакши-Гопал"),
    (r"Говинда\s+Кунда", "Говинда-кунда"), (r"Радха\s+Кунда", "Радха-кунда"),
    (r"Уддхава\s+кунда", "Уддхава-кунда"),
    (r"Кусум\s+Саровара\s+Цветочное\s+озеро", "Кусум-саровара · Цветочное озеро"),
    (r"на\s+Кусум\s+Саровара", "на Кусум-сароваре"), (r"Кусум\s+Саровара", "Кусум-саровара"),
    (r"Двадаши\s+адитья\s+тила", "Двадашадитья-тила"),
    (r"Гаура\s+Кишор\s+Дас\s+Бабаджи", "Гаура Кишора дас Бабаджи"),
    (r"Гаура\s+Пурним", "Гаура-пурним"), (r"Ратха\s+й?атра", "Ратха-ятра"),
    (r"\bРамнавами\b", "Рама-навами"), (r"саньяс", "санньяс"),
    (r"Шрила\s+Прабхупада\s+Шактиавеша\s+аватара", "Шрила Прабхупада — шактьявеша-аватара"),
    (r"\bИССКОН\b", "ИСККОН"), (r"Пабхупад", "Прабхупад"), (r"плачь", "плач"),
    (r"черного", "чёрного"), (r"коментарии", "комментарии"),
    (r"\bНТагил\b", "Нижний Тагил"), (r"\b3 мировая война\b", "Третья мировая война"),
    (r"Джапа\s+ворк\s*шоп", "Мастерская джапы"), (r"Джапа\s+воркшоп", "Мастерская джапы"),
    (r"Воскресная\s+прогр\b", "Воскресная программа"),
    (r"аудио\s+просмотр\s+фильма", "Фильм"),
    (r"Фильм\s+о\s+воде\s+(введение|комментарии)", r"Фильм о воде · \1"),
    (r"[-–]\s*отец\s+Сергий", "· отец Сергий"),
    (r"(Бхаума|Дивья|Прапанчатита|Бхакта|Прия|Прийатама|Пурна)-Нама",
     lambda m: m.group(1).replace("Прийатама", "Приятама") + "-нама"),
    (r"^Лекция\s+\d+\s+(?=[А-ЯЁ])", ""),
    (r"Тест,\s*поправки", "Поправки"),
    (r"Обзор\s+Бхагавад-гита,", "Обзор «Бхагавад-гиты»:"),
    (r"(Бхагавад-гита|Шримад-Бхагаватам)\s+глава", r"\1, глава"),
    (r"глава\s+(\d+)-(\d+)", r"главы \1–\2"),
    (r"(глава\s+\d+)\s+тексты", r"\1, тексты"),
    (r"(глава\s+\d+)\s+(\d+)-(\d+)", r"\1, тексты \2–\3"),
    (r"тексты\s+(\d+)-(\d+)", r"тексты \1–\2"),
    (r"Гурудев\s+в\s+сознании\s+Кришны\s+Очевидное", "Гурудев в сознании Кришны · очевидное"),
    (r"Очевидное\s+и\s+невероятное\s+Битва", "Очевидное и невероятное · битва"),
    (r"\s+\d\d[\s._]\d\d[\s._]\d\d(\s*арх)?$", ""),
    (r"глава\s+29\s+раса-лила,", "глава 29 · раса-лила ·"),
    (r"Прогулка\s+Вриндаван", "Прогулка по Вриндавану"),
    (r"\((\d)\)", r"· часть \1"),
    (r"(\S)\s+Лекция\s+0*(\d+)\b", r"\1 · часть \2"),
]

# Место записи — всегда хвостом через разделитель, а не приклеенным к теме.
PCG_PLACES = ("Сочи", "Баку", "Ахтуба", "Пермь", "Курган", "Уфа", "Евпатория", "Одесса",
          "Москва", "Стерлитамак", "Кумертау", "Златоуст", "Челябинск", "Екатеринбург",
          "Нижний Тагил", "Березники", "Суздаль", "Курск", "Ярославль", "Тула", "Сухарево")

PCG_REF = re.compile(r"(Бхагавад-гита|Шримад-Бхагаватам|Чайтанья-чаритамрита)"
                 r"[\s,.-]*(\d{1,3})[\s._-](\d{1,3})(?:[\s._-](\d{1,3}(?:\s*[-–]\s*\d{1,3})?))?")
PCG_IVN = re.compile(r"(Источник вечного наслаждения)[\s,.-]*(\d{1,3})")



def pcg_date(stem: str):
    """Дата из имени: канал пишет её и в начале («97.11.24 …»), и в конце («… 12.04.08»)."""
    m = PCG_DATE_HEAD.match(stem)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        y += 1900 if 90 <= y <= 99 else (2000 if y < 90 else 0)
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return (y, mo, d), stem[m.end():]
    m = re.match(r"^\s*((?:19|20)\d\d)[\s_.-]+(?=\D)", stem)
    if m:
        return (int(m.group(1)), 0, 0), stem[m.end():]
    m = PCG_DATE_TAIL.search(stem)
    if m:                                   # хвостовая дата идёт день-месяц-год
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        y += 2000 if y < 90 else 1900
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return (y, mo, d), stem[:m.start()]
    return None, stem


def pcg_ref(m) -> str:
    """«Ш.Б. 11 11 34-41» → «Шримад-Бхагаватам 11.11.34–41»."""
    parts = [str(int(m.group(2))), str(int(m.group(3)))]
    if m.group(4):
        parts.append(re.sub(r"\s*[-–]\s*", "–", m.group(4)))
    return "%s %s" % (m.group(1), ".".join(parts))


def pcg_title(stem: str, strip=(), fallback="Часть") -> str:
    """Имя файла → название дорожки. Порядок шагов важен: место снимается ДО
    расстановки разделителей, иначе от него остаётся висячая точка."""
    s = stem.replace("_", " ")
    for rx, rep in PCG_EXPAND:
        s = re.sub(rx, rep, s)
    for place in strip:                     # место уже названо альбомом
        s = re.sub(r"[\s,]*\b%s\b" % place, "", s)
    s = re.sub(r"(?<=\d)(?=[А-ЯЁ])", " ", s)       # «41Екатеринбург» → «41 Екатеринбург»
    s = re.sub(r"\bгл\.?\s*(?=\d)", "глава ", s)
    s = re.sub(r"\bстихи\b", "тексты", s)
    s = PCG_REF.sub(pcg_ref, s)
    s = PCG_IVN.sub(lambda m: "%s, глава %d" % (m.group(1), int(m.group(2))), s)
    s = re.sub(r"((?:Бхагавад-гита|Шримад-Бхагаватам|Чайтанья-чаритамрита)"
               r"(?:\s\d[\d.–-]*)?)\s+(?=[А-ЯЁ][а-яё])", r"\1 · ", s)
    for rx, rep in PCG_CANON:
        s = re.sub(rx, rep, s, flags=re.I)
    for place in PCG_PLACES:                    # место — хвостом через разделитель
        s = re.sub(r"(?<!· )\b%s\b" % place, "· %s" % place, s)
    s = re.sub(r"(Мантра|Текст|Лекция|Часть)\s*[-–]?\s*0*(\d+)\s*b\b", r"\1 \2, продолжение", s, flags=re.I)
    s = re.sub(r"(Мантра|Текст|Лекция|Часть)\s*[-–]\s*0*(\d+)", r"\1 \2", s, flags=re.I)
    s = re.sub(r"(Мантра|Текст)\s+(\d+)\s*,\s*(\d+)", r"\1 \2–\3", s)
    s = re.sub(r"^0*(\d+)\s+Лекция$", r"Лекция \1", s)
    s = re.sub(r"\s+([,.])", r"\1", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" .,-–_·")
    m = re.fullmatch(r"Лекци[яи]\s*№?\s*0*(\d+)?", s, flags=re.I)
    if m:
        s = "Часть %s" % m.group(1) if m.group(1) else ""
    if re.fullmatch(r"[\d\s·]+", s) or not s:
        s = "" if fallback == "Часть" else fallback
    # одинокий порядковый номер после слова → «· часть N» (но не глава и не нумератор)
    if (not re.search(r"\d+\.\d+", s) and "глава" not in s.lower()
            and not re.search(r"(мантра|текст|часть|лекция|стих)\s+\d+(\s|$|·)", s, flags=re.I)):
        s = re.sub(r"(?<=[а-яёa-z])\s+0*(\d{1,2})(?=\s*·|$)", r" · часть \1", s, flags=re.I)
    s = re.sub(r"·\s*·", "·", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" .,-–_·")
    return (s[:1].upper() + s[1:]) if s else ""




def build_purnacandra(audio):
    """@purnacandragoswami: 384 записи 1997–2010, из них 299 катхи и 79 киртанов.

    Канал размечен заголовочными постами («98.01 - Упадешамрита 👇»), но разметка
    дырявая: за пачкой цикла идёт хвост из лекций других лет и мест. Пост [284]
    обещает «Вриндаван парикрама», а под ним 97 записей, из которых парикрама —
    первые одиннадцать и ещё двадцать через полгода. Правило по заголовкам собрало
    бы альбом-помойку. Поэтому состав циклов разобран глазами по всем записям и
    записан списками сообщений: карта — документ, а не догадка (ЗКН-Пл010).
    """
    rows_by_id = {m["msg_id"]: m for m in audio if m["msg_id"] not in PCG_DROP}
    claimed = {i for al in PCG_ALBUMS for i in al["msgs"]}
    buckets = {b[0]: [] for b in PCG_BUCKETS}
    orphans = []
    for i in sorted(rows_by_id):
        if i in claimed or i >= PCG_KIRTAN_FROM:
            continue
        if i in PCG_FORCE:
            buckets[PCG_FORCE[i]].append(i)
            continue
        stem = re.sub(r"\.mp3$", "", rows_by_id[i]["file_name"] or "", flags=re.I)
        dt, _ = pcg_date(stem)
        put = next((b[0] for b in PCG_BUCKETS if dt and b[3][0] <= dt[0] <= b[3][1]), None)
        (buckets[put] if put else orphans).append(i)

    albums = list(PCG_ALBUMS)
    for bid, title, year, _rng in PCG_BUCKETS:
        if buckets[bid]:
            albums.append({"id": bid, "file": bid, "title": title, "year": year,
                           "msgs": buckets[bid], "dated": True, "fallback": "Лекция"})

    plan = []
    for al in albums:
        rows = []
        for i in al["msgs"]:
            m = rows_by_id.get(i)
            if not m:
                continue
            stem = re.sub(r"\.mp3$", "", m["file_name"] or "", flags=re.I)
            dt, body = pcg_date(stem)
            rows.append({"m": m, "dt": dt,
                         "title": pcg_title(body, al.get("strip", ()), al.get("fallback", "Часть"))})
        rows.sort(key=lambda r: (r["dt"] or (9999, 99, 99), r["m"]["msg_id"]))
        seen = {}
        for r in rows:
            seen[r["title"]] = seen.get(r["title"], 0) + 1
        cnt = {}
        for n, r in enumerate(rows, 1):
            base = r["title"]
            if not base:
                r["title"] = "Часть %d" % n
            elif (seen[base] > 1 and "· часть " not in base
                    and not (al["dated"] and r["dt"])):
                cnt[base] = cnt.get(base, 0) + 1
                r["title"] = "%s · часть %d" % (base, cnt[base])
        width = 3 if len(rows) > 99 else 2
        tracks = []
        for n, r in enumerate(rows, 1):
            t = r["title"]
            if al["dated"] and r["dt"]:
                t += " · %s" % (str(r["dt"][0]) if not r["dt"][1]
                                else ru_date(r["dt"][2], r["dt"][1], r["dt"][0]))
            tracks.append({"msg_id": r["m"]["msg_id"], "title": t,
                           "duration": r["m"].get("duration") or 0,
                           "size": r["m"].get("size") or 0, "source": r["m"]["file_name"],
                           "file": "%s-%0*d.mp3" % (al["file"], width, n), "sort": n})
        plan.append({"id": al["id"], "title": al["title"],
                     "identifier": "iskcone-katha-pcg-%s" % al["file"], "tracks": tracks})
    return plan, [rows_by_id[i]["file_name"] for i in orphans]
# ═════════ ИСТОЧНИК 3 · @gourgovindaswamimaharaj ═════════
#
# ЗДЕСЬ ПРАВИЛО НЕ РАБОТАЕТ, И ПОЭТОМУ ТАБЛИЦА ПОИМЁННАЯ.
#
# У Прабхупады имя файла само несёт стих и дату, у Радха Говинды — слово-метку
# цикла. Здесь нет ни того, ни другого: 47 записей — это ОТДЕЛЬНЫЕ ЛЕКЦИИ разных
# лет и материков. Ни один разбор строки не выведет, что «Поражение Кешавы
# Кашмири» — Гауранга Лила, а «Прибытие из Африки» — хроника ИСККОН. Это знание,
# а не разметка, и оно записано ниже поимённо (ЗКН-Пл010).
#
# ДВОЙНИКИ. Две лекции залиты в канал дважды разными оцифровками — признак
# механический: та же тема И длительность в пределах 3 %. Оставляем длинную.
#     msg 10 (5923 c) ≡ msg 38 (6011 c)   ШБ 7.6.1, обе от 31.05.1995
#     msg 23 (2038 c) ≡ msg 25 (2063 c)   «Понять/Постичь Кришну в таттве»
#
# ЧТО ПРАВИМ В НАЗВАНИЯХ. Только очевидный промах набора; исходная строка канала
# целиком остаётся в поле `source` дорожки — сверить можно не отходя от файла:
#     «Филадельыия» → «Филадельфия» · «ШБ 7.61» → «ШБ 7.6.1» (та же дата, что
#     у msg 10) · «Джибиси» → «Джи-Би-Си» · «Исккон» → «ИСККОН» ·
#     «лотосоподобным» → «лотосным» (язык изданий Би-Би-Ти).
# Спорное («ЧЧ 1.22.24–26», «Товако», «Предайся Братьям») переносим КАК ЕСТЬ:
# ошибка канала честнее нашей выдумки.
GGS_DUPES = {10: 38, 23: 25}

GGS_ALBUMS = [
    ("ggs-bhagavatam", "Шримад-Бхагаватам", "sb"),
    ("ggs-gauranga-lila", "Гауранга Лила", "gauranga"),
    ("ggs-tattva", "Таттва", "tattva"),
    ("ggs-nama", "Святое имя и према", "nama"),
    ("ggs-sadhana", "Садхана", "sadhana"),
    ("ggs-iskcon", "ИСККОН", "iskcon"),
    ("ggs-kathamrita", "Катхамрита", "kathamrita"),
    ("ggs-misc", "Разное", "misc"),
]

# Порядок внутри альбома = порядок этого списка: у «Шримад-Бхагаватам» — по
# песни, главе и стиху; у «Садханы» и «ИСККОН» — по годам; дальше от общего к частному.
GGS_TRACKS = [
    (36, "ggs-bhagavatam", "ШБ 2.2.27 · Как понять Веды · 4 августа 1994"),
    (38, "ggs-bhagavatam", "ШБ 7.6.1 · Оковы в темнице майи · 31 мая 1995"),
    (37, "ggs-bhagavatam", "ШБ 7.15.29 · Филадельфия, 30 мая 1992"),
    (39, "ggs-bhagavatam", "ШБ 8.7.22 · Шива-таттва · Австралия, 27 октября 1990"),
    (40, "ggs-bhagavatam", "ШБ 8.22.34 · часть 1"),
    (41, "ggs-bhagavatam", "ШБ 8.22.34 · часть 2"),
    (42, "ggs-bhagavatam", "ШБ 9.4.17–20"),
    (43, "ggs-bhagavatam", "ШБ 9.9.48 · Цена этой веры · Гита-нагари, 28 мая 1992"),
    (44, "ggs-bhagavatam", "ШБ 9.16.7–9 · 7 февраля 1995"),
    (8,  "ggs-bhagavatam", "ШБ 9.18.2 · Слушай каждый день"),
    (45, "ggs-bhagavatam", "ШБ 9.18.2 · 3 августа 1994"),

    (27, "ggs-gauranga-lila", "ЧЧ 1.22.24–26 · Практика чистого повторения · часть 1"),
    (28, "ggs-gauranga-lila", "ЧЧ 1.22.24–26 · Практика чистого повторения · часть 2"),
    (24, "ggs-gauranga-lila", "Поражение Кешавы Кашмири · 1 июня 1995"),
    (49, "ggs-gauranga-lila", "Тайна лилы Гундича-марджаны"),
    (51, "ggs-gauranga-lila", "Не убегай от объятий Махапрабху"),

    (7,  "ggs-tattva", "Гуру-таттва · Австралия, 1 октября 1992"),
    (4,  "ggs-tattva", "Гаура-таттва · Австралия, 30 сентября 1992"),
    (25, "ggs-tattva", "Постичь Кришну в таттве · 12 июля 1995"),
    (14, "ggs-tattva", "Кришна — наш вечный благожелатель · 11 июня 1995"),

    (35, "ggs-nama", "Хари-катха"),
    (22, "ggs-nama", "Повторяй Святое имя. Предайся Братьям"),
    (50, "ggs-nama", "Гирлянда премы и намы"),
    (31, "ggs-nama", "Развей жадность по Кришна-преме · часть 1 · 14 июля 1993"),
    (32, "ggs-nama", "Развей жадность по Кришна-преме · часть 2 · 14 июля 1993"),
    (33, "ggs-nama", "Развитие привязанности к лотосным стопам Кришны"),

    (2,  "ggs-sadhana", "БГ 3.37 · 27 октября 1990"),
    (34, "ggs-sadhana", "Сомнения опасны · 9 февраля 1993"),
    (15, "ggs-sadhana", "Милостивые игры Господа · 16 февраля 1993"),
    (19, "ggs-sadhana", "Нет предания без веры · 17 февраля 1993"),
    (21, "ggs-sadhana", "Оставьте майю · 23 мая 1993"),
    (9,  "ggs-sadhana", "Если Кришна удовлетворён — удовлетворены все · 12 июля 1993"),
    (6,  "ggs-sadhana", "Гуру-сева — это наше всё · Товако, 4 июня 1994"),
    (16, "ggs-sadhana", "Молись о садху-санге. Слава махапрасада · 3 августа 1994"),
    (13, "ggs-sadhana", "Когда распускается лотос удачи · 8 августа 1994"),
    (46, "ggs-sadhana", "Почему Дхритараштра не обрёл чистую преданность"),

    (47, "ggs-iskcon", "Что такое ИСККОН"),
    (29, "ggs-iskcon", "Прибытие из Африки · 5 февраля 1995"),
    (3,  "ggs-iskcon", "Возвращение из Маяпура. Встреча Джи-Би-Си · 5 марта 1995"),
    (20, "ggs-iskcon", "О руководстве ИСККОН · 15 марта 1995"),
    (30, "ggs-iskcon", "Принципы ведического брака · 21 марта 1995"),

    (11, "ggs-kathamrita", "Часть 2а"),
    (12, "ggs-kathamrita", "Часть 2б"),

    (17, "ggs-misc", "Запись без названия · 1"),
    (18, "ggs-misc", "Запись без названия · 2"),
]


def build_ggs(audio):
    """Карта канала Гоур Говинды Свами. Возвращает (альбомы, вне-альбомов)."""
    by_id = {m["msg_id"]: m for m in audio}
    mapped = {mid for mid, _, _ in GGS_TRACKS}
    # Карта обязана покрыть канал целиком: молчаливая потеря записи — ровно то,
    # ради чего карта и вынесена в отдельный шаг.
    orphans = [by_id[i].get("file_name") or str(i)
               for i in sorted(set(by_id) - mapped - set(GGS_DUPES))]

    plan = []
    for aid, title, fbase in GGS_ALBUMS:
        tracks = []
        for mid, owner, name in GGS_TRACKS:
            if owner != aid or mid not in by_id:
                continue
            m = by_id[mid]
            src = m.get("file_name") or ""
            i = len(tracks) + 1
            # ⚠️ В АРХИВ ЕДЕТ ТОЛЬКО MP3.
            # Пять записей канала лежат как .wav и .m4a — 55, 78 и 109 МБ на
            # лекцию. Телефону такое отдавать нельзя, да и сверка с архивом
            # считает лишь исходные mp3: файл в другом формате навсегда остался
            # бы «незалитым», и самоцепочка крутилась бы впустую. Поэтому такие
            # записи перекодируются перед заливкой, и это решение видно в карте.
            need = not src.lower().endswith(".mp3")
            t = {"msg_id": mid, "title": fix_homoglyphs(name),
                 "duration": m.get("duration") or 0, "size": m.get("size") or 0,
                 "source": src, "file": "%s-%02d.mp3" % (fbase, i), "sort": i}
            if need:
                t["transcode"] = True
            tracks.append(t)
        plan.append({"id": aid, "title": title,
                     "identifier": "iskcone-katha-%s" % aid, "tracks": tracks})
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
    {"channel": "@purnacandragoswami", "speaker": "purnacandra-goswami",
     "speaker_name": "Пурначандра дас Госвами Махарадж",
     "probe": "katha-probe-purnacandragoswami.json", "build": build_purnacandra},
    {"channel": "@gourgovindaswamimaharaj", "speaker": "gour-govinda-swami",
     "speaker_name": "Гоур Говинда Свами Махарадж",
     "probe": "katha-probe-gourgovindaswamimaharaj.json", "build": build_ggs},
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
