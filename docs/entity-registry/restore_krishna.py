#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Surgical restore of ONLY the `krishna` row in entity_profiles from CSV into D1.

Restores the bespoke longform hero card (parameterized — handles the ~167KB JSON
that exceeds the inline-SQL limit) plus the curated summary/biography/contribution/
level. Touches no other entity. Requires env CLOUDFLARE_API_TOKEN.
"""
import csv, os, sys, json, urllib.request

csv.field_size_limit(10_000_000)
BASE    = os.path.dirname(os.path.abspath(__file__))
ACCOUNT = os.environ.get("CF_ACCOUNT_ID", "d5cbe19470dc38599873eabfe148e6d1")
DB      = os.environ.get("CF_DATABASE_ID", "6226aded-dd03-4e74-977f-9cd0b509e73d")
TOKEN   = os.environ.get("CLOUDFLARE_API_TOKEN")
if not TOKEN:
    sys.exit("CLOUDFLARE_API_TOKEN not set")
URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query"


def run(sql, params=None):
    body = {"sql": sql}
    if params is not None:
        body["params"] = params
    req = urllib.request.Request(
        URL, method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        data=json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=120) as r:
        out = json.loads(r.read())
    if not out.get("success"):
        raise RuntimeError(json.dumps(out.get("errors"), ensure_ascii=False))
    return out["result"]


# 1) longform (the big bespoke hero card) from profiles_longform.csv
lf = None
with open(os.path.join(BASE, "profiles_longform.csv"), newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        if r["entity_id"] == "krishna":
            lf = r.get("longform", "") or ""
            break
if not lf or len(lf) < 100000:
    sys.exit(f"krishna longform missing/too small in CSV: {None if lf is None else len(lf)}")
# sanity: must be valid JSON before we write it
json.loads(lf)

# 2) curated head fields from profiles_curated.csv
cur = None
with open(os.path.join(BASE, "profiles_curated.csv"), newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        if r["entity_id"] == "krishna":
            cur = r
            break

# 3) restore ONLY krishna — parameterized upserts, no other row is referenced
run("INSERT INTO entity_profiles (entity_id,longform,updated_at) "
    "VALUES (?, ?, datetime('now')) "
    "ON CONFLICT(entity_id) DO UPDATE SET longform=excluded.longform, updated_at=datetime('now');",
    params=["krishna", lf])
if cur:
    run("INSERT INTO entity_profiles (entity_id,summary,biography,contribution,level,updated_at) "
        "VALUES (?, ?, ?, ?, ?, datetime('now')) "
        "ON CONFLICT(entity_id) DO UPDATE SET summary=excluded.summary, biography=excluded.biography, "
        "contribution=excluded.contribution, level=excluded.level, updated_at=datetime('now');",
        params=["krishna", cur.get("summary", "") or "", cur.get("biography", "") or "",
                cur.get("contribution", "") or "", cur.get("level") or "gold"])

res = run("SELECT length(longform) AS n, json_valid(longform) AS ok, "
          "json_array_length(longform) AS sec FROM entity_profiles WHERE entity_id='krishna';")
print("krishna restored:", json.dumps(res[0]["results"][0], ensure_ascii=False))
print("source longform chars:", len(lf))
