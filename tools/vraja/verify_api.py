#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, json, subprocess, urllib.request, time

CF = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1 = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
URL = "https://gaurangers.com/api/dhamas?cb=" + str(int(time.time()))
UA = "Mozilla/5.0 (compatible; iskcone-verify/1.1)"

def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body, headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    with urllib.request.urlopen(rq, timeout=60) as r:
        return json.loads(r.read().decode())

out = subprocess.run(["curl", "-sS", "-L", "--compressed", "-m", "60", "-A", UA,
                      "-H", "Cache-Control: no-cache", "-H", "Pragma: no-cache",
                      "-D", "/tmp/hdr", "-w", "\n%{http_code}", URL],
                     capture_output=True, text=True, timeout=90)
s = out.stdout or ""
nl = s.rfind("\n"); code = s[nl+1:].strip(); payload = s[:nl]
hdr = open("/tmp/hdr").read() if os.path.exists("/tmp/hdr") else ""
cfc = ""
for ln in hdr.splitlines():
    if ln.lower().startswith(("cf-cache-status","age:","cache-control","content-length")):
        cfc += ln.strip() + " | "
lines = [f"GET -> {code} bytes={len(payload)} | {cfc}"]
try:
    data = json.loads(payload)
    for d in data:
        ts = d.get("tirthas") or []
        hero = sum(1 for t in ts if t.get("hero_image"))
        src = sum(1 for t in ts if t.get("sources"))
        lines.append(f"  {d.get('id')}: tirthas={len(ts)} hero={hero} sources={src}")
    vr = next((d for d in data if d.get("id")=="vrindavan"), None)
    if vr:
        ts = vr["tirthas"]
        smp = next((t for t in ts if t.get("name","").startswith("Вимала")), None) or next((t for t in ts if t.get("sources")), None) or (ts[0] if ts else None)
        if smp:
            lines.append("sample keys: " + ",".join(sorted(smp.keys())))
            lines.append("sample name=" + str(smp.get("name")) + " hero=" + str(bool(smp.get("hero_image"))) + " src_len=" + str(len(smp.get("sources") or [])) + " about_len=" + str(len(smp.get("about") or "")))
except Exception as e:
    lines.append("parse err: " + str(e)[:160] + " head=" + payload[:160])
body = "\n".join(lines)[:5500]
try:
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-verify2 DONE',0,?)", [body])
except Exception as e:
    print("d1 err", str(e)[:160])
print(body)
