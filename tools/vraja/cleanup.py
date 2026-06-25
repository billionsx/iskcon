#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, json, urllib.request

CF = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1 = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body, headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    with urllib.request.urlopen(rq, timeout=60) as r:
        return json.loads(r.read().decode())


def rows(res):
    return res["result"][0]["results"]


COND = ("dhama_id='vrindavan' AND vp_id IS NOT NULL AND sort>=1000 "
        "AND (about IS NULL OR LENGTH(about)<40) "
        "AND (sources_json IS NULL OR json_array_length(sources_json)=0) "
        "AND hero_image IS NULL")

todel = rows(d1(f"SELECT id,name,cluster FROM tirthas WHERE {COND} ORDER BY cluster,id"))
ids = [r["id"] for r in todel]

# подчистим возможные хвосты в графе (на новых местах их нет, но на всякий случай)
deleted = 0
if ids:
    # удаляем построчно (надёжно, немного строк)
    for r in todel:
        try:
            d1("DELETE FROM tirtha_persons WHERE tirtha_id=?", [r["id"]])
        except Exception:
            pass
        d1("DELETE FROM tirthas WHERE id=?", [r["id"]])
        deleted += 1

# нормализация регистра автора
fix = d1("UPDATE tirthas SET sources_json = REPLACE(sources_json,'Раджашекхара Дас','Раджашекхара дас') WHERE sources_json LIKE '%Раджашекхара Дас%'")
fixed = fix["result"][0]["meta"].get("changes", 0)

tot = rows(d1("SELECT COUNT(*) c, SUM(vp_id IS NOT NULL) v, SUM(hero_image IS NOT NULL) h, SUM(json_array_length(sources_json)>0) s FROM tirthas WHERE dhama_id='vrindavan'"))[0]
lines = [
    f"deleted_empty={deleted} author_casing_fixed_rows={fixed}",
    f"vrindavan now: total={tot['c']} with_vp={tot['v']} with_hero={tot['h']} with_sources={tot['s']}",
    "deleted ids: " + ", ".join(ids[:40]) + (" …" if len(ids) > 40 else ""),
]
body = "\n".join(lines)[:5500]
try:
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-cleanup DONE',0,?)", [body])
except Exception as e:
    print("d1 err", str(e)[:160])
print(body)
