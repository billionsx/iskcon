#!/usr/bin/env python3
"""
Build /data/gcal-index.json — a compact [{slug, lat, lng}] of every precomputed
city feed, used by the Worker for nearest-coordinate lookup. Sources coords from
the curated vaisnava-locations.json (272 RU cities) and the gaurabda world DB,
keeping only slugs that actually have a feed file on disk.

Usage:  python3 scripts/build_gcal_index.py <web_data_dir> [gaurabda_root]
"""
import sys, os, re, json

WEB = sys.argv[1] if len(sys.argv) > 1 else "apps/web/public/data"
GA = sys.argv[2] if len(sys.argv) > 2 else "_gaurabda"


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    out_dir = os.path.join(WEB, "gcal")
    idx = {}
    vl = os.path.join(WEB, "vaisnava-locations.json")
    if os.path.exists(vl):
        for cc in json.load(open(vl, encoding="utf-8")).get("countries", []):
            for c in cc.get("cities", []):
                if "key" in c and c.get("lat") is not None and c.get("lng") is not None:
                    idx[slug(c["key"])] = {"lat": c["lat"], "lng": c["lng"]}
    locp = os.path.join(GA, "gaurabda", "res", "locations.json")
    if os.path.exists(locp):
        for e in json.load(open(locp, encoding="utf-8")):
            idx.setdefault(slug("%s %s" % (e["city"], e["country"])),
                           {"lat": e["latitude"], "lng": e["longitude"]})
    index = [{"slug": k, "lat": v["lat"], "lng": v["lng"]}
             for k, v in idx.items()
             if os.path.exists(os.path.join(out_dir, k + ".json"))]
    json.dump(index, open(os.path.join(WEB, "gcal-index.json"), "wt", encoding="utf-8"),
              separators=(",", ":"))
    print("index entries: %d (feeds on disk: %d)" % (len(index), len(os.listdir(out_dir))))


if __name__ == "__main__":
    main()
