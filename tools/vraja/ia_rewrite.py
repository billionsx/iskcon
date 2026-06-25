#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Лёгкий проход: переписать hero_image тиртх на archive.org для уже залитых файлов
объекта iskcone-vraja-tirthas. Без скачивания/загрузки — только сверка файлов
объекта и ОДНА проверка доступности URL. Переписываем лишь готовые (200),
остальные оставляем на vrajapedia (фото не ломаются). Идемпотентно, можно гонять
повторно по мере обработки объекта archive.org.
"""
import os, json, subprocess, urllib.request

CF = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1 = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
IDENT = "iskcone-vraja-tirthas"
UA = "Mozilla/5.0 (compatible; iskcone-rewrite/1.0)"


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body, headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    with urllib.request.urlopen(rq, timeout=90) as r:
        return json.loads(r.read().decode())


def rows(res):
    return res["result"][0]["results"]


def head_ok(url):
    out = subprocess.run(["curl", "-sS", "-I", "-L", "-m", "25", "-A", UA, "-o", "/dev/null", "-w", "%{http_code}", url],
                         capture_output=True, text=True, timeout=35)
    return (out.stdout or "").strip()[-3:] == "200"


def main():
    from internetarchive import get_item
    try:
        files = {f.name for f in get_item(IDENT).files}
    except Exception as e:
        print("get_item err", str(e)[:160]); files = set()
    stem = {fn.rsplit(".", 1)[0]: fn for fn in files}

    tr = rows(d1("SELECT id,hero_image FROM tirthas WHERE dhama_id='vrindavan' AND hero_image LIKE '%vrajapedia.com%' ORDER BY id"))
    rw = miss = notready = 0
    for r in tr:
        fn = stem.get(r["id"])
        if not fn:
            miss += 1
            continue
        url = f"https://archive.org/download/{IDENT}/{fn}"
        if head_ok(url):
            d1("UPDATE tirthas SET hero_image=? WHERE id=?", [url, r["id"]])
            rw += 1
        else:
            notready += 1

    left = rows(d1("SELECT SUM(hero_image LIKE '%vrajapedia.com%') vp, SUM(hero_image LIKE '%archive.org%') ia FROM tirthas WHERE dhama_id='vrindavan'"))[0]
    body = (f"item_files={len(files)} candidates={len(tr)} rewritten={rw} not_in_item={miss} not_ready={notready}\n"
            f"hero now: still_vrajapedia={left.get('vp')} on_archive={left.get('ia')}")
    try:
        d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-rewrite DONE',0,?)", [body])
    except Exception as e:
        print("sum err", str(e)[:160])
    print(body)


main()
