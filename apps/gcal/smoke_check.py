"""Smoke check for iskcon-gcal /compute response. Usage: python3 smoke_check.py <json_path>"""
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sm.json"

try:
    d = json.load(open(path))
except Exception as e:  # noqa: BLE001
    print("::error::response is not JSON:", e)
    try:
        print(open(path).read()[:400])
    except Exception:
        pass
    sys.exit(1)

if "error" in d:
    print("::error::compute returned error:", d)
    sys.exit(1)

ev = d.get("events", [])
print("events:", len(ev))
gp = [e for e in ev if e.get("date") == "2026-03-03" and "Gaura Purnima" in e.get("summary", "")]
par = [e for e in ev if e.get("date") == "2026-06-12" and "Break fast" in e.get("summary", "")]
print("Gaura Purnima 2026-03-03:", gp[:1])
print("Yevpatoria parana 2026-06-12:", par[:1])

ok = len(ev) > 50 and bool(gp) and bool(par)
print("SMOKE:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
