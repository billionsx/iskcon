#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fill missing name_en / name_ru / name_iast across imported registry CSVs.
- name_en: clean Latin (from Cyrillic where missing)
- name_ru: Cyrillic (from Latin where missing)
- name_iast: best-effort IAST via an ISKCON-term dictionary + light rules (approx; review)
Core file is left untouched (already accurate). Existing non-empty values are preserved.
"""
import csv, os, re
base = os.path.dirname(os.path.abspath(__file__))
FILES = ["ggd_entities.csv","ggd_krishna_lila_entities.csv",
         "iskcon_gurus_entities.csv","prabhupada_lilamrita_entities.csv"]

# ---- Cyrillic -> Latin (plain, for name_en)
CYR2LAT_MULTI = [("дж","j"),("кх","kh"),("бх","bh"),("гх","gh"),("дх","dh"),
                 ("тх","th"),("пх","ph"),("чх","ch"),("кш","ksh"),("шч","shch")]
CYR2LAT = {"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"j","з":"z",
 "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s",
 "т":"t","у":"u","ф":"ph","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sh","ъ":"","ы":"y",
 "ь":"","э":"e","ю":"yu","я":"ya"," ":" ","-":"-","(":"(",")":")",".":".",",":",","/":"/"}
def cyr2lat(s):
    s=s.lower()
    for a,b in CYR2LAT_MULTI: s=s.replace(a,b)
    out="".join(CYR2LAT.get(ch,ch) for ch in s)
    return re.sub(r"\s+"," ",out).strip()
def titlecase(s):
    return re.sub(r"[A-Za-zĀāĪīŪūṚṛṆṇṬṭḌḍṢṣŚśḤḥṀṁ]+", lambda m: m.group(0)[:1].upper()+m.group(0)[1:], s)

# ---- Latin -> Cyrillic (for name_ru)
LAT2CYR_MULTI=[("kh","х"),("bh","бх"),("gh","гх"),("dh","дх"),("th","тх"),("ph","ф"),
 ("ch","ч"),("sh","ш"),("ya","я"),("yu","ю"),("yo","ё"),("jna","гья"),("jn","гь"),
 ("ai","ай"),("au","ау"),("ee","и"),("oo","у"),("aa","а"),("ii","и"),("uu","у")]
LAT2CYR={"a":"а","b":"б","c":"ч","d":"д","e":"е","f":"ф","g":"г","h":"х","i":"и",
 "j":"дж","k":"к","l":"л","m":"м","n":"н","o":"о","p":"п","q":"к","r":"р","s":"с",
 "t":"т","u":"у","v":"в","w":"в","x":"кс","y":"й","z":"з","-":"-"," ":" ",".":".",
 "(":"(",")":")",",":","}
def strip_diac(s):
    rep={"ā":"a","ī":"i","ū":"u","ṛ":"ri","ṝ":"ri","ṇ":"n","ṭ":"t","ḍ":"d","ṣ":"sh",
         "ś":"sh","ḥ":"h","ṁ":"m","ñ":"ny","ṅ":"n"," c":"c"}
    for a,b in rep.items(): s=s.replace(a,b).replace(a.upper(),b)
    return s
def lat2cyr(s):
    s=strip_diac(s).lower()
    for a,b in LAT2CYR_MULTI: s=s.replace(a,b)
    out="".join(LAT2CYR.get(ch,ch) for ch in s)
    return titlecase(re.sub(r"\s+"," ",out).strip())

# ---- ISKCON-term IAST dictionary (accurate for common words/names)
IAST = {
 "swami":"Svāmī","goswami":"Gosvāmī","gosvami":"Gosvāmī","das":"Dāsa","dasa":"Dāsa",
 "dasi":"Dāsī","devi":"Devī","maharaja":"Mahārāja","pandit":"Paṇḍita","pandita":"Paṇḍita",
 "acharya":"Ācārya","acarya":"Ācārya","thakura":"Ṭhākura","thakur":"Ṭhākura","prabhu":"Prabhu",
 "krishna":"Kṛṣṇa","krsna":"Kṛṣṇa","krsta":"Kṛṣṇa","radha":"Rādhā","radharani":"Rādhārāṇī",
 "vishnu":"Viṣṇu","visnu":"Viṣṇu","narayana":"Nārāyaṇa","narayan":"Nārāyaṇa","govinda":"Govinda",
 "gopala":"Gopāla","gopal":"Gopāla","bhakti":"Bhakti","caitanya":"Caitanya","chaitanya":"Caitanya",
 "nityananda":"Nityānanda","advaita":"Advaita","gadadhara":"Gadādhara","rupa":"Rūpa","sanatana":"Sanātana",
 "raghunatha":"Raghunātha","jiva":"Jīva","gaura":"Gaura","mahaprabhu":"Mahāprabhu","mishra":"Miśra",
 "bhatta":"Bhaṭṭa","bhattacharya":"Bhaṭṭācārya","brahmachari":"Brahmacārī","brahmacari":"Brahmacārī",
 "vidyanidhi":"Vidyānidhi","pundarika":"Puṇḍarīka","sridhara":"Śrīdhara","shridhara":"Śrīdhara",
 "ramananda":"Rāmānanda","raya":"Rāya","haridasa":"Haridāsa","narada":"Nārada","vyasa":"Vyāsa",
 "vyasadeva":"Vyāsadeva","sukadeva":"Śukadeva","prahlada":"Prahlāda","dhruva":"Dhruva","arjuna":"Arjuna",
 "lalita":"Lalitā","vishakha":"Viśākhā","visakha":"Viśākhā","manjari":"Mañjarī","gopi":"Gopī",
 "vrindavana":"Vṛndāvana","prabhupada":"Prabhupāda","bhaktivinoda":"Bhaktivinoda",
 "bhaktisiddhanta":"Bhaktisiddhānta","sarasvati":"Sarasvatī","keshava":"Keśava","kesava":"Keśava",
 "bharati":"Bhāratī","puri":"Purī","tirtha":"Tīrtha","madhava":"Mādhava","madhva":"Madhva",
 "madhvacharya":"Madhvācārya","damodara":"Dāmodara","svarupa":"Svarūpa","siva":"Śiva","shiva":"Śiva",
 "indra":"Indra","surya":"Sūrya","chandra":"Candra","candra":"Candra","brahma":"Brahmā",
 "vamana":"Vāmana","rama":"Rāma","ramachandra":"Rāmacandra","sita":"Sītā","hanuman":"Hanumān",
 "uddhava":"Uddhava","akrura":"Akrūra","kunti":"Kuntī","pariksit":"Parīkṣit","bhishma":"Bhīṣma",
 "narasimha":"Narasiṁha","nrisimha":"Nṛsiṁha","kapila":"Kapila","balarama":"Balarāma","ananta":"Ananta",
 "ananda":"ānanda","govindananda":"Govindānanda","jagannatha":"Jagannātha","jagannath":"Jagannātha",
 "vakreshvara":"Vakreśvara","kashishvara":"Kāśīśvara","raghava":"Rāghava","ratnavali":"Ratnāvalī",
}
ROOT_RULES=[("sh","ś"),("ri","ṛ")]  # very light; applied only when no dict hit
def token_iast(tok):
    low=re.sub(r"[^a-z]","",tok.lower())
    if low in IAST: return IAST[low]
    out=tok
    out=out.replace("sh","ś").replace("Sh","Ś").replace("SH","Ś")
    return out
def en2iast(s):
    parts=re.split(r"(\s+|-)",s)
    return "".join(token_iast(p) if p.strip() and not re.match(r"^[\s-]+$",p) else p for p in parts)

def fix(fn):
    path=os.path.join(base,fn); rows=list(csv.DictReader(open(path,encoding="utf-8")))
    flds=rows[0].keys() if rows else []
    n_en=n_ru=n_ia=0
    for r in rows:
        en=(r.get("name_en") or "").strip(); ru=(r.get("name_ru") or "").strip(); ia=(r.get("name_iast") or "").strip()
        if not en and ru: en=titlecase(cyr2lat(ru)); r["name_en"]=en; n_en+=1
        if not ru and en: r["name_ru"]=lat2cyr(en); n_ru+=1
        if not ia and en: r["name_iast"]=en2iast(en); n_ia+=1
    with open(path,"w",newline="",encoding="utf-8") as f:
        w=csv.DictWriter(f,fieldnames=list(flds)); w.writeheader(); w.writerows(rows)
    print(f"{fn}: +name_en {n_en}, +name_ru {n_ru}, +name_iast {n_ia}  (rows {len(rows)})")

for fn in FILES: fix(fn)
print("done")
