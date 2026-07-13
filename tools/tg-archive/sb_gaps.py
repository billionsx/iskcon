#!/usr/bin/env python3
"""
sb_gaps.py — ПОЛНАЯ сверка КАНАЛОВ с КНИГОЙ, до заливки.

Вопрос простой: какие стихи «Шримад-Бхагаватам» чтец НЕ записал?

Считаем не по залитому (заливка идёт), а по СЫРОМУ инвентарю каналов
(docs/diagnostics/sb-audio-probe.json — все 13 256 имён файлов) против ВСЕХ 13 000
стихов книги в D1. Стих считается озвученным, только если какой-то файл покрывает его
ЦЕЛИКОМ: аудио «18-20» покрывает книжные «18-19» и «20», а одиночный «15» книжный
«14-15» НЕ покрывает.

Печатает: немые стихи (в книге есть, в канале нет) и дорожки вне издания.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sb_audio import parse_name, nums  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ACCOUNT = os.getenv("CF_ACCOUNT_ID", "d5cbe19470dc38599873eabfe148e6d1")
DB = os.getenv("D1_DATABASE_ID", "6226aded-dd03-4e74-977f-9cd0b509e73d")
TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")


def d1(sql):
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query"
    req = urllib.request.Request(url, data=json.dumps({"sql": sql}).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {TOKEN}",
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        j = json.loads(r.read())
    if not j.get("success"):
        raise SystemExit(f"D1: {j.get('errors')}")
    return j["result"][0]["results"]


def main():
    probe = json.loads((ROOT / "docs" / "diagnostics" / "sb-audio-probe.json").read_text(encoding="utf-8"))

    # 1. Что чтец реально записал: (песнь, глава) → список наборов номеров + имена
    audio: dict[tuple[int, int], list[tuple[set[int], str]]] = {}
    extras: list[str] = []
    for c in probe["channels"]:
        canto = int(c["channel"].rstrip("/").split("_")[-1])
        for f in c["files"]:
            orig = f.get("file_name") or ""
            ch, kind, spec, _, note = parse_name(orig)
            if kind != "verse":
                continue
            audio.setdefault((canto, ch), []).append((nums(spec), orig))

    # 2. Все стихи книги
    rows = d1("SELECT ref, division_id FROM verses WHERE work_id='sb'")
    mute: list[str] = []
    for r in rows:
        ref = r["ref"]                                  # «ШБ 9.8.11»
        parts = r["division_id"].split(".")             # sb.9.8
        canto, ch = int(parts[1]), int(parts[2])
        want = nums(ref.split(".")[-1])
        got = audio.get((canto, ch), [])
        if not any(want and want <= s for s, _ in got):
            mute.append(ref)

    # 3. Дорожки, которые не легли ни на один стих книги
    book = {r["ref"] for r in rows}
    bynum: dict[tuple[int, int], list[set[int]]] = {}
    for r in rows:
        p = r["division_id"].split(".")
        bynum.setdefault((int(p[1]), int(p[2])), []).append(nums(r["ref"].split(".")[-1]))
    for (canto, ch), lst in audio.items():
        for s, orig in lst:
            if not any(bs and bs <= s for bs in bynum.get((canto, ch), [])):
                extras.append(f"ШБ {canto}.{ch} — {orig}")

    print(f"::notice::СВЕРКА КАНАЛ ↔ КНИГА: стихов в книге {len(book)}, "
          f"немых {len(mute)}, дорожек вне издания {len(extras)}")
    print(f"\n=== НЕМЫЕ СТИХИ (в книге есть, чтец НЕ записал): {len(mute)} ===")
    for m in mute:
        print(f"  {m}")
        print(f"::warning::НЕМОЙ СТИХ: {m}")
    print(f"\n=== ВНЕ ИЗДАНИЯ (чтец записал, в книге нет): {len(extras)} ===")
    for e in extras:
        print(f"  {e}")
    if extras:
        print("::notice::ВНЕ ИЗДАНИЯ: " + " · ".join(extras))


if __name__ == "__main__":
    main()
