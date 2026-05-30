#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Materialize the Krishna-lila side of the GGD pairs into registry entities.
Reads ggd_pairs.csv (krishna_lila_id + krishna_lila_name_ru), skips ids already
present in entities_core.csv or ggd_entities.csv, and writes
ggd_krishna_lila_entities.csv so the gaura-lila-identity graph has no dangling ids.
Tattva is assigned by coarse heuristic and everything is flagged 'review' for curation.
"""
import csv, os
base = os.path.dirname(__file__)

def ids(fn):
    p=os.path.join(base,fn)
    with open(p,encoding="utf-8") as f:
        return {r["id"] for r in csv.DictReader(f)}

existing = ids("entities_core.csv") | ids("ggd_entities.csv")

def classify(name):
    n = name.lower()
    if "манджари" in n: return ("shakti-tattva","krishna-lila|manjari")
    if "гопи" in n:     return ("shakti-tattva","krishna-lila|gopi")
    if "пастух" in n or "гопа" in n or "пастушок" in n: return ("jiva-tattva","krishna-lila|gopa")
    if "муни" in n or "риши" in n:  return ("jiva-tattva","krishna-lila|sage")
    if "махараджа" in n or "царь" in n: return ("jiva-tattva","krishna-lila|king")
    if "брахман" in n:  return ("jiva-tattva","krishna-lila|brahmana")
    if "слуга" in n:    return ("jiva-tattva","krishna-lila|servant")
    if "певец" in n:    return ("jiva-tattva","krishna-lila|singer")
    if "танцор" in n:   return ("jiva-tattva","krishna-lila|dancer")
    if "вишну" in n:    return ("vishnu-tattva","krishna-lila|vishnu-tattva")
    if "вьюха" in n:    return ("vishnu-tattva","krishna-lila|vishnu-tattva")
    return ("","krishna-lila|associate")  # ambiguous -> tattva for curation

seen = {}
with open(os.path.join(base,"ggd_pairs.csv"),encoding="utf-8") as f:
    for r in csv.DictReader(f):
        kid = r["krishna_lila_id"].strip()
        name = r["krishna_lila_name_ru"].strip()
        if not kid or kid in existing or kid in seen:
            continue
        seen[kid] = (name, r["verse"])

rows=[]
for kid,(name,verse) in seen.items():
    tattva,cat = classify(name)
    rows.append([kid,"personality",tattva,cat,"","",name,"",f"identity in Gaura-lila (GGD {verse})",f"ГГД {verse}","review"])

with open(os.path.join(base,"ggd_krishna_lila_entities.csv"),"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f)
    w.writerow(["id","type","tattva","category","name_en","name_iast","name_ru","aliases","note","source_ref","confidence"])
    w.writerows(rows)

print("new krishna-lila entities:",len(rows))
from collections import Counter
print("tattva split:",dict(Counter(r[2] or "(empty)" for r in rows)))

# closure check: every relation to_id must now resolve to some entity
all_ids = existing | {r[0] for r in rows}
missing=set()
with open(os.path.join(base,"ggd_relations.csv"),encoding="utf-8") as f:
    for r in csv.DictReader(f):
        if r["to_id"] not in all_ids: missing.add(r["to_id"])
        if r["from_id"] not in all_ids: missing.add(r["from_id"])
print("dangling relation endpoints:",len(missing), sorted(missing)[:10])
