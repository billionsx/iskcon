#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render bronze-level gold-standard profiles from the registry CSVs.
One markdown file per entity in profiles/, plus an index. Library-dependent
sections are explicitly marked as pending. No network; reads local CSVs.
"""
import csv, os
from collections import defaultdict
base=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.join(base,"profiles"); os.makedirs(OUT,exist_ok=True)

ents={r["id"]:r for r in csv.DictReader(open(os.path.join(base,"entities_all.csv"),encoding="utf-8"))}
rels=list(csv.DictReader(open(os.path.join(base,"relations_all.csv"),encoding="utf-8")))
def disp(i): 
    e=ents.get(i); return (e["name_ru"] or e["name_en"] or i) if e else i

out_rel=defaultdict(list); in_rel=defaultdict(list)
for r in rels:
    out_rel[r["from_id"]].append((r["relation"],r["to_id"]))
    in_rel[r["to_id"]].append((r["relation"],r["from_id"]))

# relation -> (group, out_label, in_label)
RL={
 "avatar-of":("inc","Аватара (кого)","Аватары"),
 "expansion-of":("inc","Экспансия (кого)","Экспансии"),
 "shaktyavesha-of":("inc","Шактьявеша (кого)","Шактьявеша-воплощения"),
 "gauranga-lila-identity":("inc","Тождество в Гауранга Лиле","Тождество в Кришна-лиле"),
 "father-of":("fam","Дети","Отец"),
 "mother-of":("fam","Дети","Мать"),
 "son-of":("fam","Родитель","Сын/дочь"),
 "foster-son-of":("fam","Приёмные дети","Приёмный отец/мать"),
 "brother-of":("fam","Брат (кому)","Брат/сестра"),
 "sister-of":("fam","Сестра (кому)","Брат/сестра"),
 "wife-of":("fam","Супруг","Супруга"),
 "husband-of":("fam","Супруга","Супруг"),
 "grandson-of":("fam","Внуки","Дед/бабка"),
 "nephew-of":("fam","Племянники","Дядя/тётя"),
 "disciple-of":("lin","Гуру","Ученики"),
 "guru-of":("lin","Ученики","Гуру"),
 "associate-of":("assoc","Спутник (кого)","Спутники"),
 "godbrother-of":("assoc","Духовные братья","Духовные братья"),
 "author-of":("work","Труды (автор)","Авторы"),
 "speaker-of":("work","Произнёс","Произнесена"),
 "hearer-of":("work","Слушал","Слушатели"),
 "narrator-of":("work","Рассказал","Рассказчики"),
 "appears-in":("book","Упоминается в","Действующие лица"),
}

def collect(eid):
    g=defaultdict(lambda: defaultdict(list))  # group -> label -> [names]
    for rel,t in out_rel.get(eid,[]):
        if rel in RL: grp,lo,_=RL[rel]; g[grp][lo].append(disp(t))
    for rel,f in in_rel.get(eid,[]):
        if rel in RL: grp,_,li=RL[rel]; g[grp][li].append(disp(f))
    return g

def section(title,body): return f"### {title}\n{body}\n\n"
def kv(label,items): return f"- **{label}:** {', '.join(items)}\n" if items else ""

def render(eid):
    e=ents[eid]; g=collect(eid)
    is_book = e["type"]=="scripture"
    L=[]
    L.append(f"# {e['name_ru'] or e['name_en']}  \n")
    sub=" · ".join(x for x in [e['name_en'], e['name_iast']] if x)
    L.append(f"*{sub}*  \n`id: {eid}`\n\n")
    if e.get("note"): L.append(f"> {e['note']}\n\n")
    # 1 identity
    body=kv("RU",[e['name_ru']])+kv("EN",[e['name_en']])+kv("IAST",[e['name_iast']])
    if e.get("aliases"): body+=kv("Имена/эпитеты", e['aliases'].split('|'))
    L.append(section("1. Идентичность", body))
    # 2 tattva/class
    body=kv("Таттва",[e['tattva']] if e['tattva'] else [])+kv("Классификация", (e['category'] or '').split('|'))
    L.append(section("2. Таттва и классификация", body or "—"))
    if not is_book:
        # 3 incarnations
        inc=g.get("inc",{})
        body="".join(kv(k,v) for k,v in inc.items()) or "_В реестре не указано (раздел уточняется)._\n"
        L.append(section("3. Воплощения и тождества", body))
        # 4 books
        bk=g.get("book",{})
        body=kv("Упоминается в", bk.get("Упоминается в",[]))
        body+="\n_Точные стих-ссылки — после подключения библиотеки текстов._\n"
        L.append(section("4. Где упоминается", body))
        # 5 biography
        L.append(section("5. Биография","_Ожидает первоисточников и куратора (библиотека: ШБ / ЧЧ / лиламрита)._"))
        # 6 family/relations
        fam=g.get("fam",{}); lin=g.get("lin",{}); assoc=g.get("assoc",{})
        body="".join(kv(k,v) for k,v in {**fam,**lin,**assoc}.items()) or "—\n"
        L.append(section("6. Семья и окружение", body))
        # 7 contribution
        wk=g.get("work",{})
        body=kv("Труды (автор)", wk.get("Труды (автор)",[]))
        body+="_Вклад и учение — ожидает куратора/библиотеки._\n"
        L.append(section("7. Вклад и учение", body))
    else:
        # book: who appears in it + author
        bk=g.get("book",{}); wk=g.get("work",{})
        body=kv("Авторы", wk.get("Авторы",[]))+kv("Действующих лиц", [str(len(bk.get("Действующие лица",[])))])
        L.append(section("Состав и авторство", body))
    # 8 sources
    body=kv("Источник (реестр)",[e['source_ref']] if e.get('source_ref') else [])
    body+=f"- **Датасет:** {e.get('dataset','')}\n_Стих-ссылки — после библиотеки._\n"
    L.append(section("8. Источники", body))
    # 9 metadata
    L.append(section("9. Метаданные",
        f"- confidence: {e.get('confidence','')}\n- iast_status: {e.get('iast_status','')}\n- уровень: **bronze**\n"))
    return "".join(L)

n=0
for eid in ents:
    open(os.path.join(OUT,f"{eid}.md"),"w",encoding="utf-8").write(render(eid)); n+=1

# index grouped by dataset
idx=["# Профили личностей и книг — индекс\n",
     f"\nВсего профилей: **{n}** (уровень bronze, сгенерированы из реестра).\n"]
byds=defaultdict(list)
for eid,e in ents.items(): byds[e.get("dataset","")].append((disp(eid),eid))
for ds in sorted(byds):
    idx.append(f"\n## {ds} ({len(byds[ds])})\n")
    for name,eid in sorted(byds[ds]):
        idx.append(f"- [{name}]({eid}.md) · `{eid}`\n")
open(os.path.join(OUT,"README.md"),"w",encoding="utf-8").write("".join(idx))
print("profiles written:",n,"-> profiles/")
