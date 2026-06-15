# iskcon-gcal — on-demand Gaudiya Vaisnava (Gaurabda) calendar compute service.
#
# Runs the OFFICIAL GBC Vaisnava Calendar Committee engine (GCal / gaurabda, by
# Gopalapriya das, "as defined in Hari Bhakti Vilasa") inside a Cloudflare Python
# Worker (Pyodide). It computes the authoritative calendar for ANY coordinates +
# timezone, so the site can serve an exact per-city calendar for any place on
# Earth (geocoded under the hood via Open-Meteo) instead of a nearest-proxy.
#
# Data note: gaurabda normally loads gaurabda/res/*.json from disk. To be fully
# Pyodide-safe (no filesystem reliance) the small res payloads are EMBEDDED in
# res_data.py and an open() shim feeds them to gaurabda's loaders. locations.json
# is stubbed ([]) — it is not needed for coordinate-based calculation.
#
# Endpoint:  GET /compute?lat=<f>&lng=<f>&tz=<IANA>[&start=<"1 jan 2026">][&days=<int>][&name=<str>]
# Returns:   {"location":{lat,lng,tz}, "source":..., "events":[{"date":"YYYY-MM-DD","summary":...}]}

import builtins
import io
import json
import os

from res_data import RES

# ── open() shim: serve gaurabda's res/*.json from the embedded payload ──
_orig_open = builtins.open


def _shim_open(file, mode="r", *args, **kwargs):
    base = os.path.basename(str(file))
    if base in RES and "r" in mode and "b" not in mode:
        return io.StringIO(RES[base])
    return _orig_open(file, mode, *args, **kwargs)


builtins.open = _shim_open

# Import the engine AFTER the shim is installed (its loaders run on import).
import gaurabda as gcal  # noqa: E402

# ── timezone resolver: IANA -> GCal full tzname ("+5:30 Asia/Calcutta") ──
_IANA2FULL = {}
for _t in gcal.GetTimeZones():
    _p = _t.split(" ", 1)
    if len(_p) == 2:
        _IANA2FULL.setdefault(_p[1], _t)

# Zones absent from GCal's table -> a zone with identical UTC offset & DST rule.
_ALIAS = {
    "Asia/Kolkata": "Asia/Calcutta",
    "Europe/Kyiv": "Europe/Kiev",
    "Europe/Saratov": "Europe/Samara",      # +4, no DST
    "Asia/Barnaul": "Asia/Krasnoyarsk",      # +7, no DST
    "Asia/Tomsk": "Asia/Krasnoyarsk",        # +7, no DST
    "Europe/Astrakhan": "Europe/Samara",     # +4, no DST
    "Europe/Ulyanovsk": "Europe/Samara",     # +4, no DST
    "Asia/Atyrau": "Asia/Aqtau",             # +5, no DST
}


def _resolve_tz(z):
    if not z:
        return None
    return _IANA2FULL.get(z) or _IANA2FULL.get(_ALIAS.get(z, "")) or None


def _iso(d):
    return "%04d-%02d-%02d" % (d["year"], d["month"], d["day"])


def _qs(url):
    out = {}
    q = url.split("?", 1)[1] if "?" in url else ""
    for part in q.split("&"):
        if not part:
            continue
        if "=" in part:
            k, v = part.split("=", 1)
        else:
            k, v = part, ""
        # minimal percent-decode (commas/spaces in start=)
        v = v.replace("+", " ")
        try:
            from urllib.parse import unquote
            v = unquote(v)
        except Exception:
            pass
        out[k] = v
    return out


def _compute(lat, lng, full_tz, name, start, days):
    loc = gcal.GCLocation(data={"latitude": lat, "longitude": lng, "tzname": full_tz, "name": name})
    tc = gcal.TCalendar()
    tc.CalculateCalendar(loc, gcal.GCGregorianDate(text=start), days)
    events = []
    for raw in tc.days_iter():
        d = dict(raw)
        dd = _iso(d["date"])
        for e in (d.get("events") or []):
            tx = (e.get("text") if isinstance(e, dict) else str(e)) or ""
            tx = tx.strip()
            if tx:
                events.append({"date": dd, "summary": tx})
    return events


async def on_fetch(request, env):
    from js import Response

    url = str(request.url)
    if "/compute" not in url:
        return Response.new(
            json.dumps({"service": "iskcon-gcal", "engine": "GCal gaurabda (GBC Vaishnava Calendar Committee)"})
        )

    p = _qs(url)
    try:
        lat = float(p.get("lat", ""))
        lng = float(p.get("lng", ""))
    except (TypeError, ValueError):
        return Response.new(json.dumps({"error": "lat and lng are required floats"}))

    tz = p.get("tz", "")
    full = _resolve_tz(tz)
    if not full:
        return Response.new(json.dumps({"error": "timezone not resolvable", "tz": tz}))

    start = p.get("start", "1 jan 2026")
    try:
        days = int(p.get("days", "765"))
    except ValueError:
        days = 765
    days = max(1, min(days, 1100))
    name = p.get("name", "city")

    try:
        events = _compute(lat, lng, full, name, start, days)
    except Exception as ex:  # surface compute errors as JSON (never 500 the caller)
        return Response.new(json.dumps({"error": "compute failed", "detail": str(ex)[:200]}))

    body = json.dumps({
        "location": {"lat": lat, "lng": lng, "tz": tz, "name": name},
        "source": "GCAL gaurabda (GBC Vaishnava Calendar Committee)",
        "count": len(events),
        "events": events,
    })
    return Response.new(body)
