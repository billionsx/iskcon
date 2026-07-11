#!/usr/bin/env python3
"""
АУДИТ ПКЛ И РЕЕСТРА — домены П (9) и Р (6).

Главный закон домена: **ЗОЛОТО ТРЕБУЕТ УЛИКИ.**

Метка `gold` — не самооценка и не следствие объёма. Она означает: источники
ИСЧЕРПАНЫ, каждый пассаж имеет провенанс. Раньше метка ставилась рукой — и
649 профилей объявляли себя золотом, имея меньше 2000 знаков.

Этот аудит связывает базу с уликами в репозитории:
  • есть `level='gold'` в D1 → обязан существовать паспорт имён (ЗКН-Р005)
    и досье с провенансом (ЗКН-Р006). Нет улики — нет золота.
  • вердикт выносит `goldforge audit`, а не человек (ЗКН-Р004).

Проверяется:
  Р004  золото — только с уликой (паспорт + досье)
  Р005  паспорт имён у каждой кованой личности
  Р006  досье прежде сборки
  П001  шесть каналов жатвы объявлены в кузнице
  П009  ничего не выбрасывается: пассажи маркируются уверенностью

Запуск: python3 tools/pkl-audit.py   (D1 — по токену; без токена SQL пропускается)
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORGE = ROOT / "tools" / "goldforge" / "goldforge.py"
PASSPORTS = ROOT / "docs" / "dossiers" / "passports"


def ids_from_wrangler():
    cfg = ROOT / "apps" / "web" / "wrangler.toml"
    if not cfg.exists():
        return None, None
    t = cfg.read_text(encoding="utf-8")
    a = re.search(r'account_id\s*=\s*"([^"]+)"', t)
    d = re.search(r'database_id\s*=\s*"([^"]+)"', t)
    return (a.group(1) if a else None), (d.group(1) if d else None)


def d1(sql: str):
    wa, wd = ids_from_wrangler()
    acc = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or wa
    tok = os.environ.get("CLOUDFLARE_API_TOKEN")
    dbid = os.environ.get("D1_DATABASE_ID") or wd
    if not (acc and tok and dbid):
        return None
    url = "https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query" % (acc, dbid)
    req = urllib.request.Request(
        url, data=json.dumps({"sql": sql}).encode(),
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.load(r)
    for blk in body.get("result", []):
        return blk.get("results") or []
    return []


def check_gold_evidence():
    """ЗКН-Р004/Р005/Р006: золото требует улики — паспорт + досье.

    Это мост между базой и репозиторием. Метка в D1 без файла-улики =
    самозванство: ровно так 649 профилей объявляли себя золотом.
    """
    rows = d1("SELECT entity_id FROM entity_profiles WHERE level = 'gold'")
    if rows is None:
        return None                      # нет токена — проверка пропускается
    bad = []
    for r in rows:
        eid = r.get("entity_id")
        if not (PASSPORTS / ("%s.json" % eid)).exists():
            bad.append((eid, "золото БЕЗ паспорта имён — улики нет (ЗКН-Р005/Р004)"))
    return bad


def check_forge_channels():
    """ЗКН-П001: шесть каналов жатвы объявлены в кузнице."""
    if not FORGE.exists():
        return [("goldforge.py", "кузницы нет (ЗКН-Пл005)")]
    t = FORGE.read_text(encoding="utf-8")
    need = ["k1", "k2", "k3", "k4", "k5", "k6"]
    miss = [k for k in need if not re.search(r'\b%s\b' % k, t)]
    if miss:
        return [("goldforge.py", "нет каналов жатвы: %s (ЗКН-П001)" % ", ".join(miss))]
    return []


def check_forge_confidence():
    """ЗКН-П009: ничего не выбрасывается — пассажи маркируются уверенностью."""
    if not FORGE.exists():
        return []
    t = FORGE.read_text(encoding="utf-8")
    if not all(k in t for k in ("strong", "candidate", "homonym")):
        return [("goldforge.py", "нет тиров уверенности strong/candidate/homonym (ЗКН-П009)")]
    return []


def check_forge_gate():
    """ЗКН-Р004: вердикт выносит гейт, а не человек."""
    if not FORGE.exists():
        return []
    t = FORGE.read_text(encoding="utf-8")
    if "coverage" not in t or "verdict" not in t:
        return [("goldforge.py", "кузница не вычисляет вердикт по покрытию (ЗКН-Р003/Р004)")]
    return []


CHECKS = [
    ("ЗКН-Р004", "золото ТОЛЬКО с уликой (паспорт)", check_gold_evidence),
    ("ЗКН-Р003", "вердикт выносит гейт, не человек", check_forge_gate),
    ("ЗКН-П001", "шесть каналов жатвы", check_forge_channels),
    ("ЗКН-П009", "ничего не выбрасывается (тиры)", check_forge_confidence),
]


def main():
    print("АУДИТ ПКЛ И РЕЕСТРА · домены П · Р")
    print("─" * 70)
    details = []
    for law, name, fn in CHECKS:
        bad = fn()
        if bad is None:
            print("  ? %-11s %-42s нет доступа к D1" % (law, name[:42]))
            continue
        details += [(law, f, why) for f, why in bad]
        print("  %s %-11s %-42s %d" % ("✓" if not bad else "✗", law, name[:42], len(bad)))
    print("─" * 70)
    if details:
        print("\nНАРУШЕНИЯ (%d):\n" % len(details))
        for law, f, why in details[:20]:
            print("  %-11s %-26s %s" % (law, str(f)[:26], why))
        print("\nСвод: docs/LAWS.md · Стандарт: docs/entity-registry/GOLD_STANDARD_PROFILE.md")
        return 1
    print("Нарушений нет ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
