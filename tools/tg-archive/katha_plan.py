#!/usr/bin/env python3
"""
katha_plan.py — КАРТА ЗАЛИВКИ катхи: разведка канала → альбомы, имена файлов, названия.

═══ ПОЧЕМУ КАРТА ОТДЕЛЬНО ОТ ЗАЛИВКИ ═══

Имя файла в канале — это не название лекции. Там имя лектора, подчёркивания,
кириллица и латиница вперемешку, даты внутри имени:

    «Радха_Говинда_Свами_Вопросы_Парикшита_1.mp3»
    «Радха_Говинда_Свами_1_Радха_Говинда_Свами_Вриндаван_24_10_2015_.mp3»
    «Радха Говинда Свами - Гопи Гита 1.mp3»

Такое имя нельзя ни положить в archive.org (кириллица в URL), ни показать
человеку. Поэтому карта строится ОТДЕЛЬНЫМ ШАГОМ, её результат КОММИТИТСЯ в
репозиторий и его видно глазами ДО того, как 3 ГБ уедут в архив. Заливка потом
только исполняет карту — гадать ей не о чем (ЗКН-Пл010).

    файл в архиве:  gopi-gita-01.mp3          латиница, с ведущим нулём — сортируется
    название:       «Часть 1»                 альбом уже назван, повторять его в дорожке незачем
    альбом:         «Гопи-гита»               из заголовочного поста канала

Вход:  docs/diagnostics/katha-probe.json  (katha_probe.py)
Выход: tools/tg-archive/katha_plan.json
Запуск: python katha_plan.py
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
PROBE = HERE.parent.parent / "docs" / "diagnostics" / "katha-probe.json"
OUT = HERE / "katha_plan.json"

SPEAKER = "radha-govinda-goswami"
SPEAKER_NAME = "Радха Говинда Госвами Махарадж"

MONTHS = {
    1: "января", 2: "февраля", 3: "марта", 4: "апреля", 5: "мая", 6: "июня",
    7: "июля", 8: "августа", 9: "сентября", 10: "октября", 11: "ноября", 12: "декабря",
}

# ═══ АЛЬБОМЫ КАНАЛА ═══
# Порядок и состав объявлены самим каналом (закрепляющий пост со списком катх).
# Каждый альбом узнаётся по слову-метке в имени файла: канал держит его строго,
# и это единственная разметка, которой можно верить (title/performer пусты у всех 42).
ALBUMS = [
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


def parts_of(stem: str):
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


def date_of(stem: str):
    m = re.search(r"(\d{1,2})[._](\d{1,2})[._](20\d\d)", stem)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return "%d %s %d" % (d, MONTHS.get(mo, ""), y)


def main() -> int:
    if not PROBE.exists():
        print("нет разведки: %s" % PROBE, file=sys.stderr)
        return 1
    msgs = json.loads(PROBE.read_text(encoding="utf-8"))["channels"][0]["messages"]
    audio = [m for m in msgs if m.get("audio")]

    plan, used = [], set()
    for al in ALBUMS:
        rows = [m for m in audio
                if al["match"] in (m.get("file_name") or "") and m["msg_id"] not in used]
        rows.sort(key=lambda m: m["msg_id"])
        tracks = []
        for i, m in enumerate(rows, 1):
            used.add(m["msg_id"])
            stem = re.sub(r"\.mp3$", "", m["file_name"] or "", flags=re.I)
            # номер лекции берём из имени; если разметки нет — по порядку сообщений
            n, sub = parts_of(re.sub(r"^Радха[ _]Говинда[ _]Свами[ _\-]*", "", stem))
            if not n or n > len(rows) + 6:
                n, sub = i, None
            title = "Часть %d" % n
            if sub:
                title += " · %d" % sub
            if al.get("dated"):
                d = date_of(stem)
                if d:
                    title += " · %s" % d
            fname = "%s-%02d%s.mp3" % (al["file"], n, "-%d" % sub if sub else "")
            tracks.append({
                "msg_id": m["msg_id"], "file": fname, "title": title,
                "duration": m.get("duration") or 0, "size": m.get("size") or 0,
                "source": m["file_name"],
            })
        # порядок дорожки = номер лекции, затем номер куска (а не порядок сообщений)
        tracks.sort(key=lambda t: t["file"])
        for i, t in enumerate(tracks, 1):
            t["sort"] = i
        plan.append({**{k: al[k] for k in ("id", "title", "identifier")},
                     "speaker": SPEAKER, "n": len(tracks), "tracks": tracks})

    orphans = [m["file_name"] for m in audio if m["msg_id"] not in used]
    total = sum(a["n"] for a in plan)
    OUT.write_text(json.dumps(
        {"channel": "@radhagovindasw", "speaker": SPEAKER, "speaker_name": SPEAKER_NAME,
         "n_audio": len(audio), "n_planned": total, "orphans": orphans, "albums": plan},
        ensure_ascii=False, indent=1), encoding="utf-8")

    print("альбомов: %d · записей: %d из %d" % (len(plan), total, len(audio)))
    for a in plan:
        print("  %-22s %2d  %s" % (a["id"], a["n"], a["title"]))
    if orphans:
        print("::warning::вне альбомов осталось %d: %s" % (len(orphans), orphans[:5]))
    return 0 if not orphans else 0


if __name__ == "__main__":
    raise SystemExit(main())
