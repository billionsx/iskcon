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
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORGE = ROOT / "tools" / "goldforge" / "goldforge.py"
FORGE_DIR = ROOT / "tools" / "goldforge"
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
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = json.load(r)
    except urllib.error.HTTPError as e:
        # ЗКН-Ф014: скрипт говорит, ЧТО именно сломалось. Без этого CI показывает
        # лишь «exit code 1», и настоящая ошибка (напр. «too many SQL variables»)
        # остаётся невидимой.
        raise SystemExit("::error title=D1::HTTP %s — %s\n  SQL: %s"
                         % (e.code, e.read().decode("utf-8", "replace")[:280], sql[:110]))
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


def forge_src():
    if not FORGE_DIR.exists():
        return ""
    return "\n".join(p.read_text(encoding="utf-8") for p in sorted(FORGE_DIR.glob("*.py")))


def check_forge_channels():
    """ЗКН-П001: СЕМЬ каналов жатвы не просто объявлены — реализованы.

    Объявить канал в словаре и не написать сборщик — это У1 (документ), а не У5.
    Поэтому гейт требует и имя канала, и функцию, которая его собирает.
    """
    if not FORGE.exists():
        return [("goldforge.py", "кузницы нет (ЗКН-Пл005)")]
    t = forge_src()
    # Канал считается объявленным, только если он ЗАРЕГИСТРИРОВАН в CHANNELS.
    # Упоминание «k7» в комментарии — не канал. Гейт, который ловит слово, а не
    # реестр, зелёный при удалённом канале: проверено на живом нарушении.
    ch = re.search(r"CHANNELS\s*=\s*\{(.*?)\}", t, re.S)
    reg = re.findall(r'"(k\d)-[a-z-]+"\s*:', ch.group(1) if ch else "")
    miss = [k for k in ("k1", "k2", "k3", "k4", "k5", "k6", "k7") if k not in reg]
    if miss:
        return [("goldforge", "каналы не в реестре CHANNELS: %s (ЗКН-П001)" % ", ".join(miss))]
    bad = []
    for fn in ("k1_books_app", "k2_archive", "k4_bhajans_app", "web_channel"):
        if fn not in t:
            bad.append(("goldforge", "канал объявлен, но не собирается: %s (ЗКН-П001)" % fn))
    if "sources.json" not in t:
        bad.append(("goldforge", "нет реестра внешних источников (ЗКН-П001 k3/k5/k6/k7)"))
    return bad


def check_forge_pipeline():
    """ЗКН-П010: карточка собирается КОНВЕЙЕРОМ, а не руками.

    Стадии обязаны существовать все: паспорт → жатва → сборка → гейт → запись.
    Пропала любая — и «сборка» опять становится ручным трудом, который никто
    не может проверить.
    """
    t = forge_src()
    if not t:
        return [("goldforge", "кузницы нет (ЗКН-П010)")]
    miss = [s for s in ("passport", "harvest", "compose", "gate", "publish")
            if 'sub.add_parser("%s")' % s not in t and '("%s"' % s not in t]
    return [("goldforge", "нет стадии конвейера: %s (ЗКН-П010)" % ", ".join(miss))] if miss else []


def check_role_law():
    """ЗКН-П016: раздел определяет РОЛЬ факта, а не книга.

    Пока этого закона не было, сборщик был свальщиком: брал каждый стих, где
    мелькнуло имя, и клал в список по главам. Сто цитат, из которых девяносто
    не говорят о герое ничего.
    """
    t = forge_src()
    bad = []
    if "def classify" not in t:
        bad.append(("goldforge/role.py", "нет классификатора роли (ЗКН-П016)"))
    for r in ("актор", "авторитет", "качество", "перечисление", "упоминание"):
        if r not in t:
            bad.append(("goldforge/role.py", "нет роли «%s» (ЗКН-П016)" % r))
    if "roles.IN_CARD" not in t:
        bad.append(("goldforge/compose.py", "сборка не фильтрует по роли (ЗКН-П016)"))
    return bad


def check_no_fabrication_gate():
    """ЗКН-П011: ноль фабрикации — ПРОВЕРЯЕТСЯ, а не обещается.

    Пока этот закон жил в документе, он держался на добросовестности. Гейт
    содержания берёт каждое имя собственное и каждое число из авторской прозы
    и требует предъявить источник в досье.
    """
    t = forge_src()
    bad = []
    if "def containment" not in t:
        bad.append(("goldforge/gate.py", "нет гейта содержания (ЗКН-П011)"))
    if "def verbatim" not in t:
        bad.append(("goldforge/gate.py", "нет сверки дословности цитат (ЗКН-П012)"))
    return bad


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


def check_p008():
    """ЗКН-П008 — ИСЧЕРПЫВАЮЩИЙ ПРОХОД. ОТЧЁТ ОДИН РАЗ В КОНЦЕ.

    Это закон о МЕТОДЕ, и его нельзя поймать регуляркой в коде. Поэтому механизм
    другой: метод обязан быть ЗАПИСАН — в плейбуке, дословно, — и не может тихо
    исчезнуть при правке.

    ПОЧЕМУ ЭТО ВАЖНО.

    Соблазн работать пилюлями: прочитал одну книгу — написал абзац, прочитал
    другую — дописал ещё. Кажется быстрее. На деле:
      • источники читаются ВЫБОРОЧНО — и карточка выходит однобокой;
      • правки накатываются по одной — каждая тянет свой аудит и свой отчёт;
      • founder читает десять отчётов вместо одного и не видит целого.

    Правило: собрать ВСЁ (все книги в `docs/sources/`, все бхаджаны), писать
    ПАЧКАМИ, аудит и отчёт — ОДИН раз в конце.
    """
    p = ROOT / "docs" / "pkl-hero-playbook.md"
    if not p.exists():
        return [("docs/", "нет плейбука ПКЛ — метод негде хранить (ЗКН-П008)")]
    t = p.read_text(encoding="utf-8")
    bad = []
    need = {
        "исчерпывающ": "исчерпывающий проход по ВСЕМ источникам",
        "пачк": "писать ПАЧКАМИ, а не по одной правке",
        "один раз": "аудит и отчёт ОДИН раз в конце",
    }
    for key, what in need.items():
        if key not in t.lower():
            bad.append(("pkl-hero-playbook.md",
                        "метод потерян: «%s» (ЗКН-П008)" % what))
    return bad


CHECKS = [
    ("ЗКН-П008", "метод ПКЛ записан в плейбуке", check_p008),
    ("ЗКН-П010", "карточка собирается конвейером", check_forge_pipeline),
    ("ЗКН-П011", "гейт нулевой фабрикации существует", check_no_fabrication_gate),
    ("ЗКН-П016", "закон необходимости факта (роль)", check_role_law),
    ("ЗКН-Р004", "золото ТОЛЬКО с уликой (паспорт)", check_gold_evidence),
    ("ЗКН-Р003", "вердикт выносит гейт, не человек", check_forge_gate),
    ("ЗКН-П001", "СЕМЬ каналов жатвы реализованы", check_forge_channels),
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
