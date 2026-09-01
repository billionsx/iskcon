#!/usr/bin/env python3
"""Клиент D1. Кириллица — через instr(), не LIKE (ЗКН-Ф013 · плейбук)."""
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_DEFAULT = "6226aded-dd03-4e74-977f-9cd0b509e73d"


def _ids():
    cfg = ROOT / "apps" / "web" / "wrangler.toml"
    acc = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    dbid = os.environ.get("D1_DATABASE_ID")
    if cfg.exists():
        t = cfg.read_text(encoding="utf-8")
        if not acc:
            m = re.search(r'account_id\s*=\s*"([^"]+)"', t)
            acc = m.group(1) if m else None
        if not dbid:
            m = re.search(r'database_id\s*=\s*"([^"]+)"', t)
            dbid = m.group(1) if m else None
    return acc, (dbid or DB_DEFAULT)


# ══════════════════════════════════════════════════════════════════════════
# РЕЖИМ ЗЕРКАЛА (ЗКН-Ф027 §Г) · 01.09.2026
#
# ЗАЧЕМ. Замер 2026-09-01: 6 617 555 прочитанных строк за сутки при пределе
# 5 000 000 — база превышает САМ ПРЕДЕЛ. Из этого счёта 2 574 409 строк
# (38.9 %) даёт ОДИН ночной линт данных: он сканирует `verse_texts` и
# `entity_profiles` целиком, ища диакритику. Это работа обслуживания — её
# не ждёт ни один человек, и платить за неё живыми строками не за что.
#
# ЧТО ДЕЛАЕМ. Если задан `D1_MIRROR` — путь к локальной копии содержимого
# (релиз `d1-mirror`, кладётся ночным бэкапом, ноль прочитанных строк), —
# запросы идут в неё, а не в боевую базу. Ответ той же формы: список
# словарей. Ни один вызывающий не меняется, достаточно переменной среды.
#
# ГРАНИЦА, КОТОРУЮ НЕЛЬЗЯ ПЕРЕЙТИ. В зеркале только СОДЕРЖИМОЕ (книги,
# карточки, катха) — личных таблиц там нет по построению. Поэтому зеркало
# годится линтам и замерам и НЕ годится ничему, что читает данные человека.
# Запись в зеркало запрещена: копия живёт до следующего бэкапа, и правка в
# ней — это правка, которая исчезнет.
# ══════════════════════════════════════════════════════════════════════════
_MIRROR_CONN = None


def mirror_path():
    return os.environ.get("D1_MIRROR") or ""


def _mirror():
    global _MIRROR_CONN
    if _MIRROR_CONN is None:
        import sqlite3
        c = sqlite3.connect("file:%s?mode=ro" % mirror_path(), uri=True)
        c.row_factory = sqlite3.Row
        _MIRROR_CONN = c
    return _MIRROR_CONN


def available():
    if mirror_path():
        return Path(mirror_path()).exists()
    acc, dbid = _ids()
    return bool(acc and dbid and os.environ.get("CLOUDFLARE_API_TOKEN"))


def query(sql, params=None, tries=4):
    """Один запрос. params → bound (?1…?N): без SQL-экранирования (ЗКН-П002)."""
    if mirror_path():
        # Зеркало: тот же SQL, та же форма ответа, ноль прочитанных строк в D1.
        # Писать сюда нельзя — копия исчезнет со следующим бэкапом.
        if re.match(r"\s*(insert|update|delete|drop|alter|create)\b", sql, re.I):
            raise RuntimeError("зеркало доступно только на чтение (ЗКН-Ф027 §Г)")
        cur = _mirror().execute(sql, tuple(params or ()))
        return [dict(r) for r in cur.fetchall()]
    acc, dbid = _ids()
    tok = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not (acc and tok and dbid):
        return None
    url = "https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query" % (acc, dbid)
    body = {"sql": sql}
    if params is not None:
        body["params"] = params
    last = ""
    for i in range(tries):
        try:
            req = urllib.request.Request(
                url, data=json.dumps(body).encode(),
                headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.load(r)
            rows = []
            for blk in out.get("result", []):
                rows.extend(blk.get("results") or [])
            return rows
        except urllib.error.HTTPError as e:
            last = "HTTP %s — %s" % (e.code, e.read().decode("utf-8", "replace")[:300])
        except Exception as e:                                   # noqa: BLE001
            last = str(e)[:200]
        time.sleep(1.5 * (i + 1))
    # ЗКН-Ф014: скрипт говорит, ЧТО сломалось, а не «exit 1».
    raise SystemExit("::error title=D1::%s\n  SQL: %s" % (last, sql[:160]))


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def ors(col, forms):
    """OR-цепочка instr() по формам имени.

    ДВЕ ловушки SQLite, обе стоили бы карточке 90% материала:
      • LIKE по кириллице не работает  → только instr()
      • lower() опускает ТОЛЬКО ASCII  → instr(lower('Джива'),'джива') = 0
    Поэтому никакого lower(): ищем и строчную форму, и с заглавной.
    """
    out = []
    for f in forms:
        if not f:
            continue
        for v in {f, f[:1].upper() + f[1:]}:
            out.append("instr(coalesce(%s,''),'%s')>0" % (col, v.replace("'", "''")))
    # Пустое условие ломает SQL молча: «WHERE () OR ()» → syntax error near ")».
    # Возвращаем ЗАВЕДОМО ЛОЖНОЕ условие — запрос жив, находок ноль, ошибка видна.
    return " OR ".join(out) if out else "0"
