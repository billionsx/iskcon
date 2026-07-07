#!/usr/bin/env python3
"""
tg_stories.py — забор Telegram Stories канала и публикация на archive.org.

Тот же принцип, что и аудио-загрузчик (tg_archive.py): подключаемся к Telegram
через Telethon-сессию, забираем сторис канала (активные + закреплённые), скачиваем
медиа (фото целиком; для видео — постер-кадр), заливаем в объект archive.org и
кладём рядом манифест stories.json. Бэкенд (/api/darshan) читает этот манифест и
строит круг сторис «ISKCON ONE LOVE» в приложении.

Команда:
  fetch   Забрать сторис канала → archive.org (идемпотентно, докатывает остаток).

Секреты — ТОЛЬКО из .env / переменных окружения (в коде их нет):
  Telegram:   TG_API_ID, TG_API_HASH (+ опц. TG_SESSION_STRING для CI).
  archive.org: IA_ACCESS_KEY, IA_SECRET_KEY (S3-ключи: https://archive.org/account/s3.php).
Параметры (env):
  TG_CHANNEL     — канал (default @iskcone).
  IA_IDENTIFIER  — объект archive.org (default iskcone-stories).
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DL = ROOT / "downloads"
SESSION_NAME = str(ROOT / "tg")  # → tg.session при локальном запуске

DEFAULT_CHANNEL = "@iskcone"


def _compress_image(path: str, max_dim: int = 1600, quality: int = 85) -> None:
    """Ужать фото НА МЕСТЕ без видимой потери качества перед заливкой на archive.org.

    Даунскейл ТОЛЬКО вниз до max_dim по большей стороне (лишние пиксели в приложении
    всё равно не видны — вес падает, качество на глаз то же; увеличения не бывает).
    EXIF-ориентация впекается в пиксели, затем пере-кодируем в JPEG q85 (progressive,
    optimize). Файл заменяем ТОЛЬКО если результат меньше исходника. Любая ошибка или
    отсутствие Pillow — файл остаётся нетронутым: приём сторис не должен падать из-за
    сжатия.
    """
    try:
        import io as _io
        from PIL import Image, ImageOps
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)  # ориентация из EXIF → в пиксели
            if im.mode not in ("RGB", "L"):
                im = im.convert("RGB")
            im.thumbnail((max_dim, max_dim), Image.LANCZOS)  # thumbnail никогда не увеличивает
            buf = _io.BytesIO()
            im.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
        data = buf.getvalue()
        if len(data) < os.path.getsize(path):
            with open(path, "wb") as fh:
                fh.write(data)
    except Exception as e:  # noqa: BLE001 — сжатие не критично, не роняем приём
        print(f"  [compress] пропуск {os.path.basename(path)}: {e}", file=sys.stderr)
DEFAULT_IDENTIFIER = "iskcone-stories"


def info(m: str):
    print(f"\u2026 {m}", flush=True)


def ok(m: str):
    print(f"\u2713 {m}", flush=True)


def die(m: str, code: int = 1):
    print(f"\u2717 {m}", file=sys.stderr, flush=True)
    sys.exit(code)


async def _dl(client, media, dest: str, thumb=None) -> bool:
    """Скачать медиа в dest (с переждать-FloodWait). thumb=-1 — крупнейший постер
    видео; thumb=None — медиа целиком (полное фото или ПОЛНОЕ видео). True при успехе."""
    from telethon.errors import FloodWaitError as _FW
    while True:
        try:
            if thumb is None:
                await client.download_media(media, file=dest)
            else:
                await client.download_media(media, file=dest, thumb=thumb)
            return os.path.exists(dest)
        except _FW as e:
            info(f"FloodWait {e.seconds}s — ждём…")
            time.sleep(e.seconds + 1)
        except Exception as e:
            info(f"скачать не удалось: {e}")
            return False


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


def _iso(d):
    return d.isoformat() if d else None


async def cmd_fetch():
    from telethon.tl import functions
    from telethon.tl.types import MessageMediaPhoto, MessageMediaDocument
    from telethon.errors import FloodWaitError
    from internetarchive import get_item, upload as ia_upload

    channel = os.getenv("TG_CHANNEL") or DEFAULT_CHANNEL
    identifier = os.getenv("IA_IDENTIFIER") or DEFAULT_IDENTIFIER
    ak, sk = os.getenv("IA_ACCESS_KEY"), os.getenv("IA_SECRET_KEY")
    if not ak or not sk:
        die("Не заданы ключи archive.org: IA_ACCESS_KEY, IA_SECRET_KEY (https://archive.org/account/s3.php)")

    DL.mkdir(exist_ok=True)

    # Память между прогонами — это файлы уже залитого объекта archive.org.
    item = get_item(identifier)
    item_existed = bool(getattr(item, "exists", False))
    existing: set[str] = set()
    if item_existed:
        for fobj in (item.files or []):
            nm = fobj.get("name") if isinstance(fobj, dict) else getattr(fobj, "name", None)
            if nm:
                existing.add(nm)
    info(f"Объект archive.org: {identifier} — уже залито файлов: {len(existing)}; "
         f"объект {'существует' if item_existed else 'будет создан'}.")

    base_md = {
        "title": "ISKCON ONE LOVE — Stories",
        "mediatype": "image",
        "collection": "opensource_media",
        "creator": "ISKCON ONE LOVE",
        "subject": ["ISKCON", "\u0413\u0430\u0443\u0434\u0438\u044f-\u0432\u0430\u0439\u0448\u043d\u0430\u0432\u0438\u0437\u043c",
                    "\u0421\u043e\u0437\u043d\u0430\u043d\u0438\u0435 \u041a\u0440\u0438\u0448\u043d\u044b", "Hare Krishna", "stories"],
        "language": "rus",
    }
    metadata_done = item_existed

    client = build_client()
    collected: list[tuple[object, bool]] = []  # (StoryItem, pinned)
    async with client:
        await client.start()
        entity = await client.get_entity(channel)
        ok(f"Канал: {getattr(entity, 'title', channel)}")
        peer = await client.get_input_entity(entity)

        seen: set[int] = set()
        n_active = n_pinned = 0

        # 1) активные сторис (живые, ~24ч)
        try:
            res = await client(functions.stories.GetPeerStoriesRequest(peer=peer))
            active = getattr(getattr(res, "stories", None), "stories", None) or []
            n_active = len(active)
            for s in active:
                sid = getattr(s, "id", None)
                if sid is None or sid in seen:
                    continue
                seen.add(sid)
                collected.append((s, bool(getattr(s, "pinned", False))))
            ok(f"Активных сторис: {len(active)}")
        except Exception as e:
            info(f"Активные сторис не получены: {e}")

        # 2) закреплённые сторис (постоянные «highlights» канала)
        try:
            res = await client(functions.stories.GetPinnedStoriesRequest(peer=peer, offset_id=0, limit=50))
            pinned = getattr(res, "stories", None) or []
            n_pinned = len(pinned)
            for s in pinned:
                sid = getattr(s, "id", None)
                if sid is None or sid in seen:
                    continue
                seen.add(sid)
                collected.append((s, True))
            ok(f"Закреплённых сторис: {len(pinned)}")
        except Exception as e:
            info(f"Закреплённые сторис не получены: {e}")

        if not collected:
            info("У канала нет доступных сторис — будет пустой манифест.")

        # свежие первыми
        collected.sort(key=lambda t: (getattr(t[0], "date", None).timestamp() if getattr(t[0], "date", None) else 0), reverse=True)

        manifest: list[dict] = []
        n_done = n_skip = n_fail = 0

        for s, pinned in collected:
            sid = s.id
            media = getattr(s, "media", None)
            if media is None:
                continue
            poster = f"story_{sid}.jpg"        # постер (видео) или фото целиком
            video_name = f"story_{sid}.mp4"    # ПОЛНОЕ видео (только для видео-сторис)
            cap = (getattr(s, "caption", None) or "").strip() or None
            is_video = isinstance(media, MessageMediaDocument)
            mtype = "video" if is_video else "photo"
            entry = {
                "id": sid,
                "type": mtype,
                "file": poster,
                "caption": cap,
                "date": _iso(getattr(s, "date", None)),
                "expire": _iso(getattr(s, "expire_date", None)),
                "pinned": bool(pinned),
            }

            # Идемпотентность: фото → нужен постер; видео → нужны постер И полное mp4.
            need_poster = poster not in existing
            need_video = is_video and (video_name not in existing)
            if not need_poster and not need_video:
                if is_video:
                    entry["video"] = video_name   # mp4 уже залит ранее
                manifest.append(entry)
                n_skip += 1
                continue

            files_to_upload: dict[str, str] = {}
            if need_poster:
                pdest = DL / poster
                if is_video:
                    # постер видео — крупнейший thumbnail (для превью/блюр-подложки)
                    if not await _dl(client, media, str(pdest), thumb=-1):
                        await _dl(client, media, str(pdest))
                else:
                    await _dl(client, media, str(pdest))            # фото целиком
                if os.path.exists(pdest):
                    _compress_image(str(pdest))  # ужать фото до заливки на archive.org
                    files_to_upload[poster] = str(pdest)
            if need_video:
                vdest = DL / video_name
                if await _dl(client, media, str(vdest)):            # ПОЛНОЕ видео
                    files_to_upload[video_name] = str(vdest)

            have_video = is_video and ((video_name in files_to_upload) or (video_name in existing))
            have_poster = (poster in files_to_upload) or (poster in existing)
            if not have_poster and not have_video:
                n_fail += 1
                info(f"[{sid}] нет медиа — пропуск")
                continue
            if have_video:
                entry["video"] = video_name
            manifest.append(entry)

            if not files_to_upload:
                n_skip += 1
                continue

            md = {} if metadata_done else dict(base_md)
            try:
                resps = ia_upload(identifier, files=files_to_upload, metadata=md,
                                  access_key=ak, secret_key=sk, retries=3, verbose=True)
                bad = [r for r in resps if getattr(r, "status_code", 200) not in (200, None)]
                if bad:
                    raise RuntimeError(f"HTTP {[getattr(r, 'status_code', None) for r in bad]}")
                metadata_done = True
                n_done += 1
                ok(f"[{sid}] залит: {', '.join(files_to_upload.keys())}")
            except Exception as e:
                n_fail += 1
                manifest.pop()  # не залилось — не показываем (докатится в следующий прогон)
                info(f"[{sid}] НЕ залит: {e} — повторится при следующем прогоне")
            finally:
                for fp in files_to_upload.values():
                    try:
                        Path(fp).unlink(missing_ok=True)
                    except Exception:
                        pass

        # Манифест: его читает бэкенд и строит круг сторис. Перезаписывается каждый прогон.
        mf = {
            "channel": str(channel),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(manifest),
            "stories": manifest,
        }
        mfp = DL / "stories.json"
        mfp.write_text(json.dumps(mf, ensure_ascii=False), encoding="utf-8")
        try:
            ia_upload(identifier, files={"stories.json": str(mfp)},
                      metadata=({} if metadata_done else dict(base_md)),
                      access_key=ak, secret_key=sk, retries=3)
            ok(f"stories.json обновлён ({len(manifest)} сторис)")
        except Exception as e:
            die(f"Манифест не залит: {e}")
        finally:
            mfp.unlink(missing_ok=True)

        ok(f"Готово: залито {n_done}, пропущено (уже было) {n_skip}, ошибок {n_fail}; в манифесте {len(manifest)}.")
        print(f"::notice title=Stories::активных={n_active} закреплённых={n_pinned} в_манифесте={len(manifest)} залито={n_done} ошибок={n_fail}", flush=True)
        info(f"Объект: https://archive.org/details/{identifier}")


def main():
    import argparse
    ap = argparse.ArgumentParser(description="Telegram Stories → archive.org")
    ap.add_argument("command", choices=["fetch"], nargs="?", default="fetch")
    ap.parse_args()
    load_dotenv_if_present()
    asyncio.run(cmd_fetch())


if __name__ == "__main__":
    main()
