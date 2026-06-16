#!/usr/bin/env python3
"""
Generate authoritative Gaudiya Vaisnava (Gaurabda) calendar feeds for the GCAL
engine's built-in world location database (~2387 cities, 211 countries).

Sharded for parallel CI: each shard handles locations where index %% TOTAL == SHARD.
A per-city timeout skips pathological coordinates (e.g. polar sunrise loops) instead
of hanging the whole run. Existing feeds (curated 272 RU cities) are never overwritten.
Index building lives in build_gcal_index.py (run once after all shards merge).

Usage:  python3 scripts/gen_world_feeds.py <gaurabda_root> <out_dir> [shard total]
"""
import sys, os, re, json, signal

GA = sys.argv[1] if len(sys.argv) > 1 else "_gaurabda"
OUT = sys.argv[2] if len(sys.argv) > 2 else "apps/web/public/data/gcal"
SHARD = int(sys.argv[3]) if len(sys.argv) > 3 else 0
TOTAL = int(sys.argv[4]) if len(sys.argv) > 4 else 1
START, DAYS, CITY_TIMEOUT = "1 jan 2026", 765, 45
CURATED = "apps/web/public/data/gcal"  # never regenerate already-shipped feeds

sys.path.insert(0, GA)
import gaurabda as gcal  # noqa: E402


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def iso(d) -> str:
    return "%04d-%02d-%02d" % (d["year"], d["month"], d["day"])


class _Timeout(Exception):
    pass


def _alarm(sig, frm):
    raise _Timeout()


signal.signal(signal.SIGALRM, _alarm)


def build(e):
    loc = gcal.GCLocation(data=e)  # native: engine resolves tzid -> tz/offset
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
    return feed


def main():
    LOC = json.load(open(os.path.join(GA, "gaurabda", "res", "locations.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    gen = skip = err = timeo = 0
    for i, e in enumerate(LOC):
        if i % TOTAL != SHARD:
            continue
        sl = slug("%s %s" % (e["city"], e["country"]))
        if os.path.exists(os.path.join(OUT, sl + ".json")) or \
           (OUT != CURATED and os.path.exists(os.path.join(CURATED, sl + ".json"))):
            skip += 1
            continue
        signal.alarm(CITY_TIMEOUT)
        try:
            feed = build(e)
            signal.alarm(0)
        except _Timeout:
            timeo += 1
            print("TIMEOUT skip", sl, e["latitude"])
            continue
        except Exception as ex:
            signal.alarm(0)
            err += 1
            print("ERR", sl, type(ex).__name__, str(ex)[:80])
            continue
        json.dump(
            {"slug": sl,
             "location": {"name": e["city"], "country": e["country"],
                          "lat": e["latitude"], "lng": e["longitude"]},
             "source": "GCAL (Gaurabda — GBC Vaisnava Calendar)",
             "events": feed},
            open(os.path.join(OUT, sl + ".json"), "wt", encoding="utf-8"),
            ensure_ascii=False, separators=(",", ":"),
        )
        gen += 1
    print("shard=%d/%d generated=%d skipped=%d timeout=%d errors=%d"
          % (SHARD, TOTAL, gen, skip, timeo, err))


if __name__ == "__main__":
    main()
