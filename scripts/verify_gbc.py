#!/usr/bin/env python3
"""
GBC verification gate.

Asserts that the GCAL engine output matches a set of anchors taken verbatim
from official GBC / GCal-11-generated ISKCON Vaisnava calendars for 2026
(festival dates AND Ekadasi parana times, to the minute). Exits non-zero on
any drift, so precomputed feeds can never be committed/shipped if they differ
from the GBC reference.

Usage:  python3 scripts/verify_gbc.py <gaurabda_repo_root>
"""
import sys

GA = sys.argv[1] if len(sys.argv) > 1 else "_gaurabda"
sys.path.insert(0, GA)
import gaurabda as gcal  # noqa: E402


def events(lat, lng, tzname, start, days):
    loc = gcal.GCLocation(data={"latitude": lat, "longitude": lng,
                                "tzname": tzname, "name": "X"})
    tc = gcal.TCalendar()
    tc.CalculateCalendar(loc, gcal.GCGregorianDate(text=start), days)
    out = []
    for raw in tc.days_iter():
        d = dict(raw)
        dd = "%04d-%02d-%02d" % (d["date"]["year"], d["date"]["month"], d["date"]["day"])
        for ev in (d.get("events") or []):
            tx = (ev.get("text") if isinstance(ev, dict) else str(ev)) or ""
            if tx.strip():
                out.append((dd, tx.strip()))
    return out


# Anchors verified against official GBC GCal-11-generated ISKCON calendars (2026).
# Sources: ISKCON Chandigarh (GCal 11 export), multiple ISKCON festival calendars.
IN_TZ = "+5:30 Asia/Calcutta"
ANCHORS = [
    # desc, lat, lng, tzname, start, days, date, substring-that-must-appear
    ("Chandigarh — Mohini Ekadasi parana (GCal 11: Break fast 05:42 - 10:07 LT)",
     30.7333, 76.7833, IN_TZ, "20 apr 2026", 14, "2026-04-28", "Break fast 05:42 - 10:07 (LT)"),
    ("Chandigarh — Mohini Ekadasi fast day",
     30.7333, 76.7833, IN_TZ, "20 apr 2026", 14, "2026-04-27", "Fasting for Mohini Ekadasi"),
    ("Gaura Purnima 2026 = 3 March (Mayapur)",
     23.4234, 88.3881, IN_TZ, "25 feb 2026", 10, "2026-03-03", "Gaura Purnima"),
    ("Krsna Janmastami 2026 = 4 September (Mayapur)",
     23.4234, 88.3881, IN_TZ, "1 sep 2026", 8, "2026-09-04", "Janmastami"),
    ("Nrsimha Caturdasi 2026 = 30 April (Mayapur)",
     23.4234, 88.3881, IN_TZ, "25 apr 2026", 8, "2026-04-30", "Nrsimha Caturdasi"),
]


def main():
    fail = 0
    for desc, lat, lng, tz, start, days, date, sub in ANCHORS:
        o = events(lat, lng, tz, start, days)
        hit = any(dd == date and sub in tx for dd, tx in o)
        print(("OK   " if hit else "FAIL ") + "| " + desc)
        if not hit:
            fail += 1
            print("      expected on %s: %r" % (date, sub))
            print("      got: %r" % ([(dd, tx) for dd, tx in o if dd == date][:6]))
    if fail:
        print("::error::GBC VERIFICATION FAILED — %d anchor(s) drifted from official GCal output" % fail)
        sys.exit(1)
    print("GBC verification PASSED — all anchors match official GCal (GBC) output to the minute")


if __name__ == "__main__":
    main()
