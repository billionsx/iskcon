#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
APPLE EYES · единая точка входа департамента.

  status    — сводка: источники, состояние дозора, iOS 27, стандарты
  crawl     — разведка (живая сеть или --fixtures для офлайна)
  ios27     — дозор iOS 27 по снимкам; --issue-on-detect открывает issue
  lint      — исполнительная власть по адаптеру проекта
  attach    — подключить департамент к новому проекту (создать адаптер)
  selftest  — батарея живых нарушений в обе стороны (ломаю → красный,
              чиню → зелёный). Гейт живёт вместе со своим тестом.

Только stdlib. Департамент обязан запускаться на голом python3 где угодно.
"""
import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BIN = Path(__file__).resolve().parent
ROOT = BIN.parent
sys.path.insert(0, str(BIN))
import crawler  # noqa: E402
import digest as digest_mod  # noqa: E402
import atlas as atlas_mod  # noqa: E402
import figkit as figkit_mod  # noqa: E402
import study as study_mod  # noqa: E402
import verify as verify_mod  # noqa: E402
import lint as lint_mod  # noqa: E402

IOS27 = re.compile(r"\b(?:iOS|iPadOS)\s*27\b")

# Мандат основателя дословно (23.07.2026). Суд валит сборку, если домен
# теряет статью конституции: ключ → якорь, обязанный жить в CONSTITUTION.md.
FOUNDER_MANDATE = {
    "кернинг": "Статья 7 · Кернинг", "шрифты": "Статья 8 · Шрифты",
    "цвета": "Статья 9 · Цвета", "отступы": "Статья 10 · Отступы",
    "иконки": "Статья 11 · Иконки", "плашки": "Статья 12 · Плашки",
    "Liquid Glass": "Статья 13 · Liquid Glass", "меню": "Статья 14 · Меню",
    "архитектура приложений": "Статья 15 · Архитектура",
    "blur": "Статья 16 · Blur", "многослойность": "Статья 17 · Многослойность",
    "opacity": "Статья 18 · Opacity", "свечение": "Статья 19 · Свечение",
    "тени": "Статья 20 · Тени", "анимация": "Статья 21 · Анимация",
    "кинетика": "Статья 22 · Кинетика", "жесты": "Статья 23 · Жесты",
    "вибрации": "Статья 24 · Вибрации", "надавливание": "Статья 25 · Надавливание",
    "кроссплатформенность": "Статья 26 · Кроссплатформенность",
    "суб-приложения": "Статья 27 · Суб-приложения",
    "градиенты": "Статья 28 · Градиенты", "геймификация": "Статья 29 · Геймификация",
    "рейтинги/отзывы": "Статья 30 · Рейтинги", "маркетинг": "Статья 31 · Маркетинг",
    "popup": "Статья 32 · Popup", "продукты-эталоны": "Статья 33 · Продукты",
    "UI/UX + HIG": "Статья 34 · UI/UX",
    "автономность": "Статья 46 · Переносимость",
    "самоулучшение без ИИ": "Статья 48 · Три контура",
    "iOS 27 автообновление": "Статья 40 · Рельсы",
    "полная документация developer.apple.com": "Статья 37.1 · Атлас",
    "кит Figma iOS 27": "Статья 36.1 · Кит",
    "динамика": "Статья 21.1 · Динамика", "эффекты": "Статья 22.1 · Эффекты",
}


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


# ─────────────────────────────── status ────────────────────────────────
def cmd_status(root: Path) -> int:
    reg = root / "registry"
    srcs = json.loads((reg / "sources.json").read_text(encoding="utf-8"))["sources"]
    st_f = reg / "state" / "watch-state.json"
    st = json.loads(st_f.read_text(encoding="utf-8")) if st_f.exists() else {}
    w = json.loads((reg / "state" / "ios27-watch.json").read_text(encoding="utf-8"))
    tk = json.loads((reg / "standards" / "tokens.json").read_text(encoding="utf-8"))
    snapped = sum(1 for s in st.values() if s.get("sha"))
    print(f"APPLE EYES · {_now()}")
    print(f"  источники: {len(srcs)} · снято снимков: {snapped} · база стандартов: {tk['base']}")
    print(f"  iOS 27: {'ОБНАРУЖЕН ' + w.get('first_seen', '') if w.get('detected') else 'дозор, не обнаружен'}")
    last = max((s.get("last_checked", "") for s in st.values()), default="—")
    print(f"  последний обход: {last}")
    return 0


# ─────────────────────────────── ios27 ─────────────────────────────────
def scan_ios27(root: Path) -> list:
    """Улики из снимков и состояния. Детерминированный текстовый дозор."""
    reg = root / "registry"
    ev = []
    for snap in sorted((reg / "snapshots").glob("*.txt")):
        t = snap.read_text(encoding="utf-8", errors="replace")
        for m in list(IOS27.finditer(t))[:3]:
            a, b = max(0, m.start() - 60), min(len(t), m.end() + 60)
            ev.append({"source": snap.stem, "match": m.group(0),
                       "context": re.sub(r"\s+", " ", t[a:b]).strip()})
    return ev


def _skeleton(node, trail=""):
    """Схема ios26.5 → каркас следующей базы: каждое ЧИСЛО становится 🕳
    с памяткой прежнего значения. Строки-пояснения и refs сохраняются как
    контекст. Автоматика разворачивает РЕЛЬСЫ — заполняют их только замеры."""
    if isinstance(node, dict):
        return {k: _skeleton(v, f"{trail}.{k}" if trail else k) for k, v in node.items()}
    if isinstance(node, list):
        if node and all(isinstance(x, (int, float)) for x in node):
            return f"🕳 замерить (ios26: {node})"
        return [_skeleton(x, trail) for x in node]
    if isinstance(node, bool) or node is None:
        return node
    if isinstance(node, (int, float)):
        return f"🕳 замерить (ios26: {node})"
    return node


MANDATE_DOMAINS = [
    "кернинг/трекинг", "шрифты/роли", "цвета/поверхности", "отступы (⅓pt, сетки нет)",
    "иконки/SF Symbols", "плашки/чипы", "Liquid Glass/материал", "меню", "архитектура/суб-приложения",
    "blur/многослойность", "opacity", "свечение/тени", "анимация/кинетика", "жесты",
    "вибрации/haptics", "надавливание/press", "кроссплатформенность", "градиенты",
    "геймификация/рейтинги/отзывы", "маркетинг/popup", "продукты-эталоны (12)",
]


def scaffold_ios27(root: Path, first_seen: str) -> None:
    """Каркас смены базы: tokens.next.json (все числа 🕳) + MIGRATION.md.
    Идемпотентно: существующий каркас не перезаписывается — в нём живут замеры."""
    proto = root / "registry" / "standards" / "ios27"
    proto.mkdir(parents=True, exist_ok=True)
    nxt = proto / "tokens.next.json"
    if not nxt.exists():
        tok_f = root / "registry" / "standards" / "tokens.json"
        if not tok_f.exists():
            tok_f = ROOT / "registry" / "standards" / "tokens.json"  # переносимость: каркас всегда от измеренной базы департамента
        base = json.loads(tok_f.read_text(encoding="utf-8"))
        sk = _skeleton(base)
        sk["base"] = "ios27-dark (КАРКАС: ни одно 🕳 не закрыто — база НЕ действует, Д028)"
        sk["_рельсы"] = ("создано дозором " + first_seen + "; заполняется только конвейером "
                         "intake → инструменты → храповик; перенос чисел из ios26 запрещён")
        nxt.write_text(json.dumps(sk, ensure_ascii=False, indent=1), encoding="utf-8")
    mig = proto / "MIGRATION.md"
    if not mig.exists():
        mig.write_text(
            f"# iOS 27 · МИГРАЦИЯ БАЗЫ · каркас развёрнут {first_seen}\n\n"
            "Правило одно: домен закрыт, когда его числа стоят в `tokens.next.json` "
            "с адресами замеров. Знание дозора (`../../knowledge/`, домен ios27) — сырьё, не источник чисел.\n\n"
            "| Домен мандата | Статус |\n|---|---|\n"
            + "\n".join(f"| {d} | 🕳 |" for d in MANDATE_DOMAINS)
            + "\n\nЗакрытие: 🕳 → 📐 построчно; строка со статусом 🕳 не даёт переключить `base`.\n",
            encoding="utf-8")


def cmd_ios27(root: Path, issue: bool) -> int:
    reg = root / "registry"
    wf = reg / "state" / "ios27-watch.json"
    w = json.loads(wf.read_text(encoding="utf-8"))
    ev = scan_ios27(root)
    if ev and not w.get("detected"):
        w.update({"detected": True, "first_seen": _now(), "evidence": ev[:20]})
        proto = reg / "standards" / "ios27"
        proto.mkdir(parents=True, exist_ok=True)
        (proto / "DETECTED.md").write_text(
            f"# iOS 27 · ОБНАРУЖЕН {w['first_seen']}\n\n"
            "Дозор нашёл iOS 27 в официальных источниках Apple. Протокол смены базы (устав §5):\n\n"
            "1. Разведка уже сняла снимки — улики ниже; хроника в `../..//state/CHANGELOG.md`.\n"
            "2. Приём референсов: экраны iOS 27 кладутся как PDF — конвейер `ios26-intake` того же метода.\n"
            "3. ЗАМЕР, не перенос: ни одно число не попадает в tokens.json без адреса замера (ЗКН-Д028 —\n"
            "   правдоподобное число хуже отсутствующего). До замера база остаётся ios26.5, поле `base`\n"
            "   не переключается декларацией.\n"
            "4. Храповик только растёт: новые замеры добавляются, старые снимаются поправкой с объяснением.\n\n"
            "## Улики\n\n"
            + "\n".join(f"- `{e['source']}` · «…{e['context']}…»" for e in ev[:20]) + "\n",
            encoding="utf-8")
        print(f"iOS 27 ОБНАРУЖЕН · улик: {len(ev)} · протокол: registry/standards/ios27/DETECTED.md")
        scaffold_ios27(root, w["first_seen"])
    elif ev:
        w["evidence"] = ev[:20]
        scaffold_ios27(root, w.get("first_seen", _now()))
        print(f"iOS 27: подтверждён ранее ({w.get('first_seen')}) · улик сейчас: {len(ev)}")
    else:
        print("iOS 27: не обнаружен")
    w["last_scan"] = _now()

    if issue and w.get("detected") and not w.get("issue"):
        tok, repo = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY")
        if tok and repo:
            body = ("Дозор Apple Eyes обнаружил iOS 27 в официальных источниках.\n\n"
                    + "\n".join(f"- `{e['source']}` — «…{e['context']}…»" for e in w["evidence"][:10])
                    + "\n\nПротокол: `apple-eyes/registry/standards/ios27/DETECTED.md` (устав §5).")
            req = urllib.request.Request(
                f"https://api.github.com/repos/{repo}/issues",
                data=json.dumps({"title": "Apple Eyes · iOS 27 обнаружен — протокол смены базы",
                                 "body": body, "labels": ["apple-eyes"]}).encode(),
                headers={"Authorization": f"Bearer {tok}", "Accept": "application/vnd.github+json",
                         "User-Agent": crawler.UA})
            try:
                with urllib.request.urlopen(req, timeout=25) as r:
                    w["issue"] = json.loads(r.read()).get("number")
                    print(f"issue открыт: #{w['issue']}")
            except Exception as e:
                print(f"issue не открыт: {type(e).__name__} (не критично, протокол уже в репозитории)")
    wf.write_text(json.dumps(w, ensure_ascii=False, indent=1), encoding="utf-8")
    return 0


# ─────────────────────────────── ratchet ───────────────────────────────
def apply_ratchet(root: Path, adapter_name: str, res: dict, baseline_file: Path) -> int:
    """Храповик советника: долг по каждому правилу может только уменьшаться.
    Рост = красный даже в report-режиме; улучшение само ужимает базу."""
    counts = {r: 0 for r in res.get("rules", [])}   # ноль тоже база: первое нарушение нового правила = рост
    for r, *_ in res["findings"]:
        counts[r] = counts.get(r, 0) + 1
    base = json.loads(baseline_file.read_text(encoding="utf-8")) if baseline_file.exists() else {}
    mine = base.get(adapter_name, {})
    worse = {r: (mine.get(r), counts.get(r, 0)) for r in set(mine) | set(counts)
             if r in mine and counts.get(r, 0) > mine[r]}
    if worse:
        for r, (b, n) in sorted(worse.items()):
            print(f"  ХРАПОВИК {r}: было {b} → стало {n} (долг растёт — красный)")
        return 1
    tightened = {r: n for r, n in counts.items() if mine.get(r, 10**9) > n}
    new_mine = {r: counts.get(r, 0) for r in sorted(set(mine) | set(counts))}
    if new_mine != mine:
        base[adapter_name] = new_mine
        baseline_file.write_text(json.dumps(base, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
        if tightened:
            print("  храповик ужат: " + " · ".join(f"{r}→{n}" for r, n in sorted(tightened.items())))
    return 0


# ─────────────────────────────── attach ────────────────────────────────
def cmd_attach(root: Path, project: str, report_glob: list, strict_glob: list) -> int:
    ad = {
        "project": project,
        "created": _now(),
        "pt_to_css_px": 1,
        "allow_extra": [],
        "sizes_extra": [],
        "report": {"globs": report_glob,
                   "rules": ["AE1", "AE2", "AE3", "AE4", "AE5", "AE6", "AE7", "AE8", "AE9", "AE10", "AE11", "AE12", "AE13"]},
        "strict": {"globs": strict_glob, "rules": ["AE2", "AE3", "AE4", "AE6", "AE7"]},
        "radius_extra": [],
        "_порядок": "новый проект начинает с report; правило переводится в strict, когда его долг = 0",
    }
    out = root / "adapters" / f"{project}.json"
    out.write_text(json.dumps(ad, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"адаптер создан: {out.relative_to(root)} · дальше: apple_eyes.py lint --adapter {project} --mode report")
    return 0


# ────────────────────────────── selftest ───────────────────────────────
def cmd_selftest(root: Path) -> int:
    """Каждый орган проверен на живом нарушении в обе стороны."""
    fx = root / "tests" / "fixtures"
    ok = True

    def check(name, cond):
        nonlocal ok
        print(("  ✓ " if cond else "  ✗ ") + name)
        ok = ok and cond

    print("SELFTEST · исполнительная власть (lint)")
    tokens = json.loads((root / "registry" / "standards" / "tokens.json").read_text(encoding="utf-8"))
    adapter = {"report": {}, "strict": {"globs": ["bad.css"], "rules": ["AE1", "AE2", "AE3", "AE4", "AE5", "AE6"]},
               "allow_extra": [], "sizes_extra": []}
    res_bad = lint_mod.run(root, adapter, tokens, "strict", fx)
    got = {r for r, *_ in res_bad["findings"]}
    check("ломаю → красный: bad.css даёт AE1..AE6", {"AE1", "AE2", "AE3", "AE4", "AE5", "AE6"} <= got)
    adapter["strict"]["globs"] = ["good.css"]
    res_good = lint_mod.run(root, adapter, tokens, "strict", fx)
    check("чиню → зелёный: good.css чист", not res_good["findings"])
    adapter["strict"]["globs"] = ["commented.css"]
    res_c = lint_mod.run(root, adapter, tokens, "strict", fx)
    check("комментарий срезан до проверки: нарушитель в /* */ не считается", not res_c["findings"])

    print("SELFTEST · разведка (crawler, офлайн)")
    tmp = Path(tempfile.mkdtemp(prefix="apple-eyes-"))
    try:
        reg = tmp / "registry"
        (reg / "state").mkdir(parents=True)
        (reg / "snapshots").mkdir()
        (reg / "sources.json").write_text(json.dumps({"sources": [
            {"id": "fixture-page", "url": "https://example.invalid/hig", "domains": ["материал"]}]}), encoding="utf-8")
        (reg / "state" / "CHANGELOG.md").write_text("# хроника\n", encoding="utf-8")
        fxdir = tmp / "fx"
        fxdir.mkdir()
        shutil.copy(fx / "page_v1.html", fxdir / "fixture-page.html")
        r1 = crawler.crawl(tmp, fixtures=fxdir)
        check("первый обход снимает снимок", r1["changed"] == ["fixture-page"])
        r2 = crawler.crawl(tmp, fixtures=fxdir)
        check("повторный обход без изменений молчит", r2["changed"] == [] and r2["unchanged"] == 1)
        shutil.copy(fx / "page_v2.html", fxdir / "fixture-page.html")
        r3 = crawler.crawl(tmp, fixtures=fxdir)
        log = (reg / "state" / "CHANGELOG.md").read_text(encoding="utf-8")
        check("живое изменение поймано и легло в хронику", r3["changed"] == ["fixture-page"] and "ИЗМЕНЕНИЕ" in log and "появились" in log)

        print("SELFTEST · дозор iOS 27")
        (reg / "state" / "ios27-watch.json").write_text('{"detected": false}', encoding="utf-8")
        check("чистый снимок → не обнаружен", scan_ios27(tmp) == [])
        shutil.copy(fx / "ios27_page.html", fxdir / "fixture-page.html")
        crawler.crawl(tmp, fixtures=fxdir)
        ev = scan_ios27(tmp)
        check("страница с iOS 27 → обнаружен с уликой", bool(ev) and "iOS 27" in ev[0]["match"])
        cmd_ios27(tmp, issue=False)
        w = json.loads((reg / "state" / "ios27-watch.json").read_text(encoding="utf-8"))
        check("протокол DETECTED.md создан, статус зафиксирован",
              w.get("detected") and (reg / "standards" / "ios27" / "DETECTED.md").exists())
        nxt_f = reg / "standards" / "ios27" / "tokens.next.json"
        mig_f = reg / "standards" / "ios27" / "MIGRATION.md"
        nxt = json.loads(nxt_f.read_text(encoding="utf-8"))
        flat = json.dumps(nxt, ensure_ascii=False)
        check("рельсы новой базы: каркас развёрнут, все числа 🕳, чисел ios26 без пометки нет",
              mig_f.exists() and "🕳" in flat
              and not re.search(r'":\s*\d', flat.replace('"level":', ""))
              and "НЕ действует" in str(nxt.get("base", "")))
        nxt_f.write_text(json.dumps({"base": "заполнено замером"}, ensure_ascii=False), encoding="utf-8")
        cmd_ios27(tmp, issue=False)
        check("каркас идемпотентен: замеры в нём не затираются",
              json.loads(nxt_f.read_text(encoding="utf-8"))["base"] == "заполнено замером")
        print("SELFTEST · разведка DocC (JS-скорлупа обходится данными)")
        shutil.copy(fx / "hig-fixture.json", fxdir / "fixture-page.json")
        (fxdir / "fixture-page.html").unlink()
        (reg / "state" / "watch-state.json").write_text("{}", encoding="utf-8")
        crawler.crawl(tmp, fixtures=fxdir)
        snap_t = (reg / "snapshots" / "fixture-page.txt").read_text(encoding="utf-8")
        st = json.loads((reg / "state" / "watch-state.json").read_text(encoding="utf-8"))
        check("DocC-JSON → полный текст и заголовки, маршрут записан",
              "## Best practices" in snap_t and "44x44 pt" in snap_t
              and st["fixture-page"].get("route") == "docc")

        print("SELFTEST · знание (digest)")
        r_d1 = digest_mod.build(tmp)
        kn = (reg / "knowledge" / "fixture-page.md").read_text(encoding="utf-8")
        check("нормативное извлечено, декоративное отброшено",
              "44x44 pt" in kn and "Avoid pairing" in kn and "Reduce Motion" in kn and "Decorative flourishes" not in kn)
        r_d2 = digest_mod.build(tmp)
        check("знание детерминировано: повторный прогон без изменений",
              r_d1["changed"] == ["fixture-page"] and r_d2["changed"] == []
              and (reg / "knowledge" / "INDEX.md").exists())

        print("SELFTEST · пробы iOS 27")
        (reg / "ios27-probes.json").write_text(json.dumps({"probes": [
            {"id": "probe-alive", "url": "https://example.invalid/a", "domains": ["ios27"]},
            {"id": "probe-dead", "url": "https://example.invalid/b", "domains": ["ios27"]}]}), encoding="utf-8")
        shutil.copy(fx / "probe-alive.html", fxdir / "probe-alive.html")
        rp = crawler.probe(tmp, fixtures=fxdir)
        ids = {s["id"] for s in json.loads((reg / "sources.json").read_text(encoding="utf-8"))["sources"]}
        check("живая проба завербована, мёртвая — нет",
              rp["enrolled"] == ["probe-alive"] and "probe-alive" in ids and "probe-dead" not in ids)
        rp2 = crawler.probe(tmp, fixtures=fxdir)
        check("вербовка идемпотентна", rp2["enrolled"] == [])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print("SELFTEST · исполнительная власть (AE7–AE11)")
    adapter = {"strict": {"globs": ["bad.css"], "rules": ["AE7", "AE8", "AE9", "AE10", "AE11", "AE12", "AE13"]},
               "allow_extra": [], "sizes_extra": [], "radius_extra": []}
    got7 = {r for r, *_ in lint_mod.run(root, adapter, tokens, "strict", fx)["findings"]}
    check("ломаю → красный: bad.css даёт AE7..AE13", {"AE7", "AE8", "AE9", "AE10", "AE11", "AE12", "AE13"} <= got7)
    adapter["strict"]["globs"] = ["good.css"]
    check("чиню → зелёный: good.css чист по AE7..AE13 (Reduce Motion уважен)",
          not lint_mod.run(root, adapter, tokens, "strict", fx)["findings"])
    adapter["strict"]["globs"] = ["commented.css"]
    check("нарушители AE7..AE13 в комментарии не считаются",
          not lint_mod.run(root, adapter, tokens, "strict", fx)["findings"])

    print("SELFTEST · храповик советника")
    tmp2 = Path(tempfile.mkdtemp(prefix="apple-eyes-r-"))
    try:
        bl = tmp2 / "baseline.json"
        res_w = {"rules": ["AE1", "AE9"], "findings": [("AE1", "f", 1, "x")] * 3}
        check("первый замер пишет базу и зелёный (ноль тоже прибит)",
              apply_ratchet(root, "t", res_w, bl) == 0
              and json.loads(bl.read_text())["t"] == {"AE1": 3, "AE9": 0})
        res_zero_worse = {"rules": ["AE1", "AE9"], "findings": [("AE1", "f", 1, "x")] * 3 + [("AE9", "f", 2, "y")]}
        check("нарушение правила с нулевой базой → красный",
              apply_ratchet(root, "t", res_zero_worse, bl) == 1)
        res_worse = {"rules": ["AE1", "AE9"], "findings": [("AE1", "f", 1, "x")] * 4}
        check("долг вырос → красный", apply_ratchet(root, "t", res_worse, bl) == 1)
        res_better = {"rules": ["AE1", "AE9"], "findings": [("AE1", "f", 1, "x")] * 2}
        check("долг упал → зелёный и база ужалась",
              apply_ratchet(root, "t", res_better, bl) == 0 and json.loads(bl.read_text())["t"]["AE1"] == 2)

        print("SELFTEST · подключение (attach)")
        proj = tmp2 / "proj"
        proj.mkdir()
        (proj / "a.css").write_text(".x{box-shadow:0 0 4px #000}", encoding="utf-8")
        ad_dir = tmp2 / "adapters"
        ad_dir.mkdir()
        real_ad = ROOT / "adapters"
        # attach пишет в root/adapters — используем временный root-скелет
        (tmp2 / "registry" / "standards").mkdir(parents=True)
        shutil.copy(root / "registry" / "standards" / "tokens.json",
                    tmp2 / "registry" / "standards" / "tokens.json")
        cmd_attach(tmp2, "demo", ["*.css"], [])
        ad = json.loads((tmp2 / "adapters" / "demo.json").read_text(encoding="utf-8"))
        res_att = lint_mod.run(tmp2, ad, tokens, "report", proj)
        check("адаптер создан и линт по нему видит долг",
              "AE7" in ad["report"]["rules"] and any(r == "AE2" for r, *_ in res_att["findings"]))
    finally:
        shutil.rmtree(tmp2, ignore_errors=True)

    print("SELFTEST · атлас (цикл документации: обе стороны)")
    import atlas as atlas_mod2
    tmpa = Path(tempfile.mkdtemp(prefix="apple-eyes-a-"))
    try:
        (tmpa / "registry" / "state").mkdir(parents=True)
        (tmpa / "registry" / "state" / "CHANGELOG.md").write_text("", encoding="utf-8")
        fxa = tmpa / "fx"; fxa.mkdir()
        (fxa / "documentation.json").write_text(json.dumps({
            "metadata": {"title": "Root"},
            "references": {"a": {"url": "/documentation/aaa"}, "b": {"url": "/documentation/bbb"}},
            "primaryContentSections": []}), encoding="utf-8")
        (fxa / "documentation__aaa.json").write_text(json.dumps({
            "metadata": {"title": "AAA"}, "references": {},
            "primaryContentSections": [{"content": [{"type": "paragraph", "inlineContent": [
                {"type": "text", "text": "Use a minimum tappable area of 44x44 pt for controls."}]}]}]}), encoding="utf-8")
        (fxa / "documentation__bbb.json").write_text(json.dumps({
            "metadata": {"title": "BBB"}, "references": {},
            "primaryContentSections": [{"content": [{"type": "paragraph", "inlineContent": [
                {"type": "text", "text": "A plain descriptive line without prescriptions."}]}]}]}), encoding="utf-8")
        r1 = atlas_mod2.step(tmpa, budget=1, fixtures=fxa)
        check("бюджет уважается: шаг 1 → пройдена 1, очередь выросла",
              r1["walked"] == 1 and r1["frontier"] == 2)
        r2 = atlas_mod2.step(tmpa, budget=10, fixtures=fxa)
        lib = (tmpa / "registry" / "library" / "aaa.jsonl")
        check("цикл сам раскрывает дерево и добывает закон в библиотеку",
              r2["walked"] == 2 and lib.exists() and "44x44" in lib.read_text(encoding="utf-8")
              and (tmpa / "registry" / "library" / "INDEX.md").exists())
        r3 = atlas_mod2.step(tmpa, budget=10, fixtures=fxa)
        check("фронтир пуст → второй круг переобхода, без ложных изменений",
              r3["walked"] == 3 and r3["changed"] == 0)
        (fxa / "documentation__aaa.json").write_text(json.dumps({
            "metadata": {"title": "AAA"}, "references": {},
            "primaryContentSections": [{"content": [{"type": "paragraph", "inlineContent": [
                {"type": "text", "text": "Use a minimum tappable area of 48x48 pt for controls."}]}]}]}), encoding="utf-8")
        r4 = atlas_mod2.step(tmpa, budget=10, fixtures=fxa)
        chg = (tmpa / "registry" / "state" / "CHANGELOG.md").read_text(encoding="utf-8")
        check("подмена страницы на круге → «закон изменился» в хронике",
              r4["changed"] == 1 and "закон изменился" in chg)
    finally:
        shutil.rmtree(tmpa, ignore_errors=True)

    print("SELFTEST · кит (разбор .sketch без аккаунтов)")
    import io, zipfile
    import figkit as figkit_mod2
    tmpk = Path(tempfile.mkdtemp(prefix="apple-eyes-k-"))
    try:
        (tmpk / "registry" / "state").mkdir(parents=True)
        (tmpk / "registry" / "state" / "CHANGELOG.md").write_text("", encoding="utf-8")
        fxk = tmpk / "fx"; fxk.mkdir()
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("document.json", json.dumps({
                "sharedSwatches": {"objects": [{"name": "System Red", "value": {"red": 1, "green": 0.231, "blue": 0.188, "alpha": 1}}]},
                "layerTextStyles": {"objects": [{"name": "Body/Regular", "value": {"textStyle": {"encodedAttributes": {
                    "MSAttributedStringFontAttribute": {"attributes": {"name": "SFPro-Regular", "size": 17}},
                    "kerning": -0.43,
                    "paragraphStyle": {"maximumLineHeight": 22}}}}}]}}))
            z.writestr("pages/p1.json", json.dumps({"name": "Controls", "layers": [
                {"_class": "symbolMaster", "name": "Button/Filled", "layers": [
                    {"_class": "rectangle", "name": "bg", "fixedRadius": 26, "points": []}]}]}))
        (fxk / "mini-kit.sketch").write_bytes(buf.getvalue())
        rk = figkit_mod2.run_sketch_arm(tmpk, fixtures=fxk)
        kj = json.loads((tmpk / "registry" / "standards" / "kit" / "fixture-kit-sketch.json").read_text(encoding="utf-8"))
        check("кит разобран: цвет, текст-стиль 17pt/22/-0.43, радиус 26, символ — с адресами kit:",
              rk["status"] == "извлечено"
              and kj["colors"]["System Red"]["value"] == "#FF3B30"
              and kj["text_styles"]["Body/Regular"]["size_pt"] == 17
              and kj["text_styles"]["Body/Regular"]["kerning"] == -0.43
              and "26.0" in kj["corner_radii"] and kj["symbols"] == ["Button/Filled"]
              and kj["colors"]["System Red"]["at"].startswith("kit:"))
    finally:
        shutil.rmtree(tmpk, ignore_errors=True)

    print("SELFTEST · конституция (ст. 45: полнота мандата машиной)")
    const_t = (root / "CONSTITUTION.md").read_text(encoding="utf-8")
    missing = [d for d, anchor in FOUNDER_MANDATE.items() if anchor not in const_t]
    check(f"каждый из {len(FOUNDER_MANDATE)} доменов мандата несёт статью", not missing)
    if missing:
        for d in missing:
            print(f"    ПОТЕРЯН: {d}")
    check("проверка живая: изъятие статьи было бы поймано",
          bool([d for d, a in FOUNDER_MANDATE.items()
                if a not in const_t.replace("Статья 24 · Вибрации", "")]) )
    check("числа кодекса совпадают с реестром: кнопка/чип/крышка/стекло/нажатие",
          all(s in const_t for s in ("32.0", "35.0", "±0.4", ".05", ".06", ".09",
                                     "383", "120", "2.5–2.6", "#1C1C1E", "#2C2C2E")))

    print("SELFTEST · изученность (study: обе стороны)")
    import study as study_mod2
    rs = study_mod2.run(root)
    check("все статьи кодекса изучены (замер/знание/🕳), не изучено 0",
          not rs["bad"] and rs["articles"] >= 30 and rs["knowledge"] > 1000)
    tmps = Path(tempfile.mkdtemp(prefix="apple-eyes-s-"))
    try:
        (tmps / "registry" / "state").mkdir(parents=True)
        (tmps / "registry" / "knowledge").mkdir()
        shutil.copy(root / "registry" / "sources.json", tmps / "registry" / "sources.json")
        bare = (root / "CONSTITUTION.md").read_text(encoding="utf-8").replace(
            "Дозор: `hig-split-views`, `hig-designing-for-ipados` (архитектура\nразделённых пространств).", "")
        bare = bare.replace("прецедент ЗКН-Д029", "прецедент")
        (tmps / "CONSTITUTION.md").write_text(bare, encoding="utf-8")
        check("статья без замера/знания/🕳 → НЕ ИЗУЧЕНО пойман",
              any("Суб-приложения" in b for b in study_mod2.run(tmps)["bad"]))
    finally:
        shutil.rmtree(tmps, ignore_errors=True)

    print("SELFTEST · сверка (verify: обе стороны)")
    import verify as verify_mod
    rv = verify_mod.run(root)
    check("живая сверка сходится: расхождений 0", rv["bad"] == 0 and rv["confirmed"] >= 3)
    tmpv = Path(tempfile.mkdtemp(prefix="apple-eyes-v-"))
    try:
        (tmpv / "registry" / "standards").mkdir(parents=True)
        (tmpv / "registry" / "state").mkdir()
        (tmpv / "registry" / "knowledge").mkdir()
        shutil.copy(root / "CONSTITUTION.md", tmpv / "CONSTITUTION.md")
        tk2 = json.loads((root / "registry" / "standards" / "tokens.json").read_text(encoding="utf-8"))
        tk2["geometry"]["button_height_pt"] = 33.0  # подделка: конституция говорит 32.0
        (tmpv / "registry" / "standards" / "tokens.json").write_text(
            json.dumps(tk2, ensure_ascii=False), encoding="utf-8")
        (tmpv / "registry" / "state" / "watch-state.json").write_text("{}", encoding="utf-8")
        (tmpv / "registry" / "knowledge" / "hig-buttons.md").write_text(
            "Нормативных положений: 1\n- Use at least 44x44 pt.\n", encoding="utf-8")
        rv2 = verify_mod.run(tmpv)
        check("подделка числа базы → РАСХОЖДЕНИЕ пойман (и в кодексе, и против 44×44)",
              rv2["bad"] >= 2)
    finally:
        shutil.rmtree(tmpv, ignore_errors=True)

    print("SELFTEST · оглавление DocC (topicSections → references)")
    import extractor as ex_mod
    idx_fx = json.dumps({"metadata": {"title": "HIG"},
                         "references": {"doc://a": {"title": "Buttons"}, "doc://b": {"title": "Sliders"}},
                         "topicSections": [{"title": "Components", "identifiers": ["doc://a", "doc://b"]}]})
    exd = ex_mod.extract_docc(idx_fx)
    check("индекс раскрыт: секция стала заголовком, страницы — строками",
          "Components" in exd["headings"] and "Buttons" in exd["text"] and "Sliders" in exd["text"])

    print("SELFTEST:", "ЗЕЛЁНЫЙ" if ok else "КРАСНЫЙ")
    return 0 if ok else 1


# ─────────────────────────────── main ──────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(prog="apple_eyes")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    c = sub.add_parser("crawl")
    c.add_argument("--fixtures")
    c.add_argument("--limit", type=int, default=0)
    i = sub.add_parser("ios27")
    i.add_argument("--issue-on-detect", action="store_true")
    ln = sub.add_parser("lint")
    ln.add_argument("--adapter", required=True)
    ln.add_argument("--mode", choices=["strict", "report"], default="report")
    ln.add_argument("--out")
    ln.add_argument("--ratchet", help="файл базы долга: рост = красный, улучшение ужимает базу")
    sub.add_parser("digest")
    sub.add_parser("verify")
    sub.add_parser("study")
    at = sub.add_parser("atlas")
    at.add_argument("--budget", type=int, default=700)
    kt = sub.add_parser("kit")
    kt.add_argument("--force", action="store_true")
    pr = sub.add_parser("probe")
    pr.add_argument("--fixtures")
    at = sub.add_parser("attach")
    at.add_argument("--project", required=True)
    at.add_argument("--report-glob", action="append", default=[])
    at.add_argument("--strict-glob", action="append", default=[])
    sub.add_parser("selftest")
    a = ap.parse_args()

    if a.cmd == "status":
        return cmd_status(ROOT)
    if a.cmd == "crawl":
        r = crawler.crawl(ROOT, fixtures=Path(a.fixtures) if a.fixtures else None, limit=a.limit)
        print(f"обход: {r['total']} источников · изменилось {len(r['changed'])} · без изменений {r['unchanged']} · ошибок {len(r['errors'])}")
        for sid in r["changed"]:
            print(f"  Δ {sid}")
        for sid, e in r["errors"]:
            print(f"  ! {sid}: {e}")
        return 0
    if a.cmd == "ios27":
        return cmd_ios27(ROOT, a.issue_on_detect)
    if a.cmd == "lint":
        rc = lint_mod.main(ROOT, a.adapter, a.mode, a.out)
        if a.ratchet:
            adapter = json.loads((ROOT / "adapters" / f"{a.adapter}.json").read_text(encoding="utf-8"))
            tokens = json.loads((ROOT / "registry" / "standards" / "tokens.json").read_text(encoding="utf-8"))
            res = lint_mod.run(ROOT, adapter, tokens, a.mode, ROOT.parent)
            rc = max(rc, apply_ratchet(ROOT, a.adapter, res, Path(a.ratchet)))
        return rc
    if a.cmd == "digest":
        r = digest_mod.build(ROOT)
        print(f"знание: источников {r['sources']} · обновлено выжимок {len(r['changed'])}")
        return 0
    if a.cmd == "verify":
        r = verify_mod.run(ROOT)
        print(f"сверка: строк {r['rows']} · подтверждено знанием {r['confirmed']} · расхождений {r['bad']}")
        return 1 if r["bad"] else 0
    if a.cmd == "study":
        r = study_mod.run(ROOT)
        print(f"изученность: статей {r['articles']} · замером {r['measured']} · знанием {r['known']} "
              f"(положений {r['knowledge']}) · 🕳 {r['holes']} · не изучено {len(r['bad'])}")
        return 1 if r["bad"] else 0
    if a.cmd == "atlas":
        r = atlas_mod.step(ROOT, budget=a.budget)
        print(f"атлас: пройдено {r['walked']} · очередь {r['frontier']} · всего {r['visited_total']} · "
              f"добыто {r['mined']} · изменилось {r['changed']} · библиотека {r['library']['total']} законов / {r['library']['frameworks']} фреймворков")
        return 0
    if a.cmd == "kit":
        r = figkit_mod.run_sketch_arm(ROOT, force=a.force)
        print("кит:", r["status"])
        for k in r.get("kits", []):
            print(f"  {k['kit']}: цветов {k['colors']} · текст-стилей {k['text_styles']} · радиусов {k['radii']} · символов {k['symbols']}")
        f = figkit_mod.run_figma_arm(ROOT)
        print("figma-рука:", f["status"])
        return 0
    if a.cmd == "probe":
        r = crawler.probe(ROOT, fixtures=Path(a.fixtures) if a.fixtures else None)
        print(f"пробы iOS 27: проверено {r['checked']} · завербовано {len(r['enrolled'])}"
              + (": " + ", ".join(r["enrolled"]) if r["enrolled"] else ""))
        return 0
    if a.cmd == "attach":
        return cmd_attach(ROOT, a.project, a.report_glob or ["src/**/*.css"], a.strict_glob or [])
    if a.cmd == "selftest":
        return cmd_selftest(ROOT)
    return 2


if __name__ == "__main__":
    sys.exit(main())
