#!/usr/bin/env python3
"""
АРХИВ ПРОШЛОГО вайшнавского календаря (GCal / Гаурабда): 2016-01-01 → 2025-12-31,
по КАЖДОМУ городу, у которого есть живой фид.

ЗАЧЕМ. Живой фид (`/data/gcal/<slug>.json`) считает 2026-01-01 → 2028-02-04.
Прошлого в приложении не было ВООБЩЕ: ни экадаши 2019-го, ни Гаура-пурнимы 2021-го.
Архив закрывает 10 лет назад. Стык без дыры и без нахлёста: архив кончается там,
где начинается живой фид.

ИСТОЧНИК — ТОТ ЖЕ ДВИЖОК, НЕ ПЕРЕСЧЁТ. GCAL (gaurabda) — официальная программа
Календарного комитета GBC, астрономическая: считает любой год с той же точностью.
Правила (шуддха-экадаши, махадвадаши, окно параны, адхика-маса) здесь не
переписываются ни строкой (ЗКН-БТ001). Паритет проверен: прогон движка на 2026
даёт байт в байт тот же фид, что уже лежит в репозитории.

ПОЧЕМУ ПО КАЖДОМУ ГОРОДУ. Титхи определяется на восходе В ТОЧКЕ. Замер по 10 годам:
у Нью-Йорка ~45 % событий приходятся на ДРУГУЮ григорианскую дату, чем у Вриндавана,
у Москвы ~18 %. Один общий «мировой» архив показал бы девоту в Сиднее чужой день
экадаши — это ложь, а не экономия (ЗКН-БТ002).

═══ ГЛАВНАЯ ЛОВУШКА: ГОРОД — ЭТО НЕ ТОЛЬКО КООРДИНАТЫ, НО И ПОЯС ═══
4403 живых фида построены ТРЕМЯ разными пайплайнами, и часовой пояс лежит только
у 272 из них:
  1. curated (272)  — vaisnava-locations.json, slug(key), IANA-зона в самом фиде;
  2. БД движка (2379) — gaurabda/res/locations.json, slug("<city> <country>"),
     родная запись с tzid/offset (в фид зона НЕ попала);
  3. GeoNames (1963) — cities15000.txt, slug("<asciiname> <CC>"), зона взята из
     колонки 17 TSV и приведена resolve() (в фид зона НЕ попала).
Приоритет ровно тот же, что при сборке живых фидов: curated → движок → GeoNames
(каждый следующий генератор пропускал уже существующий файл).

Ошибиться поясом = молча сдвинуть прошлое на день. Поэтому НЕ ВЕРИМ, А ПРОВЕРЯЕМ:
для каждого города сначала считаем 60 дней ЖИВОГО окна (2026) по восстановленной
локации и сверяем с УЖЕ ОТГРУЖЕННЫМ фидом — включая минуты параны. Не совпало —
город НЕ пишется и уходит в отчёт. Молчаливое расхождение хуже пропуска.

ФОРМАТ — КОМПАКТНЫЙ. 10 лет сырым JSON = 165 КБ × 4403 = 700 МБ. Словарь +
база-36 смещения → ~30 КБ/город (~125 МБ). Плюс выброшены строки, которые воркер
и так НЕ показывает (Ksaya/Vrddhi tithi, DST). Воркер разворачивает архив обратно
в {date, summary} и гонит через ТОТ ЖЕ buildEvents(), что и живой фид, — русификация
едина по построению, а не по договорённости.

    {"slug","location","source","from","to",
     "t":[<уникальные summary>],
     "e":"<день36>.<индекс36> …"}          # день = смещение от `from`

Запуск:
    pip install "gaurabda @ git+https://github.com/gopa810/gaurabda-calendar.git"
    python3 scripts/gcal/generate_past_archive.py --shard 0 --of 12 --jobs 4 \
        [--geonames cities15000.txt]
"""
import argparse
import json
import os
import re
import signal
import sys
import time
from datetime import datetime
from multiprocessing import Pool
from zoneinfo import ZoneInfo

import gaurabda as gcal

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEEDS = os.path.join(ROOT, "apps/web/public/data/gcal")
CURATED = os.path.join(ROOT, "apps/web/public/data/vaisnava-locations.json")
OUT_DEFAULT = os.path.join(ROOT, "apps/web/public/data/gcal-past")

PAST_START, PAST_DAYS = "1 jan 2016", 3653      # 2016-01-01 … 2025-12-31
FROM, TO = "2016-01-01", "2025-12-31"
PROBE_START, PROBE_DAYS = "1 jan 2026", 60      # окно паритета с живым фидом
PROBE_TO = "2026-03-01"
CITY_TIMEOUT = 300                              # полярные координаты зацикливают восход

# Строки, которые воркер НЕ показывает никогда (workerCalendar.ts::IGNORE_LINE).
IGNORE = re.compile(r"^(?:ksaya|vrddhi)\s+tithi\b|daylight saving time", re.I)

_D36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def b36(n: int) -> str:
    if n == 0:
        return "0"
    s = ""
    while n:
        s = _D36[n % 36] + s
        n //= 36
    return s


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ── разрешение часового пояса (зеркало gen_geonames_feeds.py / fix_exussr_tz.py) ──
NATIVE, UTC_NODST = {}, {}
for _f in gcal.GetTimeZones():
    _p = _f.split(" ", 1)
    if len(_p) == 2:
        NATIVE[_p[1]] = _f
        if _p[1].startswith("UTC"):
            UTC_NODST[_p[0]] = _f
DST_ALIAS = {"Europe/Kyiv": "Europe/Kiev", "Europe/Uzhgorod": "Europe/Kiev",
             "Europe/Zaporozhye": "Europe/Kiev", "Europe/Tiraspol": "Europe/Chisinau",
             "Asia/Kolkata": "Asia/Calcutta"}


def _off_str(td):
    m = int(round(td.total_seconds() / 60))
    sign = "+" if m >= 0 else "-"
    m = abs(m)
    return "%s%d:%02d" % (sign, m // 60, m % 60)


def resolve_tz(iana):
    """Зона без перехода на летнее время → фиксированный UTC-офсет; с переходом → родная зона GCAL."""
    try:
        jan = datetime(2026, 1, 15, 12, tzinfo=ZoneInfo(iana)).utcoffset()
        jul = datetime(2026, 7, 15, 12, tzinfo=ZoneInfo(iana)).utcoffset()
    except Exception:                                          # noqa: BLE001
        return None
    if jan != jul:
        return NATIVE.get(iana) or NATIVE.get(DST_ALIAS.get(iana, ""))
    return UTC_NODST.get(_off_str(min(jan, jul)))


def curated_tz(iana):
    """Curated-фиды строились generate_all_cities.py: прямой поиск зоны по IANA-имени."""
    return NATIVE.get(iana) or NATIVE.get(DST_ALIAS.get(iana or "", ""))


# ── карты «slug → данные локации» в порядке приоритета сборки живых фидов ─────
def load_maps(geonames_tsv):
    world = {}
    res = os.path.join(os.path.dirname(gcal.__file__), "res", "locations.json")
    for e in json.load(open(res, encoding="utf-8")):
        world.setdefault(slugify("%s %s" % (e["city"], e["country"])), e)

    curated = {}
    for co in json.load(open(CURATED, encoding="utf-8"))["countries"]:
        for c in co["cities"]:
            curated.setdefault(slugify(c["key"]), c)

    geo = {}
    if geonames_tsv and os.path.exists(geonames_tsv):
        with open(geonames_tsv, encoding="utf-8") as fh:
            for line in fh:
                c = line.rstrip("\n").split("\t")
                if len(c) < 18:
                    continue
                try:
                    lat, lng = float(c[4]), float(c[5])
                except ValueError:
                    continue
                sl = slugify(c[2] + " " + c[8].upper())
                if sl:
                    geo.setdefault(sl, {"name": c[1], "lat": lat, "lng": lng, "iana": c[17].strip()})
    return curated, world, geo


CUR, WORLD, GEO = {}, {}, {}


def locate(sl, feed):
    """Восстановить РОВНО ту локацию, по которой считан живой фид этого слага."""
    loc = feed.get("location") or {}
    # 1. curated — зона лежит в самом фиде
    if feed.get("key") and loc.get("tz"):
        tz = curated_tz(loc["tz"])
        if tz:
            return {"latitude": loc["lat"], "longitude": loc["lng"], "tzname": tz, "name": loc.get("name") or sl}
        return None
    # 2. БД движка — родная запись (tzid/offset), как в gen_world_feeds.py
    if sl in WORLD:
        return dict(WORLD[sl])
    # 3. GeoNames — зона из колонки 17, приведённая resolve(), как в gen_geonames_feeds.py
    if sl in GEO:
        g = GEO[sl]
        tz = resolve_tz(g["iana"])
        if tz:
            return {"latitude": g["lat"], "longitude": g["lng"], "tzname": tz, "name": g["name"]}
    return None


def events(loc_data, start, days):
    loc = gcal.GCLocation(data=loc_data)
    tc = gcal.TCalendar()
    tc.CalculateCalendar(loc, gcal.GCGregorianDate(text=start), days)
    out = []
    for raw in tc.days_iter():
        d = dict(raw)
        dd = "%04d-%02d-%02d" % (d["date"]["year"], d["date"]["month"], d["date"]["day"])
        for e in (d.get("events") or []):
            tx = (e.get("text") if isinstance(e, dict) else str(e)) or ""
            tx = tx.strip()
            if tx:
                out.append((dd, tx))
    return out


class _Timeout(Exception):
    pass


def _alarm(sig, frm):
    raise _Timeout()


signal.signal(signal.SIGALRM, _alarm)


def build(sl):
    """slug → (slug, архив | None, причина). Пишем только то, что прошло гейт паритета."""
    try:
        feed = json.load(open(os.path.join(FEEDS, sl + ".json"), encoding="utf-8"))
    except Exception as ex:                                    # noqa: BLE001
        return (sl, None, "feed unreadable: %s" % type(ex).__name__)

    loc_data = locate(sl, feed)
    if not loc_data:
        return (sl, None, "локация не восстановлена (нет в curated/движке/GeoNames)")

    signal.alarm(CITY_TIMEOUT)
    try:
        # ГЕЙТ ПАРИТЕТА: восстановленная локация обязана воспроизвести живой фид
        # ДО МИНУТЫ. Ошибка в поясе сдвинула бы прошлое на день — молча.
        probe = events(loc_data, PROBE_START, PROBE_DAYS)
        want = [(e["date"], e["summary"]) for e in feed.get("events", []) if e["date"] < PROBE_TO]
        if probe != want:
            signal.alarm(0)
            return (sl, None, "паритет не сошёлся: свой=%d фид=%d" % (len(probe), len(want)))

        past = events(loc_data, PAST_START, PAST_DAYS)
        signal.alarm(0)
    except _Timeout:
        return (sl, None, "таймаут %ds (полярные координаты?)" % CITY_TIMEOUT)
    except Exception as ex:                                    # noqa: BLE001
        signal.alarm(0)
        return (sl, None, "%s: %s" % (type(ex).__name__, str(ex)[:70]))

    base = datetime(2016, 1, 1).date()
    dic, ev = {}, []
    for dd, tx in past:
        if IGNORE.match(tx):
            continue
        off = (datetime.strptime(dd, "%Y-%m-%d").date() - base).days
        i = dic.setdefault(tx, len(dic))
        ev.append("%s.%s" % (b36(off), b36(i)))

    return (sl, {
        "slug": sl,
        "location": feed.get("location") or {},
        "source": "GCAL gaurabda (GBC Vaishnava Calendar Committee)",
        "from": FROM, "to": TO,
        "t": list(dic.keys()),
        "e": " ".join(ev),
    }, None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shard", type=int, default=0)
    ap.add_argument("--of", type=int, default=1)
    ap.add_argument("--jobs", type=int, default=max(1, os.cpu_count() or 1))
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--geonames", default="")
    ap.add_argument("--only", default="", help="через запятую: считать только эти слаги (проверка)")
    a = ap.parse_args()

    global CUR, WORLD, GEO
    CUR, WORLD, GEO = load_maps(a.geonames)
    print("карты локаций: curated=%d движок=%d geonames=%d" % (len(CUR), len(WORLD), len(GEO)), flush=True)

    slugs = sorted(f[:-5] for f in os.listdir(FEEDS) if f.endswith(".json"))
    if a.only:
        slugs = [s for s in a.only.split(",") if s]
    else:
        slugs = [s for i, s in enumerate(slugs) if i % a.of == a.shard]
    os.makedirs(a.out, exist_ok=True)

    print("shard %d/%d: %d городов, jobs=%d" % (a.shard, a.of, len(slugs), a.jobs), flush=True)
    t0, done, kb, failed, streak = time.time(), 0, 0.0, [], 0

    with Pool(a.jobs) as pool:
        for sl, data, err in pool.imap_unordered(build, slugs, chunksize=2):
            if err:
                failed.append((sl, err))
                streak += 1
                # ЗКН-Ц003-бис: СКРИПТ ПАДАЕТ БЫСТРО. 25 подряд = сломан не город,
                # а сам прогон (нет TSV, не та БД движка) — висеть часами незачем.
                if streak >= 25:
                    print("::error::25 отказов подряд — прогон сломан, останавливаюсь")
                    for k, e in failed[-8:]:
                        print("  FAIL", k, e)
                    pool.terminate()
                    sys.exit(1)
                continue
            streak = 0
            p = os.path.join(a.out, sl + ".json")
            with open(p, "wt", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
            kb += os.path.getsize(p) / 1024
            done += 1
            if done % 50 == 0:
                print("  %d/%d  %.0fs" % (done, len(slugs), time.time() - t0), flush=True)

    print("::notice title=GCal-past shard %d::готово=%d провалено=%d %.0fs средний=%.1f КБ"
          % (a.shard, done, len(failed), time.time() - t0, kb / done if done else 0))
    for k, e in failed[:25]:
        print("  FAIL", k, e)

    # Пропуск — не молчаливая ложь: город просто останется без прошлого, воркер
    # возьмёт ближайший фид. А вот массовый провал означает сломанный прогон.
    if failed and len(failed) > len(slugs) * 0.02:
        print("::error::провалено %d из %d (>2%%) — прогон недостоверен" % (len(failed), len(slugs)))
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
