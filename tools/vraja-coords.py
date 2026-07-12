#!/usr/bin/env python3
"""
КООРДИНАТЫ МЕСТ ВРАДЖА — vrajapedia.com (ЗКН-Пл006).

ПРИНЦИП ЗДЕСЬ ОБРАТНЫЙ, ЧЕМ У ЦЕНТРОВ ИСККОН.

Центры ИСККОН переезжают и закрываются — поэтому геокодировать их адреса из
архива 2011 года нельзя: получим точки, ведущие в никуда (см. centres-official.py).

Места Враджа — гхаты, кунды, храмы, самадхи — стоят на одном месте ВЕКАМИ.
Они не протухают. Здесь координата, взятая один раз, верна и через сто лет.

СОСТОЯНИЕ. Из 672 мест дхамы координаты есть у 54 (8%). Карта дхамы пуста.
При этом у 564 мест уже проставлена ссылка `vp_link` на vrajapedia.com —
специализированную энциклопедию Враджа. Это и есть источник.

ЧЕСТНОСТЬ. Скрипт НЕ выдумывает координаты. Если страница источника их не даёт —
место остаётся без координаты и попадает в отчёт. Точка на карте, поставленная
наугад, хуже отсутствия точки: она врёт паломнику (ЗКН-БТ001 · ЗКН-Пр007).
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

UA = "iskcon-one-love/1.0 (+https://gaurangers.com; ceo@billionsx.com)"

# Координаты на странице могут лежать по-разному. Пробуем всё, что встречается,
# и берём ПЕРВОЕ правдоподобное. Диапазон Враджа: ~27.0–28.0 N, ~77.0–78.0 E —
# им же и проверяем, что вытащили именно место, а не случайное число.
COORD_RX = [
    re.compile(r'"latitude"\s*:\s*"?(-?\d{1,3}\.\d+)"?[\s\S]{0,140}?"longitude"\s*:\s*"?(-?\d{1,3}\.\d+)"?'),
    re.compile(r'data-lat=["\'](-?\d{1,3}\.\d+)["\'][\s\S]{0,160}?data-l(?:ng|on)g?=["\'](-?\d{1,3}\.\d+)["\']'),
    re.compile(r'[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)'),          # ссылка на карты
    re.compile(r'@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)'),                  # google maps @lat,lng
    re.compile(r'\bLatLng\(\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)'),
]

# РАМКА — ЭТО ГЕЙТ ПРОТИВ ЛОЖНОГО СОВПАДЕНИЯ (ЗКН-Пл008), и она должна быть ТЕСНОЙ.
#
# Проверено на живых ошибках геосервиса:
#   • «Лалита-деви мандир» → точка с долготой 77.93 (другой Унчагаон, ~50 км восточнее)
#   • «Кулия» (Навадвипа)  → другая Кулия в 13 км южнее
# Широкая рамка пропустила бы обе. У КАЖДОЙ дхамы своя.
BOXES = {
    # Врадж-мандала: 84 коса вокруг Матхуры
    "vrindavan": (27.10, 28.00, 77.15, 77.85),
    # Навадвипа-дхама: девять островов у слияния Ганги и Джаланги
    "navadvipa": (23.20, 23.60, 88.20, 88.55),
    # Нилачала (Джаганнатха Пури) — берег Бенгальского залива
    "nilachala": (19.70, 20.00, 85.75, 86.00),
}
VRAJA_BOX = BOXES["vrindavan"]           # обратная совместимость


def in_box(lat: float, lng: float, dhama: str = "vrindavan") -> bool:
    """Координата обязана лежать В СВОЕЙ дхаме. Иначе это чужое место с тем же именем."""
    a, b, c, d = BOXES.get(dhama, BOXES["vrindavan"])
    return a <= lat <= b and c <= lng <= d


def in_vraja(lat: float, lng: float) -> bool:
    return in_box(lat, lng, "vrindavan")


def get(url: str, timeout: int = 25) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def coords_from(html: str, dhama: str = "vrindavan"):
    for rx in COORD_RX:
        for m in rx.finditer(html):
            try:
                lat, lng = float(m.group(1)), float(m.group(2))
            except ValueError:
                continue
            if in_box(lat, lng, dhama):
                return lat, lng
    return None, None


# ── D1 ──────────────────────────────────────────────────────────────────────
def ids():
    cfg = open("apps/web/wrangler.toml", encoding="utf-8").read()
    a = re.search(r'account_id\s*=\s*"([^"]+)"', cfg).group(1)
    d = re.search(r'database_id\s*=\s*"([^"]+)"', cfg).group(1)
    return a, d


def d1(sql, params=None):
    acc, dbid = ids()
    tok = os.environ["CLOUDFLARE_API_TOKEN"]
    url = "https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query" % (acc, dbid)
    body = {"sql": sql}
    if params:
        body["params"] = params
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + tok,
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        # ЗКН-Ф014: молча падать нельзя — скажи, ЧТО именно не так.
        raise SystemExit("::error title=D1::HTTP %s — %s\n  SQL: %s"
                         % (e.code, e.read().decode("utf-8", "replace")[:280], sql[:110]))


def main():
    if not os.environ.get("CLOUDFLARE_API_TOKEN"):
        print("нет токена — пропуск (локальный прогон)")
        return 0

    res = d1("""SELECT id, name, dhama_id, vp_link FROM tirthas
                WHERE lat IS NULL AND vp_link IS NOT NULL AND vp_link <> ''""")
    rows = (res.get("result") or [{}])[0].get("results") or []
    print("мест без координат со ссылкой на источник: %d" % len(rows))

    found = miss = 0
    fail_streak = 0
    for i, r in enumerate(rows):
        try:
            html = get(r["vp_link"], timeout=12)
            fail_streak = 0
        except Exception as e:
            miss += 1
            fail_streak += 1
            # ЗКН-Ц003: падать БЫСТРО, если источник молчит. Иначе скрипт часами
            # висит на таймаутах и создаёт видимость работы. 15 отказов подряд =
            # источник недоступен из CI (так было с centres.iskcon.org).
            if fail_streak >= 15:
                raise SystemExit("::error title=SOURCE-DOWN::15 отказов подряд — "
                                 "источник не отвечает из CI (%s). Последняя ошибка: %s"
                                 % (r["vp_link"].split("/")[2], str(e)[:60]))
            continue
        lat, lng = coords_from(html, r.get("dhama_id") or "vrindavan")
        if lat is None:
            miss += 1
        else:
            d1("UPDATE tirthas SET lat = ?, lng = ? WHERE id = ?",
               [str(lat), str(lng), r["id"]])
            found += 1
        if i and i % 50 == 0:
            print("  ...%d/%d  найдено=%d" % (i, len(rows), found))
        time.sleep(0.25)                   # вежливость к чужому серверу

    res = d1("SELECT COUNT(*) AS n FROM tirthas WHERE lat IS NOT NULL")
    have = (res.get("result") or [{}])[0]["results"][0]["n"]
    res = d1("SELECT COUNT(*) AS n FROM tirthas")
    tot = (res.get("result") or [{}])[0]["results"][0]["n"]

    print("::notice title=VRAJA::найдено=%d  источник промолчал=%d  теперь с координатами=%d/%d"
          % (found, miss, have, tot))
    print("Места без координаты остаются БЕЗ неё. Точка наугад врёт паломнику (ЗКН-БТ001).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
