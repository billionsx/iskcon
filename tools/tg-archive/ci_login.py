#!/usr/bin/env python3
"""
Вход в Telegram прямо из GitHub Actions, без локальной машины.

Интерактив (код приходит в приложение Telegram) разнесён на два прогона:
  1) БЕЗ секрета TG_CODE → REQUEST: запрашиваем код, сохраняем промежуточное
     состояние (частичная сессия + phone_code_hash) в секрет TG_LOGIN_STATE.
     Telegram присылает код в приложение.
  2) С секретом TG_CODE → SIGNIN: грузим состояние, логинимся, сохраняем
     финальную строку сессии в секрет TG_SESSION_STRING и чистим временное.

Строка сессии и код НИКОГДА не печатаются — секреты пишет сам раннер через API
(токеном GH_TOKEN). На выходе только статусы.
"""
import os, json, base64, urllib.request, urllib.error, asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError
from nacl import public, encoding

API_ID = int(os.environ["TG_API_ID"])
API_HASH = os.environ["TG_API_HASH"]
PHONE = os.environ["TG_PHONE"].strip()
CODE = os.environ.get("TG_CODE", "").strip()
PASSWORD = os.environ.get("TG_PASSWORD", "").strip()
GH = os.environ["GH_TOKEN"]
REPO = os.environ.get("GH_REPO", "billionsx/iskcon")


def _api(method, path, data=None):
    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}{path}", method=method)
    req.add_header("Authorization", f"Bearer {GH}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "tg-login")
    if data is not None:
        req.add_header("Content-Type", "application/json")
        data = json.dumps(data).encode()
    try:
        with urllib.request.urlopen(req, data=data) as r:
            b = r.read().decode()
            return r.status, (json.loads(b) if b else {})
    except urllib.error.HTTPError as e:
        return e.code, {"err": e.read().decode()[:200]}


def set_secret(name: str, value: str) -> int:
    st, key = _api("GET", "/actions/secrets/public-key")
    if st != 200:
        print(f"PUBKEY_FAIL {st}")
        return st
    pk = public.PublicKey(key["key"].encode(), encoding.Base64Encoder())
    enc = base64.b64encode(public.SealedBox(pk).encrypt(value.encode())).decode()
    st2, _ = _api("PUT", f"/actions/secrets/{name}", {"encrypted_value": enc, "key_id": key["key_id"]})
    return st2


def delete_secret(name: str) -> int:
    st, _ = _api("DELETE", f"/actions/secrets/{name}")
    return st


async def main():
    if not CODE:
        # ── 1) REQUEST: запросить код ──
        client = TelegramClient(StringSession(), API_ID, API_HASH)
        await client.connect()
        sent = await client.send_code_request(PHONE)
        state = {"session": client.session.save(), "phone_code_hash": sent.phone_code_hash}
        await client.disconnect()
        rc = set_secret("TG_LOGIN_STATE", json.dumps(state))
        print(f"REQUEST_OK: код отправлен в Telegram. Состояние сохранено (secret {rc}).")
        print("Дальше: задать секрет TG_CODE (и TG_PASSWORD при 2FA) и перезапустить.")
        return

    # ── 2) SIGNIN: войти по коду ──
    raw = os.environ.get("TG_LOGIN_STATE", "")
    if not raw:
        print("NO_STATE: сначала прогон без TG_CODE (REQUEST).")
        return
    state = json.loads(raw)
    client = TelegramClient(StringSession(state["session"]), API_ID, API_HASH)
    await client.connect()
    try:
        try:
            await client.sign_in(phone=PHONE, code=CODE, phone_code_hash=state["phone_code_hash"])
        except SessionPasswordNeededError:
            if not PASSWORD:
                await client.disconnect()
                print("2FA_REQUIRED: у аккаунта включён облачный пароль — задай секрет TG_PASSWORD и перезапусти.")
                return
            await client.sign_in(password=PASSWORD)
    except Exception as e:
        try:
            await client.disconnect()
        except Exception:
            pass
        print(f"::error title=tg-login-signin::{type(e).__name__}: {e}")
        raise

    final = client.session.save()
    me = await client.get_me()
    await client.disconnect()

    s1 = set_secret("TG_SESSION_STRING", final)
    delete_secret("TG_LOGIN_STATE")
    delete_secret("TG_CODE")
    delete_secret("TG_PASSWORD")
    uname = ("@" + me.username) if getattr(me, "username", None) else str(me.id)
    print(f"SIGNIN_OK как {uname}. TG_SESSION_STRING сохранён (secret {s1}). Временные секреты удалены.")


asyncio.run(main())
