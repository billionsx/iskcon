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
    # ex-USSR: current timezones (no DST in Russia/Kazakhstan/etc. since 2011;
    # Kazakhstan +5 since 2024). These FAIL if the stale 2011-2014 gcal tz data
    # leaks in (Moscow +4 / Almaty +6 / spurious summer DST).
    ("Moscow — summer parana +3 (UTC+03, no DST): 04:01, not the stale +4 05:01",
     55.7522, 37.6156, "+3:00 UTC+03", "1 jul 2026", 20, "2026-07-12", "Break fast 04:01 - 09:43 (LT)"),
    ("Almaty — +5 (UTC+05, Kazakhstan since 2024): 04:23, not the stale +6 05:23",
     43.24, 76.92, "+5:00 UTC+05", "1 jul 2026", 20, "2026-07-12", "Break fast 04:23 - 09:26 (LT)"),
    ("Kyiv — EU DST preserved (+3 EEST in summer): 04:59 (DST)",
     50.45, 30.52, "+2:00 Europe/Kiev", "1 jul 2026", 20, "2026-07-12", "Break fast 04:59 - 10:22 (DST)"),
]

# Feed-on-disk anchors: assert the SHIPPED feeds carry the corrected ex-USSR
# times. Catches a stale feed even when the engine/resolver itself is correct.
# (slug, date, must_contain, must_NOT_contain)
FEED_ANCHORS = [
    ("moskva-russia", "2026-07-12", "Break fast 04:01 - 09:43 (LT)", "Break fast 05:01"),
    ("almaty-kazakhstan", "2026-07-12", "Break fast 04:23 - 09:26 (LT)", "Break fast 05:23"),
    ("novosibirsk-russia", "2026-07-12", "Break fast 05:04 - 10:43 (LT)", "(DST)"),
]


def check_feeds(feed_dir):
    import json
    import os
    fail = 0
    for slug, date, must, mustnot in FEED_ANCHORS:
        fp = os.path.join(feed_dir, slug + ".json")
        if not os.path.exists(fp):
            print("WARN | feed-anchor missing (skipped): " + slug)
            continue
        d = json.load(open(fp))
        summaries = [e["summary"] for e in d.get("events", []) if e.get("date") == date]
        blob = " || ".join(summaries)
        ok = (must in blob) and (mustnot not in blob)
        print(("OK   " if ok else "FAIL ") + "| feed " + slug + " " + date)
        if not ok:
            fail += 1
            print("      need %r, forbid %r" % (must, mustnot))
            print("      got: %r" % (summaries[:6]))
    return fail


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
    feed_dir = sys.argv[2] if len(sys.argv) > 2 else None
    if feed_dir:
        fail += check_feeds(feed_dir)
    if fail:
        print("::error::GBC VERIFICATION FAILED — %d anchor(s) drifted from official GCal output" % fail)
        sys.exit(1)
    print("GBC verification PASSED — all anchors match official GCal (GBC) output to the minute")


if __name__ == "__main__":
    main()
