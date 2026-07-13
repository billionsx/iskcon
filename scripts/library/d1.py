"""
D1-клиент конвейера. Соблюдает законы проекта:

  Ф013 — ≤100 переменных в одном запросе (батчи режем по числу биндов)
  Р002 — массовое удаление запрещено: класс не умеет DELETE вообще
  ---   — Кириллица в LIKE не работает → instr(col,'x')>0
  ---   — Прямая кавычка ' ломает SQL → только параметризация ?1…?N
"""
from __future__ import annotations
import json
import os
import time
import urllib.request
import urllib.error

CF_ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or os.environ.get("CF_ACCOUNT_ID", "d5cbe19470dc38599873eabfe148e6d1")
CF_DB = os.environ.get("CF_D1_DATABASE_ID", "6226aded-dd03-4e74-977f-9cd0b509e73d")
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN") or os.environ.get("CF_API_TOKEN", "")

API = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/d1/database/{CF_DB}/query"

MAX_BINDS = 100          # Ф013


class D1Error(RuntimeError):
    pass


def query(sql: str, params: list | None = None, retries: int = 4) -> list[dict]:
    body = json.dumps({"sql": sql, "params": [str(p) if p is not None else None
                                              for p in (params or [])]}).encode()
    req = urllib.request.Request(
        API, data=body, method="POST",
        headers={"Authorization": f"Bearer {CF_TOKEN}",
                 "Content-Type": "application/json"},
    )
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                payload = json.loads(r.read())
            if not payload.get("success"):
                raise D1Error(json.dumps(payload.get("errors"), ensure_ascii=False))
            return payload["result"][0].get("results", []) or []
        except (urllib.error.URLError, D1Error, TimeoutError) as e:
            last = e
            time.sleep(2 ** attempt)
    raise D1Error(f"D1 failed after {retries}: {last}")


def scalar(sql: str, params: list | None = None):
    rows = query(sql, params)
    if not rows:
        return None
    return next(iter(rows[0].values()))


def insert_batch(table: str, cols: list[str], rows: list[tuple],
                 mode: str = "INSERT OR REPLACE") -> int:
    """
    Пишет пачками. Размер пачки считается ОТ ЧИСЛА БИНДОВ (Ф013), а не от числа
    строк: 9 колонок → 11 строк на запрос, 4 колонки → 25 строк на запрос.
    """
    if not rows:
        return 0
    ncols = len(cols)
    if ncols == 0:
        return 0
    per = max(1, MAX_BINDS // ncols)
    written = 0
    for i in range(0, len(rows), per):
        chunk = rows[i:i + per]
        binds: list = []
        groups = []
        for r in chunk:
            ph = ",".join(f"?{len(binds) + j + 1}" for j in range(ncols))
            groups.append(f"({ph})")
            binds.extend(r)
        sql = (f"{mode} INTO {table} ({','.join(cols)}) VALUES {','.join(groups)}")
        query(sql, binds)
        written += len(chunk)
    return written


def update_one(table: str, set_cols: dict, where_col: str, where_val) -> None:
    keys = list(set_cols.keys())
    sets = ",".join(f"{k}=?{i + 1}" for i, k in enumerate(keys))
    binds = [set_cols[k] for k in keys] + [where_val]
    query(f"UPDATE {table} SET {sets} WHERE {where_col}=?{len(binds)}", binds)
