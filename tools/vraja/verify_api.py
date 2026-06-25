#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, json, subprocess, urllib.request, urllib.error

CF = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1 = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
URL = "https://gaurangers.com/api/dhamas"
UA = "Mozilla/5.0 (compatible; iskcone-verify/1.0)"


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body, headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    with urllib.request.urlopen(rq, timeout=60) as r:
        return json.loads(r.read().decode())


out = subprocess.run(["curl", "-sS", "-L", "--compressed", "-m", "60", "-A", UA, "-w", "\n%{http_code}", URL],
                     capture_output=True, text=True, timeout=90)
s = out.stdout or ""
nl = s.rfind("\n")
code = s[nl + 1:].strip()
payload = s[:nl]
lines = [f"GET {URL} -> {code} bytes={len(payload)}"]
try:
    data = json.loads(payload)
    lines.append(f"dhamas={len(data)} names={[d.get('name') for d in data]}")
    for d in data:
        ts = d.get("tirthas") or []
        cl = d.get("clusters") or []
        hero = sum(1 for t in ts if t.get("hero_image"))
        src = sum(1 for t in ts if t.get("sources"))
        lines.append(f"  {d.get('id')}: clusters={len(cl)} tirthas={len(ts)} hero={hero} sources={src}")
        if d.get("id") == "vrindavan":
            sample = next((t for t in ts if t.get("sources") and t["sources"][0].get("author")), None)
            if sample:
                s0 = sample["sources"][0]
                lines.append(f"  sample: {sample.get('name')} | kind={sample.get('kind')} | author={s0.get('author')} | book={s0.get('book')} | paras={len(s0.get('paragraphs') or [])} | hero={'Y' if sample.get('hero_image') else '-'}")
except Exception as e:
    lines.append("parse err: " + str(e)[:200] + " | head=" + payload[:200])

body = "\n".join(lines)[:5500]
try:
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-verify DONE',0,?)", [body])
except Exception as e:
    print("d1 err", str(e)[:160])
print(body)
