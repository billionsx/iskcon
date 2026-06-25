#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Диагностика: что РАННЕР Actions реально может вытащить с vrajapedia.com.
Главная страница берётся фетчером Anthropic, но urllib с раннера упёрся в таймаут.
Проверяем гипотезы: (1) блок датацентровых IP фаерволом (дроп пакетов → таймаут),
(2) тарпит бот-UA. Матрица URL × User-Agent через curl (даёт коды/заголовки/тайминг).
Результат → D1 deploy_checks (читаю через MCP).
"""
import os, json, subprocess, urllib.request

CF   = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB   = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1   = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"

def d1(sql, p=None):
    body = json.dumps({"sql": sql, "params": p or []}).encode()
    rq = urllib.request.Request(D1, data=body,
                                headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    return urllib.request.urlopen(rq, timeout=60).read()

BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
BOT     = "gaurangers-vraja-sync/1.0 (bot)"

URLS = [
    "https://vrajapedia.com/",
    "https://vrajapedia.com/wp-json/",
    "https://vrajapedia.com/wp-json/wp/v2/types",
    "https://vrajapedia.com/?rest_route=/wp/v2/types",
    "https://vrajapedia.com/wp-sitemap.xml",
    "http://brajapedia.com/",
]

def probe(url, ua):
    fmt = "%{http_code}|t=%{time_total}s|sz=%{size_download}|%{content_type}|eff=%{url_effective}"
    try:
        out = subprocess.run(
            ["curl", "-sS", "-L", "-m", "25", "-A", ua,
             "-H", "Accept: text/html,application/json,application/xml;q=0.9,*/*;q=0.8",
             "-H", "Accept-Language: ru,en;q=0.9",
             "-D", "/tmp/hdr", "-o", "/tmp/body", "-w", fmt, url],
            capture_output=True, text=True, timeout=40)
        metrics = out.stdout.strip()
        server = cfray = ""
        if os.path.exists("/tmp/hdr"):
            for line in open("/tmp/hdr", encoding="utf-8", errors="replace").read().splitlines():
                l = line.lower()
                if l.startswith("server:"): server = line.split(":", 1)[1].strip()
                if l.startswith("cf-ray:"): cfray = "Y"
        sample = ""
        if os.path.exists("/tmp/body"):
            sample = open("/tmp/body", encoding="utf-8", errors="replace").read()[:140].replace("\n", " ")
        err = (out.stderr or "").strip()[:140]
        return f"{metrics} | server={server} cf={cfray or '-'} | err={err} | {sample}"
    except subprocess.TimeoutExpired:
        return "WALL-TIMEOUT(40s)"
    except Exception as e:
        return f"EXC {str(e)[:140]}"

lines = []
for url in URLS:
    lines.append(f"[BROWSER] {url}")
    lines.append("   " + probe(url, BROWSER))
for url in ["https://vrajapedia.com/", "https://vrajapedia.com/wp-json/"]:
    lines.append(f"[BOT] {url}")
    lines.append("   " + probe(url, BOT))

body = "\n".join(lines)[:4500]
try:
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-diag DONE',0,?)", [body])
except Exception as e:
    print("D1 err", str(e)[:160])
print(body)
