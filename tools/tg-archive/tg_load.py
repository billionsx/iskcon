#!/usr/bin/env python3
"""
Вход в Telegram + экспорт строки сессии — ВЕСЬ в одном раннере (один IP), как
make_session.py. Telegram отзывает сессию, если её авторизуют на одном IP, а
используют с другого; здесь send_code + sign_in + последующая заливка идут с
ОДНОГО раннера, поэтому сессия не отваливается.

Логика:
  • если TG_SESSION_STRING ещё жив — используем его (вход не нужен);
  • иначе: send_code → ждём код в repo variable TG_CODE_LIVE (его выставит
    оператор через PAT, получив код от пользователя) → sign_in ЗДЕСЬ ЖЕ.
Итог пишем в $GITHUB_ENV (для шага заливки в ТОМ ЖЕ джобе) и сохраняем в секрет.
"""
import os
import sys
import json
import time
import base64
import urllib.request
import urllib.error

from telethon.sync import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError

API_ID = int(os.environ["TG_API_ID"])
API_HASH = os.environ["TG_API_HASH"]
PHONE = os.environ["TG_PHONE"]
PASSWORD = os.environ.get("TG_PASSWORD", "")
TOKEN = os.environ["GH_TOKEN"]
REPO = os.environ.get("GH_REPO", "billionsx/iskcon")
EXISTING = os.environ.get("TG_SESSION_STRING", "").strip()

VAR = "TG_CODE_LIVE"
POLL_SECONDS = 8
POLL_TRIES = 90  # ~12 минут


def gh(method, path, data=None):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "tg-load",
        },
    )
    if data is not None:
        req.data = json.dumps(data).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            b = r.read()
            return r.status, (json.loads(b) if b else {})
    except urllib.error.HTTPError as e:
        return e.code, {}


def save_secret(value):
    try:
        from nacl import encoding, public

        st, pk = gh("GET", f"/repos/{REPO}/actions/secrets/public-key")
        if st == 200:
            sealed = public.SealedBox(
                public.PublicKey(pk["key"].encode(), encoding.Base64Encoder())
            ).encrypt(value.encode())
            gh(
                "PUT",
                f"/repos/{REPO}/actions/secrets/TG_SESSION_STRING",
                {"encrypted_value": base64.b64encode(sealed).decode(), "key_id": pk["key_id"]},
            )
            print("Сессия сохранена в секрет TG_SESSION_STRING.")
    except Exception as e:
        print(f"warn: секрет не сохранён ({e}) — на этот прогон не критично.")


def export(value):
    ge = os.environ.get("GITHUB_ENV")
    if ge:
        with open(ge, "a", encoding="utf-8") as f:
            f.write(f"TG_SESSION_STRING={value}\n")
    print("Сессия проброшена в $GITHUB_ENV для шага заливки (тот же раннер, один IP).")


def main():
    # 1) Существующая сессия ещё жива? Тогда вход не нужен.
    if EXISTING:
        try:
            c = TelegramClient(StringSession(EXISTING), API_ID, API_HASH)
            c.connect()
            if c.is_user_authorized():
                me = c.get_me()
                c.disconnect()
                print(f"Сессия жива как {getattr(me, 'username', None) or me.id} — вход не нужен.")
                export(EXISTING)
                return
            c.disconnect()
            print("Существующая сессия мертва — нужен свежий вход.")
        except Exception as e:
            print(f"Существующая сессия не подошла ({e}) — свежий вход.")

    # 2) Свежий вход В ЭТОМ ЖЕ раннере: send_code → ждём код в variable → sign_in.
    c = TelegramClient(StringSession(), API_ID, API_HASH)
    c.connect()
    sent = c.send_code_request(PHONE)
    print(f"::notice title=tg-load::Код входа отправлен в Telegram. Жду TG_CODE_LIVE до ~12 мин.")
    sys.stdout.flush()

    code = None
    for _ in range(POLL_TRIES):
        st, v = gh("GET", f"/repos/{REPO}/actions/variables/{VAR}")
        if st == 200 and str(v.get("value", "")).strip():
            code = str(v["value"]).strip()
            break
        time.sleep(POLL_SECONDS)

    if not code:
        c.disconnect()
        print("::error title=tg-load::Код не пришёл за 12 минут — перезапусти и пришли код быстрее.")
        sys.exit(1)

    try:
        c.sign_in(phone=PHONE, code=code, phone_code_hash=sent.phone_code_hash)
    except SessionPasswordNeededError:
        if not PASSWORD:
            c.disconnect()
            print("::error title=tg-load::Нужен облачный пароль (2FA): задай секрет TG_PASSWORD.")
            sys.exit(1)
        c.sign_in(password=PASSWORD)

    final = c.session.save()
    me = c.get_me()
    c.disconnect()
    print(f"Вход выполнен как {getattr(me, 'username', None) or me.id} (тот же раннер, один IP).")
    gh("DELETE", f"/repos/{REPO}/actions/variables/{VAR}")  # одноразовый код убрать
    save_secret(final)
    export(final)


main()
