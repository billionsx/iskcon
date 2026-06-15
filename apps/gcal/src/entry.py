# DIAGNOSTIC build: functional on_fetch + lazy engine init, reports everything.
import builtins
import io
import json
import os
import traceback

_ENGINE = {"state": "uninit"}


def _init_engine():
    if _ENGINE.get("state") == "ok":
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
        _ENGINE.update(state="error", detail=traceback.format_exc()[-1400:])


async def on_fetch(request, env):
    from js import Response
    out = {"handler": "functional"}
    try:
        _init_engine()
        out["engine"] = _ENGINE.get("state")
        if _ENGINE.get("state") == "error":
            out["detail"] = _ENGINE.get("detail")
        elif _ENGINE.get("state") == "ok":
            gcal = _ENGINE["gcal"]
            tz = _ENGINE["tz"]
            out["tz_count"] = len(tz)
            full = tz.get("Europe/Simferopol")
            loc = gcal.GCLocation(data={"latitude": 45.1903, "longitude": 33.3667, "tzname": full, "name": "Yevpatoria"})
            tc = gcal.TCalendar()
            tc.CalculateCalendar(loc, gcal.GCGregorianDate(text="1 jan 2026"), 200)
            ev = []
            for raw in tc.days_iter():
                d = dict(raw)
                dd = "%04d-%02d-%02d" % (d["date"]["year"], d["date"]["month"], d["date"]["day"])
                for e in (d.get("events") or []):
                    tx = (e.get("text") if isinstance(e, dict) else str(e)) or ""
                    if tx.strip():
                        ev.append((dd, tx.strip()))
            out["compute_days"] = len(ev)
            out["parana_0612"] = [s for (dd, s) in ev if dd == "2026-06-12" and "Break fast" in s][:1]
    except BaseException:
        out["fatal"] = traceback.format_exc()[-1400:]
    return Response.new(json.dumps(out))
