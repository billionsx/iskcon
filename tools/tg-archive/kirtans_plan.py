#!/usr/bin/env python3
"""
kirtans_plan.py — РАЗБОР канала «ISKCON Kirtans» (@iskconecom) в план заливки.

ПОЧЕМУ ОТДЕЛЬНЫЙ ШАГ, А НЕ СРАЗУ ЗАЛИВКА.

В канале 1110 аудио и 42 ГБ. Залить их «как есть» — значит получить свалку, из
которой человек ничего не найдёт. Основатель просил КАТАЛОГИЗИРОВАТЬ ПО
ИСПОЛНИТЕЛЯМ. Значит сперва надо ЗНАТЬ, кто исполнитель у КАЖДОГО файла — и
только потом лить. Разбор идёт в файл, файл коммитится в репозиторий, я его
читаю глазами. Ошибка в разборе стоит переливки 42 ГБ.

ЧЕМ РАЗМЕЧЕН КАНАЛ (по разведке tg_probe):

    поле `performer`   594 из 1110   («Gour Govinda Swami», «Aindra Das», …)
    имя файла          все           («Acyuta Gopi Devi Dasi Kirtan 09.mp3»)
    хэштег в подписи   часть          («🦚 ISKCON Kirtans #AchyutaGopiDeviDasi»)

516 файлов БЕЗ `performer` — и это не «структуры нет» (ЗКН-Пл010), это «структура
в другом поле»: у них исполнитель зашит в ИМЯ ФАЙЛА и в ХЭШТЕГ. Берём все три
источника по приоритету и НИЧЕГО не угадываем: если исполнитель не выводится —
файл уходит в `unresolved` и ждёт решения, а не сваливается в «разное».

ВЫХОД: kirtans_roster.json
    { "artists": [ {key, display, n, bytes, msg_ids, samples} ],
      "unresolved": [ {...} ] }
"""
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent

# ── Поле `performer` иногда содержит НЕ имя, а рубрику канала. Такое имя
#    исполнителем не считаем — падаем на имя файла. Список пополняется руками:
#    молча зачислить рубрику в исполнители = завести артиста-призрака.
NOT_A_NAME = {
    "full kirtan", "kirtan", "bhajan", "iskcon kirtans", "iskcon", "various",
    "unknown", "va", "kirtan mela", "harinam", "mangala arati", "japa",
}

# ── Хвосты имени файла, которые НЕ являются частью имени исполнителя.
TAIL = re.compile(
    r"[\s_\-.]*(kirtan|bhajan|lecture|japa|harinam|mangala[\s_-]*arati|arati|"
    r"live|part|pt|vol|cd|track|full)?[\s_\-.]*\d{0,4}\s*$",
    re.I,
)
EXT = re.compile(r"\.(mp3|m4a|ogg|opus|flac|wav|aac)$", re.I)
HASHTAG = re.compile(r"#([A-Za-zА-Яа-яЁё][\w]{2,})")


def from_filename(name: str) -> str:
    """«Acyuta Gopi Devi Dasi Kirtan 09.mp3» → «Acyuta Gopi Devi Dasi»."""
    s = EXT.sub("", name or "")
    s = s.replace("_", " ")
    prev = None
    while s != prev:                    # хвост может быть составным: «Kirtan 09»
        prev = s
        s = TAIL.sub("", s).strip(" -_.")
    return re.sub(r"\s+", " ", s).strip()


def from_hashtag(caption: str) -> str:
    """«#AchyutaGopiDeviDasi» → «Achyuta Gopi Devi Dasi» (разбор CamelCase)."""
    for tag in HASHTAG.findall(caption or ""):
        if tag.lower() in ("iskcon", "kirtans", "iskconkirtans", "kirtan", "bhajan"):
            continue
        words = re.findall(r"[A-ZА-ЯЁ][a-zа-яё]*|\d+", tag)
        if len(words) >= 2:
            return " ".join(words)
    return ""


def key_of(display: str) -> str:
    """Ключ склейки. «Aindra Das» и «Aindra Prabhu» — ОДИН человек.

    Титулы (das/dasa/prabhu/swami/maharaj/devi dasi) — это ОБРАЩЕНИЕ, а не имя.
    Склеиваем по имени, а показываем — самый полный из встреченных вариантов.
    """
    s = display.lower()
    s = re.sub(r"[^a-zа-яё0-9\s]", " ", s)
    s = re.sub(
        r"\b(das|dasa|dasi|devi|prabhu|swami|maharaj|maharaja|goswami|gosvami|"
        r"srila|sri|shri|hh|hg|prabhupada)\b", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or display.lower().strip()


def main() -> int:
    probe = json.loads(Path(os.getenv("PROBE_IN") or "/tmp/probe.json").read_text(encoding="utf-8"))
    files = []
    for ch in probe.get("channels", []):
        files.extend(ch.get("files", []))
    if not files:
        print("::error::в разведке нет аудио — заливать нечего")
        return 1

    groups: dict[str, dict] = {}
    unresolved: list[dict] = []

    for f in files:
        perf = (f.get("performer") or "").strip()
        src = "performer"
        display = perf
        if not display or display.lower() in NOT_A_NAME:
            display = from_filename(f.get("file_name") or "")
            src = "filename"
        if not display or display.lower() in NOT_A_NAME or len(display) < 3:
            display = from_hashtag(f.get("caption") or "")
            src = "hashtag"
        if not display or len(display) < 3:
            unresolved.append({
                "msg_id": f["msg_id"], "file_name": f.get("file_name"),
                "performer": perf, "title": f.get("title"), "caption": f.get("caption"),
                "size": f.get("size"),
            })
            continue

        k = key_of(display)
        g = groups.setdefault(k, {
            "key": k, "display": display, "variants": {}, "n": 0, "bytes": 0,
            "msg_ids": [], "samples": [], "sources": {},
        })
        # показываем САМЫЙ ПОЛНЫЙ из встреченных вариантов имени
        if len(display) > len(g["display"]):
            g["display"] = display
        g["variants"][display] = g["variants"].get(display, 0) + 1
        g["sources"][src] = g["sources"].get(src, 0) + 1
        g["n"] += 1
        g["bytes"] += f.get("size") or 0
        g["msg_ids"].append(f["msg_id"])
        if len(g["samples"]) < 3:
            g["samples"].append(f.get("title") or f.get("file_name"))

    artists = sorted(groups.values(), key=lambda x: -x["n"])
    out = {
        "channel": "@iskconecom",
        "n_files": len(files),
        "n_artists": len(artists),
        "n_unresolved": len(unresolved),
        "artists": artists,
        "unresolved": unresolved,
    }
    dest = Path(os.getenv("ROSTER_OUT") or (HERE / "kirtans_roster.json"))
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    gb = sum(a["bytes"] for a in artists) / 1e9
    print("::notice::РАЗОБРАНО: %d файлов · %d исполнителей · %.1f ГБ · не опознано: %d"
          % (len(files) - len(unresolved), len(artists), gb, len(unresolved)))
    for a in artists[:45]:
        s = "+".join("%s:%d" % (k, v) for k, v in sorted(a["sources"].items()))
        print("::notice::  %4d  %6.2f ГБ  %-34s  [%s]"
              % (a["n"], a["bytes"] / 1e9, a["display"][:34], s))
    if unresolved:
        print("::warning::НЕ ОПОЗНАНО %d файлов — в «разное» их НЕ сваливаю:" % len(unresolved))
        for u in unresolved[:12]:
            print("::warning::  file=«%s» perf=«%s» cap=«%s»"
                  % ((u.get("file_name") or "")[:44], (u.get("performer") or "")[:22],
                     (u.get("caption") or "")[:34]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
