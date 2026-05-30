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

# 5) verify
for t in ("entities","entity_names","entity_categories","entity_relations"):
    res = run(f"SELECT COUNT(*) AS n FROM {t};")
    print(f"  D1 {t}:", res[0]["results"][0]["n"])
print("done.")
