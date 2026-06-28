#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Non-destructive restore of entity_names / entity_categories / entity_relations
into Cloudflare D1 from the registry CSVs.

Recovery tool: unlike registry_load.py this NEVER drops tables, NEVER touches
entities or entity_profiles (gold longform). It only ensures the three tables
exist (CREATE IF NOT EXISTS) and re-loads their rows with INSERT OR IGNORE.
Requires env CLOUDFLARE_API_TOKEN. Account/DB ids default to the project's.
"""
import csv, os, sys, json, urllib.request

csv.field_size_limit(10_000_000)
BASE = os.path.dirname(os.path.abspath(__file__))
ACCOUNT = os.environ.get("CF_ACCOUNT_ID", "d5cbe19470dc38599873eabfe148e6d1")
DB      = os.environ.get("CF_DATABASE_ID", "6226aded-dd03-4e74-977f-9cd0b509e73d")
TOKEN   = os.environ.get("CLOUDFLARE_API_TOKEN")
if not TOKEN:
    sys.exit("CLOUDFLARE_API_TOKEN not set")
URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query"


def run(sql):
    req = urllib.request.Request(
        URL, method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        data=json.dumps({"sql": sql}).encode())
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        print("!! HTTP", e.code, "ERROR BODY:", body[:800])
        print("!! FAILING SQL (first 400 chars):", sql[:400])
        print("!! SQL length:", len(sql))
        raise
    if not out.get("success"):
        raise RuntimeError(json.dumps(out.get("errors"), ensure_ascii=False))
    return out["result"]


def q(v):
    v = (v or "").strip()
    return "NULL" if v == "" else "'" + v.replace("'", "''") + "'"


def insert(table, cols, rows, batch=80):
    for i in range(0, len(rows), batch):
        ch = rows[i:i+batch]
        vals = ",".join("(" + ",".join(q(c) for c in row) + ")" for row in ch)
        run(f"INSERT OR IGNORE INTO {table} ({','.join(cols)}) VALUES {vals};")
    return len(rows)


# 1) ensure the three tables exist — IF NOT EXISTS, NO drops (entities/profiles untouched)
run("CREATE TABLE IF NOT EXISTS entity_names ("
    "id INTEGER PRIMARY KEY AUTOINCREMENT,"
    "entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,"
    "lang TEXT NOT NULL, value TEXT NOT NULL,"
    "kind TEXT NOT NULL DEFAULT 'canonical', UNIQUE(entity_id,lang,value));")
run("CREATE TABLE IF NOT EXISTS entity_categories ("
    "entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,"
    "category TEXT NOT NULL, PRIMARY KEY(entity_id,category));")
run("CREATE TABLE IF NOT EXISTS entity_relations ("
    "id INTEGER PRIMARY KEY AUTOINCREMENT,"
    "from_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,"
    "relation TEXT NOT NULL,"
    "to_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,"
    "UNIQUE(from_id,relation,to_id));")
for stmt in (
    "CREATE INDEX IF NOT EXISTS idx_names_entity ON entity_names(entity_id);",
    "CREATE INDEX IF NOT EXISTS idx_names_value ON entity_names(value);",
    "CREATE INDEX IF NOT EXISTS idx_names_lang ON entity_names(lang);",
    "CREATE INDEX IF NOT EXISTS idx_cat_category ON entity_categories(category);",
    "CREATE INDEX IF NOT EXISTS idx_rel_from ON entity_relations(from_id);",
    "CREATE INDEX IF NOT EXISTS idx_rel_to ON entity_relations(to_id);",
    "CREATE INDEX IF NOT EXISTS idx_rel_relation ON entity_relations(relation);",
):
    run(stmt)

# 2) names + categories from entities_all.csv (same derivation as registry_load.py)
ents = list(csv.DictReader(open(os.path.join(BASE, "entities_all.csv"), encoding="utf-8")))
nrows = []; crows = []
for e in ents:
    for lang, key in (("en", "name_en"), ("ru", "name_ru"), ("iast", "name_iast")):
        v = (e.get(key) or "").strip()
        if v:
            nrows.append([e["id"], lang, v, "canonical"])
    for a in (e.get("aliases") or "").split("|"):
        a = a.strip()
        if a:
            nrows.append([e["id"], "alias", a, "alias"])
    for c in (e.get("category") or "").split("|"):
        c = c.strip()
        if c:
            crows.append([e["id"], c])
print("names:", insert("entity_names", ["entity_id", "lang", "value", "kind"], nrows))
print("categories:", insert("entity_categories", ["entity_id", "category"], crows))

# 3) relations from relations_all.csv
rels = list(csv.DictReader(open(os.path.join(BASE, "relations_all.csv"), encoding="utf-8")))
rrows = [[r["from_id"], r["relation"], r["to_id"]] for r in rels]
print("relations:", insert("entity_relations", ["from_id", "relation", "to_id"], rrows))

# 4) report final counts
res = run("SELECT (SELECT COUNT(*) FROM entity_names) n,(SELECT COUNT(*) FROM entity_categories) c,(SELECT COUNT(*) FROM entity_relations) r;")
print("FINAL D1 COUNTS:", json.dumps(res[0]["results"][0]))
print("DONE")
