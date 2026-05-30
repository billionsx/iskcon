#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Principal casts of the Mahabharata and Ramayana as registry entities + relations.
New entities only (deduped against existing files); existing core ids (arjuna, bhishma,
rama, sita, ravana, hanuman ...) are reused in relations, not recreated.
"""
import csv, os
base=os.path.dirname(os.path.abspath(__file__))
def ids(fn):
    p=os.path.join(base,fn)
    return {r["id"] for r in csv.DictReader(open(p,encoding="utf-8"))} if os.path.exists(p) else set()
EXIST=set().union(*[ids(f) for f in ["entities_core.csv","ggd_entities.csv","ggd_krishna_lila_entities.csv",
        "iskcon_gurus_entities.csv","prabhupada_lilamrita_entities.csv"]])

# (id, en, iast, ru, category, note)
MB=[
("shantanu","Shantanu","Śāntanu","Шантану","mahabharata|kuru","Царь Куру, отец Бхишмы"),
("ganga-devi","Ganga","Gaṅgā","Ганга-деви","mahabharata|kuru","Мать Бхишмы"),
("satyavati","Satyavati","Satyavatī","Сатьявати","mahabharata|kuru","Царица, мать Вьясы"),
("vichitravirya","Vichitravirya","Vicitravīrya","Вичитравирья","mahabharata|kuru","Сын Шантану и Сатьявати"),
("chitrangada-kuru","Chitrangada","Citrāṅgada","Читрангада","mahabharata|kuru","Сын Шантану"),
("ambika","Ambika","Ambikā","Амбика","mahabharata|kuru","Мать Дхритараштры"),
("ambalika","Ambalika","Ambālikā","Амбалика","mahabharata|kuru","Мать Панду"),
("pandu","Pandu","Pāṇḍu","Панду","mahabharata|kuru","Отец Пандавов"),
("madri","Madri","Mādrī","Мадри","mahabharata|kuru","Жена Панду, мать Накулы и Сахадевы"),
("gandhari","Gandhari","Gāndhārī","Гандхари","mahabharata|kaurava","Жена Дхритараштры, мать Кауравов"),
("shakuni","Shakuni","Śakuni","Шакуни","mahabharata|kaurava","Брат Гандхари"),
("dushasana","Dushasana","Duḥśāsana","Духшасана","mahabharata|kaurava","Каурава"),
("kripacharya","Kripacharya","Kṛpācārya","Крипачарья","mahabharata|warrior","Наставник"),
("ashwatthama","Ashwatthama","Aśvatthāmā","Ашваттхама","mahabharata|warrior","Сын Дроны"),
("satyaki","Satyaki","Sātyaki","Сатьяки","mahabharata|warrior","Воин Ядавов"),
("kritavarma","Kritavarma","Kṛtavarmā","Критаварма","mahabharata|warrior","Воин Ядавов"),
("drupada","Drupada","Drupada","Друпада","mahabharata|panchala","Царь Панчалы, отец Драупади"),
("dhrishtadyumna","Dhrishtadyumna","Dhṛṣṭadyumna","Дхриштадьюмна","mahabharata|panchala","Брат Драупади"),
("shikhandi","Shikhandi","Śikhaṇḍī","Шикханди","mahabharata|panchala","Воин Панчалы"),
("virata","Virata","Virāṭa","Вирата","mahabharata|king","Царь Матсьи"),
("uttara-devi","Uttara","Uttarā","Уттара","mahabharata|kuru","Жена Абхиманью, мать Парикшита"),
("jayadratha","Jayadratha","Jayadratha","Джаядратха","mahabharata|warrior","Царь Синдху"),
("jarasandha","Jarasandha","Jarāsandha","Джарасандха","mahabharata|king","Царь Магадхи"),
("shishupala","Shishupala","Śiśupāla","Шишупала","mahabharata|king","Царь Чеди"),
("ekalavya","Ekalavya","Ekalavya","Эклавья","mahabharata|warrior","Лучник-нишада"),
("ghatotkacha","Ghatotkacha","Ghaṭotkaca","Гхатоткача","mahabharata|warrior","Сын Бхимы и Хидимбы"),
("hidimbi","Hidimbi","Hiḍimbā","Хидимба","mahabharata|warrior","Жена Бхимы"),
("iravan","Iravan","Irāvān","Ираван","mahabharata|warrior","Сын Арджуны и Улупи"),
("ulupi","Ulupi","Ulūpī","Улупи","mahabharata|warrior","Жена Арджуны"),
("shalya","Shalya","Śalya","Шалья","mahabharata|king","Царь Мадры, брат Мадри"),
]
MB_REL=[
("shantanu","father-of","bhishma"),("ganga-devi","mother-of","bhishma"),
("shantanu","husband-of","satyavati"),("satyavati","mother-of","vyasadeva"),
("shantanu","father-of","vichitravirya"),("satyavati","mother-of","vichitravirya"),
("shantanu","father-of","chitrangada-kuru"),
("ambika","mother-of","dhritarashtra"),("ambalika","mother-of","pandu"),
("vichitravirya","husband-of","ambika"),("vichitravirya","husband-of","ambalika"),
("pandu","father-of","yudhishthira"),("pandu","father-of","bhima"),("pandu","father-of","arjuna"),
("pandu","father-of","nakula"),("pandu","father-of","sahadeva"),
("kunti","wife-of","pandu"),("madri","wife-of","pandu"),
("madri","mother-of","nakula"),("madri","mother-of","sahadeva"),
("gandhari","wife-of","dhritarashtra"),("gandhari","mother-of","duryodhana"),
("shakuni","brother-of","gandhari"),("dushasana","brother-of","duryodhana"),
("ashwatthama","son-of","drona"),
("drupada","father-of","draupadi"),("drupada","father-of","dhrishtadyumna"),
("drupada","father-of","shikhandi"),("dhrishtadyumna","brother-of","draupadi"),
("uttara-devi","wife-of","abhimanyu"),("uttara-devi","mother-of","pariksit"),
("ghatotkacha","son-of","bhima"),("hidimbi","wife-of","bhima"),("hidimbi","mother-of","ghatotkacha"),
("iravan","son-of","arjuna"),("ulupi","wife-of","arjuna"),("shalya","brother-of","madri"),
]
MB_BOOKS={"jarasandha":["mahabharata","sb","krishna-book"],
          "shishupala":["mahabharata","sb","krishna-book"]}

RM=[
("lakshmana","Lakshmana","Lakṣmaṇa","Лакшмана","ramayana|raghu","Брат Рамы"),
("bharata-dasharathi","Bharata","Bharata","Бхарата","ramayana|raghu","Брат Рамы"),
("shatrughna","Shatrughna","Śatrughna","Шатругхна","ramayana|raghu","Брат Рамы"),
("dasharatha","Dasharatha","Daśaratha","Дашаратха","ramayana|raghu","Отец Рамы, царь Айодхьи"),
("kausalya","Kausalya","Kausalyā","Каусалья","ramayana|raghu","Мать Рамы"),
("kaikeyi","Kaikeyi","Kaikeyī","Кайкейи","ramayana|raghu","Мать Бхараты"),
("sumitra","Sumitra","Sumitrā","Сумитра","ramayana|raghu","Мать Лакшманы и Шатругхны"),
("urmila","Urmila","Ūrmilā","Урмила","ramayana|raghu","Жена Лакшманы"),
("kusha","Kusha","Kuśa","Куша","ramayana|raghu","Сын Рамы"),
("lava","Lava","Lava","Лава","ramayana|raghu","Сын Рамы"),
("sugriva","Sugriva","Sugrīva","Сугрива","ramayana|vanara","Царь обезьян"),
("vali","Vali","Vālī","Вали","ramayana|vanara","Брат Сугривы"),
("tara-vanara","Tara","Tārā","Тара","ramayana|vanara","Жена Вали"),
("angada","Angada","Aṅgada","Ангада","ramayana|vanara","Сын Вали"),
("jambavan","Jambavan","Jāmbavān","Джамбаван","ramayana|vanara","Царь медведей"),
("nala-vanara","Nala","Nala","Нала","ramayana|vanara","Строитель моста"),
("vibhishana","Vibhishana","Vibhīṣaṇa","Вибхишана","ramayana|rakshasa","Брат Раваны"),
("kumbhakarna","Kumbhakarna","Kumbhakarṇa","Кумбхакарна","ramayana|rakshasa","Брат Раваны"),
("indrajit","Indrajit","Indrajit","Индраджит","ramayana|rakshasa","Сын Раваны (Мегханада)"),
("mandodari","Mandodari","Mandodarī","Мандодари","ramayana|rakshasa","Жена Раваны"),
("surpanakha","Surpanakha","Śūrpaṇakhā","Шурпанакха","ramayana|rakshasa","Сестра Раваны"),
("maricha","Maricha","Mārīca","Маричи","ramayana|rakshasa","Демон-оборотень"),
("jatayu","Jatayu","Jaṭāyu","Джатаю","ramayana|other","Царь-орёл"),
("sampati","Sampati","Sampāti","Сампати","ramayana|other","Брат Джатаю"),
("ahalya","Ahalya","Ahalyā","Ахалья","ramayana|other","Жена Гаутамы"),
("shabari","Shabari","Śabarī","Шабари","ramayana|other","Преданная-отшельница"),
("guha","Guha","Guha","Гуха","ramayana|other","Царь нишадов"),
("valmiki","Valmiki","Vālmīki","Валмики","ramayana|sage","Автор Рамаяны"),
]
RM_REL=[
("dasharatha","father-of","rama"),("dasharatha","father-of","lakshmana"),
("dasharatha","father-of","bharata-dasharathi"),("dasharatha","father-of","shatrughna"),
("kausalya","mother-of","rama"),("kaikeyi","mother-of","bharata-dasharathi"),
("sumitra","mother-of","lakshmana"),("sumitra","mother-of","shatrughna"),
("kausalya","wife-of","dasharatha"),("kaikeyi","wife-of","dasharatha"),("sumitra","wife-of","dasharatha"),
("lakshmana","brother-of","rama"),("bharata-dasharathi","brother-of","rama"),
("shatrughna","brother-of","rama"),("urmila","wife-of","lakshmana"),
("kusha","son-of","rama"),("lava","son-of","rama"),
("vali","brother-of","sugriva"),("tara-vanara","wife-of","vali"),("angada","son-of","vali"),
("vibhishana","brother-of","ravana"),("kumbhakarna","brother-of","ravana"),
("indrajit","son-of","ravana"),("mandodari","wife-of","ravana"),("surpanakha","sister-of","ravana"),
("valmiki","author-of","ramayana"),
]

def build(chars, rels, book, book_overrides, dataset, ent_fn, rel_fn):
    erows=[]; created=set()
    for cid,en,ia,ru,cat,note in chars:
        if cid in EXIST: continue
        created.add(cid)
        erows.append([cid,"personality","jiva-tattva",cat,en,ia,ru,"",note,dataset,"verified","verified"])
    rrows=list(rels)
    for cid in created:
        for b in book_overrides.get(cid,[book]):
            rrows.append((cid,"appears-in",b))
    with open(os.path.join(base,ent_fn),"w",newline="",encoding="utf-8") as f:
        w=csv.writer(f); w.writerow(["id","type","tattva","category","name_en","name_iast","name_ru","aliases","note","source_ref","confidence","iast_status"]); w.writerows(erows)
    # dedupe relations, drop self loops, keep order
    seen=set(); out=[]
    for a,rel,b in rrows:
        if a==b or (a,rel,b) in seen: continue
        seen.add((a,rel,b)); out.append([a,rel,b])
    with open(os.path.join(base,rel_fn),"w",newline="",encoding="utf-8") as f:
        w=csv.writer(f); w.writerow(["from_id","relation","to_id"]); w.writerows(out)
    return len(erows),len(out)

ne,nr=build(MB,MB_REL,"mahabharata",MB_BOOKS,"Махабхарата","mahabharata_entities.csv","mahabharata_relations.csv")
print("Mahabharata: entities",ne,"relations",nr)
ne,nr=build(RM,RM_REL,"ramayana",{},"Рамаяна","ramayana_entities.csv","ramayana_relations.csv")
print("Ramayana: entities",ne,"relations",nr)
