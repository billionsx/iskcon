#!/usr/bin/env python3
"""
probe5.py — РАЗВЕДКА goswami.ru, заход пятый: вскрываем схему GraphQL.

Что известно: живая точка — `https://api.goswami.ru/graphql`. Интроспекция
ответила 400, но ПРОЧИТАТЬ ответ не удалось: тело ошибки пришло gzip-ом, а
обработчик ошибок его не распаковывал — на экране был мусор. Это ровно та
ситуация, когда «источник молчит» означает «я не открыл конверт».

Здесь:
  1. распаковка тел ОШИБОК тоже (иначе диагноз строится на мусоре);
  2. интроспекция — полная и урезанная, POST и GET;
  3. если интроспекция закрыта — **добыча по подсказкам**: GraphQL на неизвестное
     поле отвечает «Cannot query field "zzz" on type "Query". Did you mean …?» и
     сам перечисляет допустимые имена. Ошибка — это тоже документация;
  4. рекурсивный обход: корневые поля → их типы → поля типов;
  5. все чанки бандла, а не один файл.

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
OUT = Path(os.getenv("PROBE_OUT") or (HERE.parent.parent / "docs" / "diagnostics" / "goswami-probe5.json"))
GQL = "https://api.goswami.ru/graphql"
SITE = "https://goswami.ru"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def _decode(resp_headers, raw):
    if (resp_headers or {}).get("Content-Encoding") == "gzip" or raw[:2] == b"\x1f\x8b":
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
    return raw.decode("utf-8", "replace")


def http(url, data=None, timeout=60, method=None):
    headers = {"User-Agent": UA, "Accept": "application/json, */*", "Accept-Encoding": "gzip",
               "Origin": SITE, "Referer": SITE + "/"}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=body, headers=headers, method=method or ("POST" if data else "GET"))
    try:
        with urllib.request.urlopen(r, timeout=timeout, context=CTX) as resp:
            txt = _decode(dict(resp.headers), resp.read())
            try:
                return resp.status, json.loads(txt)
            except Exception:
                return resp.status, txt
    except urllib.error.HTTPError as e:
        try:
            txt = _decode(dict(e.headers or {}), e.read())   # ← конверт открываем и у ошибки
        except Exception:
            txt = ""
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt[:2500]
    except Exception as e:
        return 0, f"ERR {type(e).__name__}: {e}"[:200]


def gq(query, variables=None):
    return http(GQL, {"query": query, **({"variables": variables} if variables else {})})


def errs(payload):
    if isinstance(payload, dict):
        return [e.get("message", "") for e in (payload.get("errors") or [])]
    if isinstance(payload, str):
        return [payload[:600]]
    return []


SUGGEST_RX = re.compile(r'Did you mean\s+(.+?)\?', re.S)
QUOTED_RX = re.compile(r'"([A-Za-z_][A-Za-z0-9_]*)"')


def suggestions(messages):
    out = set()
    for m in messages:
        for s in SUGGEST_RX.findall(m):
            out |= set(QUOTED_RX.findall(s))
    return out


def probe_field_on(type_expr: str, rep_log: list):
    """Спрашиваем заведомо несуществующее поле — сервер сам перечислит настоящие."""
    q = type_expr.replace("@@", "zzqqzz")
    code, payload = gq(q)
    msgs = errs(payload)
    rep_log.append({"q": q[:180], "code": code, "errors": [m[:400] for m in msgs[:4]]})
    return suggestions(msgs), msgs, payload


INTROSPECT_FULL = """query I{__schema{queryType{name} types{kind name
 fields(includeDeprecated:true){name args{name type{kind name ofType{kind name ofType{kind name}}}}
 type{kind name ofType{kind name ofType{kind name ofType{kind name}}}}}}}}"""
INTROSPECT_MIN = "{__schema{queryType{name} types{name kind}}}"


def type_str(t):
    if not t:
        return "?"
    if t.get("name"):
        return t["name"]
    inner = type_str(t.get("ofType"))
    return f"[{inner}]" if t.get("kind") == "LIST" else inner


def main():
    rep = {"gql": GQL, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    # ═══ 1. Интроспекция ═══
    rep["introspection"] = []
    schema = None
    for name, q, meth in [("full-post", INTROSPECT_FULL, None), ("min-post", INTROSPECT_MIN, None)]:
        code, payload = gq(q)
        row = {"name": name, "code": code, "errors": [m[:300] for m in errs(payload)][:3]}
        if isinstance(payload, dict) and payload.get("data", {}).get("__schema"):
            row["ok"] = True
            schema = payload["data"]["__schema"]
        rep["introspection"].append(row)
        if schema:
            break
        time.sleep(0.2)

    if schema and schema.get("types"):
        types = {}
        for t in schema["types"]:
            if not t.get("name") or t["name"].startswith("__"):
                continue
            if t.get("fields"):
                types[t["name"]] = [{"name": f["name"], "type": type_str(f["type"]),
                                     "args": [f"{a['name']}:{type_str(a['type'])}" for a in (f.get("args") or [])]}
                                    for f in t["fields"]]
            else:
                types.setdefault(t["name"], [])
        rep["schema"] = types
        rep["query_type"] = (schema.get("queryType") or {}).get("name")
        print("ИНТРОСПЕКЦИЯ ОТКРЫТА. типов:", len(types))
    else:
        print("интроспекция закрыта — иду по подсказкам ошибок")

    # ═══ 2. Добыча по подсказкам ═══
    rep["discovery"] = []
    root, msgs, _ = probe_field_on("{@@}", rep["discovery"])
    rep["root_suggested"] = sorted(root)
    print("корневые подсказки:", sorted(root)[:40])

    # прицельные догадки — их подтверждает/отвергает сам сервер
    guesses = ["lectures", "lecture", "allLectures", "getLectures", "lectureList", "search",
               "searchLectures", "collections", "collection", "categories", "category",
               "scriptures", "scripture", "locations", "location", "presetValues", "presets",
               "audio", "files", "media", "total", "count", "list"]
    for g in sorted(root) + guesses:
        if any(d.get("field") == g for d in rep["discovery"] if isinstance(d, dict)):
            continue
        code, payload = gq("{%s{@@}}" % g if False else "{%s{zzqqzz}}" % g)
        m = errs(payload)
        joined = " ".join(m)
        row = {"field": g, "code": code, "errors": [x[:320] for x in m[:3]]}
        if "Cannot query field" in joined and f'"{g}"' in joined and "on type \"Query\"" in joined:
            row["exists"] = False
        else:
            row["exists"] = True
            row["subfields"] = sorted(suggestions(m))
            # поле без подсписка — скаляр: спросим напрямую
            if "must not have a selection" in joined or "must have a selection" in joined:
                row["note"] = joined[:300]
        rep["discovery"].append(row)
        time.sleep(0.12)

    alive = [d for d in rep["discovery"] if isinstance(d, dict) and d.get("exists")]
    rep["fields_alive"] = [d["field"] for d in alive]
    print("живые корневые поля:", rep["fields_alive"])

    # ═══ 3. Аргументы живых полей ═══
    rep["args"] = []
    for d in alive[:12]:
        f = d["field"]
        code, payload = gq("{%s(zzqqzz:1){zzqqzz}}" % f)
        m = errs(payload)
        rep["args"].append({"field": f, "errors": [x[:400] for x in m[:3]]})
        time.sleep(0.12)

    # ═══ 4. Все чанки бандла — тексты запросов ═══
    code, html = http(SITE + "/")
    chunks = []
    if isinstance(html, str):
        for m in re.finditer(r'(?:src|href)=["\']([^"\']+\.js)["\']', html):
            u = m.group(1)
            chunks.append(u if u.startswith("http") else SITE + ("" if u.startswith("/") else "/") + u)
    rep["chunks"] = chunks
    ops = []
    names = []
    for u in chunks[:8]:
        c, js = http(u, timeout=120)
        if not isinstance(js, str) or len(js) < 500:
            continue
        ops += [b for b in re.findall(r'"((?:query|mutation)\s(?:[^"\\]|\\.){20,2400})"', js)]
        names += re.findall(r'value:"([A-Za-z_][A-Za-z0-9_]*)"', js)
    seen, ordered = set(), []
    for n in names:
        if n not in seen:
            seen.add(n)
            ordered.append(n)
    rep["gql_ops"] = [o.encode().decode("unicode_escape", "replace")[:2000] for o in ops][:30]
    rep["ast_names"] = ordered[:500]
    print("текстов операций:", len(rep["gql_ops"]), "| AST-имён:", len(ordered))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    print("→", OUT, OUT.stat().st_size, "байт")
    return 0


if __name__ == "__main__":
    sys.exit(main())
