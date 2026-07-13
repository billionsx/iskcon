"""Жив ли источник координат Враджа — и есть ли он в архиве.

ЗКН-Пл006 — ИСТОЧНИК ВАЖНЕЕ МЕТОДА. Инструмент цел, а источник УМЕР:
vrajapedia.com отвечает 302 НА САМОГО СЕБЯ — бесконечная петля.

553 места несут ссылку `vp_link` на этот сайт. 520 из них ждут координат,
которых больше неоткуда взять.

Проверяем архив: страницы могли сохраниться.
"""
import json, urllib.error, urllib.request

UA = "Mozilla/5.0 (compatible; iskcon-one-love/1.0)"
PAGE = "https://vrajapedia.com/ru/places/mathura/pippaleshvara-mahadev/"


def get(url, timeout=25):
    rq = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(rq, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)[:80]


# 1. есть ли снимок в архиве
code, body = get("https://archive.org/wayback/available?url=" +
                 urllib.request.quote(PAGE, safe=""))
print("::notice::архив: код %d" % code)
snap = None
if code == 200:
    try:
        d = json.loads(body)
        snap = (d.get("archived_snapshots") or {}).get("closest", {})
        print("::notice::снимок: %s | %s" % (snap.get("timestamp"), snap.get("url")))
    except Exception as e:
        print("::notice::разбор архива: %s" % str(e)[:60])

# 2. есть ли в снимке координаты
if snap and snap.get("url"):
    import re
    c2, b2 = get(snap["url"], timeout=40)
    print("::notice::снимок отдал: код %d, длина %d" % (c2, len(b2)))
    m = re.search(r"[-+]?\d{1,2}\.\d{4,}\s*[,;]\s*[-+]?\d{1,3}\.\d{4,}", b2)
    print("::notice::КООРДИНАТЫ В СНИМКЕ: %s" % (m.group(0) if m else "НЕТ"))
