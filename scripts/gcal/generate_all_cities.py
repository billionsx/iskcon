#!/usr/bin/env python3
"""
Генерация self-hosted фидов вайшнавского календаря (GCal / Гаурабда) по ВСЕМ
городам из apps/web/public/data/vaisnava-locations.json.

Источник расчётов — движок GCAL (gaurabda), официальная программа Календарного
комитета GBC. Для каждого города считаем по его координатам и часовому поясу,
пишем apps/web/public/data/gcal/<slug>.json вида:
    {key, slug, location:{name,lat,lng,tz}, source, events:[{date, summary}]}

Воркер (apps/web/workerCalendar.ts) читает этот фид через биндинг ASSETS и
полностью русифицирует его на лету (ruTitle: экадаши, праздники, санкранти,
посты, вайшнавы в родительном падеже). Внешних рантайм-зависимостей нет.

Запуск (нужен Python-порт gaurabda):
    pip install "gaurabda @ git+https://github.com/gopa810/gaurabda-calendar.git"
    python3 scripts/gcal/generate_all_cities.py          # резюмируемо (пропускает готовые)
    python3 scripts/gcal/generate_all_cities.py --force  # перегенерировать всё

slug(key) ОБЯЗАН совпадать с citySlug() в workerCalendar.ts, иначе воркер не
найдёт фид: lower → [^a-z0-9]+ → '-' → strip('-').
"""
import gaurabda as gcal, json, re, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOCATIONS = os.path.join(ROOT, "apps/web/public/data/vaisnava-locations.json")
OUT = os.path.join(ROOT, "apps/web/public/data/gcal")
START = "1 jan 2026"
DAYS = 765  # ~2 года рантайма от 1 января текущего года
# IANA-зоны, которых нет в таблице GCAL под текущим именем (исторические имена).
TZ_ALIAS = {"Asia/Kolkata": "Asia/Calcutta", "Europe/Kyiv": "Europe/Kiev"}

force = "--force" in sys.argv

iana2full = {}
for t in gcal.GetTimeZones():
    p = t.split(" ", 1)
    if len(p) == 2:
        iana2full.setdefault(p[1], t)


def full_tz(z):
    return iana2full.get(z) or iana2full.get(TZ_ALIAS.get(z, ""))


def slug(k):
    return re.sub(r"[^a-z0-9]+", "-", k.lower()).strip("-")


def iso(dt):
    return "%04d-%02d-%02d" % (dt["year"], dt["month"], dt["day"])


cities = [c for co in json.load(open(LOCATIONS, encoding="utf-8"))["countries"] for c in co["cities"]]
os.makedirs(OUT, exist_ok=True)
done = skipped = 0
failed = []
t0 = time.time()
for c in cities:
    sl = slug(c["key"])
    path = os.path.join(OUT, sl + ".json")
    if os.path.exists(path) and not force:
        skipped += 1
        continue
    ftz = full_tz(c.get("tz"))
    if not ftz or c.get("lat") is None or c.get("lng") is None:
        failed.append((c["key"], c.get("tz"), "no tz/coords"))
        continue
    try:
        loc = gcal.GCLocation(data={"latitude": c["lat"], "longitude": c["lng"], "tzname": ftz, "name": c["ru"]})
        tc = gcal.TCalendar()
        tc.CalculateCalendar(loc, gcal.GCGregorianDate(text=START), DAYS)
        feed = []
        for d in (dict(v) for v in tc.days_iter()):
            dd = iso(d["date"])
            for e in (d.get("events") or []):
                tx = (e.get("text") if isinstance(e, dict) else str(e)) or ""
                if tx.strip():
                    feed.append({"date": dd, "summary": tx.strip()})
        out = {
            "key": c["key"],
            "slug": sl,
            "location": {"name": c["ru"], "lat": c["lat"], "lng": c["lng"], "tz": c["tz"]},
            "source": "GCAL gaurabda (GBC Vaishnava Calendar Committee)",
            "events": feed,
        }
        json.dump(out, open(path, "wt", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        done += 1
    except Exception as ex:
        failed.append((c["key"], c.get("tz"), str(ex)[:80]))

print(f"generated={done} skipped={skipped} failed={len(failed)} total={len(cities)} in {time.time()-t0:.0f}s")
for f in failed:
    print("  FAIL", f)
sys.exit(1 if failed else 0)
