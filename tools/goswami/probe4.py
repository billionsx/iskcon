#!/usr/bin/env python3
"""
probe4.py — РАЗВЕДКА goswami.ru, заход четвёртый: API оказался GraphQL.

Три захода искали REST — и все 404 были честными: REST-а нет. В бандле лежит
Apollo (`graphQLErrors`, `networkError`, `operation`, `forward`), а значит вся
выдача идёт одним адресом `/graphql`. Заодно в бандле виден один настоящий REST:

    GET https://api.goswami.ru/jira/import/<offset>/<limit>  →  {lectures, total}

Это прямой постраничный список лекций — им и меряется размер базы.

Здесь проверяем разом:
  1. `/jira/import/0/10` — список, поля, общее число;
  2. интроспекция `/graphql` — полная схема (типы, поля, аргументы);
  3. если интроспекция закрыта — вытаскиваем тексты запросов из самого бандла
     (graphql-tag оставляет их в `loc.source.body` либо узлами AST).

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
OUT = Path(os.getenv("PROBE_OUT") or (HERE.parent.parent / "docs" / "diagnostics" / "goswami-probe4.json"))
API = "https://api.goswami.ru"
SITE = "https://goswami.ru"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def req(url, data=None, timeout=60):
    headers = {"User-Agent": UA, "Accept": "application/json, */*", "Accept-Encoding": "gzip",
               "Origin": SITE, "Referer": SITE + "/"}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=body, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(r, timeout=timeout, context=CTX) as resp:
            raw = resp.read()
            if resp.headers.get("Content-Encoding") == "gzip":
                try:
                    raw = gzip.decompress(raw)
                except Exception:
                    pass
            txt = raw.decode("utf-8", "replace")
            try:
                return resp.status, json.loads(txt)
            except Exception:
                return resp.status, txt
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read().decode("utf-8", "replace")[:900]
        except Exception:
            return e.code, None
    except Exception as e:
        return 0, f"ERR {type(e).__name__}: {e}"[:200]


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
                acc.setdefault(key, repr(v)[:160])
    elif isinstance(obj, list) and obj:
        acc.setdefault(prefix + "[len]", len(obj))
        deep_keys(obj[0], prefix + "[]", acc, depth + 1)
    return acc


INTROSPECT = """
query IntrospectionQuery {
  __schema {
    queryType { name }
    types {
      kind name
      fields(includeDeprecated: true) {
        name
        args { name type { kind name ofType { kind name ofType { kind name } } } }
        type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
      }
    }
  }
}
"""


def type_str(t):
    if not t:
        return "?"
    if t.get("name"):
        return t["name"] + ("!" if t.get("kind") == "NON_NULL" else "")
    inner = type_str(t.get("ofType"))
    return f"[{inner}]" if t.get("kind") == "LIST" else inner


def main():
    rep = {"api": API, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    # ═══ 1. REST-список ═══
    rep["jira"] = []
    for path in ["/jira/import/0/10", "/jira/import/0/100", "/jira/import/10/10"]:
        code, payload = req(API + path)
        row = {"url": API + path, "code": code}
        if isinstance(payload, dict):
            row["keys"] = list(payload)
            row["total"] = payload.get("total")
            lec = payload.get("lectures")
            if isinstance(lec, list):
                row["n"] = len(lec)
                row["item_keys"] = deep_keys(lec[0]) if lec else {}
                row["sample"] = lec[:2]
        elif isinstance(payload, str):
            row["head"] = payload[:400]
        rep["jira"].append(row)
        time.sleep(0.2)

    # ═══ 2. GraphQL ═══
    rep["gql_endpoints"] = []
    live = None
    for p in ["/graphql", "/api/graphql", "/gql", "/query", "/graphql/"]:
        code, payload = req(API + p, {"query": "{__typename}"})
        row = {"url": API + p, "code": code,
               "body": (json.dumps(payload, ensure_ascii=False)[:300] if not isinstance(payload, str) else payload[:300])}
        rep["gql_endpoints"].append(row)
        if code == 200 and isinstance(payload, dict) and "data" in payload:
            live = API + p
        time.sleep(0.15)
    rep["gql_live"] = live

    if live:
        code, payload = req(live, {"query": INTROSPECT, "operationName": "IntrospectionQuery"})
        rep["introspection_code"] = code
        if isinstance(payload, dict) and payload.get("data", {}).get("__schema"):
            types = payload["data"]["__schema"]["types"]
            rep["query_type"] = payload["data"]["__schema"]["queryType"]["name"]
            schema = {}
            for t in types:
                if not t.get("name") or t["name"].startswith("__") or not t.get("fields"):
                    continue
                schema[t["name"]] = [
                    {"name": f["name"], "type": type_str(f["type"]),
                     "args": [f"{a['name']}: {type_str(a['type'])}" for a in (f.get("args") or [])]}
                    for f in t["fields"]
                ]
            rep["schema"] = schema
            rep["schema_types"] = sorted(schema)
        else:
            rep["introspection_error"] = json.dumps(payload, ensure_ascii=False)[:900] if not isinstance(payload, str) else payload[:900]

    # ═══ 3. Тексты запросов из бандла (если интроспекция закрыта) ═══
    code, js = req("https://goswami.ru/static/bundle.72d094cf.js", timeout=120)
    if isinstance(js, str) and len(js) > 1000:
        bodies = re.findall(r'body:\s*"((?:[^"\\]|\\.){40,2600})"', js)
        rep["gql_bodies"] = [b.encode().decode("unicode_escape", "replace")[:2200]
                             for b in bodies if re.search(r"\b(query|mutation)\b", b)][:40]
        names = re.findall(r'kind:"Name",value:"([A-Za-z_][A-Za-z0-9_]*)"', js)
        seen, ordered = set(), []
        for n in names:
            if n not in seen:
                seen.add(n)
                ordered.append(n)
        rep["gql_names"] = ordered[:400]
        rep["rest_calls"] = sorted(set(re.findall(r'"(/[a-z0-9_\-/]{3,60})"', js)))[:300]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")

    print("--- REST /jira/import ---")
    for r in rep["jira"]:
        print(f"  {r['code']} {r['url']} total={r.get('total')} n={r.get('n')} keys={r.get('keys')}")
    print("--- GraphQL ---")
    for r in rep["gql_endpoints"]:
        print(f"  {r['code']} {r['url']} {r['body'][:140]}")
    print("live:", rep.get("gql_live"), "introspection:", rep.get("introspection_code"))
    print("типы схемы:", (rep.get("schema_types") or [])[:40])
    print("текстов запросов из бандла:", len(rep.get("gql_bodies") or []))
    print("→", OUT, OUT.stat().st_size, "байт")
    return 0


if __name__ == "__main__":
    sys.exit(main())
