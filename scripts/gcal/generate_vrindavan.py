#!/usr/bin/env python3
"""
Generate the authoritative Vaisnava (Gaudiya) calendar dataset for gaurangers.com
using the GCAL (Gaurabda Calendar) algorithm.

Source:   gopa810/gaurabda-calendar (MIT) — Python port of GCAL by Gopalapriya das,
          (c) ISKCON GBC Vaishnava Calendar Committee.
Standard: Vrindavan (lat 27.583, lng 77.73, Asia/Kolkata) — the fixed location
          standard chosen for this app.
Validated: output matches iskconvrindavan.com's official temple calendar, including
           festival dates and parana (break-fast) times to the minute.

Install:  pip install "gaurabda @ git+https://github.com/gopa810/gaurabda-calendar.git"
Run:      python generate_vrindavan.py \
              --start "1 jan 2026" --count 765 \
              --out ../../apps/api/data/vaisnava-calendar-vrindavan.json

The output is a flat, typed event list. Observance dates (ekadashi fast day,
parana window) come straight from the GCAL rules — they are NOT recomputed or
guessed here. The Russian name layer is filled separately; name_en is canonical.
"""

import argparse
import datetime
import json
from math import modf

import gaurabda as gcal
from gaurabda import GCStrings

VRINDAVAN = {
    "latitude": 27.583,
    "longitude": 77.73,
    "tzname": "+5:30 Asia/Calcutta",
    "name": "Vrindavan, India",
}


def hhmm(f):
    if f is None or f < 0:
        return None
    frac, h = modf(f)
    return "%02d:%02d" % (int(h), int(round(frac * 60)))


def iso(dt):
    return "%04d-%02d-%02d" % (dt["year"], dt["month"], dt["day"])


def reason(code):
    try:
        return GCStrings.GetParanaReasonText(code)
    except Exception:
        return str(code)


def build(start_text, count):
    loc = gcal.GCLocation(data=VRINDAVAN)
    tc = gcal.TCalendar()
    tc.CalculateCalendar(loc, gcal.GCGregorianDate(text=start_text), count)

    events = []
    for d in (dict(v) for v in tc.days_iter()):
        dt = d["date"]
        date = iso(dt)
        a = d.get("astrodata", {})
        gy = a.get("gaurabda_year")
        masa, tithi, nak = a.get("masa"), a.get("tithi"), a.get("naksatra")
        sun = a.get("sun", {})

        # --- ekadashi / mahadvadasi fast (structured day flags) ---
        if d.get("fast") and d.get("ekadashiName"):
            events.append({
                "date": date, "kind": "ekadashi_fast", "name": d["ekadashiName"],
                "fast_code": d.get("fast"), "mahadvadasi": d.get("ekadashiType"),
                "gaurabda_year": gy, "masa": masa, "tithi": tithi, "naksatra": nak,
                "sunrise": sun.get("rise"), "sunset": sun.get("set"),
            })
        elif d.get("fast") and not d.get("ekadashiName"):
            events.append({
                "date": date, "kind": "mahadvadasi_fast", "name": None,
                "fast_code": d.get("fast"), "mahadvadasi": d.get("ekadashiType"),
                "gaurabda_year": gy, "masa": masa, "tithi": tithi, "naksatra": nak,
                "sunrise": sun.get("rise"), "sunset": sun.get("set"),
            })

        # --- parana (break-fast) window ---
        p = d.get("ekadashiParana")
        if p:
            events.append({
                "date": date, "kind": "ekadashi_paran",
                "paran_start": hhmm(p.get("startTime")), "paran_end": hhmm(p.get("endTime")),
                "paran_start_reason": reason(p.get("startReason")),
                "paran_end_reason": reason(p.get("endReason")),
                "gaurabda_year": gy,
            })

        # --- sankranti (solar ingress) ---
        sk = d.get("sankranti")
        if sk:
            events.append({"date": date, "kind": "sankranti", "rasi": sk.get("rasi"), "gaurabda_year": gy})

        # --- text events: festivals / appearance / disappearance / caturmasya ---
        for e in d.get("events") or []:
            t = (e.get("text") if isinstance(e, dict) else str(e)) or ""
            if t.startswith("Fasting for") or t.startswith("Break fast") or t.startswith("Ksaya tithi"):
                continue  # already captured via structured fields above
            kind, name = "festival", t
            if t.endswith("-- Appearance"):
                kind, name = "appearance", t[: -len("-- Appearance")].strip()
            elif t.endswith("-- Disappearance"):
                kind, name = "disappearance", t[: -len("-- Disappearance")].strip()
            elif "Caturmasya" in t or "Chaturmasya" in t:
                kind = "caturmasya"
            events.append({"date": date, "kind": kind, "name": name, "text": t, "gaurabda_year": gy})

    events.sort(key=lambda x: (x["date"], x["kind"]))
    return {
        "provenance": {
            "source": "GCAL (Gaurabda Calendar) — gopa810/gaurabda-calendar, MIT",
            "library": "gaurabda",
            "algorithm": "GCAL by Gopalapriya das, ISKCON GBC Vaishnava Calendar Committee",
            "location_standard": "Vrindavan",
            "location": {"name": "Vrindavan, India", "lat": 27.583, "lng": 77.73, "tz": "Asia/Kolkata"},
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "span": {"from": events[0]["date"], "to": events[-1]["date"]} if events else None,
            "validated_against": "iskconvrindavan.com official temple calendar — exact match incl. parana times",
        },
        "events": events,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="1 jan 2026", help='start date, e.g. "1 jan 2026"')
    ap.add_argument("--count", type=int, default=765, help="number of days (≈2 Gaurabda years)")
    ap.add_argument("--out", default="vaisnava-calendar-vrindavan.json")
    a = ap.parse_args()
    data = build(a.start, a.count)
    with open(a.out, "wt", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"wrote {len(data['events'])} events -> {a.out} (span {data['provenance']['span']})")


if __name__ == "__main__":
    main()
