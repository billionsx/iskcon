#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Principal personalities of Srila Prabhupada-lilamrta (Satsvarupa dasa Goswami).
Documented core: family, Gaudiya Math godbrothers, the 1977 initiating acharyas,
key founding disciples, and notable helpers. Long tail expands during curation.
Emits prabhupada_lilamrita_entities.csv + _relations.csv. Dedups against existing files.
"""
import csv, os
base = os.path.dirname(__file__)
def ids(fn):
    p=os.path.join(base,fn)
    if not os.path.exists(p): return set()
    with open(p,encoding="utf-8") as f: return {r["id"] for r in csv.DictReader(f)}
existing = ids("entities_core.csv")|ids("ggd_entities.csv")|ids("ggd_krishna_lila_entities.csv")|ids("iskcon_gurus_entities.csv")

# (id, name_en, name_ru, category, note, confidence, relation, target)
E = [
 ("gour-mohan-de","Gour Mohan De","Гоур Мохан Де","pl|family","Отец Шрилы Прабхупады","verified","",""),
 ("rajani-de","Rajani Devi","Раджани Деви","pl|family","Мать Шрилы Прабхупады","verified","",""),
 ("radharani-de","Radharani Devi","Радхарани Деви","pl|family","Супруга Прабхупады в семейной жизни","review","",""),
 ("bhakti-prajnana-keshava","Bhakti Prajnana Keshava Maharaja","Бхакти Прагьяна Кешава Махарадж","pl|godbrother","Духовный брат; даровал Прабхупаде санньясу (1959)","verified","disciple-of","bhaktisiddhanta-sarasvati"),
 ("bhakti-rakshak-sridhar","Bhakti Rakshak Sridhar Maharaja","Бхакти Ракшак Шридхар Махарадж","pl|godbrother","Духовный брат Прабхупады","verified","disciple-of","bhaktisiddhanta-sarasvati"),
 ("bhakti-hridaya-bon","Bhakti Hridaya Bon Maharaja","Бхакти Хридай Бон Махарадж","pl|godbrother","Духовный брат Прабхупады","verified","disciple-of","bhaktisiddhanta-sarasvati"),
 ("bhakti-pramode-puri","Bhakti Pramode Puri Maharaja","Бхакти Прамод Пури Махарадж","pl|godbrother","Духовный брат Прабхупады","review","disciple-of","bhaktisiddhanta-sarasvati"),
 ("bhakti-saranga-goswami","Bhakti Saranga Goswami Maharaja","Бхакти Саранга Госвами Махарадж","pl|godbrother","Духовный брат Прабхупады","review","disciple-of","bhaktisiddhanta-sarasvati"),
 ("akincana-krishnadasa-babaji","Akincana Krishnadasa Babaji","Акинчана Кришнадас Бабаджи","pl|godbrother","Духовный брат Прабхупады","review","disciple-of","bhaktisiddhanta-sarasvati"),
 ("bhakti-dayita-madhava","Bhakti Dayita Madhava Maharaja","Бхакти Дайита Мадхава Махарадж","pl|godbrother","Духовный брат Прабхупады","review","disciple-of","bhaktisiddhanta-sarasvati"),
 ("kirtanananda-swami","Kirtanananda Swami","Киртанананда Свами","pl|zonal-acharya-1977","Один из первых инициирующих ачарьев 1977 г.","review","disciple-of","prabhupada"),
 ("bhavananda-das","Bhavananda","Бхавананда","pl|zonal-acharya-1977","Один из первых инициирующих ачарьев 1977 г.","review","disciple-of","prabhupada"),
 ("hansadutta-das","Hansadutta","Хамсадутта","pl|zonal-acharya-1977","Один из первых инициирующих ачарьев 1977 г.","review","disciple-of","prabhupada"),
 ("ramesvara-swami","Ramesvara Swami","Рамешвара Свами","pl|zonal-acharya-1977","Один из первых инициирующих ачарьев 1977 г.","review","disciple-of","prabhupada"),
 ("harikesa-swami","Harikesa Swami","Харикеша Свами","pl|zonal-acharya-1977","Один из первых инициирующих ачарьев 1977 г.","review","disciple-of","prabhupada"),
 ("bhagavan-das-acharya","Bhagavan Das","Бхагаван дас","pl|zonal-acharya-1977","Один из первых инициирующих ачарьев 1977 г.","review","disciple-of","prabhupada"),
 ("jayatirtha-das","Jayatirtha","Джаятиртха","pl|zonal-acharya-1977","Один из первых инициирующих ачарьев 1977 г.","review","disciple-of","prabhupada"),
 ("shyamasundara-das","Shyamasundara Das","Шьямасундара дас","pl|founding-disciple","Ранний ученик; личный слуга Прабхупады","verified","disciple-of","prabhupada"),
 ("brahmananda-das","Brahmananda Das","Брахмананда дас","pl|founding-disciple","Один из первых учеников в Нью-Йорке","verified","disciple-of","prabhupada"),
 ("gargamuni-swami","Gargamuni Swami","Гаргамуни Свами","pl|founding-disciple","Один из первых учеников в Нью-Йорке; брат Брахмананды","review","disciple-of","prabhupada"),
 ("achyutananda-swami","Achyutananda Swami","Ачьютананда Свами","pl|founding-disciple","Ранний ученик; первым из учеников отправился в Индию","review","disciple-of","prabhupada"),
 ("hayagriva-das","Hayagriva Das","Хаягрива дас","pl|founding-disciple","Ранний ученик; помогал редактировать книги","verified","disciple-of","prabhupada"),
 ("rupanuga-das","Rupanuga Das","Рупануга дас","pl|founding-disciple","Ранний ученик и лидер ИСККОН","review","disciple-of","prabhupada"),
 ("rayarama-das","Rayarama Das","Раярама дас","pl|founding-disciple","Ранний ученик; редактор Back to Godhead","review","disciple-of","prabhupada"),
 ("gurudas","Gurudas","Гурудас","pl|founding-disciple","Ранний ученик; возглавил храм в Лондоне","review","disciple-of","prabhupada"),
 ("jadurani-devi-dasi","Jadurani Devi Dasi","Джадурани деви даси","pl|founding-disciple","Первая художница ИСККОН","verified","disciple-of","prabhupada"),
 ("govinda-dasi","Govinda Dasi","Говинда даси","pl|founding-disciple","Ранняя ученица; личная служанка-секретарь","review","disciple-of","prabhupada"),
 ("sumati-morarji","Sumati Morarji","Сумати Морарджи","pl|patron","Глава Scindia Steamship; предоставила Прабхупаде место на «Джаладуте» (1965)","verified","",""),
]

rows=[]; rels=[]
for eid,en,ru,cat,note,conf,rel,tgt in E:
    if eid not in existing:
        rows.append([eid,"personality","jiva-tattva",cat,en,"",ru,"",note,"Прабхупада-лиламрита",conf])
    if rel and tgt:
        rels.append([eid,rel,tgt])
# family relations (Prabhupada -> parents)
rels.append(["prabhupada","son-of","gour-mohan-de"])
rels.append(["prabhupada","son-of","rajani-de"])
# godbrother edges (mutual sense, stored one direction to Prabhupada)
for eid,*_ in [e for e in E if e[3]=="pl|godbrother"]:
    rels.append([eid,"godbrother-of","prabhupada"])

with open(os.path.join(base,"prabhupada_lilamrita_entities.csv"),"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f); w.writerow(["id","type","tattva","category","name_en","name_iast","name_ru","aliases","note","source_ref","confidence"]); w.writerows(rows)
with open(os.path.join(base,"prabhupada_lilamrita_relations.csv"),"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f); w.writerow(["from_id","relation","to_id"]); w.writerows(rels)
print("PL entities:",len(rows),"| PL relations:",len(rels))
