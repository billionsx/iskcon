#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BXAD · КИТ. Величины официальных дизайн-китов Apple — без единого аккаунта.

Основатель: «движок должен сам открывать кит iOS 27 и брать стандарты,
элементы, иконки — без моего аккаунта». Две руки:

РУКА SKETCH (главная, полностью автономная):
  Apple публикует те же киты для Sketch ПРЯМЫМИ ссылками на
  https://developer.apple.com/design/resources/ — а .sketch это zip с JSON.
  Шаги: страница → все ссылки .dmg/.zip/.sketch с iOS/iPadOS в имени →
  скачать → раскрыть (dmg через 7z, sketch как zip) → пройти JSON:
    цвета (fills/sharedSwatches) · текстовые стили (кегль, интерлиньяж,
    кернинг) · радиусы углов · перечень символов и иконок.
  Каждая величина несёт адрес kit:<файл>:<страница>/<имя> — это 🍎 канон
  Apple с адресом, им законно закрываются 🕳 каркаса ios27 (устав ст. 40).

РУКА FIGMA (спит до ключей):
  REST GET /v1/files/<key> при секретах FIGMA_TOKEN(+FIGMA_KIT_KEY) — тот же
  разбор дерева. Community-hub без сессии ключа не отдаёт; MCP требует
  edit-доступ (проверено 23.07.2026, отказ зафиксирован). Рука просыпается,
  как только ключи появляются, — до тех пор честное «спит», не имитация.

Запуск экономный: рука Sketch работает, только если снимок design-resources
изменился с прошлого извлечения (или --force).
"""
import io
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from crawler import UA, _robots_ok  # noqa: E402

RES_URL = "https://developer.apple.com/design/resources/"
LINK = re.compile(r'href="([^"]+\.(?:dmg|zip|sketch))"', re.I)
KITWORD = re.compile(r"ios|ipados", re.I)


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


MAX_KIT_BYTES = 700 * 1024 * 1024


def _get(url: str, binary=False, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        if not binary:
            return r.read().decode("utf-8", "replace")
        chunks, total = [], 0
        while True:
            c = r.read(1 << 20)
            if not c:
                break
            total += len(c)
            if total > MAX_KIT_BYTES:
                raise RuntimeError(f"кит больше капа {MAX_KIT_BYTES>>20}МБ")
            chunks.append(c)
        return b"".join(chunks)


def _rgba(c: dict) -> str:
    try:
        r, g, b = (round(float(c.get(k, 0)) * 255) for k in ("red", "green", "blue"))
        a = round(float(c.get("alpha", 1)), 3)
        hexv = f"#{r:02X}{g:02X}{b:02X}"
        return hexv if a == 1 else f"rgba({r},{g},{b},{a})"
    except Exception:
        return "?"


def parse_sketch(data: bytes, kit_name: str) -> dict:
    """Детерминированный обход .sketch (zip с JSON) → величины с адресами."""
    colors, texts, radii, symbols = {}, {}, {}, []
    zf = zipfile.ZipFile(io.BytesIO(data))
    doc = json.loads(zf.read("document.json").decode("utf-8", "replace"))
    for sw in ((doc.get("sharedSwatches") or {}).get("objects") or []):
        v = _rgba(sw.get("value") or {})
        colors.setdefault(sw.get("name", "?"), {"value": v, "at": f"kit:{kit_name}:swatch/{sw.get('name','?')}"})
    for ts in ((doc.get("layerTextStyles") or {}).get("objects") or []):
        st = (((ts.get("value") or {}).get("textStyle") or {}).get("encodedAttributes") or {})
        fd = ((st.get("MSAttributedStringFontAttribute") or {}).get("attributes") or {})
        texts.setdefault(ts.get("name", "?"), {
            "font": fd.get("name"), "size_pt": fd.get("size"),
            "kerning": st.get("kerning"),
            "line_pt": ((st.get("paragraphStyle") or {}).get("maximumLineHeight")),
            "at": f"kit:{kit_name}:textstyle/{ts.get('name','?')}"})

    def walk(layer, page):
        cls = layer.get("_class", "")
        nm = layer.get("name", "?")
        if cls in ("symbolMaster",):
            symbols.append(nm)
        fr = layer.get("fixedRadius")
        if cls == "rectangle":
            pts = (layer.get("points") or [])
            rad = fr if fr else (pts[0].get("cornerRadius") if pts else None)
            if rad:
                radii.setdefault(round(float(rad), 1), f"kit:{kit_name}:{page}/{nm}")
        for ch in layer.get("layers") or []:
            walk(ch, page)

    for name in zf.namelist():
        if name.startswith("pages/") and name.endswith(".json"):
            try:
                pg = json.loads(zf.read(name).decode("utf-8", "replace"))
            except Exception:
                continue
            pname = pg.get("name", name)
            for ly in pg.get("layers") or []:
                walk(ly, pname)
    return {"colors": colors, "text_styles": texts,
            "corner_radii": {str(k): v for k, v in sorted(radii.items())},
            "symbols": sorted(set(symbols))}


def _extract_container(blob: bytes, suffix: str, tmp: Path) -> bytes:
    """dmg/zip → байты первого .sketch внутри (7z раскрывает dmg на linux)."""
    if suffix == "sketch":
        return blob
    src = tmp / f"kit.{suffix}"
    src.write_bytes(blob)
    out = tmp / "x"
    out.mkdir(exist_ok=True)
    subprocess.run(["7z", "x", "-y", f"-o{out}", str(src)],
                   capture_output=True, timeout=600)
    sk = sorted(out.rglob("*.sketch"), key=lambda p: -p.stat().st_size)
    if not sk:
        raise RuntimeError("в контейнере нет .sketch")
    return sk[0].read_bytes()


def run_sketch_arm(root: Path, force=False, fixtures: Path = None) -> dict:
    reg = root / "registry"
    kdir = reg / "standards" / "kit"
    kdir.mkdir(parents=True, exist_ok=True)
    stf = kdir / "state.json"
    st = json.loads(stf.read_text(encoding="utf-8")) if stf.exists() else {}
    if fixtures is not None:
        links = [("fixture-kit.sketch", (fixtures / "mini-kit.sketch").read_bytes())]
        page_sha = "fixture"
    else:
        snap = reg / "snapshots" / "design-resources.txt"
        page_sha = json.loads((reg / "state" / "watch-state.json").read_text(encoding="utf-8")) \
            .get("design-resources", {}).get("sha", "")
        if not force and st.get("page_sha") == page_sha:
            return {"status": "без изменений — кит не перекачивался", "kits": st.get("kits", [])}
        if not _robots_ok(RES_URL):
            return {"status": "robots-disallow", "kits": []}
        html = _get(RES_URL)
        links = []
        for href in LINK.findall(html):
            if KITWORD.search(href.rsplit("/", 1)[-1]):
                url = href if href.startswith("http") else "https://developer.apple.com" + href
                name = url.rsplit("/", 1)[-1]
                try:
                    links.append((name, _get(url, binary=True, timeout=900)))
                except Exception as e:
                    links.append((name + "!download", str(e).encode()))
        if not links:
            return {"status": "ссылок на iOS-кит не найдено (страница изменилась?)", "kits": []}
    kits, arm_errors = [], []
    with tempfile.TemporaryDirectory() as td:
        for name, blob in links[:2]:
            try:
                if name.endswith("!download"):
                    raise RuntimeError("закачка: " + blob.decode(errors="replace")[:160])
                suffix = name.rsplit(".", 1)[-1].lower()
                sk = _extract_container(blob, suffix, Path(td))
                std = parse_sketch(sk, name)
                slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
                (kdir / f"{slug}.json").write_text(json.dumps(std, ensure_ascii=False, indent=1), encoding="utf-8")
                kits.append({"kit": name, "colors": len(std["colors"]), "text_styles": len(std["text_styles"]),
                             "radii": len(std["corner_radii"]), "symbols": len(std["symbols"])})
            except Exception as e:  # рука не убивает движок: ошибка = честная запись
                arm_errors.append(f"{name}: {type(e).__name__}: {e}")
    st = {"page_sha": (page_sha if not arm_errors else st.get("page_sha", "")),
          "kits": kits, "errors": arm_errors, "ts": _now()}
    stf.write_text(json.dumps(st, ensure_ascii=False, indent=1), encoding="utf-8")
    idx = ["# КИТ · величины официальных китов Apple (рука Sketch, без аккаунтов)",
           "Каждая величина несёт адрес kit:<файл>:<страница>/<имя> — 🍎 канон Apple.", ""]
    for k in kits:
        idx.append(f"- `{k['kit']}` · цветов {k['colors']} · текст-стилей {k['text_styles']}"
                   f" · радиусов {k['radii']} · символов {k['symbols']}")
    idx.append("")
    idx.append("Рука Figma: спит до секретов FIGMA_TOKEN(+FIGMA_KIT_KEY); community-hub без сессии "
               "ключа не отдаёт, MCP требует edit-доступ (отказ зафиксирован 23.07.2026).")
    (kdir / "KIT.md").write_text("\n".join(idx) + "\n", encoding="utf-8")
    if fixtures is None:
        with (reg / "state" / "CHANGELOG.md").open("a", encoding="utf-8") as f:
            f.write(f"### {_now()} · кит\n" + "".join(
                f"- {k['kit']}: цветов {k['colors']} · текст-стилей {k['text_styles']} · радиусов {k['radii']} · символов {k['symbols']}\n" for k in kits)
                + "".join(f"- ОШИБКА руки: {e}\n" for e in arm_errors) + "\n")
    status = "извлечено" if kits else ("ошибка руки: " + "; ".join(arm_errors) if arm_errors else "пусто")
    return {"status": status, "kits": kits, "errors": arm_errors}


def run_figma_arm(root: Path) -> dict:
    import os
    tok, key = os.environ.get("FIGMA_TOKEN"), os.environ.get("FIGMA_KIT_KEY")
    if not tok or not key:
        return {"status": "спит: нет FIGMA_TOKEN/FIGMA_KIT_KEY"}
    req = urllib.request.Request(f"https://api.figma.com/v1/files/{key}",
                                 headers={"X-Figma-Token": tok, "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read().decode("utf-8", "replace"))
    styles = d.get("styles") or {}
    comp = d.get("components") or {}
    out = {"name": d.get("name"), "styles": {k: v.get("name") for k, v in styles.items()},
           "components": sorted({v.get("name", "?") for v in comp.values()})}
    kdir = root / "registry" / "standards" / "kit"
    kdir.mkdir(parents=True, exist_ok=True)
    (kdir / "figma-arm.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"status": "извлечено (figma)", "components": len(out["components"]), "styles": len(styles)}


if __name__ == "__main__":
    force = "--force" in sys.argv
    r = run_sketch_arm(Path(__file__).resolve().parents[1], force=force)
    print("кит:", r["status"])
    for k in r.get("kits", []):
        print(f"  {k['kit']}: цветов {k['colors']} · текст-стилей {k['text_styles']} · символов {k['symbols']}")
    f = run_figma_arm(Path(__file__).resolve().parents[1])
    print("figma-рука:", f["status"])
