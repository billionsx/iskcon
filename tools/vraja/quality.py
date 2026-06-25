#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, json, re, urllib.request

CF = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1 = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
HONOR = {"шри", "шрила", "шри-", "श्री", "и", "the", "of"}


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body, headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    with urllib.request.urlopen(rq, timeout=60) as r:
        return json.loads(r.read().decode())


def rows(res):
    return res["result"][0]["results"]


def tight(s):
    s = (s or "").lower().replace("ё", "е")
    s = re.sub(r"[«»\"'`.,;:!?()\[\]{}—–\-]", " ", s)
    toks = [t for t in s.split() if t and t not in HONOR]
    return re.sub(r"\s+", "", " ".join(toks))


tr = rows(d1("SELECT id,name,cluster,vp_id,sort,LENGTH(about) ab, sources_json FROM tirthas WHERE dhama_id='vrindavan'"))

# коллизии по плотному имени
groups = {}
for r in tr:
    k = tight(r["name"])
    groups.setdefault(k, []).append(r)
dups = {k: v for k, v in groups.items() if len(v) > 1}

# тонкие новые места
thin = []
for r in tr:
    src = r.get("sources_json")
    nsrc = 0
    try:
        nsrc = len(json.loads(src)) if src else 0
    except Exception:
        nsrc = 0
    if r.get("vp_id") and (r.get("sort") or 0) >= 1000 and (r.get("ab") or 0) < 40 and nsrc == 0:
        thin.append(r)

lines = [f"total={len(tr)} dup_groups={len(dups)} thin_new={len(thin)}"]
for k, v in list(dups.items())[:12]:
    lines.append(f"  DUP [{k}]: " + " | ".join(f"{x['id']}(cl={x['cluster']},vp={x['vp_id']},ab={x['ab']})" for x in v))
if thin:
    lines.append("THIN sample: " + ", ".join(f"{x['id']}({x['cluster']})" for x in thin[:20]))
body = "\n".join(lines)[:5500]
try:
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-quality DONE',0,?)", [body])
except Exception as e:
    print("d1 err", str(e)[:160])
print(body)
