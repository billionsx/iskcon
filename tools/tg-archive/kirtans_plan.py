#!/usr/bin/env python3
"""
kirtans_plan.py — РАЗБОР канала «ISKCON Kirtans» (@iskconecom) в реестр исполнителей.

═══ ЧТО ПОКАЗАЛА РАЗВЕДКА (1110 аудио, 42 ГБ) ═══

ПОЛЕ `performer` — НЕНАДЁЖНО. Это ID3-тег, и в нём кто угодно:

    «Ananda Vardhana Swami 03.mp3»  → performer = «RadhaDamodar»       (студия)
    «Ananda Vardhana Swami 04.mp3»  → performer = «Ponomarenco Alexey» (кто тегал)
    «Ananda Vardhana Swami 11.mp3»  → performer = «Ananda Vardhana Swami» ✓

Один исполнитель — три разных `performer`. Ещё там рубрики («Full Kirtan»,
«Sounds») и каналы («ISKCON Desire Tree», «Mayapur TV»). 517 файлов из 1110 —
вообще без этого поля.

ИМЯ ФАЙЛА — НАДЁЖНО. Оно ВСЕГДА начинается с исполнителя:

    505  «Aindra Das - Jaya Radha-Madhava.mp3»          ИМЯ - НАЗВАНИЕ
    341  «Acyuta Gopi Devi Dasi Kirtan 09.mp3»          ИМЯ Kirtan NN
    218  «Ananda Vardhana Swami 01.mp3»                 ИМЯ NN
     46  «Bhaktisvarupa Damodara Goswami. Tulasi.mp3»   ИМЯ. НАЗВАНИЕ

Отсюда: ИМЯ ФАЙЛА — ИСТОЧНИК №1, `performer` — только запасной.
(Первая версия верила `performer` и раздробила людей на 323 «исполнителя».)

═══ КАК СКЛЕИВАЮТСЯ ВАРИАНТЫ ═══

Один человек пишется десятком способов, в двух алфавитах:

    Radhanath Swami · Radhanatha Swami · Srila Radhanath Swami · Радханатх Свами
    Indradumna Swami · Indradyumna Swami · HH Indradyumna Swami · Индрадьюмна Свами
    Aindra Das · Aindra prabhu · Aindra Babaji

Ключ склейки: кириллица → латиница, титулы прочь (Swami/Maharaj/Prabhu/das/HH/
Srila/Goswami/Babaji — это ОБРАЩЕНИЕ, а не имя), написание нормализуется
(y↔i, sh↔s, th↔t, удвоения). «Radhanath» и «Радханатх» дают ОДИН ключ.

Что не выводится — уходит в `unresolved` и ждёт решения. В «разное» молча не
сваливается ничего (ЗКН-Пл010: «структуры нет» обычно значит «ищу не там»).

Выход: kirtans_roster.json   Запуск: PROBE_IN=kirtans_probe.json python kirtans_plan.py
"""
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent

# В `performer` живут не только имена: рубрики, студии, каналы, тегальщики.
JUNK_PERFORMER = {
    "full kirtan", "kirtan", "bhajan", "kirtans", "iskcon kirtans", "iskcon",
    "iskcon one love", "iskcon desire tree", "mayapur tv", "sounds", "various",
    "va", "unknown", "radhadamodar", "ponomarenco alexey", "bhakta sim",
    "kirtan mela", "harinam", "vrajavans com",
}

# Титулы и обращения — частью ИМЕНИ они не являются.
TITLES = (
    r"hh|hg|his holiness|his grace|srila|sri|shri|sriman|"
    r"swami|svami|maharaj|maharaja|goswami|gosvami|"
    # ⚠️ «prabhupada»/«прабхупада» ЗДЕСЬ НЕТ, и это не упущение: это ИМЯ, а не
    #    обращение. Когда оно стояло в титулах, «Srila Prabhupada» = титул+титул,
    #    ключ выходил ПУСТОЙ, и 134 файла Прабхупады улетали в «не опознано».
    r"prabhu|das|dasa|dasi|devi|babaji|mataji|"
    r"свами|махарадж|махараджа|госвами|прабху|дас|даси|деви|бабаджи|шрила|шри"
)

# Хвост имени файла: рубрика + номер.
TAIL = re.compile(
    r"[\s_.\-]*(?:maha[\s_-]*kirtan|маха[\s_-]*киртан|kirtan|bhajan|lecture|japa|"
    r"harinam|mangala[\s_-]*arati|arati|live|full|part|pt|vol|cd|track|official|"
    r"киртан|бхаджан|лекция)?[\s_.\-]*\d{0,4}\s*$",
    re.I,
)
EXT = re.compile(r"\.(mp3|m4a|ogg|opus|flac|wav|aac)$", re.I)

CYR = {"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z",
       "и":"i","й":"i","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
       "с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sh",
       "ъ":"","ы":"i","ь":"","э":"e","ю":"iu","я":"ia"}


def fix_mojibake(s: str) -> str:
    """«Áõàêòè Âèãüÿíà» — кириллица cp1251, прочитанная как latin-1. Чиним."""
    if not s or not re.search(r"[ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö]", s):
        return s
    try:
        f = s.encode("latin-1", "ignore").decode("cp1251", "ignore")
        if re.search(r"[А-Яа-яЁё]{3}", f):
            return f
    except Exception:
        pass
    return s


def artist_from_filename(name: str) -> str:
    s = EXT.sub("", fix_mojibake((name or "").strip()))
    if not s:
        return ""
    for sep in (" - ", " — ", " – "):
        if sep in s:
            s = s.split(sep, 1)[0]
            break
    else:
        m = re.search(r"\.\s+\S", s)      # «ИМЯ. НАЗВАНИЕ» (у «B.B.» точки без пробела)
        if m:
            s = s[: m.start()]
    s = s.replace("_", " ")
    prev = None
    while s != prev:                      # хвост бывает составным: «Kirtan 09»
        prev = s
        s = TAIL.sub("", s).strip(" -_.")
    return re.sub(r"\s+", " ", s).strip()


def key_of(display: str) -> str:
    s = fix_mojibake(display).lower()
    s = "".join(CYR.get(c, c) for c in s)
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\b(?:%s)\b" % TITLES, " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # ⚠️ «Ниранджана» → «nirandzhana», а «Niranjana» → «niranjana»: КЛЮЧИ РАЗНЫЕ,
    #    и один человек разъезжался на двоих. Сводим разнобой транслитерации.
    s = s.replace("dzh", "j").replace("zh", "j")
    s = re.sub(r"\bgour\b", "gaur", s)
    s = s.replace("sh", "s").replace("ch", "c").replace("th", "t").replace("ck", "k")
    s = s.replace("y", "i").replace("j", "i").replace("w", "v")
    s = re.sub(r"(.)\1+", r"\1", s)
    s = re.sub(r"a\b", "", s)             # хвостовая «-a»: radhanath(a)
    return re.sub(r"\s+", " ", s).strip()


def confident(name: str) -> bool:
    """Имя выведено НАДЁЖНО: есть разделитель названия или хвост-рубрика.

    «Aindra Das - Jaya Radha-Madhava.mp3» → разделитель есть → имя точно слева.
    «Acyuta Gopi Devi Dasi Kirtan 09.mp3» → хвост «Kirtan 09» → имя точно перед ним.
    «Gour_Govinda_Swami_Bhavo_Na_Doyal_Nitai.mp3» → НИ ТОГО НИ ДРУГОГО: в имя
    исполнителя утекло название песни. Такие — во ВТОРОЙ проход, по словарю.
    """
    s = EXT.sub("", fix_mojibake((name or "").strip()))
    if any(sep in s for sep in (" - ", " — ", " – ")):
        return True
    if re.search(r"\.\s+\S", s):
        return True
    # ⚠️ «оканчивается цифрами» — НЕ признак надёжности. У «Gour_Govinda_Swami_
    #    Jaya_Jaya_Sri_Krsna_Caitanya_01» цифра стоит ПОСЛЕ названия песни, и
    #    название утекало в имя исполнителя. Подчёркнутые — только во второй проход.
    if "_" in s:
        return False
    if not re.search(r"\d", s):
        return False
    core = artist_from_filename(name)
    return bool(core) and len(core.split()) <= 5   # имя длиннее 5 слов = утекло название


def main() -> int:
    probe = json.loads(Path(os.getenv("PROBE_IN") or "kirtans_probe.json").read_text(encoding="utf-8"))
    files = [f for ch in probe.get("channels", []) for f in ch.get("files", [])]
    if not files:
        print("::error::в разведке нет аудио")
        return 1

    # ПРОХОД 1 — словарь НАДЁЖНЫХ имён (там, где имя отделено от названия).
    lexicon: dict[str, str] = {}          # key → самое частое написание
    votes: dict[str, dict] = {}
    for f in files:
        nm = f.get("file_name") or ""
        if not confident(nm):
            continue
        d = artist_from_filename(nm)
        if not d or len(d) < 3 or d.lower() in JUNK_PERFORMER:
            continue
        k = key_of(d)
        if not k or len(k) < 3:
            continue
        votes.setdefault(k, {})
        votes[k][d] = votes[k].get(d, 0) + 1
    for k, v in votes.items():
        lexicon[k] = max(v.items(), key=lambda kv: (kv[1], len(kv[0])))[0]
    # длинные имена — первыми: «Bhakti Bringa Govinda Swami» важнее «Govinda»
    known = sorted(lexicon.keys(), key=len, reverse=True)
    print("::notice::словарь надёжных имён: %d" % len(known))

    def by_lexicon(nm: str) -> str:
        """ПРОХОД 2: имя файла НАЧИНАЕТСЯ с известного исполнителя?"""
        s = key_of(EXT.sub("", fix_mojibake(nm or "")).replace("_", " "))
        for k in known:
            if s == k or s.startswith(k + " "):
                return lexicon[k]
        return ""

    groups: dict = {}
    unresolved: list = []

    for f in files:
        nm = f.get("file_name") or ""
        if confident(nm):
            display = artist_from_filename(nm)
            src = "filename"
        else:
            display = by_lexicon(nm)      # словарь важнее сырого имени файла
            src = "lexicon"
            if not display:
                display = artist_from_filename(nm)
                src = "filename"
        if not display or len(display) < 3:
            p = fix_mojibake((f.get("performer") or "").strip())
            if p and p.lower() not in JUNK_PERFORMER:
                display, src = p, "performer"
        k = key_of(display) if display else ""
        if not display or len(display) < 3 or display.lower() in JUNK_PERFORMER or not k:
            unresolved.append({"msg_id": f["msg_id"], "file_name": f.get("file_name"),
                               "performer": f.get("performer"), "title": f.get("title"),
                               "caption": f.get("caption"), "size": f.get("size")})
            continue

        g = groups.setdefault(k, {"key": k, "display": display, "variants": {}, "n": 0,
                                  "bytes": 0, "msg_ids": [], "sources": {}})
        g["variants"][display] = g["variants"].get(display, 0) + 1
        g["sources"][src] = g["sources"].get(src, 0) + 1
        g["n"] += 1
        g["bytes"] += f.get("size") or 0
        g["msg_ids"].append(f["msg_id"])

    for g in groups.values():
        g["display"] = max(g["variants"].items(), key=lambda kv: (kv[1], len(kv[0])))[0]

    artists = sorted(groups.values(), key=lambda x: -x["n"])
    out = {"channel": "@iskconecom", "n_files": len(files), "n_artists": len(artists),
           "n_unresolved": len(unresolved), "artists": artists, "unresolved": unresolved}
    Path(os.getenv("ROSTER_OUT") or (HERE / "kirtans_roster.json")).write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    gb = sum(a["bytes"] for a in artists) / 1e9
    print("::notice::РАЗОБРАНО: %d файлов · %d исполнителей · %.1f ГБ · не опознано: %d"
          % (len(files) - len(unresolved), len(artists), gb, len(unresolved)))
    for a in artists[:50]:
        print("::notice::  %4d  %6.2f ГБ  %s" % (a["n"], a["bytes"] / 1e9, a["display"][:40]))
    if unresolved:
        print("::warning::НЕ ОПОЗНАНО %d — в «разное» не сваливаю" % len(unresolved))
    return 0


if __name__ == "__main__":
    sys.exit(main())
