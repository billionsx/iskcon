#!/usr/bin/env python3
"""
sb_chain.py — замыкает цикл заливки ШБ: сверяет ЗАЛИТОЕ с ИНВЕНТАРЁМ каналов и,
если остаток есть, перезапускает `sb-audio` на недокатанные песни. Когда всё
докатано — запускает гейт сверки `sb-verify`.

Зачем: 33.5 GB не влезают в один раннер (лимит 6 часов). Прогон обязан доводить себя
сам, а не ждать, пока человек нажмёт «ещё раз».

Эталон — docs/diagnostics/sb-audio-probe.json (инвентарь каналов), пересчитанный тем же
парсером, что и заливка: дубли поста в плейлист не идут, поэтому эталон = уникальные
дорожки, а не число файлов в канале.

Env: CLOUDFLARE_API_TOKEN, GH_TOKEN (PAT с actions:write), CHAIN (глубина, стоп на 8).
"""
import collections
import json
import os
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sb_audio import d1, parse_name  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PROBE = ROOT / "docs" / "diagnostics" / "sb-audio-probe.json"
REPO = os.getenv("GH_REPO", "billionsx/iskcon")
GH = os.getenv("GH_TOKEN", "")
CHAIN = int(os.getenv("CHAIN") or 0)
MAX_CHAIN = 8


def expected() -> dict[int, int]:
    """Сколько УНИКАЛЬНЫХ дорожек должно быть в песни (дубли поста не в счёт)."""
    d = json.loads(PROBE.read_text(encoding="utf-8"))
    out: dict[int, int] = {}
    for c in d["channels"]:
        canto = int(c["channel"].rstrip("/").split("_")[-1])
        seen, n = set(), 0
        for f in c["files"]:
            ch, kind, spec, _ = parse_name(f.get("file_name") or "")
            ref = f"ШБ {canto}.{ch}.{spec}" if kind == "verse" else None
            if ref and ref in seen:
                continue
            if ref:
                seen.add(ref)
            n += 1
        out[canto] = n
    return out


def dispatch(workflow: str, inputs: dict) -> int:
    req = urllib.request.Request(
        f"https://api.github.com/repos/{REPO}/actions/workflows/{workflow}/dispatches",
        data=json.dumps({"ref": "main", "inputs": inputs}).encode(),
        method="POST",
        headers={"Authorization": f"token {GH}", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def main():
    exp = expected()
    got = collections.Counter()
    for r in d1("SELECT canto, COUNT(*) AS n FROM sb_audio GROUP BY canto"):
        got[int(r["canto"])] = r["n"]

    left = []
    print("| Песнь | Залито | Ожидается |")
    for c in sorted(exp):
        print(f"| {c} | {got.get(c, 0)} | {exp[c]} |")
        if got.get(c, 0) < exp[c]:
            left.append(c)
    total_got, total_exp = sum(got.values()), sum(exp.values())
    print(f"::notice::Озвучка ШБ: {total_got}/{total_exp} дорожек "
          f"({100 * total_got / max(1, total_exp):.1f}%) · осталось песней: {len(left)}")

    if not GH:
        print("::warning::Нет GH_TOKEN — самодокат невозможен")
        return
    if not left:
        print("::notice::ВСЁ ДОКАТАНО — запускаю гейт сверки")
        dispatch("sb-verify.yml", {})
        return
    if CHAIN >= MAX_CHAIN:
        print(f"::error::Достигнут предел самодоката ({MAX_CHAIN}) — остались песни {left}. "
              f"Дальше нужен человек: скорее всего часть файлов не берётся.")
        return
    ins = {"cantos": ",".join(map(str, left)), "budget": "330", "parallel": "6",
           "dl": "12", "chain": str(CHAIN + 1)}
    dispatch("sb-audio.yml", ins)
    print(f"::notice::Перезапуск {CHAIN + 1}/{MAX_CHAIN} на песни {left}")


if __name__ == "__main__":
    main()
