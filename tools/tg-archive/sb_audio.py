#!/usr/bin/env python3
"""
sb_audio.py — озвучка «Шримад-Бхагаватам» (12 песней, стих за стихом с комментариями):
Telegram → archive.org → D1.

ЧТО ЭТО. В каналах «Шримад-Бхагаватам, песнь N» лежит 13 256 файлов (33.5 GB) —
по одному на СТИХ (стих + комментарий), плюс введение к каждой главе и передняя
материя. Нарезка совпадает с изданием БТТ один в один: 770 слитых стихов в аудио =
770 слитых `ref` в D1. Значит аудио связывается с книгой не «на глазок», а точно.

АРХИТЕКТУРА
  • Один объект archive.org на песнь: iskcone-sb-1 … iskcone-sb-12.
  • Имя файла внутри объекта — машиночитаемое и сортируемое:
        <глава:03d>.<позиция:03d>.<метка>.mp3
        001.000.vvedenie.mp3     введение к главе
        001.001.t1.mp3           ШБ 1.1.1
        010.021.t21-22.mp3       ШБ 1.10.21-22  (слитый стих)
        000.001.ob-avtore.mp3    передняя материя песни (глава 0)
  • Таблица sb_audio в D1: файл ↔ (песнь, глава, стих). По ней воркер строит плейлист
    мгновенно, не дёргая archive.org на каждый запрос.

ДИСЦИПЛИНА (ЗКН-Пл004, §6)
  • Идемпотентность: файл, уже лежащий в объекте archive.org, не качается повторно —
    прогон можно перезапускать сколько угодно, докатит с места обрыва.
  • Регистрируем в D1 только то, что РЕАЛЬНО залито (ЗКН-Пр007: кнопка обещает только
    то, что есть).
  • Бюджет времени: за TIME_BUDGET_MIN до конца раннера прогон сворачивается штатно —
    дозаливает начатое, пишет в D1, выходит с кодом 0.

Env: TG_API_ID, TG_API_HASH, TG_SESSION_STRING, IA_ACCESS_KEY, IA_SECRET_KEY,
     CLOUDFLARE_API_TOKEN, SB_CANTOS (напр. "1,2,3"; пусто = все 12),
     TIME_BUDGET_MIN (по умолчанию 320), IA_PARALLEL (по умолчанию 3).
"""
import asyncio
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from tg_archive import build_client, load_dotenv_if_present, slug  # noqa: E402

WORK = Path(__file__).parent / "sb_work"
START = time.time()
BUDGET = float(os.getenv("TIME_BUDGET_MIN") or 320) * 60
PARALLEL = int(os.getenv("IA_PARALLEL") or 6)       # параллельных заливок на archive.org
DL_PARALLEL = int(os.getenv("DL_PARALLEL") or 12)  # параллельных скачиваний из Telegram
# Замер на живом канале: последовательно — 3.5 файла/мин; 6 потоков — 18.9. Узкое место —
# именно скачивание, и оно масштабируется линейно. FloodWait перехватывается и пережидается,
# так что перебор с параллелизмом сам себя тормозит, а не ломает.
CHUNK = 120                                        # размер порции: сверка бюджета и запись в D1

ACCOUNT = os.getenv("CF_ACCOUNT_ID", "d5cbe19470dc38599873eabfe148e6d1")
DB = os.getenv("D1_DATABASE_ID", "6226aded-dd03-4e74-977f-9cd0b509e73d")
CF_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")

# Имена песней — от издателя (названия самих каналов = каноничные подзаголовки БТТ).
CANTO_NAMES = {
    1: "Творение", 2: "Космическое проявление", 3: "Статус-кво",
    4: "Творение четвёртого уровня", 5: "Движущая сила творения",
    6: "Предписанные обязанности человечества", 7: "Наука о Боге",
    8: "Сворачивание космического проявления", 9: "Освобождение",
    10: "Summum Bonum", 11: "Всеобщая история", 12: "Век деградации",
}
# Автор — канон каталога (apps/web/src/books.ts → BOOKS.sb.author). Единый стандарт имени.
AUTHOR = ("Его Божественная Милость Абхай Чаранаравинда Бхактиведанта Свами Шрила Прабхупада, "
          "Ачарья-основатель Международного общества сознания Кришны, ИСККОН")
ABOUT = ("«Бхагавата-пурана» — сливки всех Вед: повествования о Верховной Личности Бога, "
         "Его воплощениях и преданных, ведущие к высшей цели жизни — чистой любви к Богу.")

# ── Разбор имён из канала (ЗКН-Пл010: перебраны ВСЕ формы разметки, см. sb-audio-probe.json) ──
RX_TEXT = re.compile(r'^шб[\s_]*(\d{1,2})[.\s_]+(\d{1,3})[\s_]*текст[\s_]*(\d{1,3}(?:\s*[-–—]\s*\d{1,3})?)',
                     re.I)
RX_INTRO = re.compile(r'^шб[\s_]*(\d{1,2})[.\s_]+(\d{1,3})[\s_]*(введение|обращение|вступительное)', re.I)
RX_CANTO_FRONT = re.compile(r'^шб[\s_]*(\d{1,2})[\s_]+(?!\d)', re.I)  # «шб_10_Краткое описание…»


def parse_name(orig: str):
    """Имя файла из канала → (глава, вид, спецификатор стиха, метка).
    глава 0 = передняя материя песни. вид: verse | intro | front."""
    n = (orig or "").strip()
    stem = re.sub(r'\.[A-Za-z0-9]{2,4}$', '', n)
    m = RX_TEXT.match(stem)
    if m:
        ch = int(m.group(2))
        spec = re.sub(r'\s*[-–—]\s*', '-', m.group(3).strip())
        return ch, "verse", spec, f"t{spec}"
    m = RX_INTRO.match(stem)
    if m:
        ch = int(m.group(2))
        return ch, "intro", None, "vvedenie"
    if RX_CANTO_FRONT.match(stem) or not stem.lower().startswith("шб"):
        return 0, "front", None, slug(stem, "chast")
    return 0, "front", None, slug(stem, "chast")


def track_title(kind: str, spec, orig: str) -> str:
    if kind == "verse":
        return f"Текст {spec.replace('-', '–')}"
    if kind == "intro":
        return "Введение"
    t = re.sub(r'\.[A-Za-z0-9]{2,4}$', '', (orig or "").strip()).replace("_", " ").strip()
    t = re.sub(r'^шб\s*\d{1,2}\s*', '', t, flags=re.I).strip()
    return (t[:1].upper() + t[1:]) if t else "Часть"


def d1(sql, params=None):
    if not CF_TOKEN:
        raise SystemExit("Нет CLOUDFLARE_API_TOKEN")
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query"
    body = json.dumps({"sql": sql, "params": params or []}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {CF_TOKEN}", "Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                j = json.loads(r.read())
            if not j.get("success"):
                raise RuntimeError(f"D1: {j.get('errors')}")
            return j["result"][0]["results"]
        except Exception as e:
            if attempt == 3:
                raise SystemExit(f"D1 недоступна: {e}")
            time.sleep(2 * (attempt + 1))


def ensure_schema():
    d1("""CREATE TABLE IF NOT EXISTS sb_audio (
            file TEXT PRIMARY KEY, canto INTEGER NOT NULL, chapter INTEGER NOT NULL,
            seq INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT, title TEXT NOT NULL,
            duration INTEGER, src TEXT NOT NULL)""")
    d1("CREATE INDEX IF NOT EXISTS idx_sb_audio_pos ON sb_audio(canto, chapter, seq)")


def register(rows):
    """Пишем в D1 только подтверждённо залитое. Чанк 10×9=90 биндов < лимита D1 (~100)."""
    n = 0
    for i in range(0, len(rows), 10):
        chunk = rows[i:i + 10]
        vals, params = [], []
        for k, r in enumerate(chunk):
            b = k * 9
            vals.append(f"(?{b+1},?{b+2},?{b+3},?{b+4},?{b+5},?{b+6},?{b+7},?{b+8},?{b+9})")
            params += [r["file"], r["canto"], r["chapter"], r["seq"], r["kind"],
                       r["ref"], r["title"], r["duration"], r["src"]]
        d1("INSERT OR REPLACE INTO sb_audio (file,canto,chapter,seq,kind,ref,title,duration,src) "
           "VALUES " + ",".join(vals), params)
        n += len(chunk)
    return n


def canto_metadata(canto: int) -> dict:
    name = CANTO_NAMES[canto]
    return {
        "mediatype": "audio",
        "collection": "opensource_audio",
        "title": f"Шримад-Бхагаватам. Песнь {canto} «{name}» — аудио, стих за стихом с комментариями",
        "creator": AUTHOR,
        "language": "rus",
        "date": "2026",
        "description": (
            f"{ABOUT}<br/><br/>Песнь {canto} «{name}» — полная аудиоверсия: каждый стих с "
            f"комментарием Шрилы Прабхупады, отдельным файлом, плюс введения к главам. "
            f"Аудиокнига цифровой библиотеки ISKCON ONE LOVE: "
            f'<a href="https://gaurangers.com/shrimad-bhagavatam">gaurangers.com/shrimad-bhagavatam</a>'
        ),
        "subject": ["Шримад-Бхагаватам", "Srimad-Bhagavatam", "Bhagavata Purana", f"Песнь {canto}",
                    "ISKCON", "ИСККОН", "Гаудия-вайшнавизм", "Сознание Кришны", "Hare Krishna",
                    "Шрила Прабхупада", "Bhaktivedanta", "аудиокнига", "audiobook"],
        "external-identifier": "urn:related-book:https://vedabase.io/ru/library/sb/",
    }


async def run_canto(client, canto: int, pool, loop) -> bool:
    """True — песнь докатана до конца; False — вышли по бюджету времени.

    Конвейер: сначала СКАНИРУЕМ канал (метаданные, дёшево) и строим план; уже лежащее на
    archive.org отсеиваем сразу. Затем гоняем план порциями: DL_PARALLEL скачиваний и
    IA_PARALLEL заливок работают внахлёст. Последовательная качалка давала 0.23 МБ/с —
    это 40 часов на 33.5 GB; узким местом была именно она, а не Telegram как таковой.
    """
    from telethon.tl.types import DocumentAttributeAudio, DocumentAttributeFilename
    from telethon.errors import FloodWaitError
    from internetarchive import get_item, upload as ia_upload

    ak, sk = os.getenv("IA_ACCESS_KEY"), os.getenv("IA_SECRET_KEY")
    ident = f"iskcone-sb-{canto}"
    channel = f"https://t.me/srimad_bhagavatam_pesn_{canto}"

    item = get_item(ident)
    existed = bool(getattr(item, "exists", False))
    have = set()
    if existed:
        for f in (item.files or []):
            nm = f.get("name") if isinstance(f, dict) else getattr(f, "name", None)
            if nm:
                have.add(nm)
    WORK.mkdir(exist_ok=True)

    # ── 1. План: чего ещё нет в объекте ──
    plan: list = []
    rows_ok: list[dict] = []
    playlist: list[dict] = []
    seq_by_ch: dict[int, int] = {}
    n_skip = 0
    entity = await client.get_entity(channel)
    async for msg in client.iter_messages(entity, reverse=True):
        doc = msg.audio or (msg.document if msg.document and
                            (msg.document.mime_type or "").startswith("audio/") else None)
        if not doc:
            continue
        orig = None
        dur = None
        for a in doc.attributes:
            if isinstance(a, DocumentAttributeAudio):
                dur = a.duration
            elif isinstance(a, DocumentAttributeFilename):
                orig = a.file_name
        orig = orig or f"audio-{msg.id}.mp3"

        ch, kind, spec, label = parse_name(orig)
        seq = seq_by_ch.get(ch, 0)
        seq_by_ch[ch] = seq + 1
        remote = f"{ch:03d}.{seq:03d}.{label}.mp3"
        row = {"file": f"{ident}/{remote}", "canto": canto, "chapter": ch, "seq": seq,
               "kind": kind, "ref": (f"ШБ {canto}.{ch}.{spec}" if kind == "verse" else None),
               "title": track_title(kind, spec, orig), "duration": dur,
               "src": f"/audio/{ident}/{remote}"}
        playlist.append({"file": remote, "title": row["title"], "ref": row["ref"], "orig": orig})
        if remote in have:
            n_skip += 1
            rows_ok.append(row)
        else:
            plan.append((msg, remote, row, getattr(doc, "size", 0) or 0))

    todo_gb = sum(p[3] for p in plan) / 1e9
    print(f"::notice::Песнь {canto} → {ident}: уже залито {n_skip}, осталось {len(plan)} "
          f"({todo_gb:.2f} GB)")

    md_done = existed
    n_up = n_fail = 0
    reg_from = 0

    def flush(force: bool = False) -> None:
        # Пишем в D1 ПОРЦИЯМИ: у песни 10 это 3662 файла — обрыв раннера не должен обнулять учёт.
        nonlocal reg_from
        if len(rows_ok) - reg_from >= (1 if force else 200):
            register(rows_ok[reg_from:])
            reg_from = len(rows_ok)

    def do_upload(remote: str, path: str, md: dict):
        resps = ia_upload(ident, files={remote: path}, metadata=md, access_key=ak, secret_key=sk,
                          retries=3, queue_derive=False, verbose=False)
        bad = [r for r in resps if getattr(r, "status_code", 200) not in (200, None)]
        if bad:
            raise RuntimeError(f"HTTP {[getattr(r, 'status_code', None) for r in bad]}")

    async def fetch(msg, dest: Path):
        while True:
            try:
                await client.download_media(msg, file=str(dest))
                return
            except FloodWaitError as e:
                print(f"FloodWait {e.seconds}s")
                await asyncio.sleep(e.seconds + 1)

    sem_dl = asyncio.Semaphore(DL_PARALLEL)
    sem_up = asyncio.Semaphore(PARALLEL)

    async def one(msg, remote: str, row: dict):
        dest = WORK / remote
        try:
            async with sem_dl:
                await fetch(msg, dest)
            async with sem_up:
                await loop.run_in_executor(pool, do_upload, remote, str(dest), {})
            return row
        finally:
            dest.unlink(missing_ok=True)

    # ── 2. Первый файл — отдельно и синхронно: он создаёт объект и несёт метаданные ──
    if plan and not md_done:
        msg, remote, row, _ = plan.pop(0)
        dest = WORK / remote
        try:
            await fetch(msg, dest)
            await loop.run_in_executor(pool, do_upload, remote, str(dest), canto_metadata(canto))
            n_up += 1
            rows_ok.append(row)
            md_done = True
        except Exception as e:
            print(f"::error::Песнь {canto}: не создан объект ({remote}): {e}")
            return False
        finally:
            dest.unlink(missing_ok=True)

    # ── 3. Остальное — порциями внахлёст ──
    exhausted = True
    t0, b0 = time.time(), 0.0
    for i in range(0, len(plan), CHUNK):
        if time.time() - START > BUDGET:
            exhausted = False
            print(f"::notice::Песнь {canto}: бюджет времени исчерпан — сворачиваюсь штатно")
            break
        part = plan[i:i + CHUNK]
        res = await asyncio.gather(*[one(m, rn, rw) for m, rn, rw, _ in part],
                                   return_exceptions=True)
        for (m, rn, rw, sz), r in zip(part, res):
            if isinstance(r, BaseException):
                n_fail += 1
                print(f"✗ {rn}: {r}")
            else:
                n_up += 1
                rows_ok.append(rw)
        flush()
        b0 += sum(sz for _, _, _, sz in part)
        el = max(1.0, time.time() - t0)
        print(f"::notice::Песнь {canto}: {n_up}/{len(plan) + 1} · {b0/1e9:.2f} GB · "
              f"{b0/1e6/el:.2f} МБ/с · ошибок {n_fail}")

    if playlist and exhausted:  # сайдкар пишем только при ПОЛНОМ проходе — иначе он обрезан
        pl = WORK / "playlist.json"
        pl.write_text(json.dumps({"tracks": playlist}, ensure_ascii=False), encoding="utf-8")
        try:
            ia_upload(ident, files={"playlist.json": str(pl)}, metadata={},
                      access_key=ak, secret_key=sk, retries=3, queue_derive=False, verbose=False)
        except Exception as e:
            print(f"playlist.json не залит: {e}")
        pl.unlink(missing_ok=True)

    flush(force=True)
    print(f"::notice::Песнь {canto}: залито {n_up}, уже было {n_skip}, ошибок {n_fail}, "
          f"в D1 {reg_from} · {'ДОКАТАНА' if exhausted and not n_fail else 'ОСТАЛОСЬ — перезапусти'}")
    return exhausted and n_fail == 0


async def main():
    load_dotenv_if_present()
    if not os.getenv("IA_ACCESS_KEY") or not os.getenv("IA_SECRET_KEY"):
        raise SystemExit("Нет ключей archive.org")
    raw = (os.getenv("SB_CANTOS") or "").strip()
    cantos = [int(x) for x in raw.split(",") if x.strip()] if raw else list(range(1, 13))

    ensure_schema()
    loop = asyncio.get_running_loop()
    pool = ThreadPoolExecutor(max_workers=PARALLEL + 1)
    done, left = [], []
    client = build_client()
    async with client:
        await client.start()
        for c in cantos:
            if time.time() - START > BUDGET:
                left.append(c)
                continue
            try:
                (done if await run_canto(client, c, pool, loop) else left).append(c)
            except Exception as e:
                print(f"::warning::Песнь {c}: {e}")
                left.append(c)
    pool.shutdown(wait=True)

    tot = d1("SELECT COUNT(*) AS n FROM sb_audio")[0]["n"]
    print(f"::notice::ИТОГО в D1: {tot} дорожек · докатано {done} · осталось {left}")
    if left:
        print(f"::notice::ПЕРЕЗАПУСТИ с SB_CANTOS={','.join(map(str, left))}")


if __name__ == "__main__":
    asyncio.run(main())
