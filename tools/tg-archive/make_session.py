#!/usr/bin/env python3
"""
Генерация строки сессии Telethon для запуска в CI (GitHub Actions).

Запусти ОДИН раз локально:
    export TG_API_ID=...  TG_API_HASH=...
    python make_session.py
Введи номер телефона и код из Telegram. Скопируй напечатанную строку
целиком в секрет репозитория TG_SESSION_STRING. Больше интерактивный
вход в CI не понадобится.
"""
import os

from telethon.sync import TelegramClient
from telethon.sessions import StringSession

api_id = int(os.environ["TG_API_ID"])
api_hash = os.environ["TG_API_HASH"]

with TelegramClient(StringSession(), api_id, api_hash) as c:
    print("\n=== TG_SESSION_STRING (скопируй целиком в GitHub Secrets) ===\n")
    print(c.session.save())
    print("\n=============================================================\n")
