#!/usr/bin/env python3
"""
ОФИЦИАЛЬНЫЙ ДИРЕКТОРИЙ ЦЕНТРОВ — centres.iskcon.org (ЗКН-Пл006).

ПОЧЕМУ ЭТОТ СКРИПТ СУЩЕСТВУЕТ.

Локатор центров был мёртв: 792 из 956 без координат. Первый порыв — геокодировать
адреса. Разбор показал, что это была бы ошибка:

  • 729 центров пришли из `centers.iskcondesiretree.com` — АРХИВА 2011–2013 годов.
    Ни у одного нет координат. За 14 лет часть центров переехала или закрылась.
  • 164 центра — из `centres.iskcon.org`, ОФИЦИАЛЬНОГО директория. У ВСЕХ координаты.

Официальный директорий создан ровно затем, чтобы устранить «неприятные сюрпризы
вроде следования по карте к адресу храма и обнаружения себя посреди пустоты».
Геокодировать протухшие адреса 2011 года = воспроизвести эту проблему: поставить
на карту точки, ведущие в никуда. То же сломанное обещание, что ЗКН-Пр007.

ПОЧЕМУ ЧЕРЕЗ БРАУЗЕР.

Проверено ФАКТОМ, а не догадкой: официальный сайт не отдаёт данные машинам.
  • wp-json → таймаут (REST выключен)
  • ?rest_route=… → возвращает HTML, не JSON
  • /sitemap.xml, /wp-sitemap.xml, /sitemap_index.xml → ноль записей
Листинги рисует JavaScript. Значит нужен настоящий браузер.

Playwright в проекте УЖЕ есть — им пре-генерируются PDF книг в deploy-web.yml.
Здесь он открывает страницы регионов и ПЕРЕХВАТЫВАЕТ сетевые ответы, которыми сайт
наполняет карту: там координаты лежат структурно, а не в разметке.
"""
import json
import re
import sys
import time

REGIONS = [
    "india", "europe", "russia", "usa-canada", "latin-america-caribbean", "uk",
    "southeast-asia", "africa", "oceania", "south-asia", "far-east-asia",
    "central-asia", "asia-pacific", "middle-east", "latin-america", "us-canada",
]
OFFICIAL = "https://centres.iskcon.org"
OUT = "apps/web/public/data/iskcon-centres-official.json"

LAT_KEYS = ("lat", "latitude", "geolocation_lat", "_geolocation_lat")
LNG_KEYS = ("lng", "long", "longitude", "geolocation_long", "_geolocation_long")
NAME_KEYS = ("title", "name", "post_title", "listing_title")


def dig(obj, acc):
    """Рекурсивно собрать всё, что похоже на маркер карты (имя + координаты)."""
    if isinstance(obj, dict):
        lat = next((obj[k] for k in LAT_KEYS if k in obj), None)
        lng = next((obj[k] for k in LNG_KEYS if k in obj), None)
        nm = next((obj[k] for k in NAME_KEYS if k in obj), None)
        if lat is not None and lng is not None:
            try:
                la, ln = float(lat), float(lng)
                if -90 <= la <= 90 and -180 <= ln <= 180 and (la or ln):
                    name = re.sub(r"<[^>]+>", " ", str(nm or "")).strip()
                    name = re.sub(r"\s+", " ", name)
                    if name:
                        acc[name.lower()] = {
                            "name": name, "lat": la, "lng": ln,
                            "url": obj.get("url") or obj.get("permalink") or "",
                            "source": "centres.iskcon.org",
                        }
            except (TypeError, ValueError):
                pass
        for v in obj.values():
            dig(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            dig(v, acc)


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit("::error title=NO-PLAYWRIGHT::нужен playwright + chromium")

    found = {}
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        ctx = br.new_context(user_agent="iskcon-one-love/1.0 (+https://gaurangers.com)")
        page = ctx.new_page()

        def on_response(resp):
            ct = (resp.headers or {}).get("content-type", "")
            if "json" not in ct.lower():
                return
            try:
                dig(resp.json(), found)
            except Exception:
                pass

        page.on("response", on_response)

        for reg in REGIONS:
            url = "%s/centre-region/%s/" % (OFFICIAL, reg)
            try:
                page.goto(url, wait_until="networkidle", timeout=60000)
            except Exception as e:
                print("::warning title=REGION::%s → %s" % (reg, str(e)[:60]))
                continue
            for _ in range(30):
                try:
                    btn = page.query_selector("a.load-more, button.load-more, .load_more_jobs")
                    if not btn or not btn.is_visible():
                        break
                    btn.click()
                    page.wait_for_timeout(1200)
                except Exception:
                    break
            print("  %-26s маркеров всего: %d" % (reg, len(found)))
            time.sleep(0.3)

        br.close()

    places = sorted(found.values(), key=lambda p: p["name"])
    print("::notice title=OFFICIAL::центров с координатами=%d" % len(places))

    if len(places) < 200:
        raise SystemExit("::error title=TOO-FEW::директорий дал %d центров, ожидалось ~664. "
                         "Скрейп неполон — базу не трогаю." % len(places))

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"places": places, "count": len(places),
                   "source": "centres.iskcon.org"}, f, ensure_ascii=False, indent=1)
    print("записано: %s" % OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
