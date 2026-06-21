#!/usr/bin/env python3
"""
tg_archive.py — выгрузка всех аудио из Telegram-канала и публикация на archive.org.

Команды:
  download   Скачать все аудио из канала (метаданные, докачка, прогресс).
  package    Упаковать скачанное в .zip + manifest.json  (ПУТЬ Б: «дай ссылку, залью сам»).
  upload     Залить на archive.org и связать с книгой    (ПУТЬ А: автозагрузка).
  run        download → upload одной командой.

Секреты берутся ТОЛЬКО из .env / переменных окружения. В коде их нет и быть не может.
Telegram: TG_API_ID, TG_API_HASH (+ опц. TG_SESSION_STRING для CI).
archive.org: IA_ACCESS_KEY, IA_SECRET_KEY (S3-ключи с https://archive.org/account/s3.php).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
import unicodedata
import zipfile
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

ROOT = Path(__file__).resolve().parent
DOWNLOAD_DIR = ROOT / "downloads"
MANIFEST = ROOT / "manifest.json"
SESSION_NAME = str(ROOT / "tg")  # → создаст tg.session

# --- транслитерация ru→lat для аккуратных ASCII-имён файлов на archive.org ---
_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def translit(s: str) -> str:
    out = []
    for ch in s or "":
        low = ch.lower()
        if low in _TRANSLIT:
            t = _TRANSLIT[low]
            out.append(t.upper() if (ch.isupper() and t) else t)
        else:
            out.append(ch)
    return "".join(out)


def slug(s: str, fallback: str = "audio") -> str:
    s = translit(s or "")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s[:60] or fallback


def human(n: float) -> str:
    for u in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.0f}{u}" if u == "B" else f"{n:.1f}{u}"
        n /= 1024
    return f"{n:.1f}PB"


def die(msg: str, code: int = 1):
    print(f"\u2717 {msg}", file=sys.stderr)
    sys.exit(code)


def info(msg: str):
    print(f"\u2022 {msg}")


def ok(msg: str):
    print(f"\u2713 {msg}")


def load_dotenv_if_present():
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def load_config(path: Path) -> dict:
    # В CI канал/режим/идентификаторы приходят из переменных окружения (входы
    # workflow), поэтому отсутствие config.yaml — не ошибка: вернём пустой конфиг.
    if not path.exists():
        return {}
    if yaml is None:
        die("Нужен pyyaml:  pip install pyyaml")
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {"channel": None, "generated_at": None, "count": 0, "files": []}


def save_manifest(m: dict):
    m["generated_at"] = datetime.now(timezone.utc).isoformat()
    m["count"] = len(m["files"])
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8")


def build_client():
    api_id = os.getenv("TG_API_ID")
    api_hash = os.getenv("TG_API_HASH")
    if not api_id or not api_hash:
        die("Не заданы секреты Telegram: TG_API_ID, TG_API_HASH (см. .env / https://my.telegram.org)")
    from telethon import TelegramClient
    from telethon.sessions import StringSession

    sess = os.getenv("TG_SESSION_STRING")
    if sess:
        return TelegramClient(StringSession(sess), int(api_id), api_hash)
    return TelegramClient(SESSION_NAME, int(api_id), api_hash)


# ------------------------------------------------------------------ download
async def cmd_download(cfg: dict):
    from telethon.tl.types import DocumentAttributeAudio, DocumentAttributeFilename
    from telethon.errors import FloodWaitError
    from tqdm import tqdm

    tg = cfg.get("telegram", {})
    channel = os.getenv("TG_CHANNEL") or tg.get("channel")
    if not channel:
        die("В config.yaml не указан telegram.channel (например: '@my_kirtan_channel' или t.me/...)")
    audio_only = tg.get("audio_only", True)
    reverse = (tg.get("order", "chronological") == "chronological")
    limit = (int(os.getenv("TG_LIMIT")) if (os.getenv("TG_LIMIT") or "").strip() else tg.get("limit"))  # None = все; TG_LIMIT — для теста

    DOWNLOAD_DIR.mkdir(exist_ok=True)
    manifest = load_manifest()
    manifest["channel"] = str(channel)
    by_id = {f["msg_id"]: f for f in manifest["files"]}
    order_idx = max((f.get("order", 0) for f in manifest["files"]), default=0)
    new_count = 0

    client = build_client()
    async with client:
        # При первом локальном запуске спросит телефон + код в терминале.
        # В CI с TG_SESSION_STRING подключается без вопросов.
        await client.start()
        entity = await client.get_entity(channel)
        ok(f"Канал: {getattr(entity, 'title', channel)}")

        async for msg in client.iter_messages(entity, reverse=reverse, limit=limit):
            doc = None
            if msg.audio:
                doc = msg.audio
            elif (not audio_only) and msg.voice:
                doc = msg.voice
            elif msg.document and (msg.document.mime_type or "").startswith("audio/"):
                doc = msg.document
            if not doc:
                continue

            title = performer = orig_name = None
            duration = None
            for attr in doc.attributes:
                if isinstance(attr, DocumentAttributeAudio):
                    title, performer, duration = attr.title, attr.performer, attr.duration
                elif isinstance(attr, DocumentAttributeFilename):
                    orig_name = attr.file_name

            mime = doc.mime_type or "audio/mpeg"
            ext = (os.path.splitext(orig_name)[1] if orig_name else "") \
                or "." + mime.split("/")[-1].replace("mpeg", "mp3")

            existing = by_id.get(msg.id)
            if existing:
                idx = existing["order"]
            else:
                order_idx += 1
                idx = order_idx

            name_base = slug(
                f"{performer} {title}" if (performer or title) else (orig_name or f"audio-{msg.id}")
            )
            filename = f"{idx:03d}_{name_base}{ext}"
            dest = DOWNLOAD_DIR / filename

            rec = existing or {"msg_id": msg.id}
            rec.update({
                "order": idx,
                "date": msg.date.isoformat() if msg.date else None,
                "filename": filename,
                "size": doc.size,
                "duration": duration,
                "title": title,
                "performer": performer,
                "mime": mime,
            })

            # докачка: пропускаем уже скачанные файлы нужного размера
            if dest.exists() and dest.stat().st_size == doc.size:
                rec["downloaded"] = True
                by_id[msg.id] = rec
                if not existing:
                    manifest["files"].append(rec)
                continue

            while True:
                try:
                    pbar = tqdm(total=doc.size, unit="B", unit_scale=True,
                                desc=filename[:32], leave=False)

                    def cb(cur, tot, _p=pbar):
                        _p.update(cur - _p.n)

                    await client.download_media(msg, file=str(dest), progress_callback=cb)
                    pbar.close()
                    break
                except FloodWaitError as e:
                    info(f"FloodWait {e.seconds}s — ждём…")
                    time.sleep(e.seconds + 1)

            rec["downloaded"] = True
            by_id[msg.id] = rec
            if not existing:
                manifest["files"].append(rec)
            new_count += 1
            save_manifest(manifest)  # сохраняем после каждого файла — устойчиво к обрывам

        manifest["files"].sort(key=lambda f: f["order"])
        save_manifest(manifest)
        ok(f"Готово. Всего в манифесте: {len(manifest['files'])}, новых скачано: {new_count}")
        if not os.getenv("TG_SESSION_STRING"):
            info("Для запуска в GitHub Actions сгенерируй строку сессии:  python make_session.py")


# ------------------------------------------------------------------- package
def cmd_package(cfg: dict):
    manifest = load_manifest()
    files = [f for f in manifest["files"] if f.get("downloaded")]
    if not files:
        die("Нечего упаковывать — сначала запусти:  python tg_archive.py download")
    chan = slug(manifest.get("channel") or "channel")
    zip_path = ROOT / f"iskcon-audio-{chan}.zip"
    total = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as z:  # аудио уже сжато → STORED
        for f in files:
            p = DOWNLOAD_DIR / f["filename"]
            if p.exists():
                z.write(p, arcname=f["filename"])
                total += 1
        z.write(MANIFEST, arcname="manifest.json")
    ok(f"Архив: {zip_path}  ({total} файлов, {human(zip_path.stat().st_size)})")
    info("ПУТЬ Б: скачай .zip и залей на archive.org вручную — или забери его из артефактов GitHub Actions.")


# -------------------------------------------------------------------- upload
def cmd_upload(cfg: dict):
    from internetarchive import upload as ia_upload

    ak, sk = os.getenv("IA_ACCESS_KEY"), os.getenv("IA_SECRET_KEY")
    if not ak or not sk:
        die("Не заданы ключи archive.org: IA_ACCESS_KEY, IA_SECRET_KEY "
            "(взять на https://archive.org/account/s3.php)")

    arc = cfg.get("archive", {})
    mode = os.getenv("IA_MODE") or arc.get("mode", "new_item")
    manifest = load_manifest()
    files = [f for f in manifest["files"] if f.get("downloaded")]
    if not files:
        die("Нечего загружать — сначала запусти download")

    file_map = {}  # {remote_name: local_path} — имена уже ASCII (index + slug)
    for f in files:
        local = DOWNLOAD_DIR / f["filename"]
        if local.exists():
            file_map[f["filename"]] = str(local)
    if not file_map:
        die("Файлы из манифеста не найдены в downloads/ — перезапусти download")

    if mode == "attach_to_book":
        identifier = os.getenv("IA_BOOK_IDENTIFIER") or arc.get("book_identifier")
        if not identifier:
            die("mode=attach_to_book требует archive.book_identifier (id существующего объекта книги)")
        md = {}  # не перезаписываем метаданные книги — просто докладываем файлы
        info(f"Добавляю {len(file_map)} аудио в существующий объект книги: {identifier}")
    else:
        identifier = os.getenv("IA_IDENTIFIER") or arc.get("identifier")
        if not identifier:
            die("mode=new_item требует identifier (env IA_IDENTIFIER или archive.identifier)")
        md = dict(arc.get("metadata", {}))
        md.setdefault("mediatype", "audio")
        rel = os.getenv("IA_RELATED_BOOK_URL") or arc.get("related_book_url")
        if rel:  # связь с книгой: кросс-ссылка в метаданных и описании
            md["external-identifier"] = f"urn:related-book:{rel}"
            desc = md.get("description", "")
            md["description"] = (desc + f'<br/>Аудио к книге: <a href="{rel}">{rel}</a>').strip()
        info(f"Создаю/обновляю объект archive.org: {identifier}")

    responses = ia_upload(identifier, files=file_map, metadata=md,
                          access_key=ak, secret_key=sk, retries=3, verbose=True)
    failed = [r for r in responses if getattr(r, "status_code", 200) not in (200, None)]

    base_url = f"https://archive.org/details/{identifier}"
    for f in files:
        f["uploaded"] = True
        f["ia_identifier"] = identifier
        f["ia_url"] = base_url
    save_manifest(manifest)

    if failed:
        die(f"Часть файлов не загрузилась ({len(failed)} из {len(file_map)}). Смотри вывод выше.")
    ok(f"Загружено на archive.org: {base_url}")
    info("Этот URL можно записать в D1 и связать с книгой в приложении (см. README).")


# -------------------------------------------------------------------- stream
async def cmd_stream(cfg: dict):
    """ПУТЬ А (надёжный). По одному файлу: скачать → сразу залить на archive.org → удалить локально.
    Уже залитые файлы (которые есть в объекте archive.org) пропускаются, поэтому прогон можно
    перезапускать сколько угодно раз — он докатывается с места обрыва. Устойчив к таймауту раннера
    и к троттлингу Telegram: ничего не теряется, т.к. прогресс хранится в самом объекте archive.org."""
    from telethon.tl.types import DocumentAttributeAudio, DocumentAttributeFilename
    from telethon.errors import FloodWaitError
    from tqdm import tqdm
    from internetarchive import get_item, upload as ia_upload

    ak, sk = os.getenv("IA_ACCESS_KEY"), os.getenv("IA_SECRET_KEY")
    if not ak or not sk:
        die("Не заданы ключи archive.org: IA_ACCESS_KEY, IA_SECRET_KEY "
            "(взять на https://archive.org/account/s3.php)")

    tg = cfg.get("telegram", {})
    channel = os.getenv("TG_CHANNEL") or tg.get("channel")
    if not channel:
        die("Не указан канал (env TG_CHANNEL или telegram.channel в config.yaml)")
    audio_only = tg.get("audio_only", True)
    reverse = (tg.get("order", "chronological") == "chronological")
    limit = (int(os.getenv("TG_LIMIT")) if (os.getenv("TG_LIMIT") or "").strip() else tg.get("limit"))

    arc = cfg.get("archive", {})
    mode = os.getenv("IA_MODE") or arc.get("mode", "new_item")

    # Книжный режим: id и метаданные строятся ПО СТАНДАРТУ библиотеки (books.ts),
    # а не из вольного текста канала. Загрузчик тянет /api/books/<work>/meta.
    book_id = (os.getenv("BOOK_ID") or "").strip()
    meta_json = (os.getenv("META_JSON") or "").strip()
    if book_id or meta_json:
        import urllib.request
        bm = None
        if meta_json:
            # Метаданные пришли прямо из бэкенда (воркер собрал по books.ts) — без HTTP, без WAF.
            try:
                bm = json.loads(meta_json)
            except Exception as e:
                die(f"META_JSON не парсится: {e}")
        else:
            site = (os.getenv("DL_SITE") or "https://gaurangers.com").rstrip("/")
            req = urllib.request.Request(
                f"{site}/api/books/{book_id}/meta",
                headers={"User-Agent": "Mozilla/5.0 (compatible; iskcone-downloader/1.0)",
                         "Accept": "application/json"},
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    raw = r.read().decode("utf-8", "replace")
            except Exception as e:
                die(f"Не удалось получить метаданные книги '{book_id}' с {site}: {e}")
            try:
                bm = json.loads(raw)
            except Exception:
                die(f"/api/books/{book_id}/meta вернул не-JSON (первые 200 симв.): {raw[:200]}")
        if not bm or not bm.get("identifier") or not bm.get("metadata"):
            die("Метаданные книги неполны (нужны identifier и metadata)")
        identifier = bm["identifier"]
        base_md = dict(bm["metadata"])
        base_md.setdefault("mediatype", "audio")
        page = bm.get("bookPageUrl") or ""
        rel = bm.get("relatedBookUrl") or page
        if rel:
            base_md["external-identifier"] = f"urn:related-book:{rel}"
        if page:
            desc = base_md.get("description", "")
            base_md["description"] = (desc + f'<br/><br/>Аудиокнига к изданию в библиотеке ISKCON ONE LOVE: <a href="{page}">{page}</a>').strip()
        ok(f"Книга по стандарту: {identifier} — «{base_md.get('title')}» ({base_md.get('creator')})")
    elif mode == "attach_to_book":
        identifier = os.getenv("IA_BOOK_IDENTIFIER") or arc.get("book_identifier")
        if not identifier:
            die("mode=attach_to_book требует book_identifier (id существующего объекта книги)")
        base_md = {}  # метаданные книги не трогаем — только докладываем файлы
    else:
        identifier = os.getenv("IA_IDENTIFIER") or arc.get("identifier")
        if not identifier:
            die("mode=new_item требует identifier (env IA_IDENTIFIER или archive.identifier)")
        base_md = dict(arc.get("metadata", {}))
        base_md.setdefault("mediatype", "audio")
        rel = os.getenv("IA_RELATED_BOOK_URL") or arc.get("related_book_url")
        if rel:
            base_md["external-identifier"] = f"urn:related-book:{rel}"
            desc = base_md.get("description", "")
            base_md["description"] = (desc + f'<br/>Аудио к книге: <a href="{rel}">{rel}</a>').strip()

    base_url = f"https://archive.org/details/{identifier}"

    # Что уже лежит в объекте archive.org — это и есть «память» между прогонами.
    item = get_item(identifier)
    item_existed = bool(getattr(item, "exists", False))
    existing = set()
    if item_existed:
        for fobj in (item.files or []):
            nm = fobj.get("name") if isinstance(fobj, dict) else getattr(fobj, "name", None)
            if nm:
                existing.add(nm)
    info(f"Объект archive.org: {identifier} — уже залито файлов: {len(existing)}; "
         f"объект {'существует' if item_existed else 'будет создан'}.")

    DOWNLOAD_DIR.mkdir(exist_ok=True)
    metadata_done = item_existed  # если объект уже создан — метаданные больше не трогаем
    uploaded_run: set[str] = set()
    idx = 0
    n_skip = n_done = n_fail = 0

    client = build_client()
    async with client:
        await client.start()
        entity = await client.get_entity(channel)
        ok(f"Канал: {getattr(entity, 'title', channel)}")

        async for msg in client.iter_messages(entity, reverse=reverse, limit=limit):
            doc = None
            if msg.audio:
                doc = msg.audio
            elif (not audio_only) and msg.voice:
                doc = msg.voice
            elif msg.document and (msg.document.mime_type or "").startswith("audio/"):
                doc = msg.document
            if not doc:
                continue

            idx += 1  # детерминированный хронологический номер — одинаков при любом перезапуске

            title = performer = orig_name = None
            for attr in doc.attributes:
                if isinstance(attr, DocumentAttributeAudio):
                    title, performer = attr.title, attr.performer
                elif isinstance(attr, DocumentAttributeFilename):
                    orig_name = attr.file_name
            mime = doc.mime_type or "audio/mpeg"
            ext = (os.path.splitext(orig_name)[1] if orig_name else "") \
                or "." + mime.split("/")[-1].replace("mpeg", "mp3")
            name_base = slug(
                f"{performer} {title}" if (performer or title) else (orig_name or f"audio-{msg.id}")
            )
            remote = f"{idx:03d}_{name_base}{ext}"

            if remote in existing or remote in uploaded_run:
                n_skip += 1
                continue

            dest = DOWNLOAD_DIR / remote
            while True:  # скачиваем этот один файл, переживая FloodWait
                try:
                    pbar = tqdm(total=doc.size, unit="B", unit_scale=True, desc=remote[:32], leave=False)

                    def cb(cur, tot, _p=pbar):
                        _p.update(cur - _p.n)

                    await client.download_media(msg, file=str(dest), progress_callback=cb)
                    pbar.close()
                    break
                except FloodWaitError as e:
                    info(f"FloodWait {e.seconds}s — ждём…")
                    time.sleep(e.seconds + 1)

            md = {} if metadata_done else dict(base_md)  # метаданные ставим только при создании объекта
            try:
                resps = ia_upload(identifier, files={remote: str(dest)}, metadata=md,
                                  access_key=ak, secret_key=sk, retries=3, verbose=True)
                bad = [r for r in resps if getattr(r, "status_code", 200) not in (200, None)]
                if bad:
                    raise RuntimeError(f"HTTP {[getattr(r, 'status_code', None) for r in bad]}")
                metadata_done = True
                uploaded_run.add(remote)
                n_done += 1
                ok(f"[{idx:03d}] залит: {remote}")
            except Exception as e:  # не валим весь прогон из-за одного файла — повторится в след. раз
                n_fail += 1
                info(f"[{idx:03d}] НЕ залит ({remote}): {e} — будет повторён при следующем прогоне")
            finally:
                try:
                    dest.unlink(missing_ok=True)  # освобождаем диск независимо от исхода
                except Exception:
                    pass

    ok(f"Прогон завершён: залито {n_done}, пропущено (уже было) {n_skip}, ошибок {n_fail}.")
    info(f"Объект: {base_url}")
    if n_fail:
        info("Часть файлов не залилась — просто запусти прогон ещё раз, докатит остаток.")
    print(f"::notice::archive.org {base_url} | залито {n_done}, пропущено {n_skip}, ошибок {n_fail}")
    if n_done == 0 and n_fail > 0:
        die(f"Ни один файл не залит на archive.org ({n_fail} ошибок) — объект {base_url}")


def main():
    ap = argparse.ArgumentParser(description="Telegram → archive.org для аудио")
    ap.add_argument("command", choices=["download", "package", "upload", "stream", "run"])
    ap.add_argument("--config", default=str(ROOT / "config.yaml"))
    args = ap.parse_args()

    load_dotenv_if_present()
    cfg = load_config(Path(args.config))

    if args.command == "download":
        asyncio.run(cmd_download(cfg))
    elif args.command == "package":
        cmd_package(cfg)
    elif args.command == "upload":
        cmd_upload(cfg)
    elif args.command == "stream":
        asyncio.run(cmd_stream(cfg))
    elif args.command == "run":
        asyncio.run(cmd_download(cfg))
        cmd_upload(cfg)


if __name__ == "__main__":
    main()
