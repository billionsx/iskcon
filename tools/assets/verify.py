#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Гейт живости зеркал (ЗКН-Пл023): регулярно проверяет, что КАЖДЫЙ вынесенный класс
реально доступен на ОБОИХ зеркалах (archive.org + GitHub Releases). Бан аккаунта или
пропажа item обнаруживаются СРАЗУ — а не через полгода, когда преданный упрётся в
мёртвую ссылку.

Провал (нежёсткий по умолчанию): если хотя бы одно зеркало класса мертво — печатаем
::error и выходим с кодом 1 (в CI это красит прогон и шлёт уведомление). Оба зеркала
класса живы → ок. Пока манифест пуст — гейт зелёный (нечего проверять).

Сеть недоступна из песочницы — гоняется в CI (assets-verify.yml). Чистый парсер
проверяется `--selftest`.
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip() or "."
MANIFEST = os.path.join(ROOT, "docs", "assets", "manifest.jsonl")
UA = "ISKCON-ONE-LOVE-Assets/1.0 (+https://gaurangers.com)"


def read_manifest(path=None):
    p = path or MANIFEST
    rows = []
    if not os.path.exists(p):
        return rows
    with open(p, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except ValueError:
                pass
    return rows


def head_ok(url, timeout=45):
    """HEAD (с откатом на GET Range 0-0) — жив ли URL. archive.org отдаёт 302 на ноду."""
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method)
        req.add_header("User-Agent", UA)
        if method == "GET":
            req.add_header("Range", "bytes=0-0")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if r.status in (200, 206, 302, 301):
                    return True, r.status
        except urllib.error.HTTPError as e:
            if e.code in (200, 206, 302, 301, 403):  # 403 у IA иногда на HEAD — пробуем GET
                if method == "GET":
                    return False, e.code
                continue
            return False, e.code
        except (urllib.error.URLError, OSError) as e:
            last = getattr(e, "reason", e)
    return False, str(locals().get("last", "?"))


def verify(rows):
    dead = []
    for rec in rows:
        cls = rec.get("class", "?")
        for host, url in (("archive.org", rec.get("ia_url")), ("GitHub", rec.get("gh_url"))):
            if not url:
                dead.append((cls, host, "нет URL в манифесте"))
                continue
            ok, code = head_ok(url)
            mark = "✓" if ok else "✗"
            print("  %s %-10s %-24s %s (%s)" % (mark, host, cls, url, code))
            if not ok:
                dead.append((cls, host, "%s (%s)" % (url, code)))
    return dead


def selftest():
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "m.jsonl")
        with open(p, "w") as f:
            f.write(json.dumps({"class": "a", "ia_url": "x", "gh_url": "y"}) + "\n")
            f.write("\n")
            f.write("битая строка\n")
            f.write(json.dumps({"class": "b", "ia_url": "z", "gh_url": "w"}) + "\n")
        rows = read_manifest(p)
        assert len(rows) == 2 and rows[0]["class"] == "a", "read_manifest"
    assert read_manifest("/nope/none.jsonl") == [], "empty manifest ok"
    print("selftest OK")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        selftest()
        return
    rows = read_manifest()
    if not rows:
        print("::notice::манифест пуст — проверять нечего, гейт зелёный")
        return
    print("Проверка живости зеркал (%d классов):" % len(rows))
    dead = verify(rows)
    if dead:
        for cls, host, why in dead:
            print("::error title=Зеркало мертво::класс «%s» на %s: %s" % (cls, host, why))
        raise SystemExit(1)
    print("::notice::✓ все зеркала живы (%d классов × 2)" % len(rows))


if __name__ == "__main__":
    main()
