#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ЗАМЕР РАСХОДА D1 — точка отсчёта и постоянная проверка.

Cloudflare с 01.09.2026 отбивает запросы к D1 сверх суточного бесплатного
предела (5 000 000 прочитанных строк, 100 000 записанных, обнуление 00:00 UTC).
Цель проекта — десятая часть предела: 500 000 чтений и 10 000 записей в сутки.

Скрипт снимает ДВА числа из аналитики Cloudflare и НИЧЕГО не чинит:
  1) кто именно читает — разбор по запросам за сутки (d1QueriesAdaptiveGroups);
  2) когда именно — почасовой рисунок за 48 часов (d1AnalyticsAdaptiveGroups).

Почасовой рисунок отвечает на вопрос, который дороже всех прочих: расход ровный
или пиками. Ровный — читает что-то постоянное. Пики раз в полчаса — собственный
крон воркера (crons = ["*/30 * * * *"]). Пики по часам — работы GitHub Actions,
они ходят в D1 через REST мимо воркера.

Результат кладётся В РЕПОЗИТОРИЙ (логи Actions живут на нехостящихся доменах и
как канал наблюдения не годятся):
  docs/d1-quota/measure-<UTC>.md   — читаемый отчёт замера
  docs/d1-quota/latest.json        — машинный срез последнего замера
  docs/d1-quota/history.tsv        — суточная лента, по ней видно «трое суток подряд»

Режим гейта (--enforce): падает, если последние ПОЛНЫЕ сутки UTC превысили 10%
предела. Пока расход не приведён в порядок, эта проверка обязана быть красной —
в этом её смысл, иначе через месяц всё вернётся и никто не заметит.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

GQL = "https://api.cloudflare.com/client/v4/graphql"

# Пределы площадки и наша собственная цель — десятая часть от них.
LIMIT_READ = 5_000_000
LIMIT_WRITE = 100_000
TARGET_READ = LIMIT_READ // 10      # 500 000
TARGET_WRITE = LIMIT_WRITE // 10    # 10 000

Q_QUERIES = """
query($tag:String!,$db:String!,$t1:Time!,$t2:Time!){viewer{accounts(filter:{accountTag:$tag}){
 d1QueriesAdaptiveGroups(limit:25,filter:{databaseId:$db,datetimeHour_geq:$t1,datetimeHour_leq:$t2},
 orderBy:[sum_rowsRead_DESC]){dimensions{query} sum{rowsRead rowsWritten queryDurationMs} count}}}}
"""

Q_HOURLY = """
query($tag:String!,$db:String!,$t1:Time!,$t2:Time!){viewer{accounts(filter:{accountTag:$tag}){
 d1AnalyticsAdaptiveGroups(limit:300,filter:{databaseId:$db,datetimeHour_geq:$t1,datetimeHour_leq:$t2},
 orderBy:[datetimeHour_DESC]){dimensions{datetimeHour} sum{rowsRead rowsWritten readQueries writeQueries}}}}}
"""


def gql(token, query, variables):
    body = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(
        GQL,
        data=body,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:  # ЗКН-Ф014: сказать, ЧТО именно ответила аналитика
        raise SystemExit("GraphQL HTTP %s: %s" % (e.code, e.read()[:500].decode("utf-8", "replace")))
    if data.get("errors"):
        raise SystemExit("GraphQL errors: " + json.dumps(data["errors"], ensure_ascii=False))
    accounts = data["data"]["viewer"]["accounts"]
    if not accounts:
        raise SystemExit("GraphQL: аккаунт не найден — проверь accountTag и права токена на аналитику")
    return accounts[0]


def fmt(n):
    return f"{n:,}".replace(",", " ")


def main():
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "d5cbe19470dc38599873eabfe148e6d1").strip()
    db = os.environ.get("D1_DATABASE_ID", "6226aded-dd03-4e74-977f-9cd0b509e73d").strip()
    enforce = "--enforce" in sys.argv
    if not token:
        raise SystemExit("нет CLOUDFLARE_API_TOKEN")

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    t2 = now.strftime("%Y-%m-%dT%H:00:00Z")
    t24 = (now - timedelta(hours=24)).strftime("%Y-%m-%dT%H:00:00Z")
    t48 = (now - timedelta(hours=48)).strftime("%Y-%m-%dT%H:00:00Z")

    # ── РАЗБОР ОДНОГО ЧАСА (--hour YYYY-MM-DDTHH) ────────────────────────
    # Суточная верхушка отвечает «кто ест вообще», но не «что случилось в
    # 18:00». Когда расход взрывается в один час, нужен именно тот час:
    # 01.09 в 18:00 UTC база прочитала 42.9 млн строк при 126 запросах, и
    # суточный отчёт этого не показывал — 78 % расхода не попало в топ-25,
    # потому что размазалось по запросам с разным текстом.
    for i, a in enumerate(sys.argv):
        if a == "--hour" and i + 1 < len(sys.argv):
            h = sys.argv[i + 1]
            base = datetime.strptime(h, "%Y-%m-%dT%H").replace(tzinfo=timezone.utc)
            t_a = base.strftime("%Y-%m-%dT%H:00:00Z")
            t_b = (base + timedelta(hours=1)).strftime("%Y-%m-%dT%H:00:00Z")
            r = gql(token, Q_QUERIES, {"tag": account, "db": db, "t1": t_a, "t2": t_b})
            if "data" not in r or not r["data"]:
                print("аналитика не ответила формой:", json.dumps(r)[:600])
                return 1
            rows = r["data"]["viewer"]["accounts"][0]["d1QueriesAdaptiveGroups"]
            print("ЧАС %s — верхушка по прочитанным строкам" % h)
            tot = 0
            for x in rows:
                rr = x["sum"]["rowsRead"]; tot += rr
                q = " ".join(str(x["dimensions"]["query"]).split())[:150]
                print("%12d  ×%-5d %s" % (rr, x["count"], q))
            print("сумма верхушки: %d" % tot)
            return 0

    top = gql(token, Q_QUERIES, {"tag": account, "db": db, "t1": t24, "t2": t2})
    hourly = gql(token, Q_HOURLY, {"tag": account, "db": db, "t1": t48, "t2": t2})

    rows_top = top.get("d1QueriesAdaptiveGroups") or []
    rows_hour = hourly.get("d1AnalyticsAdaptiveGroups") or []

    # Суточные суммы по календарным суткам UTC — именно так считает площадка.
    per_day = {}
    for r in rows_hour:
        day = r["dimensions"]["datetimeHour"][:10]
        d = per_day.setdefault(day, {"rowsRead": 0, "rowsWritten": 0, "readQueries": 0, "writeQueries": 0, "hours": 0})
        for k in ("rowsRead", "rowsWritten", "readQueries", "writeQueries"):
            d[k] += r["sum"].get(k, 0) or 0
        d["hours"] += 1

    win_read = sum((r["sum"].get("rowsRead") or 0) for r in rows_hour[:24])
    win_write = sum((r["sum"].get("rowsWritten") or 0) for r in rows_hour[:24])

    stamp = now.strftime("%Y-%m-%dT%H") + "Z"
    outdir = os.path.join("docs", "d1-quota")
    os.makedirs(outdir, exist_ok=True)

    # ── машинный срез ────────────────────────────────────────────────────────
    latest = {
        "measured_at": stamp,
        "window_24h": {"from": t24, "to": t2, "rowsRead": win_read, "rowsWritten": win_write},
        "target": {"rowsRead": TARGET_READ, "rowsWritten": TARGET_WRITE},
        "limit": {"rowsRead": LIMIT_READ, "rowsWritten": LIMIT_WRITE},
        "per_day_utc": per_day,
        "top_queries": rows_top,
        "hourly": rows_hour,
    }
    with open(os.path.join(outdir, "latest.json"), "w", encoding="utf-8") as f:
        json.dump(latest, f, ensure_ascii=False, indent=1)

    # ── суточная лента: по ней видно «трое суток подряд» ─────────────────────
    hist = os.path.join(outdir, "history.tsv")
    seen = set()
    if os.path.exists(hist):
        with open(hist, encoding="utf-8") as f:
            for line in f:
                seen.add(line.split("\t")[0])
    else:
        with open(hist, "w", encoding="utf-8") as f:
            f.write("day_utc\thours\trowsRead\trowsWritten\treadQueries\twriteQueries\tverdict\n")
    with open(hist, "a", encoding="utf-8") as f:
        for day in sorted(per_day):
            d = per_day[day]
            if day in seen or d["hours"] < 24:      # только полные сутки, один раз
                continue
            ok = d["rowsRead"] <= TARGET_READ and d["rowsWritten"] <= TARGET_WRITE
            f.write(
                f"{day}\t{d['hours']}\t{d['rowsRead']}\t{d['rowsWritten']}"
                f"\t{d['readQueries']}\t{d['writeQueries']}\t{'OK' if ok else 'OVER'}\n"
            )

    # ── читаемый отчёт ───────────────────────────────────────────────────────
    L = []
    L.append(f"# Замер расхода D1 — {stamp}\n")
    L.append(f"База `{db}` · счёт `{account}`\n")
    L.append("## Итог за последние 24 часа\n")
    L.append("| | замер | цель (10%) | предел | к цели |")
    L.append("|---|---:|---:|---:|---:|")
    L.append(f"| прочитано строк | {fmt(win_read)} | {fmt(TARGET_READ)} | {fmt(LIMIT_READ)} | ×{win_read/TARGET_READ:,.1f} |".replace(",", " "))
    L.append(f"| записано строк | {fmt(win_write)} | {fmt(TARGET_WRITE)} | {fmt(LIMIT_WRITE)} | ×{win_write/TARGET_WRITE:,.1f} |".replace(",", " "))
    L.append("")

    L.append("## Кто именно — верхушка прожорливых запросов за сутки\n")
    L.append("| # | прочитано | записано | вызовов | строк на вызов | мс | запрос |")
    L.append("|---:|---:|---:|---:|---:|---:|---|")
    for i, r in enumerate(rows_top, 1):
        s, q = r["sum"], (r["dimensions"]["query"] or "").replace("|", "¦").replace("\n", " ").strip()
        cnt = r.get("count") or 0
        per = (s.get("rowsRead") or 0) / cnt if cnt else 0
        L.append(
            f"| {i} | {fmt(s.get('rowsRead') or 0)} | {fmt(s.get('rowsWritten') or 0)} | {fmt(cnt)} "
            f"| {fmt(int(per))} | {fmt(int(s.get('queryDurationMs') or 0))} | `{q[:300]}` |"
        )
    L.append("")
    L.append("«Строк на вызов» — главный столбец. Большое число означает проход всей")
    L.append("таблицы: у D1 прочитанная строка это строка, ПРОСМОТРЕННАЯ движком, а не")
    L.append("отданная в ответ. Каждый запрос отсюда идёт на EXPLAIN QUERY PLAN:")
    L.append("SCAN — проход всей таблицы, SEARCH … USING INDEX — попадание по индексу.\n")

    L.append("## Когда именно — почасовой рисунок за 48 часов\n")
    L.append("| час UTC | прочитано | записано | чтений | записей |")
    L.append("|---|---:|---:|---:|---:|")
    for r in rows_hour:
        s = r["sum"]
        L.append(
            f"| {r['dimensions']['datetimeHour']} | {fmt(s.get('rowsRead') or 0)} "
            f"| {fmt(s.get('rowsWritten') or 0)} | {fmt(s.get('readQueries') or 0)} "
            f"| {fmt(s.get('writeQueries') or 0)} |"
        )
    L.append("")

    L.append("## Суточные суммы (календарные сутки UTC)\n")
    L.append("| сутки | часов в выборке | прочитано | записано | приговор |")
    L.append("|---|---:|---:|---:|---|")
    for day in sorted(per_day, reverse=True):
        d = per_day[day]
        ok = d["rowsRead"] <= TARGET_READ and d["rowsWritten"] <= TARGET_WRITE
        note = "OK" if ok else "ПРЕВЫШЕНИЕ"
        if d["hours"] < 24:
            note += f" (неполные сутки: {d['hours']} ч)"
        L.append(f"| {day} | {d['hours']} | {fmt(d['rowsRead'])} | {fmt(d['rowsWritten'])} | {note} |")
    L.append("")

    report = os.path.join(outdir, f"measure-{stamp}.md")
    with open(report, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")

    print("\n".join(L[:14]))
    print(f"\n→ {report}")
    print(f"→ {outdir}/latest.json")
    print(f"→ {hist}")

    if enforce:
        full = [d for d in sorted(per_day) if per_day[d]["hours"] >= 24]
        if not full:
            print("\nГЕЙТ: полных суток в выборке нет — нечего судить.")
            return
        day = full[-1]
        d = per_day[day]
        over = []
        if d["rowsRead"] > TARGET_READ:
            over.append(f"чтение {fmt(d['rowsRead'])} > {fmt(TARGET_READ)} (×{d['rowsRead']/TARGET_READ:.1f})")
        if d["rowsWritten"] > TARGET_WRITE:
            over.append(f"запись {fmt(d['rowsWritten'])} > {fmt(TARGET_WRITE)} (×{d['rowsWritten']/TARGET_WRITE:.1f})")
        if over:
            print(f"\nГЕЙТ КРАСНЫЙ за {day}: " + "; ".join(over))
            sys.exit(1)
        print(f"\nГЕЙТ ЗЕЛЁНЫЙ за {day}: чтение {fmt(d['rowsRead'])}, запись {fmt(d['rowsWritten'])}")


if __name__ == "__main__":
    main()
