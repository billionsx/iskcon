#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Слияние staging vraja_raw → tirthas (дхама vrindavan).

Логика матчинга (по приоритету):
  1) существующая тиртха с тем же vp_id  → обновить (идемпотентная пересинхронизация);
  2) курированная тиртха с совпадающим «плотным» именем (без пробелов/шри/диакритики)
     → привязать и обогатить, НЕ трогая куратуру (about/lila/persons/coords/source);
  3) иначе → вставить новое место (кластер по региону, источник-книга, атрибуция).

Совпавшим добавляем только sources_json + hero (если пусто) + gallery + vp_*.
Координат у vrajapedia нет — новые места без lat/lng (карта по названию). Рехост фото — отдельным шагом.
"""
import os, json, re, urllib.request, urllib.error, time, traceback

CF   = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB   = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1   = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"

REGION_MAP = {
    59: "govardhana", 86: "town", 344: "kokilavan", 328: "radhakunda", 338: "barsana",
    336: "kamyavan", 340: "nandagaon", 374: "gokula", 332: "mathura", 342: "yavat",
    2250: "sanket", 2509: "bahulavan", 2475: "kumudvan", 364: "bhandiravan", 370: "lohavan",
    2028: "adi-badri", 366: "matavan", 330: "madhuvan", 1872: "upavan", 372: "raval",
    368: "belvan", 334: "talavan", 362: "bhadravan", 1914: "town", 8: "town",
}
HONOR = {"шри", "шрила", "шри-", "श्री", "the", "of", "и"}


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body, headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(rq, timeout=120) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        det = ""
        try:
            det = e.read().decode("utf-8", "replace")[:400]
        except Exception:
            pass
        raise RuntimeError(f"D1 HTTP {e.code}: {det}")


def rows(res):
    return res["result"][0]["results"]


def norm(s):
    s = (s or "").lower().replace("ё", "е")
    s = re.sub(r"[«»\"'`.,;:!?()\[\]{}—–\-]", " ", s)
    toks = [t for t in s.split() if t and t not in HONOR]
    return " ".join(toks)


def tight(s):
    return re.sub(r"\s+", "", norm(s))


def slugify(s):
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


# ---------- загрузка существующих ----------
ex = rows(d1("SELECT id,name,iast,cluster,about,hero_image,vp_id,lila FROM tirthas WHERE dhama_id='vrindavan'"))
all_ids = set(r["id"] for r in rows(d1("SELECT id FROM tirthas")))
by_tight = {}
by_vpid = {}
ex_about = {}
ex_hero = {}
for r in ex:
    by_tight.setdefault(tight(r["name"]), r["id"])
    if r.get("vp_id"):
        by_vpid[int(r["vp_id"])] = r["id"]
    ex_about[r["id"]] = r.get("about") or ""
    ex_hero[r["id"]] = r.get("hero_image") or ""

# ---------- staging ----------
vr = rows(d1("SELECT vp_id,slug,title,primary_cat,link,modified,excerpt,featured_url,gallery,sources_json,about,kind_guess FROM vraja_raw"))

INS_COLS = ["id", "dhama_id", "cluster", "name", "iast", "kind", "lat", "lng", "blurb", "about", "lila",
            "persons", "maps", "source", "sort", "hero_image", "gallery", "sources_json",
            "vp_id", "vp_slug", "vp_link", "vp_modified"]

inserts = []
updates = []   # (id, sources_json, hero_or_None, gallery, about_or_None, vp_id, vp_slug, vp_link, vp_modified)
used = set(all_ids)
new_clusters = {}
matched = 0
sort_base = 1000

for i, p in enumerate(vr):
    vpid = int(p["vp_id"])
    cluster = REGION_MAP.get(p.get("primary_cat"), "town")
    srcs = p.get("sources_json") or "[]"
    book = ""
    try:
        arr = json.loads(srcs)
        book = (arr[0].get("book") if arr and arr[0].get("book") else "")
    except Exception:
        arr = []
    feat = p.get("featured_url")
    gal = p.get("gallery")
    about = p.get("about") or ""

    tgt = by_vpid.get(vpid) or by_tight.get(tight(p["title"]))
    if tgt:
        matched += 1
        hero_set = feat if (not ex_hero.get(tgt) and feat) else None
        about_set = about if (not ex_about.get(tgt) and about) else None
        updates.append((tgt, srcs, hero_set, gal, about_set, vpid, p.get("slug"), p.get("link"), p.get("modified")))
        continue

    # новое место
    sid = slugify(p.get("slug") or "") or f"vp-{vpid}"
    if sid in used:
        sid = f"{sid}-{vpid}"
    used.add(sid)
    new_clusters[cluster] = new_clusters.get(cluster, 0) + 1
    blurb = (p.get("excerpt") or "")[:170]
    if not blurb and about:
        m = re.match(r"(.{40,180}?[.!?])\s", about)
        blurb = (m.group(1) if m else about[:160])
    source = (f"«{book}»" if book else "Гаудия-вайшнавская традиция")
    inserts.append({
        "id": sid, "dhama_id": "vrindavan", "cluster": cluster, "name": p["title"], "iast": "",
        "kind": p.get("kind_guess") or "place", "lat": None, "lng": None,
        "blurb": blurb, "about": about, "lila": None, "persons": None, "maps": None,
        "source": source, "sort": sort_base + i, "hero_image": feat, "gallery": gal,
        "sources_json": srcs, "vp_id": vpid, "vp_slug": p.get("slug"),
        "vp_link": p.get("link"), "vp_modified": p.get("modified"),
    })

ERRORS = []

# ---------- применить UPDATE (по строкам) ----------
for (tid, srcs, hero, gal, about_set, vpid, vslug, vlink, vmod) in updates:
    try:
        sets = ["sources_json=?", "gallery=COALESCE(?,gallery)", "vp_id=?", "vp_slug=?", "vp_link=?", "vp_modified=?"]
        params = [srcs, gal, vpid, vslug, vlink, vmod]
        if hero is not None:
            sets.append("hero_image=?"); params.append(hero)
        if about_set is not None:
            sets.append("about=?"); params.append(about_set)
        params.append(tid)
        d1(f"UPDATE tirthas SET {','.join(sets)} WHERE id=?", params)
    except Exception as e:
        ERRORS.append(f"upd {tid}: {str(e)[:140]}")

# ---------- применить INSERT (батчами с построчным фолбэком) ----------
def insert_rows(batch):
    ph = ",".join("(" + ",".join(["?"] * len(INS_COLS)) + ")" for _ in batch)
    sql = f"INSERT INTO tirthas ({','.join(INS_COLS)}) VALUES {ph} ON CONFLICT(id) DO UPDATE SET " + \
          ",".join(f"{c}=excluded.{c}" for c in INS_COLS if c != "id")
    params = []
    for row in batch:
        params.extend(row[c] for c in INS_COLS)
    d1(sql, params)

buf = []
for row in inserts:
    buf.append(row)
    if len(buf) >= 8:
        try:
            insert_rows(buf)
        except Exception:
            for r1 in buf:
                try:
                    insert_rows([r1])
                except Exception as e2:
                    ERRORS.append(f"ins {r1['id']}: {str(e2)[:140]}")
        buf = []
if buf:
    try:
        insert_rows(buf)
    except Exception:
        for r1 in buf:
            try:
                insert_rows([r1])
            except Exception as e2:
                ERRORS.append(f"ins {r1['id']}: {str(e2)[:140]}")

# ---------- отчёт ----------
tot = rows(d1("SELECT COUNT(*) c, SUM(vp_id IS NOT NULL) v, SUM(hero_image IS NOT NULL) h, SUM(sources_json IS NOT NULL) s FROM tirthas WHERE dhama_id='vrindavan'"))[0]
percl = rows(d1("SELECT cluster, COUNT(*) c FROM tirthas WHERE dhama_id='vrindavan' GROUP BY cluster ORDER BY c DESC"))
lines = [
    f"matched={matched} inserted={len(inserts)} updates={len(updates)} errors={len(ERRORS)}",
    f"vrindavan now: total={tot['c']} with_vp={tot['v']} with_hero={tot['h']} with_sources={tot['s']}",
    "per_cluster: " + ", ".join(f"{r['cluster']}:{r['c']}" for r in percl),
]
if ERRORS:
    lines.append("ERR: " + " || ".join(ERRORS[:6]))
body = "\n".join(lines)[:5500]
try:
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-sync DONE',0,?)", [body])
except Exception as e:
    print("sum err", str(e)[:160])
print(body)
