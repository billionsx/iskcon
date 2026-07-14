#!/usr/bin/env python3
"""ПРОВЕРКА: каждая ли запись из базы РЕАЛЬНО лежит в архиве.

ЗКН-Р015 — «готово» значит «работает у человека». Строка в базе, за которой нет
файла, — это не запись, это обещание, которое плеер не выполнит. Такие надо найти
ВСЕ и назвать поимённо, а не ждать, пока их найдёт основатель.
"""
import json, os, sys, urllib.request, urllib.error, collections
from concurrent.futures import ThreadPoolExecutor

ACCOUNT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]


def d1(sql, params=None):
    body = {"sql": sql}
    if params:
        body["params"] = params
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = json.loads(r.read())
    except urllib.error.HTTPError as e:                       # ЗКН-Ф014
        print("::error::D1 %s: %s" % (e.code, e.read().decode()[:300])); raise
    if not out.get("success"):
        print("::error::D1: %s" % json.dumps(out.get("errors"))[:300]); raise SystemExit(1)
    return out["result"][0]["results"]


def ia_files(ident):
    """Что РЕАЛЬНО лежит в элементе архива."""
    try:
        with urllib.request.urlopen("https://archive.org/metadata/%s" % ident, timeout=60) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:                       # ЗКН-Ф014
        if e.code != 404:
            print("::warning::archive.org %s: %s" % (e.code, ident))
        return ident, set()
    except Exception as e:
        print("::warning::archive.org %s: %s" % (ident, str(e)[:100]))
        return ident, set()
    return ident, {f.get("name") for f in (data.get("files") or [])}


tracks = d1("SELECT id, identifier, file, title FROM kirtan_tracks ORDER BY identifier, file")
print("::notice::записей в базе: %d" % len(tracks))

idents = sorted({t["identifier"] for t in tracks})
print("::notice::элементов архива: %d" % len(idents))

have = {}
with ThreadPoolExecutor(max_workers=8) as ex:
    for ident, files in ex.map(ia_files, idents):
        have[ident] = files

dead = [t for t in tracks if t["file"] not in have.get(t["identifier"], set())]
print("::notice::ЖИВЫХ: %d · МЁРТВЫХ (файла нет в архиве): %d" % (len(tracks) - len(dead), len(dead)))

by_ident = collections.Counter(t["identifier"] for t in dead)
for ident, n in by_ident.most_common(20):
    print("::warning::%s — нет %d файлов (в элементе всего %d)" % (ident, n, len(have.get(ident, set()))))

for t in dead[:40]:
    print("::warning::МЁРТВАЯ: %s | %s" % (t["title"][:60], t["file"][:60]))

with open("kirtans_dead.json", "w", encoding="utf-8") as f:
    json.dump([{"id": t["id"], "identifier": t["identifier"], "file": t["file"], "title": t["title"]} for t in dead],
              f, ensure_ascii=False, indent=1)
print("::notice::список мёртвых записан в kirtans_dead.json")

# ═══ ВТОРАЯ ПРОВЕРКА: ОТДАЁТ ЛИ АРХИВ ФАЙЛ ПО ССЫЛКЕ ═══
#
# Метаданные могут ЗНАТЬ о файле, а `/download/` — не отдавать его: имена с
# необычными знаками (точка после дефиса, скобки, кавычки) ломают путь. Запись,
# которая числится, но не звучит, — хуже отсутствующей: человек нажимает и ничего
# не происходит. Проверяем КАЖДУЮ ссылку, а не выборку.
import urllib.parse

def probe(t):
    u = "https://archive.org/download/%s/%s" % (t["identifier"], urllib.parse.quote(t["file"]))
    req = urllib.request.Request(u, method="HEAD")
    req.add_header("User-Agent", "iskcon-verify/1")
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return (t, r.status)
    except urllib.error.HTTPError as e:                       # ЗКН-Ф014
        return (t, e.code)
    except Exception:
        return (t, 0)

bad = []
with ThreadPoolExecutor(max_workers=12) as ex:
    for t, code in ex.map(probe, tracks):
        if code not in (200, 206, 302):
            bad.append((t, code))

print("::notice::ССЫЛКА ОТДАЁТ ЗВУК: %d · НЕ ОТДАЁТ: %d" % (len(tracks) - len(bad), len(bad)))
for t, code in bad[:40]:
    print("::warning::НЕ ИГРАЕТ [%s]: %s | %s" % (code, t["title"][:52], t["file"][:52]))

with open("kirtans_broken.json", "w", encoding="utf-8") as f:
    json.dump([{"id": t["id"], "identifier": t["identifier"], "file": t["file"],
                "title": t["title"], "code": c} for t, c in bad], f, ensure_ascii=False, indent=1)
sys.exit(0)
