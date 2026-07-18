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
from concurrent.futures import ThreadPoolExecutor
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
META_PARALLEL = int(os.getenv("META_PARALLEL") or 24)
WORK = Path(os.getenv("WORK") or "/tmp/goswami")
ONLY_ALBUM = (os.getenv("ONLY_ALBUM") or "").strip()
LIMIT = int(os.getenv("LIMIT") or 0)
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
def ia_files(identifier: str) -> dict:
    """Что РЕАЛЬНО лежит в элементе: имя → длина в секундах. Истина — архив (ЗКН-Ф021)."""
    url = f"https://archive.org/metadata/{identifier}"
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45, context=CTX) as r:
                data = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {}
            if attempt == 1:
                print("::warning::archive.org %s: %s" % (e.code, identifier))
                return {}
            time.sleep(2)
        except Exception as e:                        # noqa: BLE001
            if attempt == 1:
                print("::warning::archive.org %s: %s" % (identifier, str(e)[:120]))
                return {}
            time.sleep(2)
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


def ia_survey(albums: list) -> dict:
    """Сверка ПАРАЛЛЕЛЬНАЯ: по одному вызову на альбом, но в много потоков.
    Последовательно тысяча альбомов съела бы весь бюджет прогона."""
    have = {}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=META_PARALLEL) as pool:
        futs = {pool.submit(ia_files, al["identifier"]): al["identifier"] for al in albums}
        done = 0
        for f in futs:
            pass
        for f, ident in futs.items():
            try:
                have[ident] = f.result()
            except Exception:                         # noqa: BLE001
                have[ident] = {}
            done += 1
            if done % 100 == 0:
                print("  … сверено %d/%d альбомов (%.0f c)" % (done, len(futs), time.time() - t0), flush=True)
    return have


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

    register_speakers_albums(p)

    print("сверка с архивом…", flush=True)
    have = ia_survey(albums)
    already = sum(len(v) for v in have.values())

    todo = []
    for al in albums:
        if ONLY_ALBUM and al["id"] != ONLY_ALBUM:
            continue
        got = have.get(al["identifier"], {})
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
    print("::notice::в архиве уже %d · к заливке %d" % (already, len(todo)), flush=True)

    # то, что уже лежит в архиве, но ещё не в базе — регистрируем сразу
    known = []
    for al in albums:
        got = have.get(al["identifier"], {})
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

    def do_upload(al: dict, remote: str, path: str, t: dict):
        # Происхождение проставляется ВСЕГДА: зеркало обязано указывать на
        # первоисточник, иначе через год никто не скажет, откуда запись и кто
        # её правообладатель. `originalurl`/`source` — штатные поля archive.org
        # ровно для этого.
        src = t.get("src_page") or SOURCE_HOME
        meta = {
            "title": "%s — %s" % (speaker, al["title"]),
            "creator": speaker,
            "collection": "opensource_audio",
            "mediatype": "audio",
            "subject": ["katha", "lecture", "iskcon", "gaudiya vaishnava", "bhakti",
                        "катха", "лекция", "Бхакти Вигьяна Госвами"],
            "language": ["rus"],
            "source": SOURCE_HOME,
            "originalurl": src,
            "description": "%s. %s. Лекции на русском языке. Зеркало записи с %s"
                           % (al["title"], speaker, src),
        }
        if al.get("year"):
            meta["year"] = al["year"]
        if t.get("date"):
            meta["date"] = t["date"]
        resp = ia.upload(
            al["identifier"], files={remote: path}, metadata=meta,
            access_key=ak, secret_key=sk, queue_derive=False, verbose=False,
            retries=2, retries_sleep=20,
            request_kwargs={"timeout": 300},          # БЕЗ НЕГО ЗАЛИВКА ВИСНЕТ ЧАСАМИ
        )
        bad = [x for x in resp if getattr(x, "status_code", 200) not in (200, None)]
        if bad:
            raise RuntimeError("HTTP %s" % [getattr(x, "status_code", None) for x in bad])

    q: asyncio.Queue = asyncio.Queue()
    for item in todo:
        q.put_nowait(item)
    total = q.qsize()

    done = fail = 0
    bytes_done = 0.0
    t0 = time.time()
    stop = False
    pending: list = []
    lock = asyncio.Lock()

    async def flush(force=False):
        nonlocal pending
        async with lock:
            if not pending or (len(pending) < 40 and not force):
                return
            batch, pending = pending, []
        try:
            await loop.run_in_executor(pool, register_tracks, batch)
        except Exception as e:                        # noqa: BLE001
            print("::warning::запись в D1: %s" % str(e)[:160])

    async def one(al, t):
        nonlocal done, bytes_done
        dest = WORK / ("%s-%s" % (al["id"], t["file"]))
        try:
            size = await loop.run_in_executor(pool, fetch, t["url"], dest)
            last = None
            for attempt in range(3):                  # гонка создания элемента: 503/SlowDown
                try:
                    async with sem_up:
                        await loop.run_in_executor(pool, do_upload, al, t["file"], str(dest), t)
                    last = None
                    break
                except Exception as e:                # noqa: BLE001
                    last = e
                    await asyncio.sleep((5, 20, 60)[attempt])
            if last:
                raise last
        finally:
            dest.unlink(missing_ok=True)
        pending.append((al, t, t.get("duration") or 0))
        done += 1
        bytes_done += size
        await flush()

    async def worker():
        nonlocal fail, stop
        while not stop:
            try:
                al, t = q.get_nowait()
            except asyncio.QueueEmpty:
                return
            if time.time() - START > BUDGET:
                stop = True
                return
            try:
                await one(al, t)
            except Exception as e:                    # noqa: BLE001
                fail += 1
                print("::warning::%s/%s: %s" % (al["id"], t["file"], str(e)[:140]))
            if done and done % 25 == 0:
                el = max(1.0, time.time() - t0)
                print("::notice::залито %d из %d · %.2f ГБ · %.1f МБ/с · %.1f зап/мин · ошибок %d"
                      % (done, total, bytes_done / 1e9, bytes_done / 1e6 / el, done / el * 60, fail),
                      flush=True)

    await asyncio.gather(*[worker() for _ in range(DL_PARALLEL)])
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
