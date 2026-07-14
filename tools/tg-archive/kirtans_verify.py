#!/usr/bin/env python3
"""ЗКН-Д008 — КАЖДАЯ ЗАПИСЬ ОБЯЗАНА ИГРАТЬСЯ. ПРОВЕРЯЕМ, А НЕ ВЕРИМ.

В базе лежит имя файла, которое МЫ отправили в архив. Но archive.org имя
ПРАВИТ — убирает и заменяет символы. Строка в базе остаётся, а файла под таким
именем в архиве НЕТ: плеер молча упирается в 404, и человек думает, что сломан
плеер.

Проверка идёт от АРХИВА, а не от нашего лога: берём настоящий список файлов
каждого элемента и сверяем с базой.

  • имя совпало           → ок, заодно вытаскиваем длительность
  • имя не совпало, но
    файл узнаётся         → ЧИНИМ имя в базе
  • файла нет вовсе       → помечаем `broken=1`, плеер такие не показывает
"""
import json, os, re, sys, time, urllib.error, urllib.request
from collections import defaultdict

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
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:          # ЗКН-Ф014
            print("::warning::D1 %s: %s" % (e.code, e.read().decode()[:200]))
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))
    if not out.get("success"):
        print("::error::D1: %s" % json.dumps(out.get("errors"))[:300])
        raise SystemExit(1)
    rows = []
    for blk in out.get("result", []):
        rows.extend(blk.get("results") or [])
    return rows


def ia_files(identifier):
    """Что РЕАЛЬНО лежит в элементе — по метаданным архива, а не по нашему логу."""
    url = f"https://archive.org/metadata/{identifier}"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.loads(r.read()).get("files", [])
        except urllib.error.HTTPError as e:          # ЗКН-Ф014: не глотаем молча
            if e.code == 404:
                print("::warning::элемента нет: %s" % identifier)
                return []
            print("::warning::archive.org %s на %s" % (e.code, identifier))
        except Exception as e:
            print("::warning::archive.org %s: %s" % (identifier, str(e)[:90]))
        time.sleep(4 * (attempt + 1))
    return []


def key(name):
    """Ключ узнавания: регистр, пробелы и знаки препинания архив меняет по-своему."""
    s = (name or "").lower()
    s = re.sub(r"\.(mp3|m4a|ogg|opus|flac|wav)$", "", s)
    s = re.sub(r"[^a-zа-я0-9]+", "", s)
    return s


def main():
    tracks = d1("SELECT id, identifier, file, duration FROM kirtan_tracks")
    print("::notice::дорожек в базе: %d" % len(tracks))

    by_item = defaultdict(list)
    for t in tracks:
        by_item[t["identifier"]].append(t)
    print("::notice::элементов архива: %d" % len(by_item))

    ok = fixed = broken = 0
    dur_set = 0
    fix_sql, broken_ids, dur_sql = [], [], []

    for ident, rows in sorted(by_item.items()):
        files = ia_files(ident)
        # только звук: архив кладёт рядом свои служебные файлы
        audio = [f for f in files if re.search(r"\.(mp3|m4a|ogg|opus|flac|wav)$", f.get("name", ""), re.I)]
        have = {f["name"]: f for f in audio}
        byk = {}
        for f in audio:
            byk.setdefault(key(f["name"]), f)

        for t in rows:
            f = have.get(t["file"])
            if f is None:
                f = byk.get(key(t["file"]))
                if f is not None:
                    fix_sql.append((t["id"], f["name"]))
                    fixed += 1
                else:
                    broken_ids.append(t["id"])
                    broken += 1
                    continue
            else:
                ok += 1
            # длительность — из архива: у 790 записей её не было
            if not t.get("duration"):
                try:
                    sec = int(float(f.get("length") or 0))
                except Exception:
                    sec = 0
                if sec > 0:
                    dur_sql.append((t["id"], sec))
                    dur_set += 1

        if len(audio) != len(rows):
            print("::warning::%s — архив %d, база %d" % (ident, len(audio), len(rows)))

    print("::notice::ИТОГ — играется: %d · имя чинится: %d · файла нет: %d · длительность: %d"
          % (ok, fixed, broken, dur_set))

    # Отчёт — В БАЗУ: аннотаций GitHub даёт десяток, и итог в них не влезает.
    d1("CREATE TABLE IF NOT EXISTS kirtans_verify ("
       "  at TEXT PRIMARY KEY, ok INTEGER, fixed INTEGER, broken INTEGER, durs INTEGER, sample TEXT)")
    sample = " | ".join(b.split("/")[-1][:44] for b in broken_ids[:12])
    d1("INSERT OR REPLACE INTO kirtans_verify (at, ok, fixed, broken, durs, sample) VALUES (?1,?2,?3,?4,?5,?6)",
       [time.strftime("%Y-%m-%d %H:%M"), ok, fixed, broken, dur_set, sample])

    if os.environ.get("APPLY") != "1":
        print("::notice::пробный прогон — база не тронута")
        return 0

    q = lambda s: "'" + str(s).replace("'", "''") + "'"
    for i in range(0, len(fix_sql), 40):
        ch = fix_sql[i:i+40]
        cases = " ".join("WHEN %s THEN %s" % (q(a), q(b)) for a, b in ch)
        ids = ",".join(q(a) for a, _ in ch)
        d1("UPDATE kirtan_tracks SET file=CASE id %s END WHERE id IN (%s);" % (cases, ids))
    for i in range(0, len(dur_sql), 40):
        ch = dur_sql[i:i+40]
        cases = " ".join("WHEN %s THEN %d" % (q(a), b) for a, b in ch)
        ids = ",".join(q(a) for a, _ in ch)
        d1("UPDATE kirtan_tracks SET duration=CASE id %s END WHERE id IN (%s);" % (cases, ids))
    for i in range(0, len(broken_ids), 60):
        ids = ",".join(q(a) for a in broken_ids[i:i+60])
        d1("UPDATE kirtan_tracks SET broken=1 WHERE id IN (%s);" % ids)
    if fix_sql or dur_sql:
        d1("UPDATE kirtan_tracks SET broken=0 WHERE broken IS NULL;")
    print("::notice::применено")
    return 0


if __name__ == "__main__":
    sys.exit(main())
