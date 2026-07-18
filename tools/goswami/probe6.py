#!/usr/bin/env python3
"""
probe6.py — РАЗВЕДКА goswami.ru, заход шестой: вычерпываем схему подсказками.

Интроспекция закрыта («introspection is not allowed by Apollo Server»), но сервер
всё равно рассказывает о себе: на неизвестное поле graphql-js отвечает

    Cannot query field "lectures" on type "Query". Did you mean "getUsers"?

и перечисляет БЛИЖАЙШИЕ настоящие имена. Уже так вышли `getUsers`, `getVacncies`,
`getCollections`, `getZeroCollections`, `getCollectionsForAdmin`, `searchTags` —
видно и соглашение об именах (`getXxx`), и опечатку автора («Vacncies»).

Отсюда обход в ширину: каждое найденное имя порождает соседей (выбрось букву,
поменяй букву, переставь), соседи спрашиваются, ответ даёт новые имена — и так
пока схема не перестанет прирастать. То же самое делается для ПОЛЕЙ ТИПА
(`{getX{zz}}` → подсказки полей) и для АРГУМЕНТОВ (`{getX(zz:1)}`).

Только чтение, но запросов много — между ними пауза, и общий бюджет ограничен.
"""
import gzip
import json
import os
import re
import ssl
import string
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
OUT = Path(os.getenv("PROBE_OUT") or (HERE.parent.parent / "docs" / "diagnostics" / "goswami-probe6.json"))
GQL = "https://api.goswami.ru/graphql"
SITE = "https://goswami.ru"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
BUDGET = float(os.getenv("PROBE_BUDGET_MIN") or 22) * 60
PAUSE = float(os.getenv("PROBE_PAUSE") or 0.05)
START = time.time()
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

CALLS = [0]


def http(url, data=None, timeout=45):
    headers = {"User-Agent": UA, "Accept": "application/json, */*", "Accept-Encoding": "gzip",
               "Origin": SITE, "Referer": SITE + "/"}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=body, headers=headers, method="POST" if data else "GET")

    def dec(h, raw):
        if (h or {}).get("Content-Encoding") == "gzip" or raw[:2] == b"\x1f\x8b":
            try:
                raw = gzip.decompress(raw)
            except Exception:
                pass
        return raw.decode("utf-8", "replace")
    try:
        with urllib.request.urlopen(r, timeout=timeout, context=CTX) as resp:
            t = dec(dict(resp.headers), resp.read())
            try:
                return resp.status, json.loads(t)
            except Exception:
                return resp.status, t
    except urllib.error.HTTPError as e:
        try:
            t = dec(dict(e.headers or {}), e.read())
        except Exception:
            t = ""
        try:
            return e.code, json.loads(t)
        except Exception:
            return e.code, t[:2000]
    except Exception as e:
        return 0, f"ERR {type(e).__name__}: {e}"[:160]


def gq(q):
    CALLS[0] += 1
    time.sleep(PAUSE)
    return http(GQL, {"query": q})


def msgs(payload):
    if isinstance(payload, dict):
        return [e.get("message", "") for e in (payload.get("errors") or [])]
    return [payload[:500]] if isinstance(payload, str) else []


SUGGEST_RX = re.compile(r"Did you mean\s+(.+?)\?", re.S)
QUOTED_RX = re.compile(r'"([A-Za-z_][A-Za-z0-9_]*)"')


def suggest(ms):
    out = set()
    for m in ms:
        for s in SUGGEST_RX.findall(m):
            out |= set(QUOTED_RX.findall(s))
    return out


def neighbors(name: str):
    """Соседи имени — ими вылавливаются братья по схеме."""
    out = set()
    if len(name) > 3:
        for i in range(len(name)):
            out.add(name[:i] + name[i + 1:])                       # выбросить букву
        for i in range(len(name) - 1):
            out.add(name[:i] + name[i + 1] + name[i] + name[i + 2:])  # переставить
    for c in string.ascii_lowercase:
        out.add(name + c)
        if len(name) > 3:
            out.add(name[:-1] + c)
    return {x for x in out if 2 < len(x) < 40 and x != name}


def over():
    return time.time() - START > BUDGET


# ═══ ОБХОД КОРНЕВЫХ ПОЛЕЙ ════════════════════════════════════════════════════

def crawl_root(rep):
    known, probed = set(), set()
    queue = []
    seeds = ["getLectures", "getLecture", "getLecturesList", "getAllLectures", "getLectureById",
             "getUsers", "getVacncies", "getCollections", "getZeroCollections", "searchTags",
             "getCategories", "getScriptures", "getLocations", "getTags", "getFiles", "getAudio",
             "getMain", "getIndex", "getList", "getItems", "getData", "getInfo", "getPreset",
             "getPresetValues", "getFilters", "getSearch", "search", "lectures", "getVideo",
             "getPlaylist", "getPanel", "getTimeMachine", "getSitemap", "getStat", "getCount"]
    seeds += ["get" + c.upper() for c in string.ascii_lowercase]
    seeds += ["get" + c.upper() + d for c in "lcsagptvmuobrfdkeni" for d in ("e", "a", "o", "i", "u")]
    queue.extend(seeds)

    while queue and not over():
        name = queue.pop(0)
        if name in probed:
            continue
        probed.add(name)
        code, payload = gq("{%s{zzqqzz}}" % name)
        ms = msgs(payload)
        j = " ".join(ms)
        if f'Cannot query field "{name}" on type "Query"' not in j:
            known.add(name)
            for n in neighbors(name):
                if n not in probed:
                    queue.append(n)
        for s in suggest(ms):
            if s not in known:
                known.add(s)
                for n in neighbors(s):
                    if n not in probed:
                        queue.append(n)
                if s not in probed:
                    queue.insert(0, s)
        if CALLS[0] % 120 == 0:
            print(f"  … запросов {CALLS[0]}, найдено {len(known)}, очередь {len(queue)}", flush=True)
    rep["root_fields"] = sorted(known)
    rep["root_probed"] = len(probed)
    return sorted(known)


# ═══ ПОЛЯ ТИПА И АРГУМЕНТЫ ═══════════════════════════════════════════════════

def crawl_type(field: str, rep):
    """Поля возвращаемого типа — тем же способом."""
    info = {"field": field}
    code, payload = gq("{%s{zzqqzz}}" % field)
    ms = msgs(payload)
    j = " ".join(ms)
    info["needs_args"] = "argument" in j.lower() and "required" in j.lower()
    info["scalar"] = "must not have a selection" in j
    info["raw"] = [m[:400] for m in ms[:3]]
    if info["scalar"]:
        code, payload = gq("{%s}" % field)
        info["value"] = json.dumps(payload, ensure_ascii=False)[:1200]
        return info

    subs, probed, queue = set(), set(), list(suggest(ms))
    queue += ["id", "title", "name", "date", "url", "file", "file_url", "audio", "video",
              "video_url", "duration", "total", "items", "list", "lectures", "category",
              "scripture", "location", "tags", "teaser", "description", "image", "slug",
              "createdAt", "published", "size", "collection", "author", "place", "year"]
    while queue and not over():
        s = queue.pop(0)
        if s in probed:
            continue
        probed.add(s)
        code, payload = gq("{%s{%s}}" % (field, s))
        m2 = msgs(payload)
        jj = " ".join(m2)
        if not m2:
            subs.add(s)
            continue
        if "Cannot query field" not in jj:
            subs.add(s)
        for x in suggest(m2):
            if x not in probed and x not in queue:
                queue.append(x)
                subs.add(x)
    info["subfields"] = sorted(subs)

    # аргументы
    code, payload = gq("{%s(zzqqzz:1){id}}" % field)
    info["args_hint"] = [m[:400] for m in msgs(payload)[:3]]
    return info


def main():
    rep = {"gql": GQL, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    print("обход корневых полей…", flush=True)
    roots = crawl_root(rep)
    print("КОРНЕВЫЕ ПОЛЯ:", roots, flush=True)

    interesting = [r for r in roots if not r.lower().endswith("foradmin")]
    prio = [r for r in interesting if re.search(r"lect|collect|categ|script|locat|tag|search|zero", r, re.I)]
    rest = [r for r in interesting if r not in prio]
    rep["types"] = []
    for f in (prio + rest)[:22]:
        if over():
            break
        print("  тип:", f, flush=True)
        rep["types"].append(crawl_type(f, rep))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    print("запросов всего:", CALLS[0])
    print("→", OUT, OUT.stat().st_size, "байт")
    for t in rep["types"]:
        print(f"  {t['field']}: scalar={t.get('scalar')} subs={(t.get('subfields') or [])[:14]}")
        if t.get("args_hint"):
            print("      args:", t["args_hint"][0][:200])
    return 0


if __name__ == "__main__":
    sys.exit(main())
