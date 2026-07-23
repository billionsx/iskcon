#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
APPLE EYES · РАЗВЕДКА. Автономный дозор источников Apple — без ИИ.

Принципы (устав §3):
  ВЕЖЛИВОСТЬ  — robots.txt уважается; между запросами пауза; User-Agent
                называет себя и даёт контакт. Дозор ходит по короткому
                курируемому списку страниц, а не ползает по сайту.
  ЭКОНОМИЯ    — условные запросы (If-None-Match / If-Modified-Since):
                неизменившаяся страница стоит Apple один 304.
  ДЕТЕРМИНИЗМ — «изменилось» решает sha256 нормализованного ТЕКСТА
                (extractor.py), а не ETag: CDN меняет ETag от погоды.
  ХРОНИКА     — каждое изменение ложится тремя следами: state (хэш),
                snapshot (текст страницы), CHANGELOG (дата · источник ·
                домены мандата · дифф заголовков).
  ЖИВУЧЕСТЬ   — ошибка одного источника записывается и не роняет обход.

Офлайн-режим (--fixtures DIR) подменяет сеть файлами — на нём стоит
selftest: дозор проверен на живом изменении до выхода в поле.
"""
import json
import sys
import time
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extractor import extract, heading_diff  # noqa: E402

UA = "AppleEyes/1.0 (+https://github.com/billionsx/iskcon; standards change-watch; ceo@billionsx.com)"
TIMEOUT = 25
DELAY = 2.5
SNAP_CAP = 120_000  # знаков текста в снимке — хватает любой странице HIG


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _slug(sid: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "-" for c in sid)


class Robots:
    def __init__(self):
        self.cache = {}

    def allowed(self, url: str) -> bool:
        from urllib.parse import urlsplit
        host = "{0.scheme}://{0.netloc}".format(urlsplit(url))
        rp = self.cache.get(host)
        if rp is None:
            rp = urllib.robotparser.RobotFileParser()
            try:
                req = urllib.request.Request(host + "/robots.txt", headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=TIMEOUT) as f:
                    rp.parse(f.read().decode("utf-8", "replace").splitlines())
            except Exception:
                rp = None  # robots недоступен → консервативно разрешаем GET публичной страницы
            self.cache[host] = rp
        return True if rp is None else rp.can_fetch(UA, url)


def _fetch(url: str, prev: dict) -> tuple:
    """→ (status, html|None, etag, last_modified). status: 200/304/чис.код/'err:...'"""
    headers = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5"}
    if prev.get("etag"):
        headers["If-None-Match"] = prev["etag"]
    if prev.get("last_modified"):
        headers["If-Modified-Since"] = prev["last_modified"]
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            body = r.read(4_000_000).decode("utf-8", "replace")
            return 200, body, r.headers.get("ETag", ""), r.headers.get("Last-Modified", "")
    except urllib.error.HTTPError as e:
        if e.code == 304:
            return 304, None, prev.get("etag", ""), prev.get("last_modified", "")
        return e.code, None, "", ""
    except Exception as e:
        return f"err:{type(e).__name__}", None, "", ""


def crawl(root: Path, fixtures: Path = None, limit: int = 0, delay: float = DELAY) -> dict:
    reg = root / "registry"
    sources = json.loads((reg / "sources.json").read_text(encoding="utf-8"))["sources"]
    state_f = reg / "state" / "watch-state.json"
    state = json.loads(state_f.read_text(encoding="utf-8")) if state_f.exists() else {}
    snaps = reg / "snapshots"
    snaps.mkdir(parents=True, exist_ok=True)
    changelog = reg / "state" / "CHANGELOG.md"
    robots = Robots()
    if limit:
        sources = sources[:limit]

    changed, errors, unchanged = [], [], 0
    for src in sources:
        sid, url = src["id"], src["url"]
        prev = state.get(sid, {})
        if fixtures is not None:
            fx = fixtures / f"{_slug(sid)}.html"
            if not fx.exists():
                continue
            status, html, etag, lm = 200, fx.read_text(encoding="utf-8"), "", ""
        else:
            if not robots.allowed(url):
                errors.append((sid, "robots-disallow"))
                state[sid] = {**prev, "url": url, "last_checked": _now(), "note": "robots-disallow"}
                continue
            status, html, etag, lm = _fetch(url, prev)
            time.sleep(delay)

        rec = {"url": url, "last_checked": _now(),
               "etag": etag or prev.get("etag", ""), "last_modified": lm or prev.get("last_modified", "")}
        if status == 304:
            state[sid] = {**prev, **rec}
            unchanged += 1
            continue
        if status != 200:
            errors.append((sid, str(status)))
            state[sid] = {**prev, **rec, "note": str(status)}
            continue

        ex = extract(html)
        if ex["sha"] == prev.get("sha"):
            state[sid] = {**prev, **rec}
            unchanged += 1
            continue

        # ИЗМЕНЕНИЕ: снимок + хроника + состояние
        diff = heading_diff(prev.get("headings", []), ex["headings"])
        snap = snaps / f"{_slug(sid)}.txt"
        snap.write_text(
            f"# {ex['title'] or sid}\n# {url}\n# снято: {_now()}\n\n"
            + "\n".join("## " + h for h in ex["headings"]) + "\n\n"
            + ex["text"][:SNAP_CAP] + "\n",
            encoding="utf-8")
        first = "sha" not in prev
        entry = [f"### {_now()} · `{sid}`" + (" · первый снимок" if first else " · ИЗМЕНЕНИЕ"),
                 f"- {url}",
                 f"- домены мандата: {', '.join(src.get('domains', []) or ['—'])}"]
        if not first:
            if diff["added"]:
                entry.append("- появились: " + " · ".join(diff["added"]))
            if diff["removed"]:
                entry.append("- исчезли: " + " · ".join(diff["removed"]))
            entry.append(f"- объём текста: {prev.get('text_len', '?')} → {len(ex['text'])} зн.")
        with changelog.open("a", encoding="utf-8") as f:
            f.write("\n".join(entry) + "\n\n")
        state[sid] = {**rec, "sha": ex["sha"], "title": ex["title"],
                      "headings": ex["headings"][:60], "text_len": len(ex["text"]),
                      "last_changed": _now(), "domains": src.get("domains", [])}
        changed.append(sid)

    state_f.parent.mkdir(parents=True, exist_ok=True)
    state_f.write_text(json.dumps(state, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    return {"changed": changed, "unchanged": unchanged, "errors": errors, "total": len(sources)}
