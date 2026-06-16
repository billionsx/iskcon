#!/usr/bin/env python3
"""
Precompute authoritative Gaudiya Vaisnava (Gaurabda) calendar feeds for the
engine's built-in world location database (~2387 cities, 211 countries).

Runs the GCAL engine (github.com/gopa810/gaurabda-calendar) at native CPython
speed and writes one feed per city, plus a slug->coords index that the web
Worker uses for nearest-coordinate lookup. Existing feeds are preserved
(the curated 272 RU cities are never overwritten).

Usage:  python3 scripts/gen_world_feeds.py <gaurabda_repo_root> <web_data_dir>
        e.g. python3 scripts/gen_world_feeds.py _gaurabda apps/web/public/data
"""
import sys, os, re, json

GA_ROOT = sys.argv[1] if len(sys.argv) > 1 else "_gaurabda"
WEB_DATA = sys.argv[2] if len(sys.argv) > 2 else "apps/web/public/data"
START, DAYS = "1 jan 2026", 765  # ~2.1y, matches the curated feeds

sys.path.insert(0, GA_ROOT)
import gaurabda as gcal  # noqa: E402


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def iso(d) -> str:
    return "%04d-%02d-%02d" % (d["year"], d["month"], d["day"])


def main():
    loc_path = os.path.join(GA_ROOT, "gaurabda", "res", "locations.json")
    LOC = json.load(open(loc_path, encoding="utf-8"))
    out_dir = os.path.join(WEB_DATA, "gcal")
    os.makedirs(out_dir, exist_ok=True)

    gen = skip = err = 0
    for e in LOC:
        sl = slug("{} {}".format(e["city"], e["country"]))
        fp = os.path.join(out_dir, sl + ".json")
        if os.path.exists(fp):           # never clobber curated / already-built
            skip += 1
            continue
        try:
            loc = gcal.GCLocation(data=e)  # native: engine resolves tzid->tz/offset
            tc = gcal.TCalendar()
            tc.CalculateCalendar(loc, gcal.GCGregorianDate(text=START), DAYS)
            feed = []
            for raw in tc.days_iter():
                d = dict(raw)
                dd = iso(d["date"])
                for ev in (d.get("events") or []):
                    tx = (ev.get("text") if isinstance(ev, dict) else str(ev)) or ""
                    tx = tx.strip()
                    if tx:
                        feed.append({"date": dd, "summary": tx})
            json.dump(
                {
                    "slug": sl,
                    "location": {"name": e["city"], "country": e["country"],
                                 "lat": e["latitude"], "lng": e["longitude"]},
                    "source": "GCAL (Gaurabda — GBC Vaisnava Calendar)",
                    "events": feed,
                },
                open(fp, "wt", encoding="utf-8"),
                ensure_ascii=False, separators=(",", ":"),
            )
            gen += 1
        except Exception as ex:  # skip a bad entry, keep going
            err += 1
            print("ERR", sl, type(ex).__name__, str(ex)[:90])

    # ---- coords index (slug -> lat/lng) for nearest-coordinate serving ----
    idx = {}
    vl = os.path.join(WEB_DATA, "vaisnava-locations.json")
    if os.path.exists(vl):
        data = json.load(open(vl, encoding="utf-8"))
        for cc in data.get("countries", []):
            for c in cc.get("cities", []):
                if "key" in c and "lat" in c and "lng" in c:
                    idx[slug(c["key"])] = {"lat": c["lat"], "lng": c["lng"]}
    for e in LOC:
        sl = slug("{} {}".format(e["city"], e["country"]))
        idx.setdefault(sl, {"lat": e["latitude"], "lng": e["longitude"]})

    # keep only slugs that actually have a feed on disk
    index = [{"slug": k, "lat": v["lat"], "lng": v["lng"]}
             for k, v in idx.items()
             if os.path.exists(os.path.join(out_dir, k + ".json"))]
    json.dump(index, open(os.path.join(WEB_DATA, "gcal-index.json"), "wt",
                          encoding="utf-8"), separators=(",", ":"))

    print("generated=%d skipped=%d errors=%d index=%d" % (gen, skip, err, len(index)))


if __name__ == "__main__":
    main()
