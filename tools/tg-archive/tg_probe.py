#!/usr/bin/env python3
"""
tg_probe.py — ИНВЕНТАРИЗАЦИЯ Telegram-каналов без скачивания.

Зачем: прежде чем лить сотни файлов на archive.org и привязывать их к главам в D1,
нужно ЗНАТЬ, как канал размечен (ЗКН-Пл010: «структуры нет» обычно значит «ищу не там»).
Скрипт читает только метаданные сообщений — трафика почти нет, канал не качается.

Env:
  TG_API_ID, TG_API_HASH, TG_SESSION_STRING  — доступ (секреты репозитория)
  TG_CHANNELS  — каналы через запятую (@name или t.me/name)
  PROBE_OUT    — куда положить JSON (по умолчанию probe.json)
  TG_LIMIT     — лимит сообщений на канал (пусто = все)

Идемпотентен: только чтение, ничего не пишет ни в Telegram, ни в archive.org.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from tg_archive import build_client, load_dotenv_if_present  # noqa: E402


async def probe_channel(client, channel: str, limit):
    from telethon.tl.types import DocumentAttributeAudio, DocumentAttributeFilename

    entity = await client.get_entity(channel)
    files = []
    i = 0
    async for msg in client.iter_messages(entity, reverse=True, limit=limit):
        doc = None
        if msg.audio:
            doc = msg.audio
        elif msg.document and (msg.document.mime_type or "").startswith("audio/"):
            doc = msg.document
        if not doc:
            continue
        i += 1
        title = performer = orig_name = None
        duration = None
        for attr in doc.attributes:
            if isinstance(attr, DocumentAttributeAudio):
                title, performer, duration = attr.title, attr.performer, attr.duration
            elif isinstance(attr, DocumentAttributeFilename):
                orig_name = attr.file_name
        files.append({
            "i": i,
            "msg_id": msg.id,
            "date": msg.date.isoformat() if msg.date else None,
            "grouped_id": getattr(msg, "grouped_id", None),
            "title": title,
            "performer": performer,
            "file_name": orig_name,
            "duration": duration,
            "size": getattr(doc, "size", None),
            "mime": doc.mime_type,
            "caption": (msg.message or "")[:200] or None,
        })
    return {
        "channel": str(channel),
        "title": getattr(entity, "title", str(channel)),
        "n_audio": len(files),
        "total_bytes": sum(f["size"] or 0 for f in files),
        "files": files,
    }


async def main():
    load_dotenv_if_present()
    chans = [c.strip() for c in (os.getenv("TG_CHANNELS") or "").split(",") if c.strip()]
    if not chans:
        print("TG_CHANNELS пуст", file=sys.stderr)
        sys.exit(1)
    raw_limit = (os.getenv("TG_LIMIT") or "").strip()
    limit = int(raw_limit) if raw_limit else None
    out = Path(os.getenv("PROBE_OUT") or "probe.json")

    report = {"channels": []}
    client = build_client()
    async with client:
        await client.start()
        for ch in chans:
            try:
                r = await probe_channel(client, ch, limit)
            except Exception as e:  # один канал не валит разведку остальных
                r = {"channel": ch, "error": str(e), "n_audio": 0, "files": []}
                print(f"::warning::{ch}: {e}")
            report["channels"].append(r)
            gb = (r.get("total_bytes") or 0) / 1e9
            print(f"::notice::{ch} — аудио: {r['n_audio']}, объём: {gb:.2f} GB")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    tot = sum(c["n_audio"] for c in report["channels"])
    print(f"::notice::ИТОГО аудио во всех каналах: {tot}")


if __name__ == "__main__":
    asyncio.run(main())
