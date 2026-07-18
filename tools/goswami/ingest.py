#!/usr/bin/env python3
"""
ingest.py — МАССОВАЯ ПЕРЕБРОСКА БАЗЫ: источник по HTTP → archive.org → D1 → плеер.

═══ ЗАЧЕМ ОТДЕЛЬНЫЙ ДВИЖОК ═══

`katha_ingest.py` возит катху из Telegram и накрепко к нему привязан: сессия,
FloodWait, `iter_messages`. Здесь источник — обычные ссылки, и это меняет всё:
скачивание дешёвое и распараллеливается вдесятеро, зато записей не сорок, а
тысячи. Поэтому движок написан ПОД ОБЪЁМ и НЕ ЗНАЕТ, откуда взялся план:

    план (JSON) → альбомы → дорожки с прямыми ссылками
    и больше ничего. Любая другая большая база приводится к тому же плану
    и едет этим же движком, без единой правки кода.

═══ ЧТО ДЕЛАЕТ ОБЪЁМ БОЛЬНЫМ (и как здесь лечится) ═══

1. СВЕРКА С АРХИВОМ. Наивно — по элементу за раз: тысяча альбомов × сетевой
   вызов = прогон умирает, не начав качать. Здесь сверка ПАРАЛЛЕЛЬНАЯ
   (`META_PARALLEL` потоков) и делается один раз в начале.
2. ПАМЯТЬ И ДИСК. Раннеру дают ~14 ГБ. Файл качается на диск, ЗАЛИВАЕТСЯ и
   ТУТ ЖЕ УДАЛЯЕТСЯ — на диске никогда не лежит больше, чем в работе.
3. ЗАПИСЬ В D1. По строке на дорожку — это тысячи вызовов. Здесь ПАЧКАМИ, и
   размер пачки считается от предела в 100 переменных связывания (ЗКН-Ф013).
4. БЮДЖЕТ ПРОГОНА. GitHub рубит job на 6 часах. Прогон сам следит за временем,
   доделывает начатое и сообщает воркфлоу, сколько осталось (`left=`), а тот
   перезапускает себя — так база переезжает за сколько угодно прогонов.
5. ИДЕМПОТЕНТНОСТЬ. Источник истины — metadata-API archive.org, а не наш
   журнал (ЗКН-Ф021): что уже лежит в архиве — не качается заново. Прогон
   можно оборвать в любой момент и запустить снова.
6. ЗАМЕР, А НЕ ВЕРА (ЗКН-Пл012). Скорость печатается по ходу: видно сразу,
   упёрлись мы в источник, в архив или в диск.

Команды:  run · verify · stats
"""
import asyncio
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).parent
ACCOUNT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
TOKEN = os.getenv("CLOUDFLARE_API_TOKEN") or ""

PLAN = Path(os.getenv("PLAN") or (HERE / "goswami_plan.json"))
SOURCE_HOME = os.getenv("SOURCE_HOME") or "https://goswami.ru/"
BUDGET = float(os.getenv("BUDGET_MIN") or 300) * 60
DL_PARALLEL = int(os.getenv("DL_PARALLEL") or 12)
IA_PARALLEL = int(os.getenv("IA_PARALLEL") or 6)
META_PARALLEL = int(os.getenv("META_PARALLEL") or 8)
WORK = Path(os.getenv("WORK") or "/tmp/goswami")
ONLY_ALBUM = (os.getenv("ONLY_ALBUM") or "").strip()
LIMIT = int(os.getenv("LIMIT") or 0)
BATCH = int(os.getenv("BATCH") or 8)
# Работников МЕНЬШЕ, чем раньше: каждый теперь тянет не файл, а пачку из BATCH
# штук сразу. Оставить прежние двенадцать — это 96 одновременных скачиваний
# в источник, и он закроется первым.
WORKERS = int(os.getenv("WORKERS") or 4)
DRY_RUN = (os.getenv("DRY_RUN") or "").strip() not in ("", "0", "false", "no")
START = time.time()

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

MAX_BINDS = 100


def plan() -> dict:
    if not PLAN.exists():
        print("::error::нет карты заливки %s — сначала plan.py" % PLAN)
        raise SystemExit(1)
    return json.loads(PLAN.read_text(encoding="utf-8"))


# ─────────────────────────── D1 ────────────────────────────
def d1(sql: str, params=None):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
        data=json.dumps({"sql": sql, "params": params or []}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                body = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:           # ЗКН-Ф014: не падать молча
            print("::error::D1 %s: %s" % (e.code, e.read().decode()[:300]))
            if attempt == 2:
                raise
            time.sleep(3 * (attempt + 1))
        except Exception as e:                        # noqa: BLE001
            if attempt == 2:
                print("::error::D1: %s" % str(e)[:200])
                raise
            time.sleep(3 * (attempt + 1))
    if not body.get("success"):
        print("::error::D1: %s" % json.dumps(body.get("errors"))[:300])
        raise SystemExit(1)
    return body["result"][0]["results"]


def d1_batch(sql_head: str, cols: int, rows: list, tail: str = ""):
    """Пачками, размер считается от предела в 100 переменных (ЗКН-Ф013)."""
    if not rows:
        return 0
    per = max(1, MAX_BINDS // cols)
    n = 0
    for i in range(0, len(rows), per):
        chunk = rows[i:i + per]
        ph, params = [], []
        for r in chunk:
            base = len(params)
            ph.append("(" + ",".join("?%d" % (base + k + 1) for k in range(cols)) + ")")
            params.extend(r)
        d1("%s VALUES %s %s" % (sql_head, ",".join(ph), tail), params)
        n += len(chunk)
    return n


# ─────────────────────── archive.org ────────────────────────
def ia_files(identifier: str):
    """Что РЕАЛЬНО лежит в элементе: имя → длина в секундах. Истина — архив (ЗКН-Ф021).

    Возвращает `None`, если УЗНАТЬ НЕ УДАЛОСЬ, и `{}`, если элемента нет или он
    пуст. Разница принципиальна. Раньше оба случая давали `{}`, и «я не смог
    проверить» читалось как «там ничего нет»: сверка отрапортовала 0 залитых при
    136 подтверждённых, а прогон собрался везти их заново. На суточной работе
    такая подмена уничтожает идемпотентность — любой перезапуск начинает с нуля.
    """
    url = f"https://archive.org/metadata/{identifier}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
                data = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {}                              # элемента нет — это ЗНАНИЕ
            if attempt == 2:
                return None                            # не смогли — это НЕЗНАНИЕ
            time.sleep(2 * (attempt + 1))
        except Exception:                              # noqa: BLE001
            if attempt == 2:
                return None
            time.sleep(2 * (attempt + 1))
    else:
        return None
    out = {}
    for f in data.get("files") or []:
        if f.get("source") != "original":
            continue
        if not f["name"].lower().endswith((".mp3", ".m4a", ".ogg", ".mp4")):
            continue
        try:
            ln = float(f.get("length") or 0)
        except (TypeError, ValueError):
            ln = 0.0
        out[f["name"]] = int(ln)
    return out


def d1_known(speaker: str) -> dict:
    """Что мы САМИ считаем залитым, по нашей базе: цикл → {имя файла: длительность}.

    Запасная опора на случай, когда archive.org не отвечает. Она слабее архива и
    первой не спрашивается, но она несравнимо лучше, чем принять молчание сети
    за пустой архив и повезти двести гигабайт по второму разу.
    """
    out = {}
    try:
        rows = d1("SELECT b.id AS aid, t.file, t.duration FROM katha_tracks t "
                  "JOIN katha_albums b ON b.id = t.album_id WHERE t.speaker_slug = ?1",
                  [speaker])
    except Exception as e:                             # noqa: BLE001
        print("::warning::опора на базу недоступна: %s" % str(e)[:120])
        return out
    for r in rows:
        out.setdefault(r["aid"], {})[r["file"]] = int(r["duration"] or 0)
    return out


def ia_survey(albums: list) -> dict:
    """Сверка ПАРАЛЛЕЛЬНАЯ и ОГРАНИЧЕННАЯ ПО ВРЕМЕНИ.

    Сверять надо (ЗКН-Ф021: истина — архив, а не наш журнал), но сверка не смеет
    съесть прогон. Не уложились — идём дальше, пометив неопрошенное как
    НЕИЗВЕСТНОЕ (`None`), а не как пустое.

    Потоков немного намеренно: под напором metadata-API не отказывает, а молчит,
    и два десятка потоков делают молчание массовым.
    """
    have = {}
    t0 = time.time()
    deadline = float(os.getenv("SURVEY_MIN") or 8) * 60
    total = len(albums)
    unknown = 0
    with ThreadPoolExecutor(max_workers=META_PARALLEL) as pool:
        futs = {pool.submit(ia_files, al["identifier"]): al["identifier"] for al in albums}
        done = 0
        for f in as_completed(futs):
            ident = futs[f]
            try:
                have[ident] = f.result()
            except Exception:                          # noqa: BLE001
                have[ident] = None
            if have[ident] is None:
                unknown += 1
            done += 1
            if done % 25 == 0 or done == total:
                el = time.time() - t0
                print("  … сверено %d/%d (не узнали %d, %.0f c)" % (done, total, unknown, el), flush=True)
                beat("сверка", done=done, total=total, unknown=unknown, sec=round(el))
            if time.time() - t0 > deadline:
                left = [futs[x] for x in futs if not x.done()]
                print("::warning::сверка не уложилась в срок: %d из %d" % (done, total), flush=True)
                for i in left:
                    have.setdefault(i, None)
                for x in futs:
                    x.cancel()
                break
    if unknown:
        print("::warning::archive.org не ответил по %d циклам — для них опора на нашу базу" % unknown,
              flush=True)
    return have



def beat(stage: str, **kv):
    """Пульс прогона в D1.

    Логи раннера доступны не всегда, а archive.org из песочницы не виден вовсе.
    Без пульса «идёт 40 минут» не отличить от «висит 40 минут»: обе картинки
    выглядят одинаково — ничего не происходит. Поэтому прогон сам докладывает,
    на какой он стадии и сколько прошёл, в таблицу, которую видно снаружи.
    """
    kv["stage"] = stage
    kv["at"] = time.strftime("%H:%M:%S")
    kv["min"] = round((time.time() - START) / 60, 1)
    try:
        d1("INSERT INTO app_config (key, value, updated_at) VALUES (?1, ?2, datetime('now')) "
           "ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
           ["goswami_progress", json.dumps(kv, ensure_ascii=False)])
    except Exception as e:                                    # noqa: BLE001
        print("::warning::пульс: %s" % str(e)[:120])


# ─────────────────────── скачивание ─────────────────────────
def fetch(url: str, dest: Path) -> int:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://goswami.ru/"})
    size = 0
    # ЗКН-Ф014: HTTPError перехватывается ЗДЕСЬ. Без этого сайт отдаёт 404/403,
    # а качалка падает молча — файл «не скачался», причина неизвестна.
    try:
        with urllib.request.urlopen(req, timeout=180, context=CTX) as r, dest.open("wb") as fh:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                fh.write(chunk)
                size += len(chunk)
    except urllib.error.HTTPError as e:
        raise RuntimeError("HTTP %s на %s" % (e.code, url)) from e
    if size < 4096:
        raise RuntimeError("подозрительно мал: %d Б" % size)
    return size


# ──────────────────────── регистрация ───────────────────────
def register_speakers_albums(p: dict):
    sp = p["speaker"]
    d1("""INSERT INTO katha_speakers (slug,name,full,role,era,origin,bio,mono,accent,entity_id,sort)
          VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
          ON CONFLICT(slug) DO UPDATE SET name=excluded.name, full=excluded.full, role=excluded.role,
            era=excluded.era, origin=excluded.origin, bio=excluded.bio, mono=excluded.mono,
            accent=excluded.accent, entity_id=excluded.entity_id, sort=excluded.sort""",
       [sp, p["speaker_name"], p.get("speaker_full"), p.get("speaker_role"), p.get("speaker_era"),
        p.get("speaker_origin"), p.get("speaker_bio"), p.get("speaker_mono"),
        1 if p.get("speaker_accent") else 0, p.get("speaker_entity"), int(p.get("speaker_sort") or 0)])

    rows = [[al["id"], sp, al["title"], al["identifier"], al.get("year"), al.get("note"),
             int(al.get("sort") or 0)] for al in p["albums"]]
    d1_batch("INSERT INTO katha_albums (id,speaker_slug,title,archive,year,note,sort)", 7, rows,
             """ON CONFLICT(id) DO UPDATE SET title=excluded.title, archive=excluded.archive,
                year=excluded.year, note=excluded.note, sort=excluded.sort""")
    print("::notice::реестр: рассказчик 1 · циклов %d" % len(rows))


def register_tracks(pairs: list):
    """pairs = [(album, track, duration)] — пишем пачками."""
    rows = []
    for al, t, dur in pairs:
        rows.append(["%s/%s" % (al["identifier"], t["file"]), al["speaker"], al["id"],
                     al["identifier"], t["file"], t["title"], int(dur or 0),
                     t.get("src_id"), int(t.get("sort") or 0)])
    return d1_batch(
        "INSERT INTO katha_tracks (id,speaker_slug,album_id,identifier,file,title,duration,msg_id,sort)",
        9, rows,
        """ON CONFLICT(id) DO UPDATE SET title=excluded.title, duration=excluded.duration,
           sort=excluded.sort, album_id=excluded.album_id""")


# ─────────────────────────── run ────────────────────────────
async def main_run() -> int:
    import internetarchive as ia

    p = plan()
    albums = p["albums"]
    speaker = p["speaker_name"]
    print("::notice::карта: циклов %d · записей %d"
          % (len(albums), sum(len(a["tracks"]) for a in albums)), flush=True)

    if DRY_RUN:
        print("::notice::ВХОЛОСТУЮ: ничего не публикуется и не пишется в базу", flush=True)
    else:
        register_speakers_albums(p)

    # Сверять надо лишь то, что прогон тронет. Полная сверка 277 циклов ради
    # сотни файлов — это минуты ожидания за данные, которые не понадобятся.
    scope = [a for a in albums if not ONLY_ALBUM or a["id"] == ONLY_ALBUM]
    if LIMIT:
        need, cut = 0, []
        for a in scope:
            cut.append(a)
            need += len(a["tracks"])
            if need >= LIMIT:
                break
        scope = cut
    print("сверка с архивом: %d из %d циклов…" % (len(scope), len(albums)), flush=True)
    have = ia_survey(scope)

    # «Не узнали» ≠ «пусто». Там, где archive.org промолчал, опираемся на нашу
    # базу — она знает, что мы уже возили. Иначе одно молчание сети стоит
    # повторной перевозки сотен гигабайт.
    mine = d1_known(p["speaker"])
    unknown = [i for i, v in have.items() if v is None]
    if unknown:
        by_ident = {a["identifier"]: a["id"] for a in albums}
        for ident in unknown:
            have[ident] = dict(mine.get(by_ident.get(ident, ""), {}))
        print("::notice::по %d циклам ответа архива нет — взято из базы (%d дорожек)"
              % (len(unknown), sum(len(have[i]) for i in unknown)), flush=True)
    already = sum(len(v or {}) for v in have.values())

    todo = []
    for al in albums:
        if ONLY_ALBUM and al["id"] != ONLY_ALBUM:
            continue
        got = have.get(al["identifier"]) or {}
        for t in al["tracks"]:
            if t["file"] in got:
                continue
            if not t.get("url"):
                continue
            todo.append((al, t))
    # Потолок прогона (ЗКН-Пл012): прежде чем пускать многочасовую переброску,
    # скорость меряется на первой сотне файлов. Без этого потолка «пробный»
    # прогон увёз бы всю базу.
    if LIMIT and len(todo) > LIMIT:
        print("::notice::потолок прогона: %d из %d" % (LIMIT, len(todo)), flush=True)
        todo = todo[:LIMIT]
    beat("к заливке", already=already, todo=len(todo))
    print("::notice::в архиве уже %d · к заливке %d" % (already, len(todo)), flush=True)

    # то, что уже лежит в архиве, но ещё не в базе — регистрируем сразу
    known = []
    for al in albums:
        got = have.get(al["identifier"]) or {}
        for t in al["tracks"]:
            sec = got.get(t["file"])
            if sec is not None:
                known.append((al, t, sec if sec > 0 else t.get("duration") or 0))
    if known:
        n = register_tracks(known)
        print("::notice::подтверждено в базе: %d дорожек" % n, flush=True)

    if not todo:
        Path(os.getenv("GITHUB_OUTPUT") or "/dev/null").open("a").write("left=0\n")
        print("::notice::всё уже в архиве")
        return 0

    WORK.mkdir(parents=True, exist_ok=True)
    ak, sk = os.environ["IA_ACCESS_KEY"], os.environ["IA_SECRET_KEY"]
    loop = asyncio.get_running_loop()
    pool = ThreadPoolExecutor(max_workers=IA_PARALLEL + 2)
    sem_up = asyncio.Semaphore(IA_PARALLEL)

    def do_upload(al: dict, items: list):
        """Заливает СРАЗУ НЕСКОЛЬКО файлов одного цикла одним вызовом.

        По файлу за вызов — это отдельный запрос к S3 и отдельная гонка создания
        элемента на КАЖДУЮ запись. При тысячах записей архив начинает отвечать
        отказами (поймали 24 подряд), а наши повторы ждут по 5/20/60 секунд и
        душат скорость сильнее самих отказов. Пачкой на цикл запросов в BATCH раз
        меньше, элемент создаётся однажды, и поводов для отказа почти не остаётся.

        Происхождение проставляется ВСЕГДА: зеркало обязано указывать на
        первоисточник, иначе через год никто не скажет, откуда запись и кто её
        правообладатель. `originalurl`/`source` — штатные поля archive.org.
        """
        meta = {
            "title": "%s — %s" % (speaker, al["title"]),
            "creator": speaker,
            "collection": "opensource_audio",
            "mediatype": "audio",
            "subject": ["katha", "lecture", "iskcon", "gaudiya vaishnava", "bhakti",
                        "катха", "лекция", "Бхакти Вигьяна Госвами"],
            "language": ["rus"],
            "source": SOURCE_HOME,
            "originalurl": SOURCE_HOME,
            "description": "%s. %s. Лекции на русском языке. Зеркало с %s"
                           % (al["title"], speaker, SOURCE_HOME),
        }
        if al.get("year"):
            meta["year"] = al["year"]
        files = {remote: path for remote, path, _t in items}
        resp = ia.upload(
            al["identifier"], files=files, metadata=meta,
            access_key=ak, secret_key=sk, queue_derive=False, verbose=False,
            retries=2, retries_sleep=15,
            request_kwargs={"timeout": 600},          # БЕЗ НЕГО ЗАЛИВКА ВИСНЕТ ЧАСАМИ
        )
        bad = [x for x in resp if getattr(x, "status_code", 200) not in (200, None)]
        if bad:
            raise RuntimeError("HTTP %s" % [getattr(x, "status_code", None) for x in bad])

    # Очередь не из файлов, а из ПАЧЕК одного цикла: один вызов заливки
    # закрывает сразу несколько записей.
    grouped: dict = {}
    for al, t in todo:
        grouped.setdefault(al["id"], (al, []))[1].append(t)
    batches = []
    for al, ts in grouped.values():
        for i in range(0, len(ts), BATCH):
            batches.append((al, ts[i:i + BATCH]))

    q: asyncio.Queue = asyncio.Queue()
    for b in batches:
        q.put_nowait(b)
    total = len(todo)
    print("::notice::пачек %d по %d файлов" % (len(batches), BATCH), flush=True)

    done = fail = 0
    bytes_done = 0.0
    t0 = time.time()
    stop = False
    pending: list = []
    beat_at = [0.0]
    lock = asyncio.Lock()

    async def flush(force=False):
        nonlocal pending
        async with lock:
            if not pending or (len(pending) < 10 and not force):
                return
            batch, pending = pending, []
        try:
            await loop.run_in_executor(pool, register_tracks, batch)
        except Exception as e:                        # noqa: BLE001
            print("::warning::запись в D1: %s" % str(e)[:160])

    async def one(al, tracks):
        """Пачка: качаем параллельно, заливаем одним вызовом, чистим за собой."""
        nonlocal done, bytes_done
        got = []
        try:
            async def grab(t):
                dest = WORK / ("%s-%s" % (al["id"], t["file"]))
                size = await loop.run_in_executor(pool, fetch, t["url"], dest)
                return t, dest, size

            for res in await asyncio.gather(*[grab(t) for t in tracks], return_exceptions=True):
                if isinstance(res, Exception):
                    print("::warning::%s: скачивание: %s" % (al["id"], str(res)[:120]))
                    continue
                got.append(res)
            if not got:
                raise RuntimeError("ни один файл пачки не скачался")

            if DRY_RUN:
                # Вхолостую: цепочка проверяется целиком, кроме публикации.
                for _t, _d, size in got:
                    bytes_done += size
                    done += 1
                return

            items = [(t["file"], str(dest), t) for t, dest, _s in got]
            last = None
            for attempt in range(3):                  # гонка создания элемента: 503/SlowDown
                try:
                    async with sem_up:
                        await loop.run_in_executor(pool, do_upload, al, items)
                    last = None
                    break
                except Exception as e:                # noqa: BLE001
                    last = e
                    await asyncio.sleep((5, 15, 40)[attempt])
            if last:
                raise last
        finally:
            for _t, dest, _s in got:
                dest.unlink(missing_ok=True)
        if DRY_RUN:
            return
        for t, _d, size in got:
            pending.append((al, t, t.get("duration") or 0))
            done += 1
            bytes_done += size
        await flush()

    async def worker():
        nonlocal fail, stop
        while not stop:
            try:
                al, tracks = q.get_nowait()
            except asyncio.QueueEmpty:
                return
            if time.time() - START > BUDGET:
                stop = True
                return
            try:
                await one(al, tracks)
            except Exception as e:                    # noqa: BLE001
                fail += len(tracks)
                print("::warning::%s (пачка %d): %s" % (al["id"], len(tracks), str(e)[:140]))
            # Пульс по ВРЕМЕНИ, а не по кратности счётчика: потоки увеличивают
            # `done` наперегонки и круглые числа проскакивают.
            if time.time() - beat_at[0] > 45:
                beat_at[0] = time.time()
                el = max(1.0, time.time() - t0)
                beat("заливка", done=done, total=total, fail=fail,
                     gb=round(bytes_done / 1e9, 2), mbs=round(bytes_done / 1e6 / el, 2))
                print("::notice::залито %d из %d · %.2f ГБ · %.1f МБ/с · %.1f зап/мин · ошибок %d"
                      % (done, total, bytes_done / 1e9, bytes_done / 1e6 / el,
                         done / el * 60, fail), flush=True)

    await asyncio.gather(*[worker() for _ in range(WORKERS)])
    await flush(force=True)
    pool.shutdown(wait=True)

    el = max(1.0, time.time() - t0)
    print("::notice::ЗА ПРОГОН: %d записей · %.2f ГБ · %.1f МБ/с · ошибок %d"
          % (done, bytes_done / 1e9, bytes_done / 1e6 / el, fail))
    left = max(0, total - done)
    Path(os.getenv("GITHUB_OUTPUT") or "/dev/null").open("a").write("left=%d\n" % left)
    print("::notice::осталось в очереди: %d" % left)
    return 0


# ────────────────────────── verify ──────────────────────────
def cmd_verify() -> int:
    """ЗКН-Ф021: «готово» = файлы ВИДНЫ В АРХИВЕ. Заодно уточняем длительность по архиву."""
    p = plan()
    albums = p["albums"]
    have = ia_survey(albums)
    missing_total = 0
    confirm = []
    empty_albums = []
    for al in albums:
        real = have.get(al["identifier"], {})
        want = {t["file"]: t for t in al["tracks"]}
        missing = sorted(set(want) - set(real))
        missing_total += len(missing)
        if not real:
            empty_albums.append(al["id"])
        for name, sec in real.items():
            t = want.get(name)
            if t:
                confirm.append((al, t, sec if sec > 0 else t.get("duration") or 0))
    if confirm:
        register_tracks(confirm)
    n = d1("SELECT COUNT(*) c FROM katha_tracks")[0]["c"]
    na = d1("SELECT COUNT(*) c FROM katha_albums")[0]["c"]
    print("::notice::в базе: циклов %d · дорожек %d · не залито %d · пустых циклов %d"
          % (na, n, missing_total, len(empty_albums)))
    if empty_albums:
        print("::warning::пустые циклы: %s" % ", ".join(empty_albums[:12]))
    Path(os.getenv("GITHUB_OUTPUT") or "/dev/null").open("a").write("left=%d\n" % missing_total)
    return missing_total


def cmd_stats() -> int:
    p = plan()
    tr = sum(len(a["tracks"]) for a in p["albums"])
    sec = sum(t.get("duration") or 0 for a in p["albums"] for t in a["tracks"])
    print("рассказчик : %s" % p["speaker_name"])
    print("циклов     : %d" % len(p["albums"]))
    print("записей    : %d" % tr)
    print("звучание   : %.0f ч" % (sec / 3600))
    for al in sorted(p["albums"], key=lambda a: -len(a["tracks"]))[:25]:
        h = sum(t.get("duration") or 0 for t in al["tracks"]) / 3600
        print("  %-42s %4d зап · %5.1f ч" % (al["title"][:42], len(al["tracks"]), h))
    return 0


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    if cmd == "verify":
        cmd_verify()
        return 0
    if cmd == "stats":
        return cmd_stats()
    if cmd == "run":
        return asyncio.run(main_run())
    print("команды: run | verify | stats", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
