#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Load the entity registry into Cloudflare D1 (idempotent).
Reads schema.sql + entities_all.csv + relations_all.csv from this directory.
Requires env: CLOUDFLARE_API_TOKEN. Account/DB ids default to the project's values.
"""
import csv, os, sys, json, urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
ACCOUNT = os.environ.get("CF_ACCOUNT_ID","d5cbe19470dc38599873eabfe148e6d1")
DB      = os.environ.get("CF_DATABASE_ID","6226aded-dd03-4e74-977f-9cd0b509e73d")
TOKEN   = os.environ.get("CLOUDFLARE_API_TOKEN")
if not TOKEN: sys.exit("CLOUDFLARE_API_TOKEN not set")
URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query"

def run(sql):
    req = urllib.request.Request(URL, method="POST",
        headers={"Authorization":f"Bearer {TOKEN}","Content-Type":"application/json"},
        data=json.dumps({"sql":sql}).encode())
    with urllib.request.urlopen(req, timeout=120) as r:
        out = json.loads(r.read())
    if not out.get("success"):
        raise RuntimeError(json.dumps(out.get("errors"), ensure_ascii=False))
    return out["result"]

def q(v):
    v = (v or "").strip()
    return "NULL" if v=="" else "'"+v.replace("'","''")+"'"

def insert(table, cols, rows, batch=80):
    n=0
    for i in range(0, len(rows), batch):
        chunk = rows[i:i+batch]
        vals = ",".join("("+",".join(q(c) for c in row)+")" for row in chunk)
        run(f"INSERT OR IGNORE INTO {table} ({','.join(cols)}) VALUES {vals};")
        n += len(chunk)
    return n

# 1) schema (drop+create) — strip comments, split on ';' and run each statement
print("applying schema ...")
raw = open(os.path.join(BASE,"schema.sql"),encoding="utf-8").read()
nocomments = "\n".join(l for l in raw.splitlines() if not l.strip().startswith("--"))
for stmt in [s.strip() for s in nocomments.split(";") if s.strip()]:
    run(stmt+";")

# 2) entities
ents = list(csv.DictReader(open(os.path.join(BASE,"entities_all.csv"),encoding="utf-8")))
erows = [[e["id"],e["type"],e.get("tattva",""),e.get("note",""),e.get("source_ref",""),
          e.get("confidence",""),e.get("iast_status",""),e.get("dataset","")] for e in ents]
ne = insert("entities", ["id","type","tattva","note","source_ref","confidence","iast_status","dataset"], erows)
print("entities:", ne)

# 3) names (canonical en/ru/iast + aliases) and categories
nrows=[]; crows=[]
for e in ents:
    for lang,key in (("en","name_en"),("ru","name_ru"),("iast","name_iast")):
        v=(e.get(key) or "").strip()
        if v: nrows.append([e["id"],lang,v,"canonical"])
    for a in (e.get("aliases") or "").split("|"):
        a=a.strip()
        if a: nrows.append([e["id"],"alias",a,"alias"])
    for c in (e.get("category") or "").split("|"):
        c=c.strip()
        if c: crows.append([e["id"],c])
nn = insert("entity_names", ["entity_id","lang","value","kind"], nrows)
nc = insert("entity_categories", ["entity_id","category"], crows)
print("names:", nn, "| categories:", nc)

# 4) relations
rels = list(csv.DictReader(open(os.path.join(BASE,"relations_all.csv"),encoding="utf-8")))
rrows = [[r["from_id"],r["relation"],r["to_id"]] for r in rels]
nr = insert("entity_relations", ["from_id","relation","to_id"], rrows)
print("relations:", nr)

# 4b) profile layer — non-destructive (NOT dropped on reload; preserves curated prose)
run("""CREATE TABLE IF NOT EXISTS entity_profiles (
  entity_id TEXT PRIMARY KEY, summary TEXT, biography TEXT, contribution TEXT,
  level TEXT NOT NULL DEFAULT 'bronze', reviewed_by TEXT, reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')) );""")
run("""CREATE TABLE IF NOT EXISTS entity_citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, entity_id TEXT NOT NULL, work_id TEXT NOT NULL,
  ref TEXT NOT NULL, kind TEXT, note TEXT );""")
# seed a bronze row for every entity lacking one; existing curated rows are kept (OR IGNORE)
np = insert("entity_profiles", ["entity_id","summary"], [[e["id"], e.get("note","")] for e in ents])
print("profiles seeded (bronze):", np)

# auto-enriched summaries (bronze): batched UPSERT of composed summaries for non-curated personalities
auto_path = os.path.join(BASE, "profiles_auto.csv")
if os.path.exists(auto_path):
    ar = list(csv.DictReader(open(auto_path, encoding="utf-8")))
    for i in range(0, len(ar), 60):
        chunk = ar[i:i+60]
        vals = ",".join(
            f"({q(r['entity_id'])},{q(r.get('summary',''))},{q(r.get('biography',''))},"
            f"{q(r.get('contribution',''))},{q(r.get('level','auto') or 'auto')},datetime('now'))" for r in chunk)
        run(f"INSERT INTO entity_profiles (entity_id,summary,biography,contribution,level,updated_at) VALUES {vals} "
            "ON CONFLICT(entity_id) DO UPDATE SET summary=excluded.summary, biography=excluded.biography, "
            "contribution=excluded.contribution, level=excluded.level, updated_at=datetime('now');")
    print("auto profiles upserted:", len(ar))
else:
    print("auto summaries: profiles_auto.csv not found — skipped")

# curated profiles — batched UPSERT (gold): full summary+biography+contribution for listed entities
prof_path = os.path.join(BASE, "profiles_curated.csv")
if os.path.exists(prof_path):
    pr = list(csv.DictReader(open(prof_path, encoding="utf-8")))
    for i in range(0, len(pr), 60):
        chunk = pr[i:i+60]
        vals = ",".join(
            f"({q(r['entity_id'])},{q(r.get('summary',''))},{q(r.get('biography',''))},"
            f"{q(r.get('contribution',''))},{q(r.get('level','gold') or 'gold')},datetime('now'))" for r in chunk)
        run(f"INSERT INTO entity_profiles (entity_id,summary,biography,contribution,level,updated_at) VALUES {vals} "
            "ON CONFLICT(entity_id) DO UPDATE SET summary=excluded.summary, biography=excluded.biography, "
            "contribution=excluded.contribution, level=excluded.level, updated_at=datetime('now');")
    print("curated profiles upserted:", len(pr))
else:
    print("curated profiles: profiles_curated.csv not found — skipped")

# 4c) cross-silo facet links — non-destructive (NOT dropped on reload; NO FK to entities,
#     иначе DROP entities из schema.sql каскадно стёр бы связи). Источник: links_all.csv.
run("""CREATE TABLE IF NOT EXISTS entity_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT, entity_id TEXT NOT NULL, kind TEXT NOT NULL,
  ref TEXT NOT NULL, title TEXT, subtitle TEXT, sort INTEGER NOT NULL DEFAULT 0, dataset TEXT,
  UNIQUE(entity_id, kind, ref) );""")
run("CREATE INDEX IF NOT EXISTS idx_links_entity ON entity_links(entity_id);")
links_path = os.path.join(BASE, "links_all.csv")
if os.path.exists(links_path):
    links = list(csv.DictReader(open(links_path, encoding="utf-8")))
    lrows = [[l["entity_id"], l["kind"], l["ref"], l.get("title",""), l.get("subtitle",""),
              l.get("sort","0"), l.get("dataset","")] for l in links]
    nl = insert("entity_links", ["entity_id","kind","ref","title","subtitle","sort","dataset"], lrows)
    print("links:", nl)
else:
    print("links: links_all.csv not found — skipped")

# 5) verify
for t in ("entities","entity_names","entity_categories","entity_relations","entity_profiles","entity_links"):
    res = run(f"SELECT COUNT(*) AS n FROM {t};")
    print(f"  D1 {t}:", res[0]["results"][0]["n"])
print("done.")
