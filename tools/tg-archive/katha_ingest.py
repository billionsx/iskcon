#!/usr/bin/env python3
"""
katha_ingest.py — ЗАЛИВКА КАТХИ: Telegram → archive.org → D1 → плеер.

Исполняет карту `katha_plan.json` (её строит katha_plan.py и её видно глазами
в репозитории). Гадать здесь не о чем: альбом, имя файла в архиве и название
дорожки уже решены и проверены ДО того, как гигабайты уехали.

Устройство взято у `kirtans_ingest.py` — оно уже увезло 42 ГБ киртанов и 33 ГБ
Шримад-Бхагаватам, и переизобретать его незачем:

    12 асинхронных воркеров тянут из ОЧЕРЕДИ (без барьера);
     6 параллельных заливок на archive.org через семафор;
    блокирующий upload — в ThreadPoolExecutor, чтобы не держать цикл событий;
    timeout=300 на заливку — БЕЗ НЕГО ОНА ВИСЛА ЧАСАМИ (урок ШБ);
    три попытки с растущей паузой — 12 воркеров в один новый элемент дают
       гонку создания (503/SlowDown), без повтора терялась треть записей;
    FloodWait от Telegram — ждём и повторяем, а не падаем.

ИДЕМПОТЕНТНОСТЬ: что уже лежит в архиве, того не качаем. Источник истины —
metadata-API archive.org, а не наш журнал (ЗКН-Ф021).

Команды:  run · verify
"""
import asyncio
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
ACCOUNT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
TOKEN = os.getenv("CLOUDFLARE_API_TOKEN") or ""

BUDGET = float(os.getenv("BUDGET_MIN") or 300) * 60
DL_PARALLEL = int(os.getenv("DL_PARALLEL") or 8)
IA_PARALLEL = int(os.getenv("IA_PARALLEL") or 5)
# Канал БОЛЬШЕ НЕ КОНСТАНТА: он записан у каждого альбома карты. Пока он жил
# здесь, второй рассказчик означал бы второй файл — а второй файл расходится с
# первым на первой же правке. ONLY_SPEAKER сужает прогон до одного голоса.
ONLY = (os.getenv("ONLY_SPEAKER") or "").strip()
WORK = Path("/tmp/katha")
START = time.time()


def plan() -> dict:
    return json.loads((HERE / "katha_plan.json").read_text(encoding="utf-8"))


def d1(sql: str, params=None):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
        data=json.dumps({"sql": sql, "params": params or []}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:              # ЗКН-Ф014: не падать молча
        print("::error::D1 %s: %s" % (e.code, e.read().decode()[:300]))
        raise
    if not body.get("success"):
        print("::error::D1: %s" % json.dumps(body.get("errors"))[:300])
        raise SystemExit(1)
    return body["result"][0]["results"]


def ia_files(identifier: str) -> dict:
    """Что РЕАЛЬНО лежит в элементе: имя → длина в секундах (или 0).

    Источник истины — архив, а не наш журнал. Длину берём отсюда же: в
    Telegram-метаданных она бывает вздорной (у одной записи стояло 7 ч 39 мин),
    а archive.org считает её по самому файлу.
    """
    try:
        with urllib.request.urlopen(f"https://archive.org/metadata/{identifier}", timeout=45) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code != 404:                            # 404 = элемента ещё нет, это норма
            print("::warning::archive.org %s: %s" % (e.code, identifier))
        return {}
    except Exception as e:                           # noqa: BLE001
        print("::warning::archive.org %s: %s" % (identifier, str(e)[:120]))
        return {}
    out = {}
    for f in data.get("files") or []:
        if f.get("source") != "original" or not f["name"].lower().endswith(".mp3"):
            continue
        try:
            ln = float(f.get("length") or 0)
        except (TypeError, ValueError):
            ln = 0.0
        out[f["name"]] = int(ln)
    return out


SPEAKERS = {
    "prabhupada": {
        "name": "Шрила Прабхупада",
        # ЗКН-И004: полный титул — ПРОПИСЬЮ. Полусокращённая форма «А.Ч. …»
        # запрещена: это ни полный титул, ни краткая форма.
        "full": "Его Божественная Милость Абхай Чаранаравинда Бхактиведанта Свами "
                "Шрила Прабхупада, Ачарья-основатель Международного общества "
                "сознания Кришны, ИСККОН",
        "role": "Ачарья-основатель ИСККОН",
        "era": "1896–1977",
        "origin": "Калькутта · Вриндаван",
        "bio": "Записи 1966–1976 годов: лекции по «Шримад-Бхагаватам», «Бхагавад-гите» "
               "и «Шри Чайтанья-чаритамрите», утренние прогулки, беседы и интервью — "
               "голос, которым Гауранга Лила пришла на Запад.",
        "mono": "Шрила Прабхупада", "accent": 1, "entity_id": "prabhupada", "sort": 10,
    },
    "purnacandra-goswami": {
        "name": "Пурначандра дас Госвами Махарадж",
        "full": "Е.С. Шрила Пурначандра дас Госвами Махарадж",
        "role": "Ученик Шрилы Прабхупады · санньяси ИСККОН",
        "era": "ушёл в 2010",
        "origin": "Нью-Йорк · Бхактиведанта-Мэнор · Москва",
        "bio": "Пришёл в ИСККОН в Нью-Йорке в 1976 году и вскоре присоединился к "
               "странствующей санкиртана-группе «Радха-Дамодара». С 1981 года проповедовал "
               "в Гонконге, на Филиппинах и в Индии; с 1987-го десять лет вёл еженедельные "
               "занятия по бхакти-шастрам в Бхактиведанта-Мэноре и Лондоне, затем курсы "
               "бхакти-шастри в Ирландии, Франции, Индии и странах Балтии. Санньясу и титул "
               "Госвами принял в 2008 году. Последние годы служил в России и на Украине, "
               "ушёл 4 ноября 2010 года в Москве, в месяц Картика. Записи этого собрания "
               "охватывают 1997–2010 годы.",
        "mono": "ПЧ", "accent": 0, "sort": 5,
    },
    "radha-govinda-goswami": {
        "name": "Радха Говинда Госвами Махарадж",
        "role": "Санньяси ИСККОН · рассказчик Шримад-Бхагаватам",
        "mono": "Радха Говинда", "accent": 0, "entity_id": "radha-govinda-swami", "sort": 20,
    },
    "gour-govinda-swami": {
        "name": "Гоур Говинда Свами Махарадж",
        "full": "Его Божественная Милость Шри Шримад Гоур Говинда Свами Махарадж",
        "role": "Санньяси ИСККОН · рассказчик Шримад-Бхагаватам",
        "era": "1929–1996",
        "origin": "Орисса · Гадеигири и Бхуванешвар",
        "bio": "Ученик Шрилы Прабхупады. Родился 2 сентября 1929 года в деревне "
               "Джаганнатхпур близ Джаганнатха Пури; вырос в Гадеигири, в роду Гири, "
               "славившемся киртаном со времён Шьямананды Прабху. Санньясу принял от "
               "Шрилы Прабхупады в 1975 году во Вриндаване, на открытии храма "
               "Кришны-Баларамы, и по его указанию поднял храм ИСККОН в Бхуванешваре — "
               "на пустой земле, в одиночку. Ушёл в Шри Маяпур-дхаме 9 февраля 1996 года. "
               "Его лекции считают одними из самых глубоких в движении.",
        "mono": "Гоур Говинда", "accent": 0, "entity_id": "gour-govinda-swami", "sort": 30,
    },
}


def sync_catalog(albums: list) -> None:
    """Рассказчики и альбомы — ИЗ КАРТЫ, а не руками в базе.

    Раньше строки `katha_speakers`/`katha_albums` заводились прямой правкой D1:
    карта говорила одно, витрина показывала другое, и найти рассогласование
    можно было только глазами. Теперь карта — единственный источник.
    """
    seen = []
    for al in albums:
        if al["speaker"] not in seen:
            seen.append(al["speaker"])
    for slug in seen:
        s = SPEAKERS.get(slug)
        if not s:
            continue
        d1("""INSERT INTO katha_speakers (slug, name, full, role, era, origin, bio, mono, accent, entity_id, sort)
              VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
              ON CONFLICT(slug) DO UPDATE SET name=excluded.name, full=excluded.full,
                role=excluded.role, era=excluded.era, origin=excluded.origin, bio=excluded.bio,
                mono=excluded.mono, accent=excluded.accent, entity_id=excluded.entity_id,
                sort=excluded.sort""",
           [slug, s["name"], s.get("full"), s.get("role"), s.get("era"), s.get("origin"),
            s.get("bio"), s.get("mono"), s.get("accent", 0), s.get("entity_id"), s.get("sort", 50)])
    for i, al in enumerate(albums, 1):
        base = SPEAKERS.get(al["speaker"], {}).get("sort", 50) * 100
        d1("""INSERT INTO katha_albums (id, speaker_slug, title, archive, sort)
              VALUES (?1,?2,?3,?4,?5)
              ON CONFLICT(id) DO UPDATE SET speaker_slug=excluded.speaker_slug,
                title=excluded.title, archive=excluded.archive, sort=excluded.sort""",
           [al["id"], al["speaker"], al["title"], al["identifier"], base + i])
    print("::notice::каталог сверен: рассказчиков %d · альбомов %d" % (len(seen), len(albums)))


def ext_of(name: str) -> str:
    m = re.search(r"\.([A-Za-z0-9]{2,4})$", name or "")
    return ("." + m.group(1).lower()) if m else ".bin"


def to_mp3(src: str, dst: str) -> None:
    """Несжатую запись — в mp3 ПЕРЕД заливкой.

    Часть записей залита в каналы как .wav и .m4a: одна лекция весит до 109 МБ.
    Отдавать такое телефону нельзя, и сверка с архивом (ЗКН-Ф021) считает только
    исходные mp3 — файл в другом формате навсегда остался бы «незалитым», а
    самоцепочка крутилась бы вхолостую до конца времён.

    Падаем громко: залить .wav под именем .mp3 — значит соврать о содержимом
    файла, и плеер обнаружит это уже у человека в руках.
    """
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src,
         "-vn", "-codec:a", "libmp3lame", "-q:a", "4", dst],
        capture_output=True, text=True)
    if r.returncode != 0 or not Path(dst).exists() or Path(dst).stat().st_size == 0:
        raise RuntimeError("ffmpeg: %s" % (r.stderr or "пустой файл")[:200])


def register(al: dict, t: dict, dur: int):
    d1("""INSERT INTO katha_tracks (id, speaker_slug, album_id, identifier, file, title, duration, msg_id, sort)
          VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title, duration=excluded.duration, sort=excluded.sort""",
       ["%s/%s" % (al["identifier"], t["file"]), al["speaker"], al["id"], al["identifier"],
        t["file"], t["title"], dur, t["msg_id"], t["sort"]])


# ─────────────────────────── run ────────────────────────────
async def main_run() -> int:
    import internetarchive as ia
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from telethon.errors import FloodWaitError

    p = plan()
    albums = [a for a in p["albums"] if not ONLY or a["speaker"] == ONLY]
    sync_catalog(albums)
    have, by_channel = {}, {}
    n_tracks = 0
    for al in albums:
        have[al["identifier"]] = ia_files(al["identifier"])
        by_channel.setdefault(al["channel"], {})
        for t in al["tracks"]:
            by_channel[al["channel"]][t["msg_id"]] = (al, t)
            n_tracks += 1
    already = sum(len(v) for v in have.values())
    print("::notice::каналов %d · альбомов %d · записей %d · в архиве уже %d"
          % (len(by_channel), len(albums), n_tracks, already))

    WORK.mkdir(parents=True, exist_ok=True)
    ak, sk = os.environ["IA_ACCESS_KEY"], os.environ["IA_SECRET_KEY"]
    loop = asyncio.get_running_loop()
    pool = ThreadPoolExecutor(max_workers=IA_PARALLEL + 1)
    sem_up = asyncio.Semaphore(IA_PARALLEL)

    def do_upload(al: dict, remote: str, path: str):
        speaker = al["speaker_name"]
        resp = ia.upload(
            al["identifier"], files={remote: path},
            metadata={
                "title": "%s — %s" % (speaker, al["title"]),
                "creator": speaker,
                "collection": "opensource_audio",
                "mediatype": "audio",
                "subject": ["katha", "srimad bhagavatam", "iskcon", "gaudiya vaishnava",
                            "bhakti", "катха", "Шримад-Бхагаватам"],
                "language": ["rus"],
                "description": "%s. %s. Катха на русском языке."
                               % (al["title"], speaker),
            },
            access_key=ak, secret_key=sk, queue_derive=False, verbose=False,
            retries=2, retries_sleep=20,
            request_kwargs={"timeout": 300},   # БЕЗ ЭТОГО ЗАЛИВКА ВИСЛА ЧАСАМИ
        )
        bad = [x for x in resp if getattr(x, "status_code", 200) not in (200, None)]
        if bad:
            raise RuntimeError("HTTP %s" % [getattr(x, "status_code", None) for x in bad])

    client = TelegramClient(StringSession(os.environ["TG_SESSION_STRING"]),
                            int(os.environ["TG_API_ID"]), os.environ["TG_API_HASH"])
    done = fail = 0
    bytes_done = 0.0
    t0 = time.time()
    stop = False

    async with client:
        await client.start()

        q: asyncio.Queue = asyncio.Queue()
        for channel, by_msg in by_channel.items():
            entity = await client.get_entity(channel)
            async for msg in client.iter_messages(entity):
                hit = by_msg.get(msg.id)
                if not hit:
                    continue
                al, t = hit
                if t["file"] in have[al["identifier"]]:
                    continue                          # уже в архиве
                doc = msg.audio or msg.document
                if not doc:
                    continue
                q.put_nowait((msg, al, t, getattr(doc, "size", 0) or 0))
        total = q.qsize()
        print("::notice::к заливке в этом прогоне: %d записей" % total)

        async def one(msg, al, t, size):
            nonlocal done, bytes_done
            dest = WORK / ("%d-%s" % (msg.id, t["file"]))
            raw = dest
            try:
                if t.get("transcode"):
                    # Скачиваем под исходным расширением: Telethon выбирает
                    # кодек по нему, а .mp3 на wav-потоке дал бы битый файл.
                    raw = WORK / ("%d-src%s" % (msg.id, ext_of(t.get("source") or "")))
                while True:                           # FloodWait — ждём, а не падаем
                    try:
                        await client.download_media(msg, file=str(raw))
                        break
                    except FloodWaitError as e:
                        print("FloodWait %ss" % e.seconds)
                        await asyncio.sleep(e.seconds + 1)
                if t.get("transcode"):
                    await loop.run_in_executor(pool, to_mp3, str(raw), str(dest))
                last = None
                for attempt in range(3):              # гонка создания элемента
                    try:
                        async with sem_up:
                            await loop.run_in_executor(pool, do_upload, al, t["file"], str(dest))
                        last = None
                        break
                    except Exception as e:            # noqa: BLE001
                        last = e
                        await asyncio.sleep((5, 20, 60)[attempt])
                if last:
                    raise last
            finally:
                dest.unlink(missing_ok=True)
                raw.unlink(missing_ok=True)          # исходник перекодировки
            register(al, t, t["duration"])
            done += 1
            bytes_done += size

        async def worker():
            nonlocal fail, stop
            while not stop:
                try:
                    msg, al, t, size = q.get_nowait()
                except asyncio.QueueEmpty:
                    return
                if time.time() - START > BUDGET:
                    stop = True
                    return
                try:
                    await one(msg, al, t, size)
                except Exception as e:                # noqa: BLE001
                    fail += 1
                    print("::warning::%s: %s" % (t["file"], str(e)[:120]))
                if done and done % 5 == 0:
                    el = max(1.0, time.time() - t0)
                    print("::notice::залито %d из %d · %.2f ГБ · %.1f МБ/с · ошибок %d"
                          % (done, total, bytes_done / 1e9, bytes_done / 1e6 / el, fail))

        await asyncio.gather(*[worker() for _ in range(DL_PARALLEL)])

    pool.shutdown(wait=True)
    print("::notice::ЗА ПРОГОН: %d · ошибок %d" % (done, fail))
    left = cmd_verify(quiet=True)
    rest, nxt = remaining_others()
    print("::notice::осталось у своего: %d · у остальных: %d · дальше: %s"
          % (left, rest, nxt or "—"))
    with Path(os.getenv("GITHUB_OUTPUT") or "/dev/null").open("a") as fh:
        fh.write("left=%d\nrest=%d\nnext=%s\n" % (left, rest, nxt))
    return 0


def remaining_by_speaker() -> dict:
    """Незалитые записи по рассказчикам: {slug: сколько осталось}."""
    rest = {}
    for al in plan()["albums"]:
        have = set(ia_files(al["identifier"]))
        n = len(set(t["file"] for t in al["tracks"]) - have)
        if n:
            rest[al["speaker"]] = rest.get(al["speaker"], 0) + n
    return rest


def remaining_others() -> tuple:
    """Чужой остаток и КОМУ передать ход: (сколько, slug).

    Цепочка запускала себя с тем же фильтром, с каким её позвали. Пока рассказчик
    был один, это было незаметно; с четырьмя каналами получилось так, что первый
    же долгий голос занимает единственную сессию Telegram (ЗКН-Пл003) на сутки, а
    следом никто не встаёт: очередь свободна, а звать в неё некому.

    Ход передаём тому, у кого остаток МЕНЬШЕ. Иначе канал на сорок лекций стоит
    за каналом на тысячу двести и не появляется в приложении неделю — при том,
    что своей очереди ему хватило бы на час.
    """
    if not ONLY:
        return 0, ""
    rest = {k: v for k, v in remaining_by_speaker().items() if k != ONLY}
    if not rest:
        return 0, ""
    nxt = min(rest, key=lambda s: rest[s])
    return sum(rest.values()), nxt


# ────────────────────────── verify ──────────────────────────
def cmd_verify(quiet: bool = False) -> int:
    """ЗКН-Ф021: «готово» = файлы ВИДНЫ В АРХИВЕ. Заодно правим длительность по архиву."""
    p = plan()
    albums = [a for a in p["albums"] if not ONLY or a["speaker"] == ONLY]
    sync_catalog(albums)
    missing_total = 0
    fixed = 0
    for al in albums:
        real = ia_files(al["identifier"])
        want = {t["file"]: t for t in al["tracks"]}
        missing = sorted(set(want) - set(real))
        missing_total += len(missing)
        for name, sec in real.items():
            t = want.get(name)
            if not t:
                continue
            dur = sec if sec > 0 else t["duration"]
            register(al, t, dur)
            if sec > 0 and abs(sec - t["duration"]) > 5:
                fixed += 1
        mark = "✓" if not missing else "нет %d" % len(missing)
        print("::notice::%-14s %4d/%4d  %s" % (al["id"], len(real), len(want), mark))
        if missing and not quiet:
            print("::warning::%s не залито: %s" % (al["id"], ", ".join(missing[:8])))
    n = d1("SELECT COUNT(*) c FROM katha_tracks")[0]["c"]
    print("::notice::дорожек в базе: %d · длительность уточнена по архиву: %d · не залито: %d"
          % (n, fixed, missing_total))
    return missing_total


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    if cmd == "verify":
        return 0 if cmd_verify() == 0 else 0
    if cmd == "run":
        return asyncio.run(main_run())
    print("команды: run | verify", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
