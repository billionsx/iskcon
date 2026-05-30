#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate appears-in edges linking existing personalities to the books they appear in
(many-to-many) + a few factual Vyasa author-of edges. Only existing ids are used.
Writes book_relations.csv. Dedups against current relations_all.csv.
"""
import csv, os
base=os.path.dirname(os.path.abspath(__file__))
rows=list(csv.DictReader(open(os.path.join(base,"entities_all.csv"),encoding="utf-8")))
books={r["id"] for r in rows if r["type"]=="scripture"}

CAT={
 "mahabharata":{"mahabharata","sb"}, "pandava":{"bg","mahabharata","sb"}, "gita":{"bg"},
 "ramayana":{"ramayana","sb"}, "bhagavatam":{"sb"}, "maha-jana":{"sb"},
 "vraja":{"sb","krishna-book"}, "krishna-family":{"sb","krishna-book"},
 "krishna-associate":{"sb","krishna-book"}, "krishna-consort":{"sb","krishna-book"},
 "demigod":{"sb"}, "sage":{"sb"}, "demon":{"sb"}, "avatara":{"sb"}, "lila-avatara":{"sb"},
 "guna-avatara":{"sb"}, "yuga-avatara":{"sb"}, "kumaras":{"sb"}, "manu":{"sb"}, "king":{"sb"},
 "shaktyavesha":{"sb"}, "vilasa":{"sb"}, "pancha-tattva":{"cc","cb","cm"},
 "chaitanya-associate":{"cc","cb","cm"}, "cc":{"cc"}, "six-goswamis":{"cc","cb"},
}
OVERRIDE={
 "krishna":{"sb","krishna-book","bg","cc","cb","mahabharata","bs"},
 "chaitanya":{"cc","cb","cm","sb","ggd"}, "radharani":{"sb","krishna-book","cc","cb","bs"},
 "balarama":{"sb","krishna-book","mahabharata"}, "bhishma":{"mahabharata","sb","bg"},
 "narayana":{"sb"}, "vishnu":{"sb","bs"}, "lakshmi":{"sb"},
 "haridasa-thakura":{"cc","cb"}, "madhavendra-puri":{"cc"}, "ishvara-puri":{"cc"},
 "narada":{"sb","mahabharata"}, "vyasadeva":{"sb","mahabharata"},
 "hanuman":{"ramayana","mahabharata"}, "parashurama":{"mahabharata","ramayana","sb"},
}
AUTHOR_OF={"vyasadeva":{"sb","mahabharata","puranas","vedanta-sutra"},
           "satsvarupa-das-goswami":{"prabhupada-lilamrita"},
           "kavi-karnapura":{"ggd"},
           "lochana-dasa-thakura":{"cm"},
           "valmiki":{"ramayana"}}

# existing edges (dedup against BASE relation files only, never relations_all)
existing=set()
for bf in ("relations_core.csv","ggd_relations.csv","iskcon_gurus_relations.csv","prabhupada_lilamrita_relations.csv"):
    p=os.path.join(base,bf)
    if os.path.exists(p):
        for r in csv.DictReader(open(p,encoding="utf-8")):
            existing.add((r["from_id"],r["relation"],r["to_id"]))

out=[]
def add(f,rel,t):
    if t in books and f!=t and (f,rel,t) not in existing:
        existing.add((f,rel,t)); out.append([f,rel,t])

for r in rows:
    eid=r["id"]
    if r["type"]!="personality": continue
    ds=r["dataset"]; cats=set((r["category"] or "").split("|"))
    target=set()
    if ds=="Гаура-ганоддеша-дипика · Гаура-лила": target|={"ggd","cc","cb","cm"}
    elif ds=="Гаура-ганоддеша-дипика · Кришна-лила": target|={"ggd","sb","krishna-book"}
    elif ds=="Прабхупада-лиламрита": target|={"prabhupada-lilamrita"}
    elif ds=="Ядро":
        for c in cats: target|=CAT.get(c,set())
    # gurus: no book appearance
    if eid in OVERRIDE: target|=OVERRIDE[eid]
    for b in sorted(target): add(eid,"appears-in",b)

for aid,bset in AUTHOR_OF.items():
    for b in sorted(bset): add(aid,"author-of",b)

with open(os.path.join(base,"book_relations.csv"),"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f); w.writerow(["from_id","relation","to_id"]); w.writerows(out)

from collections import Counter
print("new edges:",len(out))
print("appears-in per book:")
for b,n in Counter(t for f,r,t in out if r=="appears-in").most_common():
    print(f"  {b:14} {n}")
print("author-of added:",sum(1 for x in out if x[1]=="author-of"))
