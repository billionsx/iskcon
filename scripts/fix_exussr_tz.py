#!/usr/bin/env python3
"""Recompute ex-USSR city feeds with the CORRECT current timezone.

The Gaurabda/GCal port ships timezone data from the 2011-2014 era: it still
applies summer DST to zones that abolished it (Russia, Belarus, Kazakhstan,
Central Asia, Caucasus) and carries stale base offsets (Moscow +4, Almaty +6,
Novosibirsk-zone applying DST, etc.). That shifts the LOCAL parana times by an
hour for the whole ex-USSR audience.

Fix: for every existing feed whose coordinates fall in an ex-USSR timezone,
re-derive the IANA zone from coordinates (timezonefinder), then resolve to a
GCal zone that reproduces the CURRENT behaviour:
  - no-DST zones  -> gcal "UTC+NN" fixed-offset zone with the current offset
                     (offset taken from zoneinfo / live IANA data),
  - DST zones (Ukraine, Moldova, Baltics) -> native gcal zone (EU DST is
    unchanged since 1996, so the native zone is already correct).
Then recompute the calendar and overwrite the feed in place.

Usage:  python3 scripts/fix_exussr_tz.py <gaurabda_root> <feed_dir>
"""
import sys, os, json, glob
from datetime import datetime
from zoneinfo import ZoneInfo

GAURABDA_ROOT = sys.argv[1] if len(sys.argv) > 1 else "_gaurabda"
FEED_DIR = sys.argv[2] if len(sys.argv) > 2 else "apps/web/public/data/gcal"
DAYS = 765
START = "1 jan 2026"

sys.path.insert(0, GAURABDA_ROOT)
import gaurabda as gcal  # noqa: E402
from timezonefinder import TimezoneFinder  # noqa: E402

# ---- ex-USSR IANA timezones (timezonefinder output namespace) ----
EX_USSR_IANA = {
    # Russia
    "Europe/Kaliningrad", "Europe/Moscow", "Europe/Simferopol", "Europe/Volgograd",
    "Europe/Kirov", "Europe/Astrakhan", "Europe/Saratov", "Europe/Ulyanovsk",
    "Europe/Samara", "Asia/Yekaterinburg", "Asia/Omsk", "Asia/Novosibirsk",
    "Asia/Barnaul", "Asia/Tomsk", "Asia/Novokuznetsk", "Asia/Krasnoyarsk",
    "Asia/Irkutsk", "Asia/Chita", "Asia/Yakutsk", "Asia/Khandyga",
    "Asia/Vladivostok", "Asia/Ust-Nera", "Asia/Magadan", "Asia/Sakhalin",
    "Asia/Srednekolymsk", "Asia/Kamchatka", "Asia/Anadyr",
    # Ukraine
    "Europe/Kyiv", "Europe/Kiev", "Europe/Uzhgorod", "Europe/Zaporozhye",
    # Belarus
    "Europe/Minsk",
    # Kazakhstan
    "Asia/Almaty", "Asia/Aqtau", "Asia/Aqtobe", "Asia/Atyrau", "Asia/Oral",
    "Asia/Qostanay", "Asia/Qyzylorda",
    # Uzbekistan
    "Asia/Tashkent", "Asia/Samarkand",
    # Kyrgyzstan
    "Asia/Bishkek",
    # Tajikistan
    "Asia/Dushanbe",
    # Turkmenistan
    "Asia/Ashgabat",
    # Armenia / Azerbaijan / Georgia
    "Asia/Yerevan", "Asia/Baku", "Asia/Tbilisi",
    # Moldova
    "Europe/Chisinau", "Europe/Tiraspol",
    # Baltics
    "Europe/Vilnius", "Europe/Riga", "Europe/Tallinn",
}
# DST IANA zones with a different name inside gcal
DST_ALIAS = {"Europe/Kyiv": "Europe/Kiev", "Europe/Uzhgorod": "Europe/Kiev",
             "Europe/Zaporozhye": "Europe/Kiev", "Europe/Tiraspol": "Europe/Chisinau"}

# ---- build resolver maps from gcal's own timezone table ----
NATIVE = {}      # IANA -> "+H:MM IANA"
UTC_NODST = {}   # "+H:MM" -> "+H:MM UTC+NN" (fixed offset, no DST)
for f in gcal.GetTimeZones():
    p = f.split(" ", 1)
    if len(p) != 2:
        continue
    off, name = p
    NATIVE[name] = f
    if name.startswith("UTC"):
        UTC_NODST[off] = f


def _off_str(td):
    m = int(round(td.total_seconds() / 60))
    s = "+" if m >= 0 else "-"
    m = abs(m)
    return f"{s}{m // 60}:{m % 60:02d}"


def _profile(iana):
    jan = datetime(2026, 1, 15, 12, tzinfo=ZoneInfo(iana)).utcoffset()
    jul = datetime(2026, 7, 15, 12, tzinfo=ZoneInfo(iana)).utcoffset()
    return min(jan, jul), (jan != jul)


def resolve(iana):
    """IANA zone -> correct current gcal tzname (or None)."""
    try:
        win, has_dst = _profile(iana)
    except Exception:
        return None
    if has_dst:
        return NATIVE.get(iana) or NATIVE.get(DST_ALIAS.get(iana, ""))
    return UTC_NODST.get(_off_str(win))


def gen_events(lat, lng, tzname):
    loc = gcal.GCLocation(data={"latitude": lat, "longitude": lng, "tzname": tzname, "name": "X"})
    tc = gcal.TCalendar()
    tc.CalculateCalendar(loc, gcal.GCGregorianDate(text=START), DAYS)
    out = []
    for raw in tc.days_iter():
        d = dict(raw)
        dd = "%04d-%02d-%02d" % (d["date"]["year"], d["date"]["month"], d["date"]["day"])
        for ev in (d.get("events") or []):
            tx = (ev.get("text") if isinstance(ev, dict) else str(ev)) or ""
            tx = tx.strip()
            if tx:
                out.append({"date": dd, "summary": tx})
    return out


def main():
    tf = TimezoneFinder()
    files = sorted(glob.glob(os.path.join(FEED_DIR, "*.json")))
    fixed = noniana = nocoord = notz = 0
    for fp in files:
        if os.path.basename(fp) == "gcal-index.json":
            continue
        try:
            d = json.load(open(fp))
        except Exception:
            continue
        loc = d.get("location") or {}
        lat, lng = loc.get("lat"), loc.get("lng")
        if lat is None or lng is None:
            nocoord += 1
            continue
        iana = tf.timezone_at(lat=float(lat), lng=float(lng))
        if iana not in EX_USSR_IANA:
            noniana += 1
            continue
        tzn = resolve(iana)
        if not tzn:
            print("NO-TZ", iana, fp, flush=True)
            notz += 1
            continue
        ev = gen_events(float(lat), float(lng), tzn)
        if not ev:
            notz += 1
            continue
        d["events"] = ev
        d["tz"] = tzn
        with open(fp, "w") as fh:
            json.dump(d, fh, ensure_ascii=False, separators=(",", ":"))
        fixed += 1
        if fixed % 50 == 0:
            print(f"... fixed {fixed}", flush=True)
    print(f"DONE fixed={fixed} non_exussr={noniana} no_coord={nocoord} no_tz={notz} total={len(files)}", flush=True)


if __name__ == "__main__":
    main()
