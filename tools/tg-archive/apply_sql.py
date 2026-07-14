#!/usr/bin/env python3
"""Применяет SQL-файл к D1 по инструкциям (по одной на строку).

ЗКН-Ф014: ответ API читается. Молча не падаем.
"""
import json, os, sys, urllib.request
from pathlib import Path

ACCOUNT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]


def d1(sql):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
        data=json.dumps({"sql": sql}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:
        print("::error::D1 %s: %s" % (e.code, e.read().decode()[:400])); raise
    if not body.get("success"):
        print("::error::D1: %s" % json.dumps(body.get("errors"))[:400]); raise SystemExit(1)
    return body["result"][0]["meta"].get("changes", 0)


path = Path(sys.argv[1])
lines = [l for l in path.read_text(encoding="utf-8").split("\n") if l.strip()]
total = 0
for i, sql in enumerate(lines, 1):
    n = d1(sql)
    total += n
    print("::notice::%d/%d — изменено строк: %d" % (i, len(lines), n))
print("::notice::ВСЕГО ИЗМЕНЕНО: %d" % total)
