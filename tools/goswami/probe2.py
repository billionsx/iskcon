#!/usr/bin/env python3
"""
probe2.py — РАЗВЕДКА goswami.ru, заход второй: сайт не SPA-с-API, а SSR-React.

Первый заход искал JSON-API и не нашёл ничего: все /api/* отвечают 404. Зато
главная отдаёт 243 КБ ГОТОВОГО HTML с react-helmet — значит состояние магазина
вшито в саму страницу (`window.__INITIAL_STATE__` и родня), а ссылки на mp3
стоят прямо в разметке (кнопка «Скачать»). Искать надо там, а не в API
(ЗКН-Пл010: «структуры нет» обычно значит «ищу не там»).

Проверяем разом:
  · встроенное состояние — все известные имена (__INITIAL_STATE__, __NUXT__, …);
  · любые ссылки на звук — .mp3/.m4a/.aac где угодно в HTML;
  · поддомен assets.goswami.ru — как устроены пути к файлам;
  · бандлы — с ДИАГНОСТИКОЙ (первый заход молча получил ноль);
  · sitemap — полностью, включая вложенные карты;
  · постраничная навигация каталога (?page= / ?p= / /page/N).

Только чтение. Без зависимостей.
"""
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
OUT = Path(os.getenv("PROBE_OUT") or (HERE.parent.parent / "docs" / "diagnostics" / "goswami-probe2.json"))
SITE = "https://goswami.ru"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def get(url: str, timeout=40):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/json,*/*",
        "Accept-Encoding": "gzip",
        "Accept-Language": "ru,en;q=0.8",
        "Referer": SITE + "/",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                try:
                    raw = gzip.decompress(raw)
                except Exception:
                    pass
            return r.status, raw.decode("utf-8", "replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, "", {}
    except Exception as e:
        return 0, f"ERR {type(e).__name__}: {e}", {}


def head(url: str):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA, "Referer": SITE + "/"})
    try:
        with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
            return r.status, dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as e:
        return 0, {"err": str(e)[:120]}


# ═══ встроенное состояние ════════════════════════════════════════════════════

STATE_NAMES = ["__INITIAL_STATE__", "__PRELOADED_STATE__", "__APP_STATE__", "__NUXT__",
               "__NEXT_DATA__", "__DATA__", "__STATE__", "initialState", "__REDUX_STATE__"]


def balanced(s: str, i: int):
    """Вырезает сбалансированный {...} начиная с i. Учитывает строки и экранирование."""
    if i >= len(s) or s[i] not in "{[":
        return None
    open_c, close_c = s[i], ("}" if s[i] == "{" else "]")
    depth, j, in_str, esc, q = 0, i, False, False, ""
    while j < len(s):
        c = s[j]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == q:
                in_str = False
        else:
            if c in "\"'":
                in_str, q = True, c
            elif c == open_c:
                depth += 1
            elif c == close_c:
                depth -= 1
                if depth == 0:
                    return s[i:j + 1]
        j += 1
    return None


def find_states(html: str):
    out = {}
    for name in STATE_NAMES:
        for m in re.finditer(re.escape(name) + r"\s*=\s*", html):
            blob = balanced(html, m.end())
            if not blob or len(blob) < 40:
                continue
            try:
                out[name] = json.loads(blob)
                break
            except Exception:
                out.setdefault(name + "_raw", blob[:1500])
    # <script type="application/json" id="...">
    for m in re.finditer(r'<script[^>]+type=["\']application/json["\'][^>]*>(.*?)</script>', html, re.S):
        try:
            out.setdefault("script_json", json.loads(m.group(1)))
        except Exception:
            pass
    return out


def deep_keys(obj, prefix="", acc=None, depth=0):
    if acc is None:
        acc = {}
    if depth > 5:
        return acc
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (dict, list)):
                deep_keys(v, key, acc, depth + 1)
            else:
                acc.setdefault(key, repr(v)[:140])
    elif isinstance(obj, list) and obj:
        acc.setdefault(prefix + "[len]", len(obj))
        deep_keys(obj[0], prefix + "[]", acc, depth + 1)
    return acc


AUDIO_RX = re.compile(r'["\'(\s]((?:https?://[^"\'\s)]+|/[^"\'\s)]*)\.(?:mp3|m4a|aac|ogg|mp4))["\')\s]', re.I)
ASSET_RX = re.compile(r'https?://assets\.goswami\.ru/[^"\'\s)<>]+', re.I)


def main():
    rep = {"site": SITE, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    # 1. Главная
    code, html, hdrs = get(SITE + "/")
    rep["home"] = {"code": code, "len": len(html), "ctype": hdrs.get("Content-Type")}
    st = find_states(html)
    rep["home_states"] = {k: (deep_keys(v) if not k.endswith("_raw") else v) for k, v in st.items()}
    rep["home_audio"] = sorted({m.group(1) for m in AUDIO_RX.finditer(html)})[:40]
    rep["home_assets"] = sorted(set(ASSET_RX.findall(html)))[:40]
    # ищем «Скачать» — в SSR у кнопки должен быть href
    rep["home_download_ctx"] = [html[max(0, m.start() - 400):m.start() + 120].replace("\n", " ")
                                for m in re.finditer(r"Скачать", html)][:3]

    # 2. Страница лекции
    code2, lec, _ = get(SITE + "/lecture/6016")
    rep["lecture"] = {"code": code2, "len": len(lec)}
    st2 = find_states(lec)
    rep["lecture_states"] = {k: (deep_keys(v) if not k.endswith("_raw") else v) for k, v in st2.items()}
    rep["lecture_audio"] = sorted({m.group(1) for m in AUDIO_RX.finditer(lec)})[:40]
    rep["lecture_assets"] = sorted(set(ASSET_RX.findall(lec)))[:40]
    # полный дамп состояния лекции — по нему строится карта полей
    for k, v in st2.items():
        if not k.endswith("_raw"):
            rep["lecture_state_full"] = v
            break

    # 3. Бандлы — с диагностикой (первый заход молча получил ноль)
    bundles = ["https://goswami.ru/static/bundle.72d094cf.js",
               "https://goswami.ru/static/vendor.e3dda9c5.chunk.js"]
    for m in re.finditer(r'(?:src|href)=["\']([^"\']+\.js)["\']', html):
        u = m.group(1)
        u = u if u.startswith("http") else SITE + ("" if u.startswith("/") else "/") + u
        if u not in bundles:
            bundles.append(u)
    rep["bundles"] = []
    for b in bundles[:6]:
        c, js, h = get(b, timeout=60)
        row = {"url": b, "code": c, "len": len(js)}
        if c == 200 and len(js) > 1000:
            row["api_paths"] = sorted({x for x in re.findall(r'["\'](/[a-z0-9_\-/]{3,60})["\']', js)
                                       if any(w in x for w in ("api", "lecture", "audio", "media", "download"))})[:60]
            row["hosts"] = sorted(set(re.findall(r'https?://[a-z0-9.\-]+goswami\.ru', js)))[:20]
            row["audio_hint"] = sorted({m.group(1) for m in AUDIO_RX.finditer(js)})[:20]
        else:
            row["head"] = js[:300]
        rep["bundles"].append(row)

    # 4. Карта сайта (вложенные карты тоже)
    c, sm, _ = get(SITE + "/sitemap.xml")
    rep["sitemap"] = {"code": c, "len": len(sm), "body": sm[:3000]}
    subs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", sm)
    rep["sitemap_locs"] = subs[:60]
    rep["sitemap_children"] = []
    for u in subs[:12]:
        if not u.endswith(".xml"):
            continue
        c2, s2, _ = get(u)
        locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", s2)
        rep["sitemap_children"].append({"url": u, "code": c2, "n": len(locs), "sample": locs[:8]})

    # 5. Пагинация каталога
    rep["paging"] = []
    for cand in ["/?page=2", "/?p=2", "/page/2", "/lectures?page=2", "/?offset=20", "/?skip=20"]:
        c3, h3, _ = get(SITE + cand)
        ids = sorted(set(re.findall(r"/lecture/(\d+)", h3)))
        rep["paging"].append({"url": cand, "code": c3, "len": len(h3), "n_ids": len(ids), "ids": ids[:8]})
        time.sleep(0.15)
    rep["home_ids"] = sorted(set(re.findall(r"/lecture/(\d+)", html)))[:60]

    # 6. Прямая проверка звука, если нашли ссылку
    cand = (rep["lecture_audio"] or rep["home_audio"] or [])
    rep["audio_head"] = []
    for u in cand[:4]:
        full = u if u.startswith("http") else SITE + u
        sc, hh = head(full)
        rep["audio_head"].append({"url": full, "code": sc,
                                  "type": hh.get("Content-Type"), "len": hh.get("Content-Length")})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")

    print("home:", rep["home"])
    print("состояния главной:", list(rep["home_states"]))
    print("состояния лекции :", list(rep["lecture_states"]))
    print("звук на лекции   :", rep["lecture_audio"][:6])
    print("assets на лекции :", rep["lecture_assets"][:6])
    print("id на главной    :", len(rep["home_ids"]))
    print("пагинация        :", [(p["url"], p["code"], p["n_ids"]) for p in rep["paging"]])
    print("sitemap          :", rep["sitemap"]["code"], rep["sitemap_locs"][:6])
    print("→", OUT, OUT.stat().st_size, "байт")
    return 0


if __name__ == "__main__":
    sys.exit(main())
