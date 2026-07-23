#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
APPLE EYES · ИСПОЛНИТЕЛЬНАЯ ВЛАСТЬ. Переносимый линт измеренных стандартов.

Правила выведены из замеров (registry/standards/tokens.json — каждое число
несёт адрес, ЗКН-Д028), а не из вкуса. Комментарии срезаются ДО проверки:
в комментариях законно живут строки-нарушители (грабли гейтов ISKCON).

Правила:
  AE1 ПОВЕРХНОСТЬ  фон задаётся только измеренными ступенями поверхностей
                   (tokens.surfaces.allow + allow_extra адаптера). Ступени три,
                   а не «примерно тёмные»: #000000 → #1C1C1E → #2C2C2E.
  AE2 ТЕНЬ         box-shadow на чёрном холсте запрещён — в 217 кадрах тени
                   на #000 нет; глубину даёт ступень поверхности, не тень.
  AE3 УГОЛ         скругление > 12 pt требует формы суперэллипса в файле
                   (clip-path:path(...) или corner-shape) — дуга border-radius
                   проиграла замер во всех девяти продуктах (§4.2).
  AE4 ТРЕКИНГ      letter-spacing в px не превышает ±0.4 (жёсткая крышка
                   поправки трекинга); значения в em принадлежат РОЛИ и
                   правилом не трогаются (Д028: трекинг у Apple задан в em).
  AE5 КЕГЛЬ        font-size из шкалы ролей (report-советник по умолчанию:
                   легальны и кегли, выведенные из чернил кадра).
  AE6 ДВОЙНИК      известные тёплые двойники запрещены: #8E8E8E вместо
                   rgba(235,235,245,.60) даёт систематический сдвиг тепла
                   по всему интерфейсу (TOKENS §2).

Режимы: strict — любое error-нарушение = exit 1; report — только отчёт.
"""
import glob
import json
import re
import sys
from pathlib import Path


def strip_comments(text: str, suffix: str) -> str:
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)          # CSS / JS block
    if suffix in (".ts", ".tsx", ".js", ".jsx"):
        text = re.sub(r"(?<![:\\])//[^\n]*", " ", text)          # // строка (не https://)
    if suffix in (".html", ".htm"):
        text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    return text


HEX = r"#[0-9A-Fa-f]{6}\b"
BG_PROP = re.compile(r"(?:background|background-color)\s*:\s*(" + HEX + ")", re.I)
SHADOW = re.compile(r"\bbox-shadow\s*:\s*(?!\s*none)", re.I)
RADIUS = re.compile(r"border-radius\s*:\s*([\d.]+)px", re.I)
SUPER = re.compile(r"clip-path\s*:\s*path\(|corner-shape", re.I)
LSPX = re.compile(r"letter-spacing\s*:\s*(-?[\d.]+)px", re.I)
FSIZE = re.compile(r"font-size\s*:\s*([\d.]+)px", re.I)


def _line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def run(root: Path, adapter: dict, tokens: dict, mode: str, project_root: Path) -> dict:
    scope = adapter.get(mode, {}) or {}
    globs = scope.get("globs", [])
    rules = scope.get("rules", ["AE1", "AE2", "AE3", "AE4", "AE6"])
    allow = {c.upper() for c in tokens["surfaces"]["allow"]} | {c.upper() for c in adapter.get("allow_extra", [])}
    forb = {c.upper(): why for c, why in tokens.get("forbidden_colors", {}).items()}
    cap = float(tokens["typography"]["tracking_cap_px"])
    rad_lim = float(tokens["geometry"]["corner_form_required_above_pt"])
    sizes = {float(s) for s in tokens["typography"]["role_sizes_pt"]} | {float(s) for s in adapter.get("sizes_extra", [])}

    findings, files_n = [], 0
    for g in globs:
        for fp in sorted(glob.glob(str(project_root / g), recursive=True)):
            p = Path(fp)
            if not p.is_file() or p.suffix not in (".css", ".html", ".htm", ".tsx", ".ts", ".jsx", ".js"):
                continue
            files_n += 1
            raw = p.read_text(encoding="utf-8", errors="replace")
            t = strip_comments(raw, p.suffix)
            rel = str(p.relative_to(project_root))

            if "AE1" in rules:
                for m in BG_PROP.finditer(t):
                    c = m.group(1).upper()
                    if c not in allow:
                        findings.append(("AE1", rel, _line_of(t, m.start()),
                                         f"фон {c} вне лестницы поверхностей ({' → '.join(tokens['surfaces']['ladder'])})"))
            if "AE2" in rules:
                for m in SHADOW.finditer(t):
                    findings.append(("AE2", rel, _line_of(t, m.start()),
                                     "box-shadow: на чёрном холсте теней нет — глубина = ступень поверхности"))
            if "AE3" in rules:
                bigs = [(float(m.group(1)), m.start()) for m in RADIUS.finditer(t) if float(m.group(1)) > rad_lim]
                if bigs and not SUPER.search(t):
                    v, pos = bigs[0]
                    findings.append(("AE3", rel, _line_of(t, pos),
                                     f"border-radius {v}px > {rad_lim:g}pt без формы суперэллипса (clip-path:path / corner-shape)"))
            if "AE4" in rules:
                for m in LSPX.finditer(t):
                    v = float(m.group(1))
                    if abs(v) > cap + 1e-9:
                        findings.append(("AE4", rel, _line_of(t, m.start()),
                                         f"letter-spacing {v}px — крышка поправки ±{cap}px; роль задаётся в em"))
            if "AE5" in rules:
                for m in FSIZE.finditer(t):
                    v = float(m.group(1))
                    if v not in sizes:
                        findings.append(("AE5", rel, _line_of(t, m.start()),
                                         f"font-size {v}px вне шкалы ролей {sorted(sizes)}"))
            if "AE6" in rules:
                for c, why in forb.items():
                    for m in re.finditer(re.escape(c), t, re.I):
                        findings.append(("AE6", rel, _line_of(t, m.start()), why))

    return {"mode": mode, "files": files_n, "findings": findings, "rules": rules}


def render(res: dict, adapter_name: str) -> str:
    out = [f"# APPLE EYES · отчёт линта · адаптер `{adapter_name}` · режим {res['mode']}",
           f"Файлов просмотрено: {res['files']} · правила: {', '.join(res['rules'])} · находок: {len(res['findings'])}", ""]
    if not res["findings"]:
        out.append("Чисто.")
    else:
        by = {}
        for r, f, ln, msg in res["findings"]:
            by.setdefault(r, []).append((f, ln, msg))
        for r in sorted(by):
            out.append(f"## {r} · {len(by[r])}")
            for f, ln, msg in by[r][:120]:
                out.append(f"- `{f}:{ln}` — {msg}")
            if len(by[r]) > 120:
                out.append(f"- … ещё {len(by[r]) - 120}")
            out.append("")
    return "\n".join(out) + "\n"


def main(root: Path, adapter_name: str, mode: str, out_file: str = None, project_root: Path = None) -> int:
    adapter = json.loads((root / "adapters" / f"{adapter_name}.json").read_text(encoding="utf-8"))
    tokens = json.loads((root / "registry" / "standards" / "tokens.json").read_text(encoding="utf-8"))
    project_root = project_root or root.parent
    res = run(root, adapter, tokens, mode, project_root)
    text = render(res, adapter_name)
    if out_file:
        Path(out_file).write_text(text, encoding="utf-8")
    print(text)
    return 1 if (mode == "strict" and res["findings"]) else 0


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", required=True)
    ap.add_argument("--mode", choices=["strict", "report"], default="report")
    ap.add_argument("--out")
    a = ap.parse_args()
    sys.exit(main(Path(__file__).resolve().parents[1], a.adapter, a.mode, a.out))
