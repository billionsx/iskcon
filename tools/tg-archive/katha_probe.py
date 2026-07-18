#!/usr/bin/env python3
"""
katha_probe.py — ИНВЕНТАРИЗАЦИЯ канала катхи БЕЗ скачивания.

Отличие от tg_probe.py: канал катхи размечен не только аудио-метаданными —
альбомы часто объявляются ТЕКСТОВЫМИ постами-заголовками между пачками аудио.
tg_probe такие посты выбрасывает, и структура альбомов теряется (ЗКН-Пл010:
«структуры нет» почти всегда значит «ищу не там»). Поэтому здесь пишутся ВСЕ
сообщения: аудио — с полными метаданными, текстовые — с текстом (обрезка 500).

Env:
  TG_API_ID, TG_API_HASH, TG_SESSION_STRING — доступ (секреты репозитория)
  TG_CHANNELS  — каналы через запятую (@name или t.me/name)
  PROBE_OUT    — куда положить JSON (по умолчанию katha_probe.json)
  TG_LIMIT     — лимит сообщений (пусто = все)

Идемпотентен: только чтение.
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
    msgs = []
    n_audio = 0
    total = 0
    async for msg in client.iter_messages(entity, reverse=True, limit=limit):
        doc = None
        if msg.audio:
            doc = msg.audio
        elif msg.document and (msg.document.mime_type or "").startswith("audio/"):
            doc = msg.document
        row = {
            "msg_id": msg.id,
            "date": msg.date.isoformat() if msg.date else None,
            "grouped_id": getattr(msg, "grouped_id", None),
            "text": (msg.message or "")[:500] or None,
        }
        if doc:
            n_audio += 1
            total += getattr(doc, "size", 0) or 0
            title = performer = orig_name = None
            duration = None
            for attr in doc.attributes:
                if isinstance(attr, DocumentAttributeAudio):
                    title, performer, duration = attr.title, attr.performer, attr.duration
                elif isinstance(attr, DocumentAttributeFilename):
                    orig_name = attr.file_name
            row.update({
                "audio": True,
                "title": title,
                "performer": performer,
                "file_name": orig_name,
                "duration": duration,
                "size": getattr(doc, "size", None),
                "mime": doc.mime_type,
            })
        else:
            # текст/фото без аудио — возможный заголовок альбома; пустые пропускаем
            if not row["text"] and not msg.photo:
                continue
            row["audio"] = False
            if msg.photo:
                row["photo"] = True
        msgs.append(row)
    return {
        "channel": str(channel),
        "title": getattr(entity, "title", str(channel)),
        "about": (getattr(entity, "about", None) or None),
        "n_audio": n_audio,
        "n_msgs": len(msgs),
        "total_bytes": total,
        "messages": msgs,
    }


async def main():
    load_dotenv_if_present()
    chans = [c.strip() for c in (os.getenv("TG_CHANNELS") or "").split(",") if c.strip()]
    if not chans:
        print("TG_CHANNELS пуст", file=sys.stderr)
        sys.exit(1)
    raw_limit = (os.getenv("TG_LIMIT") or "").strip()
    limit = int(raw_limit) if raw_limit else None
    out = Path(os.getenv("PROBE_OUT") or "katha_probe.json")

    client = build_client()
    await client.start()
    channels = []
    for ch in chans:
        try:
            channels.append(await probe_channel(client, ch, limit))
        except Exception as e:  # noqa: BLE001 — канал в отчёт, не падение всего
            channels.append({"channel": ch, "error": str(e)})
    await client.disconnect()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"channels": channels}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("готово:", out, "| каналов:", len(channels))


if __name__ == "__main__":
    asyncio.run(main())
