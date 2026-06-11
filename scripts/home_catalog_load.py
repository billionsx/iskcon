#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Load home-page catalogs into Cloudflare D1 (full rebuild, idempotent).
Sources:
  apps/web/public/data/iskcon-places.json     -> table `places`
  apps/web/public/data/iskcon-documents.json  -> table `home_documents`
Requires env: CLOUDFLARE_API_TOKEN. Account/DB ids default to project values.
"""
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "apps", "web", "public", "data")
ACCOUNT = os.environ.get("CF_ACCOUNT_ID", "d5cbe19470dc38599873eabfe148e6d1")
DB = os.environ.get("CF_DATABASE_ID", "6226aded-dd03-4e74-977f-9cd0b509e73d")
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
if not TOKEN:
    sys.exit("CLOUDFLARE_API_TOKEN not set")
URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query"


def run(sql):
    req = urllib.request.Request(URL, method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        data=json.dumps({"sql": sql}).encode())
    with urllib.request.urlopen(req, timeout=120) as r:
        out = json.loads(r.read())
    if not out.get("success"):
        raise RuntimeError(json.dumps(out.get("errors"), ensure_ascii=False))
    return out["result"]


def q(v):
    """SQL-литерал: NULL для пустых, экранирование апострофов."""
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).strip()
    return "NULL" if s == "" else "'" + s.replace("'", "''") + "'"


def insert(table, cols, rows, batch=60):
    n = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        vals = ",".join("(" + ",".join(q(c) for c in row) + ")" for row in chunk)
        run(f"INSERT INTO {table} ({','.join(cols)}) VALUES {vals};")
        n += len(chunk)
    return n


# ── 1. places ──────────────────────────────────────────────────────────
print("schema: places ...")
run("DROP TABLE IF EXISTS places;")
run("""CREATE TABLE places (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
  name_ru TEXT, city_ru TEXT, state_ru TEXT,
  categories TEXT, address TEXT, city TEXT, state TEXT, country TEXT,
  continent TEXT, lat REAL, lng REAL, phone TEXT, email TEXT,
  website TEXT, source TEXT);""")
run("CREATE INDEX idx_places_kind ON places(kind);")
run("CREATE INDEX idx_places_geo ON places(kind, continent, country);")

places = json.load(open(os.path.join(DATA, "iskcon-places.json"), encoding="utf-8"))
items = places.get("items") or places.get("places") or places
import sys as _sys
_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ru_geo
rows = [[p.get("id"), p.get("kind"), p.get("name"),
         ru_geo.ru_place_name(p.get("name") or ""),
         ru_geo.ru_city(p.get("city") or ""),
         ru_geo.ru_state(p.get("state") or ""),
         json.dumps(p.get("categories") or [], ensure_ascii=False),
         p.get("address"), p.get("city"), p.get("state"), p.get("country"),
         p.get("continent"), p.get("lat"), p.get("lng"),
         p.get("phone"), p.get("email"), p.get("website"), p.get("source")]
        for p in items]
n = insert("places",
           ["id", "kind", "name", "name_ru", "city_ru", "state_ru",
            "categories", "address", "city", "state", "country",
            "continent", "lat", "lng", "phone", "email", "website", "source"], rows)
print("places:", n)

# ── 2. home_documents ──────────────────────────────────────────────────
print("schema: home_documents ...")
run("DROP TABLE IF EXISTS home_documents;")
run("""CREATE TABLE home_documents (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, year TEXT, title TEXT NOT NULL,
  issuer TEXT, summary TEXT, body TEXT, facts TEXT, url TEXT, sort INTEGER);""")

docs = json.load(open(os.path.join(DATA, "iskcon-documents.json"), encoding="utf-8"))["documents"]
drows = [[d["id"], d["type"], d.get("year"), d["title"], d.get("issuer"),
          d.get("summary"), json.dumps(d.get("body") or [], ensure_ascii=False),
          json.dumps(d.get("facts") or [], ensure_ascii=False),
          d.get("url"), d.get("sort", 0)] for d in docs]
nd = insert("home_documents",
            ["id", "type", "year", "title", "issuer", "summary", "body", "facts", "url", "sort"], drows)
print("home_documents:", nd)

# ── 3. verify ──────────────────────────────────────────────────────────
res = run("SELECT (SELECT COUNT(*) FROM places) AS places, (SELECT COUNT(*) FROM home_documents) AS docs;")
counts = res[0]["results"][0]
print("verify:", json.dumps(counts))
if counts["places"] < 500 or counts["docs"] < 10:
    sys.exit("verification failed: counts too low")
print("OK")
