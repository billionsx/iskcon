#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Full backup-export: mirror EVERY gold card (with longform) from D1 into the
registry CSVs, so the entire personality library survives any rebuild.

- profiles_curated.csv : upsert gold summary/biography/contribution/level for all
- profiles_longform.csv: upsert longform for all gold EXCEPT `krishna` (its bespoke
  ~167K row is left exactly as committed in git)
- profiles_auto.csv    : drop every gold entity_id (now authoritative in curated)

Existing rows are updated in place (order preserved); new rows are appended sorted.
Per-file line terminator is preserved. Reads D1 (needs CLOUDFLARE_API_TOKEN),
paginated to stay within API response limits.
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
PROTECT = {"krishna"}  # bespoke longform row — never rewritten from D1


def run(sql, params=None):
    body = {"sql": sql}
    if params is not None:
        body["params"] = params
    req = urllib.request.Request(
        URL, method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        data=json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=180) as r:
        out = json.loads(r.read())
    if not out.get("success"):
        raise RuntimeError(json.dumps(out.get("errors"), ensure_ascii=False))
    return out["result"]


# 1) every gold card that carries a real longform article
res = run("SELECT entity_id FROM entity_profiles "
          "WHERE level='gold' AND longform IS NOT NULL AND length(longform) > 200 "
          "ORDER BY entity_id;")
ids = [r["entity_id"] for r in res[0]["results"]]
print("gold cards with longform in D1:", len(ids))
if not ids:
    sys.exit("nothing to export")

# 2) fetch full rows in batches (avoid oversized API responses)
data = {}
B = 40
for i in range(0, len(ids), B):
    chunk = ids[i:i + B]
    inlist = ",".join("'" + e + "'" for e in chunk)
    r = run(f"SELECT entity_id,summary,biography,contribution,level,longform "
            f"FROM entity_profiles WHERE entity_id IN ({inlist});")
    for row in r[0]["results"]:
        data[row["entity_id"]] = row
assert len(data) == len(ids), f"fetched {len(data)} != {len(ids)}"
# validate every longform is parseable JSON before we persist it
for e in ids:
    try:
        json.loads(data[e].get("longform") or "")
    except Exception as ex:
        sys.exit(f"invalid longform JSON for {e}: {ex}")
print("fetched + JSON-validated:", len(data))


def detect_term(path):
    with open(path, "rb") as f:
        return "\r\n" if b"\r\n" in f.read(65536) else "\n"


def read_csv(name):
    p = os.path.join(BASE, name)
    with open(p, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        return p, r.fieldnames, list(r), detect_term(p)


def write_csv(path, fields, rows, term):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator=term)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k, "") for k in fields})


# 3a) curated — upsert gold prose for all
p, cf, crows, term = read_csv("profiles_curated.csv")
pos = {r["entity_id"]: i for i, r in enumerate(crows)}
added = updated = 0
for eid in ids:
    d = data[eid]
    rec = {"entity_id": eid, "summary": d.get("summary") or "",
           "biography": d.get("biography") or "", "contribution": d.get("contribution") or "",
           "level": "gold"}
    if eid in pos:
        crows[pos[eid]] = rec; updated += 1
    else:
        crows.append(rec); added += 1
write_csv(p, cf, crows, term)
print(f"curated: updated {updated}, appended {added}, total now {len(crows)}")

# 3b) longform — upsert for all except protected bespoke rows
p, lf, lrows, term = read_csv("profiles_longform.csv")
pos = {r["entity_id"]: i for i, r in enumerate(lrows)}
added = updated = skipped = 0
for eid in ids:
    if eid in PROTECT:
        skipped += 1
        continue
    rec = {"entity_id": eid, "longform": data[eid].get("longform") or ""}
    if eid in pos:
        lrows[pos[eid]] = rec; updated += 1
    else:
        lrows.append(rec); added += 1
write_csv(p, lf, lrows, term)
print(f"longform: updated {updated}, appended {added}, protected {skipped}, total now {len(lrows)}")

# 3c) auto — drop every gold id (now authoritative in curated)
p, af, arows, term = read_csv("profiles_auto.csv")
idset = set(ids)
before = len(arows)
arows = [r for r in arows if r["entity_id"] not in idset]
write_csv(p, af, arows, term)
print(f"auto: {before} -> {len(arows)} (removed {before - len(arows)})")
print("done.")
