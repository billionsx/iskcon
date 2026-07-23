#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
APPLE EYES · орган чтения. HTML → структура без внешних библиотек.

Разведке не нужен «умный» парсер: нужен ДЕТЕРМИНИРОВАННЫЙ. Один и тот же
HTML обязан давать один и тот же хэш на любой машине — иначе хроника
изменений превращается в шум собственного инструмента (грабли Д028:
инструмент, который врёт, хуже отсутствующего).

Что извлекается:
  title       — <title>
  headings    — h1..h4 по порядку (несут структуру страницы Apple)
  text        — видимый текст, нормализованный (script/style/noscript/svg
                выброшены, пробелы схлопнуты)
  sha         — sha256 нормализованного текста; ETag страницы Apple меняется
                от CDN, текст — только от содержания.
"""
import hashlib
import re
from html.parser import HTMLParser

_SKIP = {"script", "style", "noscript", "template", "svg", "iframe"}
_HEAD = {"h1", "h2", "h3", "h4"}


class _Reader(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.headings = []
        self.chunks = []
        self._skip_depth = 0
        self._in_title = False
        self._head_tag = None
        self._head_buf = []

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP:
            self._skip_depth += 1
        elif tag == "title":
            self._in_title = True
        elif tag in _HEAD and self._skip_depth == 0:
            self._head_tag = tag
            self._head_buf = []

    def handle_endtag(self, tag):
        if tag in _SKIP and self._skip_depth > 0:
            self._skip_depth -= 1
        elif tag == "title":
            self._in_title = False
        elif tag in _HEAD and self._head_tag == tag:
            h = _norm(" ".join(self._head_buf))
            if h:
                self.headings.append(f"{tag}: {h}")
            self._head_tag = None

    def handle_data(self, data):
        if self._skip_depth:
            return
        if self._in_title:
            self.title += data
        if self._head_tag:
            self._head_buf.append(data)
        self.chunks.append(data)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def extract(html: str) -> dict:
    r = _Reader()
    try:
        r.feed(html)
        r.close()
    except Exception:
        pass  # битый HTML не роняет разведку — берём то, что успели
    text = _norm(" ".join(r.chunks))
    return {
        "title": _norm(r.title),
        "headings": r.headings,
        "text": text,
        "sha": hashlib.sha256(text.encode("utf-8")).hexdigest(),
    }


def heading_diff(old: list, new: list) -> dict:
    """Что появилось / исчезло на уровне заголовков — язык хроники."""
    o, n = set(old or []), set(new or [])
    return {
        "added": [h for h in new if h not in o][:12],
        "removed": [h for h in old if h not in n][:12],
    }
