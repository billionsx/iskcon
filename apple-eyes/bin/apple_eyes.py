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
import lint as lint_mod  # noqa: E402

IOS27 = re.compile(r"\b(?:iOS|iPadOS)\s*27\b")


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
    elif ev:
        w["evidence"] = ev[:20]
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


# ─────────────────────────────── attach ────────────────────────────────
def cmd_attach(root: Path, project: str, report_glob: list, strict_glob: list) -> int:
    ad = {
        "project": project,
        "created": _now(),
        "pt_to_css_px": 1,
        "allow_extra": [],
        "sizes_extra": [],
        "report": {"globs": report_glob, "rules": ["AE1", "AE2", "AE3", "AE4", "AE5", "AE6"]},
        "strict": {"globs": strict_glob, "rules": ["AE2", "AE3", "AE4", "AE6"]},
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
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

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
        return lint_mod.main(ROOT, a.adapter, a.mode, a.out)
    if a.cmd == "attach":
        return cmd_attach(ROOT, a.project, a.report_glob or ["src/**/*.css"], a.strict_glob or [])
    if a.cmd == "selftest":
        return cmd_selftest(ROOT)
    return 2


if __name__ == "__main__":
    sys.exit(main())
