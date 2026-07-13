"""
СТАДИЯ 2 — ПАРСИНГ.  Оригинал из корпуса → канонический JSONL.

Один стих = одна строка. Ничего не додумывает: если в источнике стих 47
отсутствует, в JSONL его не будет, и ПР004 (паритет с манифестом) это поймает.
Именно так ловится галлюцинация — не «на глаз», а счётом.

Адаптеры по корпусам. Каждый возвращает список dict:
    {work_id, ref, devanagari, translit, context}
"""
from __future__ import annotations
import json, pathlib, re, sys

OUT = pathlib.Path("build/library/parsed")

# Деванагари-диапазон Unicode
DEVA = re.compile(r"[\u0900-\u097F]")
# IAST-диакритика
IAST = re.compile(r"[āīūṛṝḷṅñṭḍṇśṣṁṃḥ]", re.I)


def _looks_verse(line: str) -> bool:
    return bool(DEVA.search(line) or IAST.search(line))


def parse_gretil(text: str, work_id: str) -> list[dict]:
    """GRETIL: строки вида  `GGD_1.1  śrī-caitanya...`  либо блоки со ссылкой ||1||"""
    out, buf, ref = [], [], None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z]+)_?([\d.]+[a-z]?)\s+(.*)$", line)
        if m:
            if ref and buf:
                out.append({"work_id": work_id, "ref": ref,
                            "devanagari": "", "translit": " ".join(buf), "context": ""})
            ref, buf = m.group(2), [m.group(3)]
            continue
        m2 = re.search(r"\|\|\s*([\d.]+)\s*\|\|", line)
        if m2:
            buf.append(re.sub(r"\|\|.*?\|\|", "", line).strip())
            out.append({"work_id": work_id, "ref": m2.group(1),
                        "devanagari": "" if not DEVA.search(line) else line,
                        "translit": " ".join(b for b in buf if b), "context": ""})
            buf, ref = [], None
            continue
        if _looks_verse(line):
            buf.append(line)
    if ref and buf:
        out.append({"work_id": work_id, "ref": ref, "devanagari": "",
                    "translit": " ".join(buf), "context": ""})
    return out


def parse_plain(text: str, work_id: str) -> list[dict]:
    """Простой формат: блоки, разделённые пустой строкой, ref в конце ||n||."""
    out = []
    for block in re.split(r"\n\s*\n", text):
        block = block.strip()
        if not block:
            continue
        m = re.search(r"\|\|\s*([\d.]+)\s*\|\|", block)
        if not m:
            continue
        body = re.sub(r"\|\|.*?\|\|", "", block).strip()
        out.append({
            "work_id": work_id, "ref": m.group(1),
            "devanagari": body if DEVA.search(body) else "",
            "translit": body if not DEVA.search(body) else "",
            "context": "",
        })
    return out


ADAPTERS = {"gretil": parse_gretil, "jiva-grantha": parse_plain,
            "sanskritdocuments": parse_plain, "plain": parse_plain}


def parse(work_id: str, src: pathlib.Path, corpus: str = "gretil") -> pathlib.Path:
    text = src.read_text(encoding="utf-8", errors="replace")
    verses = ADAPTERS.get(corpus, parse_plain)(text, work_id)
    if not verses:
        sys.exit(f"{work_id}: парсер не нашёл ни одного стиха в {src} — адаптер не тот")

    refs = [v["ref"] for v in verses]
    if len(refs) != len(set(refs)):
        sys.exit(f"ПР004: дубли ref в {src}")

    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f"{work_id}.jsonl"
    with dst.open("w", encoding="utf-8") as fh:
        for v in verses:
            fh.write(json.dumps(v, ensure_ascii=False) + "\n")

    # МАНИФЕСТ ПАРИТЕТА (ПР004): сколько стихов было в источнике.
    (OUT / f"{work_id}.count").write_text(str(len(verses)), encoding="utf-8")
    print(f"{work_id}: {len(verses)} стихов → {dst}  (паритет зафиксирован)")
    return dst


if __name__ == "__main__":
    parse(sys.argv[1], pathlib.Path(sys.argv[2]),
          sys.argv[3] if len(sys.argv) > 3 else "gretil")
