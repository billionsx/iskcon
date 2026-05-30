#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ISKCON initiating gurus from the official GBC list (gbc.iskcon.org).
Each line: 'Name [GURU_ABBR] (OWN_ABBR)'. GURU_ABBR (all-caps token outside parens)
= the guru's own spiritual master; absence => disciple of Srila Prabhupada.
Emits iskcon_gurus_entities.csv + iskcon_gurus_relations.csv.
"""
import csv, os, re, unicodedata
base = os.path.dirname(__file__)

def slug(name):
    n = unicodedata.normalize("NFKD", name).encode("ascii","ignore").decode()
    n = re.sub(r"[^A-Za-z0-9]+","-", n).strip("-").lower()
    return n

# existing ids to avoid duplicates
def ids(fn):
    p=os.path.join(base,fn)
    if not os.path.exists(p): return set()
    with open(p,encoding="utf-8") as f: return {r["id"] for r in csv.DictReader(f)}
existing = ids("entities_core.csv")|ids("ggd_entities.csv")|ids("ggd_krishna_lila_entities.csv")

ACCEPTING = """Acyuta Priya Das RNS (APD)
Advaita Acharya Das BTS (AAD)
Adikarta Das (AKD)
Asita Krishna Swami TKG (AKS)
Atmanivedana Swami BSDS (AVS)
Bhakti Ananda Haridas Goswami (BAHG) BSDS
Bhakti Anugraha Janardana Swami GKG (BAJS)
Bhakti Asraya Vaisnava Swami GKG (BAVS)
Bhaktivaibhava Swami (BVS)
Bhakti Bhagavatamrita Kesava Swami PVS (BBKS)
Bhakti Bhrnga Govinda Swami (BBGS)
Bhakti Caitanya Swami (BCAIS)
Bhakti Carudesna Swami BTS (BCDS)
Bhakti Dayita Adipurusha Swami GGS (BDAS)
Bhakti Dhira Damodara Swami BTS (BDDS)
Bhakti Gaurava Narayan Swami TKG (BGNS)
Bhakti Gauravani Goswami (BGVG)
Bhakti Prabhava Swami BCS (BPRS)
Bhakti Prabhupada-vrata Damodara Swami (BPDS)
Bhakti Pran Gopinath Swami GGS (BPGS)
Bhakti Prema Swami BCS (BHPS)
Bhakti Raghava Swami (BRS)
Bhakti Ratnakara Ambarisa Swami GKG (BRAS)
Bhakti Sundar Goswami (BSG)
Bhakti Vasudeva Swami BTS (BHVS)
Bhakti Vijnana Goswami RNS (BVG)
Bhakti Vikasa Swami (BVKS)
Bhaktivyasa Tirtha Swami BSDS (BVTS)
Bhakti VV Narasimha Swami (BVVNS)
Bhakti-bhusana Swami (BBS)
Bhaktimarga Swami (BMS)
Bhaktipada Goswami SRS (BPG)
Bhurijana Das (BJD)
Bir Krsna Das Goswami (BKG)
Caitanya Avatari Das JPS (CAD)
Caitanya Candra Caran Das JPS (CCCD)
Candra Mukha Swami HDG (CMKS)
Candramauli Swami (CMS)
Danavir Goswami (DG)
Dayavan Swami RSD (DS)
Devakinandan Das MVG (DND)
Devamrita Swami (DAS)
Dhanvantari Swami (DVS)
Dhirasanta Das Goswami (DDG)
Drutakarma Das (DKD)
Gauranga Prem Swami JPS (GRPS)
Giridhari Swami (GDS)
Gopaswami Das (GSD)
Guru Prasad Swami (GPS)
Haladhara Swami GGS (HDS)
Hanumatpresaka Swami (HPS)
Harivilas Das (HVD)
Hrdayananda dasa Goswami (HDG)
Indradyumna Swami (IDS)
Janananda dasa Goswami (JG)
Jayadvaita Swami (JAS)
Jayapataka Swami (JPS)
Jivananda Das (JND)
Kalakantha Das (KKD)
Kavicandra Swami (KVCS)
Kesava Bharati dasa Goswami (KBDG)
Kratu Das (KRD)
Kripamoya Das (KMD)
Krsna Ksetra Swami (KRKS)
Lokanath Swami (LOK)
Madana-mohana Das MG (MM)
Madan Gopal Das SDG (MGD)
Madhu Sevita Das (MSD)
Mahadyuti Swami (MDS)
Mahaman Das (MMD)
Mahaprabhu Swami SRS (MPS)
Mahatma Das (MD)
Mahavisnu Swami (MVS)
Mani Bandha Das NRS (MBD)
Manonatha Das (MND)
Matsya Avatara Das (MAD)
Medhavi Das (MDD)
Narayani Devi Dasi (NDD)
Navayogendra Swami (NYS)
Niranjana Swami (NRS)
Partha Sarathi Das Goswami (PSDG)
Patita Pavana Das IDS (PPD)
Prabodhananda Saraswati Swami GKG (PSS)
Prahladananda Swami (PAS)
Purushatraya Swami (PTS)
Radhacaran Das TKG (RCD)
Radha Govinda Das SRS (RGD)
Radha Govinda Swami (RGM)
Radha Krishna Das TKG (RKD)
Radhanath Swami (RNS)
Rama Govinda Swami KDS (RMGS)
Ravindra Svarupa Das (RVSD)
Revati Raman Das JPS (RRD)
Romapada Swami (RPS)
Rtadhvaja Swami (RTS)
Sacinandana Swami (SNS)
Samik Rsi Das (SRD)
Sankarsana Das (SDA)
Satyadeva Das (SDD)
Siddhartha Swami (SAS)
Sikhi Mahiti Das (SMD)
Sivarama Swami (SRS)
Smita Krsna Swami (SKS)
Sridhama Das (SD)
Srivas Das BTS (SVD)
Subhaga Swami (SSM)
Sundarananda Das GGS (SND)
Sukadeva Swami RNS (SDS)
Umapati Das GKG (UPD)
Vaisesika Das (VSD)
Varsana Swami (VS)
Vatsala Das (VD)
Vasu Srestha Das JPS (VSD)
Vedavyasapriya Swami (VVPS)
Virabahu Das (VBD)
Yadunandana Swami SDG (YNS)
Yamunacarya Das Goswami HDG (YDG)""".splitlines()

NOT_ACCEPTING = ["Bhanu Swami","Ganapati Swami","Giriraja Swami (GRS)","Mukunda Goswami (MG)",
                 "Satsvarupa Das Goswami (SDG)","Vegavan Das"]

# Known guru-abbreviations that point to departed/emeritus gurus not on the accepting list.
DEPARTED = {  # abbr: (slug, name_en)
 "GKG":("gopal-krishna-goswami","Gopal Krishna Goswami"),
 "TKG":("tamal-krishna-goswami","Tamal Krishna Goswami"),
 "BCS":("bhakti-charu-swami","Bhakti Charu Swami"),
 "GGS":("gour-govinda-swami","Gour Govinda Swami"),
 "BTS":("bhakti-tirtha-swami","Bhakti Tirtha Swami"),
}

def parse(line):
    m = re.search(r"\(([A-Za-z0-9-]+)\)", line)
    own = m.group(1) if m else None
    pre = (line[:m.start()] if m else line).strip()
    post = (line[m.end():] if m else "").strip()
    guru = None
    if pre:
        last = pre.split()[-1]
        if re.fullmatch(r"[A-Z]{2,6}", last): guru = last
    if guru is None and post:
        mt = re.match(r"([A-Z]{2,6})\b", post)
        if mt: guru = mt.group(1)
    name = re.sub(r"\([^)]*\)","",line).strip()
    if guru:
        name = re.sub(r"\b"+guru+r"\b","",name).strip()
    name = re.sub(r"\s+"," ",name).strip()
    return name, own, guru

rows=[]; rels=[]; own_map={}; extra_ents={}
parsed=[]
for ln in ACCEPTING:
    name,own,guru = parse(ln); parsed.append((name,own,guru,"initiating-guru"))
    if own: own_map[own]=slug(name)
for ln in NOT_ACCEPTING:
    name,own,guru = parse(ln); parsed.append((name,own,guru,"guru|not-accepting"))
    if own: own_map[own]=slug(name)

for name,own,guru,cat in parsed:
    sid=slug(name)
    if sid not in existing:
        rows.append([sid,"personality","jiva-tattva",f"iskcon|{cat}",name,"","",own or "","","GBC gbc.iskcon.org",
                     "verified"])
    # relation to spiritual master
    target=None
    if guru:
        if guru in own_map: target=own_map[guru]
        elif guru in DEPARTED:
            target=DEPARTED[guru][0]
            extra_ents[target]=DEPARTED[guru][1]
        # else: unresolved abbr -> recorded in aliases, no edge
    else:
        target="prabhupada"  # in core
    if target: rels.append([sid,"disciple-of",target])

for sid,name in extra_ents.items():
    if sid not in existing:
        rows.append([sid,"personality","jiva-tattva","iskcon|guru|departed",name,"","","","",
                     "GBC gbc.iskcon.org","verified"])
        rels.append([sid,"disciple-of","prabhupada"])

with open(os.path.join(base,"iskcon_gurus_entities.csv"),"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f); w.writerow(["id","type","tattva","category","name_en","name_iast","name_ru","aliases","note","source_ref","confidence"]); w.writerows(rows)
with open(os.path.join(base,"iskcon_gurus_relations.csv"),"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f); w.writerow(["from_id","relation","to_id"]); w.writerows(rels)

print("guru entities:",len(rows),"| relations:",len(rels))
print("departed gurus added:",list(extra_ents.values()))
unresolved=sorted({g for _,_,g,_ in parsed if g and g not in own_map and g not in DEPARTED})
print("unresolved guru-abbrs (edge skipped, kept in aliases):",unresolved)
