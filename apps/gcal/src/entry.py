# iskcon-gcal — on-demand Gaudiya Vaisnava (Gaurabda) calendar compute service.
# Runs the official GBC Vaisnava Calendar Committee engine (gaurabda) in a
# Cloudflare Python Worker (Pyodide) to compute an authoritative calendar for
# ANY coordinates + timezone. Data embedded (res_data.py) via an open() shim.
#
# GET /compute?lat=<f>&lng=<f>&tz=<IANA>[&start="1 jan 2026"][&days=int][&name=str]

import builtins
import io
import json
import os
import traceback

# ── guarded init: import engine + build tz table; capture any failure ──
_INIT_ERR = None
gcal = None
_IANA2FULL = {}
try:
    from res_data import RES

    _orig_open = builtins.open

    def _shim_open(file, mode="r", *args, **kwargs):
        base = os.path.basename(str(file))
        if base in RES and "r" in mode and "b" not in mode:
            return io.StringIO(RES[base])
        return _orig_open(file, mode, *args, **kwargs)

    builtins.open = _shim_open

    import gaurabda as gcal  # noqa: E402

    for _t in gcal.GetTimeZones():
        _p = _t.split(" ", 1)
        if len(_p) == 2:
            _IANA2FULL.setdefault(_p[1], _t)
except Exception:
    _INIT_ERR = traceback.format_exc()

_ALIAS = {
    "Asia/Kolkata": "Asia/Calcutta",
    "Europe/Kyiv": "Europe/Kiev",
    "Europe/Saratov": "Europe/Samara",
    "Asia/Barnaul": "Asia/Krasnoyarsk",
    "Asia/Tomsk": "Asia/Krasnoyarsk",
    "Europe/Astrakhan": "Europe/Samara",
    "Europe/Ulyanovsk": "Europe/Samara",
    "Asia/Atyrau": "Asia/Aqtau",
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
    try:
        if _INIT_ERR:
            return Response.new(json.dumps({"error": "init failed", "detail": _INIT_ERR[-1600:]}))
        url = str(request.url)
        if "/compute" not in url:
            return Response.new(json.dumps({"service": "iskcon-gcal", "ok": True}))
        p = _qs(url)
        try:
            lat = float(p.get("lat", ""))
            lng = float(p.get("lng", ""))
        except (TypeError, ValueError):
            return Response.new(json.dumps({"error": "lat and lng required floats"}))
        full = _resolve_tz(p.get("tz", ""))
        if not full:
            return Response.new(json.dumps({"error": "tz not resolvable", "tz": p.get("tz", "")}))
        start = p.get("start", "1 jan 2026")
        try:
            days = int(p.get("days", "765"))
        except ValueError:
            days = 765
        days = max(1, min(days, 1100))
        name = p.get("name", "city")
        events = _compute(lat, lng, full, name, start, days)
        body = json.dumps({
            "location": {"lat": lat, "lng": lng, "tz": p.get("tz", ""), "name": name},
            "source": "GCAL gaurabda (GBC Vaishnava Calendar Committee)",
            "count": len(events),
            "events": events,
        })
        return Response.new(body)
    except Exception:
        return Response.new(json.dumps({"error": "handler crashed", "detail": traceback.format_exc()[-1600:]}))
