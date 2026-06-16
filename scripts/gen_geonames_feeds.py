#!/usr/bin/env python3
"""Generate city feeds from a GeoNames cities dump, with CORRECT current
timezones (same resolver as fix_exussr_tz: no-DST -> gcal "UTC+NN" with the
current offset from zoneinfo; DST zones -> native gcal zone).

Densifies coverage so the worker's nearest-precomputed-feed is always close
(=> parana times stay authoritative for any town, not just listed cities).

GeoNames TSV columns (tab-separated, no header):
  1 name  2 asciiname  4 lat  5 lng  8 country_code  14 population  17 timezone

Usage:
  python3 scripts/gen_geonames_feeds.py <gaurabda_root> <geonames_tsv> <out_dir> \
      <country_codes_csv> <min_pop> [shard total]
Skips a city if its feed file already exists (preserves curated + corrected feeds).
"""
import sys, os, json, re, signal
from datetime import datetime
from zoneinfo import ZoneInfo

GA = sys.argv[1]
TSV = sys.argv[2]
OUT = sys.argv[3]
CODES = set(c.strip().upper() for c in sys.argv[4].split(",") if c.strip())
MIN_POP = int(sys.argv[5])
SHARD = int(sys.argv[6]) if len(sys.argv) > 7 else 0
TOTAL = int(sys.argv[7]) if len(sys.argv) > 7 else 1
DAYS = 765
START = "1 jan 2026"

sys.path.insert(0, GA)
import gaurabda as gcal  # noqa: E402

# ---- corrected current-tz resolver (mirrors fix_exussr_tz.py) ----
NATIVE, UTC_NODST = {}, {}
for f in gcal.GetTimeZones():
    p = f.split(" ", 1)
    if len(p) != 2:
        continue
    off, name = p
    NATIVE[name] = f
    if name.startswith("UTC"):
        UTC_NODST[off] = f
DST_ALIAS = {"Europe/Kyiv": "Europe/Kiev", "Europe/Uzhgorod": "Europe/Kiev",
             "Europe/Zaporozhye": "Europe/Kiev", "Europe/Tiraspol": "Europe/Chisinau",
             "Asia/Kolkata": "Asia/Calcutta"}


def _off_str(td):
    m = int(round(td.total_seconds() / 60))
    s = "+" if m >= 0 else "-"
    m = abs(m)
    return f"{s}{m // 60}:{m % 60:02d}"


def resolve(iana):
    try:
        jan = datetime(2026, 1, 15, 12, tzinfo=ZoneInfo(iana)).utcoffset()
        jul = datetime(2026, 7, 15, 12, tzinfo=ZoneInfo(iana)).utcoffset()
    except Exception:
        return None
    if jan != jul:  # observes DST -> native gcal zone (EU/US DST is current)
        return NATIVE.get(iana) or NATIVE.get(DST_ALIAS.get(iana, ""))
    return UTC_NODST.get(_off_str(min(jan, jul)))


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


class _T(Exception):
    pass


def _alarm(sig, frm):
    raise _T()


signal.signal(signal.SIGALRM, _alarm)


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
    os.makedirs(OUT, exist_ok=True)
    written = skipped = existed = notz = polar = failed = 0
    idx = -1
    with open(TSV, encoding="utf-8") as fh:
        for line in fh:
            c = line.rstrip("\n").split("\t")
            if len(c) < 18:
                continue
            cc = c[8].upper()
            if cc not in CODES:
                continue
            try:
                pop = int(c[14] or 0)
            except ValueError:
                pop = 0
            if pop < MIN_POP:
                continue
            idx += 1
            if TOTAL > 1 and idx % TOTAL != SHARD:
                continue
            name, asciiname = c[1], c[2]
            try:
                lat, lng = float(c[4]), float(c[5])
            except ValueError:
                continue
            iana = c[17].strip()
            slug = slugify(asciiname + " " + cc)
            if not slug:
                continue
            fp = os.path.join(OUT, slug + ".json")
            if os.path.exists(fp):
                existed += 1
                continue
            tzn = resolve(iana)
            if not tzn:
                notz += 1
                continue
            if abs(lat) >= 63:  # skip polar (sunrise edge-cases / engine hangs)
                polar += 1
                continue
            try:
                signal.alarm(45)
                ev = gen_events(lat, lng, tzn)
                signal.alarm(0)
            except _T:
                polar += 1
                continue
            except Exception:
                signal.alarm(0)
                failed += 1
                continue
            if not ev:
                failed += 1
                continue
            doc = {"slug": slug,
                   "location": {"name": name, "country": cc, "lat": lat, "lng": lng},
                   "tz": tzn, "source": "GCal (Gaurabda) — GBC Vaisnava Calendar; GeoNames",
                   "events": ev}
            with open(fp, "w") as o:
                json.dump(doc, o, ensure_ascii=False, separators=(",", ":"))
            written += 1
            if written % 50 == 0:
                print(f"... shard {SHARD} written {written}", flush=True)
    print(f"DONE shard={SHARD}/{TOTAL} written={written} existed={existed} "
          f"no_tz={notz} polar={polar} failed={failed}", flush=True)


if __name__ == "__main__":
    main()
