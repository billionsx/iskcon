# iskcon-gcal — on-demand Gaudiya Vaisnava (Gaurabda) calendar compute service.
# Cloudflare Python Worker (Pyodide) running the official GBC Vaisnava Calendar
# Committee engine (gaurabda) for ANY coords + timezone. Data embedded
# (res_data.py) via an open() shim — no filesystem reliance. Engine is lazily
# initialised on first request and cached.
#
# GET /compute?lat=<f>&lng=<f>&tz=<IANA>[&start="1 jan 2026"][&days=int][&name=str]

import builtins
import io
import json
import os
import traceback

from workers import WorkerEntrypoint, Response

_ENGINE = {"state": "uninit"}


def _init_engine():
    if _ENGINE.get("state") in ("ok", "error"):
        return
    try:
        from res_data import RES

        _orig = builtins.open

        def _open(file, mode="r", *a, **k):
            base = os.path.basename(str(file))
            if base in RES and "r" in mode and "b" not in mode:
                return io.StringIO(RES[base])
            return _orig(file, mode, *a, **k)

        builtins.open = _open

        import gaurabda as gcal

        m = {}
        for t in gcal.GetTimeZones():
            p = t.split(" ", 1)
            if len(p) == 2:
                m.setdefault(p[1], t)
        _ENGINE.update(state="ok", gcal=gcal, tz=m)
    except BaseException:
        _ENGINE.update(state="error", detail=traceback.format_exc()[-1600:])


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


def _handle(url):
    _init_engine()
    if _ENGINE.get("state") != "ok":
        return {"error": "engine init failed", "detail": _ENGINE.get("detail", "?")}
    gcal = _ENGINE["gcal"]
    tzmap = _ENGINE["tz"]
    if "/compute" not in url:
        return {"service": "iskcon-gcal", "ok": True, "tz_count": len(tzmap)}
    p = _qs(url)
    try:
        lat = float(p.get("lat", ""))
        lng = float(p.get("lng", ""))
    except (TypeError, ValueError):
        return {"error": "lat and lng required floats"}
    z = p.get("tz", "")
    full = tzmap.get(z) or tzmap.get(_ALIAS.get(z, "")) or None
    if not full:
        return {"error": "tz not resolvable", "tz": z}
    start = p.get("start", "1 jan 2026")
    try:
        days = int(p.get("days", "765"))
    except ValueError:
        days = 765
    days = max(1, min(days, 1100))
    name = p.get("name", "city")
    loc = gcal.GCLocation(data={"latitude": lat, "longitude": lng, "tzname": full, "name": name})
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
    return {
        "location": {"lat": lat, "lng": lng, "tz": z, "name": name},
        "source": "GCAL gaurabda (GBC Vaishnava Calendar Committee)",
        "count": len(events),
        "events": events,
    }


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        try:
            payload = _handle(str(request.url))
        except BaseException:
            payload = {"error": "handler crashed", "detail": traceback.format_exc()[-1600:]}
        return Response(json.dumps(payload), headers={"content-type": "application/json; charset=utf-8"})
