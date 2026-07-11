#!/usr/bin/env python3
"""
ОФИЦИАЛЬНЫЙ ДИРЕКТОРИЙ ЦЕНТРОВ — centres.iskcon.org (ЗКН-Пл006).

ПОЧЕМУ ЭТОТ СКРИПТ СУЩЕСТВУЕТ.

В базе было 956 центров, из них 792 БЕЗ координат — локатор мёртв. Первый порыв:
геокодировать адреса. Разбор показал, что это было бы ошибкой:

  • 729 центров пришли из `centers.iskcondesiretree.com` — АРХИВА 2011–2013 годов.
    Ни у одного нет координат. За 14 лет часть центров переехала или закрылась.
  • 164 центра пришли из `centres.iskcon.org` — ОФИЦИАЛЬНОГО директория ИСККОН.
    У ВСЕХ 164 координаты есть.

Официальный директорий создан ровно затем, чтобы устранить «неприятные сюрпризы
вроде следования по карте к адресу храма и обнаружения себя посреди пустоты».
Геокодировать протухшие адреса 2011 года = воспроизвести эту проблему и поставить
на карту точки, ведущие в никуда. Это то же сломанное обещание, что ЗКН-Пр007.

ЧТО ДЕЛАЕТ СКРИПТ.

Тянет ВЕСЬ официальный директорий (664 центра: Индия 172 · Европа 103 · Россия 91 ·
США/Канада 77 · Латинская Америка 49 · UK 44 · ЮВА 38 · Африка 36 · Океания 22 …).
Сайт — WordPress + WP Job Manager: центры лежат в типе `job_listing`, координаты —
в мете (`geolocation_lat` / `geolocation_long`).

ИСТОЧНИК ИСТИНЫ: официальный директорий. Архив desiretree остаётся ТОЛЬКО как
запасной для центров, которых в официальном нет (и такие помечаются явно).
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

OFFICIAL = "https://centres.iskcon.org"
UA = "iskcon-one-love/1.0 (+https://gaurangers.com; ceo@billionsx.com)"

# WP Job Manager хранит листинги в этом типе. Пробуем по очереди — тема могла
# переименовать CPT; скрипт обязан сказать, что именно сработало (или упасть).
CPT_CANDIDATES = ["job_listing", "case27_listing", "listing", "centre"]


def get(url: str, timeout: int = 45):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def find_cpt() -> str:
    """Определить реальный тип записи для центров."""
    for cpt in CPT_CANDIDATES:
        try:
            arr = get("%s/wp-json/wp/v2/%s?per_page=1" % (OFFICIAL, cpt))
            if isinstance(arr, list) and arr:
                print("::notice title=CPT::тип записи центров = %s" % cpt)
                return cpt
        except Exception:
            continue
    raise SystemExit("::error title=CPT-NOT-FOUND::официальный директорий не отдаёт ни один из %s"
                     % ", ".join(CPT_CANDIDATES))


def num(v):
    """Координата из меты. WP отдаёт мету по-разному: строкой, числом, списком."""
    if isinstance(v, list):
        v = v[0] if v else None
    if v in (None, "", "0"):
        return None
    try:
        f = float(v)
        return f if -90.0 <= f <= 90.0 or abs(f) <= 180.0 else None
    except (TypeError, ValueError):
        return None


def strip_html(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()


def fetch_all(cpt: str):
    """Все центры официального директория с координатами."""
    out, page = [], 1
    while page < 20:                       # 664 центра ≈ 7 страниц по 100
        url = "%s/wp-json/wp/v2/%s?per_page=100&page=%d" % (OFFICIAL, cpt, page)
        try:
            arr = get(url)
        except Exception as e:
            if page == 1:
                raise
            print("::warning title=PAGE::страница %d: %s" % (page, e))
            break
        if not isinstance(arr, list) or not arr:
            break
        out += arr
        if len(arr) < 100:
            break
        page += 1
        time.sleep(0.4)                    # вежливость к чужому серверу
    return out


LAT_KEYS = ("geolocation_lat", "_geolocation_lat", "latitude", "_latitude", "lat")
LNG_KEYS = ("geolocation_long", "_geolocation_long", "geolocation_lng",
            "longitude", "_longitude", "lng", "long")
ADDR_KEYS = ("_job_location", "job_location", "geolocation_formatted_address",
             "_geolocation_formatted_address", "address", "_address")


def pick(meta: dict, keys) -> object:
    for k in keys:
        if k in meta and meta[k] not in (None, "", []):
            return meta[k]
    return None


def normalize(rows):
    places, no_coords = [], 0
    for r in rows:
        meta = r.get("meta") or {}
        lat = num(pick(meta, LAT_KEYS))
        lng = num(pick(meta, LNG_KEYS))
        addr = pick(meta, ADDR_KEYS)
        if isinstance(addr, list):
            addr = addr[0] if addr else None
        name = strip_html((r.get("title") or {}).get("rendered", ""))
        if not name:
            continue
        if lat is None or lng is None:
            no_coords += 1
        places.append({
            "id": r.get("slug") or str(r.get("id")),
            "name": name,
            "address": strip_html(str(addr or "")),
            "lat": lat, "lng": lng,
            "website": r.get("link"),
            "source": "centres.iskcon.org",   # ОФИЦИАЛЬНЫЙ источник истины
        })
    return places, no_coords


def main():
    cpt = find_cpt()
    rows = fetch_all(cpt)
    places, no_coords = normalize(rows)
    with_coords = len(places) - no_coords

    print("::notice title=OFFICIAL::центров=%d  с координатами=%d  без=%d"
          % (len(places), with_coords, no_coords))

    if len(places) < 300:
        raise SystemExit("::error title=TOO-FEW::официальный директорий отдал %d центров — "
                         "ожидалось ~664. Скрейп неполон, не перезаписываю базу." % len(places))

    out = {"places": places, "count": len(places), "with_coords": with_coords,
           "source": "centres.iskcon.org", "cpt": cpt}
    with open("apps/web/public/data/iskcon-centres-official.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("записано: apps/web/public/data/iskcon-centres-official.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
