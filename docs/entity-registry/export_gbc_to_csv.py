#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Persist this-session GBC gold cards from D1 into the registry CSVs so they
survive any full rebuild.

- appends the 27 gurus' gold prose to profiles_curated.csv (summary/biography/
  contribution/level)
- appends their longform JSON to profiles_longform.csv
- removes their stale auto rows from profiles_auto.csv

Existing rows (incl. the big krishna longform) are left byte-untouched: curated &
longform are append-only; auto is rewritten via csv round-trip. Per-file line
terminator is preserved. Reads D1 (needs CLOUDFLARE_API_TOKEN)."""
import csv, os, sys, json, io, urllib.request

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


IDS = ["hanumatpresaka-swami", "janananda-dasa-goswami", "kavicandra-swami",
       "kesava-bharati-dasa-goswami", "mahadyuti-swami", "mahaprabhu-swami",
       "mahavisnu-swami", "navayogendra-swami", "partha-sarathi-das-goswami",
       "prabodhananda-saraswati-swami", "purushatraya-swami", "radha-govinda-swami",
       "rtadhvaja-swami", "siddhartha-swami", "smita-krsna-swami", "subhaga-swami",
       "sukadeva-swami", "dhanvantari-swami", "candra-mukha-swami",
       "bhaktivyasa-tirtha-swami", "gauranga-prem-swami", "rama-govinda-swami",
       "bhaktipada-goswami", "bhurijana-das", "acyuta-priya-das", "vatsala-das",
       "radha-govinda-das"]

inlist = ",".join("'" + i + "'" for i in IDS)
res = run(f"SELECT entity_id,summary,biography,contribution,level,longform "
          f"FROM entity_profiles WHERE entity_id IN ({inlist});")
rows = {r["entity_id"]: r for r in res[0]["results"]}
missing = [i for i in IDS if i not in rows]
if missing:
    sys.exit("missing in D1: " + ",".join(missing))
for i in IDS:
    d = rows[i]
    if not d.get("longform") or len(d["longform"]) < 50:
        sys.exit(f"{i}: longform missing/too small")
    json.loads(d["longform"])  # validate
print("fetched + validated from D1:", len(rows))


def detect_term(path):
    with open(path, "rb") as f:
        return "\r\n" if b"\r\n" in f.read(65536) else "\n"


def present_ids(path):
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        header = next(r)
        idi = header.index("entity_id")
        return set(row[idi] for row in r if row)


def append_rows(name, fields, newrows):
    p = os.path.join(BASE, name)
    term = detect_term(p)
    with open(p, "rb") as f:
        data = f.read()
    need_nl = bool(data) and not data.endswith(b"\n")
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator=term)
    for row in newrows:
        w.writerow([row.get(k, "") for k in fields])
    with open(p, "a", newline="", encoding="utf-8") as f:
        if need_nl:
            f.write(term)
        f.write(buf.getvalue())


def rewrite_drop(name, drop_ids):
    p = os.path.join(BASE, name)
    term = detect_term(p)
    with open(p, newline="", encoding="utf-8") as f:
        rd = list(csv.reader(f))
    header, body = rd[0], rd[1:]
    idi = header.index("entity_id")
    kept = [row for row in body if row and row[idi] not in drop_ids]
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator=term)
        w.writerow(header)
        for row in kept:
            w.writerow(row)
    return len(body), len(kept)


# curated (append; the 27 are not yet present)
cur_have = present_ids(os.path.join(BASE, "profiles_curated.csv"))
cur_new = [{"entity_id": i, "summary": rows[i].get("summary") or "",
            "biography": rows[i].get("biography") or "",
            "contribution": rows[i].get("contribution") or "",
            "level": rows[i].get("level") or "gold"}
           for i in IDS if i not in cur_have]
append_rows("profiles_curated.csv",
            ["entity_id", "summary", "biography", "contribution", "level"], cur_new)
print("curated appended:", len(cur_new), "| already present:", len(IDS) - len(cur_new))

# longform (append; the 27 are not yet present — krishna row untouched)
lf_have = present_ids(os.path.join(BASE, "profiles_longform.csv"))
lf_new = [{"entity_id": i, "longform": rows[i].get("longform") or ""}
          for i in IDS if i not in lf_have]
append_rows("profiles_longform.csv", ["entity_id", "longform"], lf_new)
print("longform appended:", len(lf_new), "| already present:", len(IDS) - len(lf_new))

# auto (drop the 27 stale rows)
before, after = rewrite_drop("profiles_auto.csv", set(IDS))
print(f"auto rows: {before} -> {after} (removed {before - after})")
print("done.")
