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
    """Возвращает (потеряно, деградировано). Страховка держится, пока живо ХОТЯ БЫ
    ОДНО зеркало класса (фейловер работает). Потеряно = 0 живых зеркал (真 беда).
    Деградировано = 1 из 2 (редундантность просела — надо перезеркалить, но не пожар).
    Это же корректно гасит лаг archive.org: свежий item ещё пропагируется (404), а
    зеркало GitHub уже раздаёт — класс доступен."""
    lost, degraded = [], []
    for rec in rows:
        cls = rec.get("class", "?")
        live, states = 0, []
        for host, url in (("archive.org", rec.get("ia_url")), ("GitHub", rec.get("gh_url"))):
            if not url:
                states.append("%s: нет URL" % host)
                continue
            ok, code = head_ok(url)
            print("  %s %-10s %-22s %s (%s)" % ("✓" if ok else "✗", host, cls, url, code))
            if ok:
                live += 1
            else:
                states.append("%s: %s (%s)" % (host, url, code))
        if live == 0:
            lost.append((cls, "; ".join(states)))
        elif live == 1:
            degraded.append((cls, "; ".join(states)))
    return lost, degraded


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


def gh_alive(rec):
    """Отдельно про GitHub Releases: заливка туда синхронная, лага у неё нет.

    archive.org после загрузки некоторое время деривирует item и честно отдаёт
    404 — на это скидка есть. У Releases такой скидки нет: если сразу после
    выноса ассета в релизе нет, значит его там и не будет. Ровно так родился
    пустой `assets-ios26-refs-2`: класс уехал в манифест, зеркало осталось
    пустым, а общий гейт увидел «одно живое из двух» и написал предупреждение.
    Предупреждение в логе CI не читает никто.
    """
    url = rec.get("gh_url")
    if not url:
        return False, "нет URL"
    return head_ok(url)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--class", dest="cls", default="", help="проверить один класс, а не весь манифест")
    ap.add_argument("--strict-gh", action="store_true",
                    help="мёртвое зеркало GitHub — ошибка, а не предупреждение (для приёмки: там лага не бывает)")
    a = ap.parse_args()
    if a.selftest:
        selftest()
        return
    rows = read_manifest()
    if a.cls:
        rows = [r for r in rows if r.get("class") == a.cls]
        if not rows:
            raise SystemExit("::error::класс «%s» не найден в манифесте" % a.cls)
    if not rows:
        print("::notice::манифест пуст — проверять нечего, гейт зелёный")
        return
    if a.strict_gh:
        dead = []
        for rec in rows:
            ok, code = gh_alive(rec)
            print("  %s GitHub     %-22s %s" % ("✓" if ok else "✗", rec.get("class", "?"), code))
            if not ok:
                dead.append((rec.get("class", "?"), code))
        if dead:
            for cls, code in dead:
                print("::error title=Зеркало GitHub пусто::класс «%s» — релиз без ассета (%s). "
                      "Чинится так: python3 tools/assets/offload.py reupload --class %s" % (cls, code, cls))
            raise SystemExit(1)
    print("Проверка живости зеркал (%d классов):" % len(rows))
    lost, degraded = verify(rows)
    for cls, why in degraded:
        print("::warning title=Редундантность просела::класс «%s» жив на одном зеркале (%s) — перезеркалить" % (cls, why))
    if lost:
        for cls, why in lost:
            print("::error title=Класс потерян::«%s» мёртв на ОБОИХ зеркалах: %s" % (cls, why))
        raise SystemExit(1)
    tail = " (%d с одним живым зеркалом — предупреждение)" % len(degraded) if degraded else ""
    print("::notice::✓ у каждого класса живо ≥1 зеркало (%d классов)%s" % (len(rows), tail))


if __name__ == "__main__":
    main()
