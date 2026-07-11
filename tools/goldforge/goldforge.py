#!/usr/bin/env python3
"""
КУЗНИЦА ЗОЛОТА (goldforge) — конвейер сборки авторитетной мини-книги о личности.

Закон: ЗКН-Р003 (золото = исчерпание источников), ЗКН-Р004 (уровень вычисляется
гейтом, не ставится вручную), ЗКН-П008 (исчерпывающий проход), ЗКН-БТ001 (ноль
фабрикации: в досье попадает только то, что реально найдено, с провенансом).

Корень прежней беды: жатва шла по ОДНОЙ форме имени (русской), а первоисточники
лежат на английском. Пример: «Нароттам» → 0 совпадений в Narottama-Vilasa.EN
(524 упоминания «Narottam») и в Bhakti-Ratnakara.EN (426). Терялось ~99% материала.

Стадии:
  passport  — все формы имени (RU + склонения + EN + IAST + алиасы + эпитеты)
  harvest   — исчерпывающий сбор по docs/sources (оба языка) + D1 (опционально)
  audit     — гейт золота: покрытие досье, обязательные разделы

Использование:
  python3 tools/goldforge/goldforge.py passport <entity_id> --names names.json
  python3 tools/goldforge/goldforge.py harvest  <entity_id>
  python3 tools/goldforge/goldforge.py audit    <entity_id> --card card.json

Только stdlib. Шелл-совместимо (sh), без внешних зависимостей.
"""
import argparse
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "docs" / "sources"
DOSSIERS = ROOT / "docs" / "dossiers"
PASSPORTS = ROOT / "docs" / "dossiers" / "passports"

WINDOW = 1200          # контекст вокруг совпадения, символов
MIN_STEM = 5           # минимальная длина основы (защита от мусорных совпадений)
MAX_SUFFIX = 4         # сколько букв окончания допускаем после основы

RU_VOWELS = "аеёиоуыэюя"
EN_VOWELS = "aeiou"


def fold(s: str) -> str:
    """Нижний регистр + снятие диакритики (ā→a, Ṭ→t) + ё→е. Для устойчивого поиска."""
    s = s.lower().replace("ё", "е")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", s)


def stem(token: str) -> str:
    """Основа слова: срезаем хвостовые гласные, чтобы покрыть склонения.
    'нароттама'→'нароттам' (покрывает -ы,-е,-у,-ой), 'narottama'→'narottam'."""
    t = fold(token)
    vowels = RU_VOWELS + EN_VOWELS
    while len(t) > MIN_STEM and t[-1] in vowels:
        t = t[:-1]
    return t


def build_forms(names, extra_forms=None, min_token=5):
    """Из всех имён (ru/en/iast/alias) собираем поисковые основы.
    Служебные слова (дас, das, тхакур как самостоятельный токен) НЕ берём в одиночку —
    только значимые токены, иначе получим тысячи ложных совпадений."""
    STOP = {
        "дас", "даса", "das", "dasa", "деви", "devi", "шри", "sri", "sri",
        "шрила", "srila", "госвами", "gosvami", "goswami", "тхакур", "thakura",
        "thakur", "прабху", "prabhu", "махарадж", "maharaja", "пандит", "pandita",
        "ачарья", "acarya", "acharya", "кавирадж", "kaviraja", "the", "of", "and",
    }
    forms = {}
    for n in names:
        for tok in re.split(r"[\s\-·,\.]+", n):
            tok = tok.strip()
            if not tok:
                continue
            f = fold(tok)
            if f in STOP or len(f) < min_token:
                continue
            s = stem(tok)
            if len(s) >= MIN_STEM:
                forms.setdefault(s, set()).add(n)
    for e in (extra_forms or []):
        s = stem(e)
        if len(s) >= MIN_STEM:
            forms.setdefault(s, set()).add("(ручная форма)")
    return forms


def compile_pattern(forms):
    """Один регексп по всем основам: основа + до MAX_SUFFIX букв окончания."""
    alts = sorted(forms.keys(), key=len, reverse=True)
    body = "|".join(re.escape(a) for a in alts)
    return re.compile(rf"(?<![a-zа-я])({body})[a-zа-я]{{0,{MAX_SUFFIX}}}(?![a-zа-я])")


def snap(text, lo, hi):
    """Расширяем окно до границ абзаца/предложения — чтобы цитата не рвалась."""
    p = text.rfind("\n\n", max(0, lo - 400), lo)
    if p != -1:
        lo = p + 2
    else:
        d = text.rfind(". ", max(0, lo - 200), lo)
        if d != -1:
            lo = d + 2
    p = text.find("\n\n", hi, hi + 400)
    if p != -1:
        hi = p
    else:
        d = text.find(". ", hi, hi + 200)
        if d != -1:
            hi = d + 1
    return max(0, lo), min(len(text), hi)


def cmd_passport(args):
    """Стадия 0 — ПАСПОРТ: все формы имени. Чинит главную дыру процесса."""
    names = []
    if args.names and Path(args.names).exists():
        raw = json.loads(Path(args.names).read_text(encoding="utf-8"))
        rows = raw.get("results", raw) if isinstance(raw, dict) else raw
        for r in rows:
            v = r.get("value") if isinstance(r, dict) else str(r)
            if v:
                names.append(v)
    names += (args.name or [])
    if not names:
        sys.exit("нет имён: --names names.json (выгрузка entity_names) или --name «Имя»")

    forms = build_forms(names, args.form)
    PASSPORTS.mkdir(parents=True, exist_ok=True)
    out = PASSPORTS / f"{args.entity_id}.json"
    doc = {
        "entity_id": args.entity_id,
        "names": names,
        "forms": sorted(forms.keys()),
        "excludes": args.exclude or [],
    }
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"паспорт: {out}")
    print(f"  имён:  {len(names)} → {', '.join(names)}")
    print(f"  основ: {len(forms)} → {', '.join(sorted(forms.keys()))}")
    if doc["excludes"]:
        print(f"  исключения (омонимы): {', '.join(doc['excludes'])}")


def cmd_harvest(args):
    """Стадия 1–2 — ЖАТВА и ДОСЬЕ: исчерпывающий сбор с провенансом."""
    pp = PASSPORTS / f"{args.entity_id}.json"
    if not pp.exists():
        sys.exit(f"нет паспорта {pp} — сначала стадия passport")
    doc = json.loads(pp.read_text(encoding="utf-8"))
    forms = {f: set() for f in doc["forms"]}
    pat = compile_pattern(forms)
    excludes = [re.compile(fold(e)) for e in doc.get("excludes", [])]

    files = sorted(SOURCES.rglob("*.txt"))
    findings, per_source, per_form = [], {}, {}

    for fp in files:
        try:
            text = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        folded = fold(text)
        spans = []
        for m in pat.finditer(folded):
            base = m.group(1)
            per_form[base] = per_form.get(base, 0) + 1
            spans.append((m.start(), m.end(), base))
        if not spans:
            continue

        merged = []
        for st, en, base in spans:
            lo, hi = snap(text, st - WINDOW, en + WINDOW)
            if merged and lo <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], hi)
                merged[-1][2].add(base)
                merged[-1][3] += 1
            else:
                merged.append([lo, hi, {base}, 1])

        rel = str(fp.relative_to(ROOT))
        kept = 0
        for lo, hi, bases, hits in merged:
            passage = text[lo:hi].strip()
            fpass = fold(passage)
            if any(x.search(fpass) for x in excludes):
                continue
            findings.append({
                "source": rel,
                "offset": lo,
                "hits": hits,
                "forms": sorted(bases),
                "passage": passage,
            })
            kept += 1
        per_source[rel] = {
            "mentions": sum(s[3] for s in merged),
            "passages": kept,
            "chars": sum(len(f["passage"]) for f in findings if f["source"] == rel),
        }

    DOSSIERS.mkdir(parents=True, exist_ok=True)
    out = DOSSIERS / f"{args.entity_id}.dossier.json"
    dossier = {
        "entity_id": args.entity_id,
        "passport": doc,
        "stats": {
            "sources_scanned": len(files),
            "sources_with_hits": len(per_source),
            "mentions": sum(v["mentions"] for v in per_source.values()),
            "passages": len(findings),
            "chars": sum(len(f["passage"]) for f in findings),
            "per_form": per_form,
            "per_source": per_source,
        },
        "findings": findings,
    }
    out.write_text(json.dumps(dossier, ensure_ascii=False, indent=2), encoding="utf-8")

    st = dossier["stats"]
    print(f"досье: {out}")
    print(f"  просмотрено файлов : {st['sources_scanned']}")
    print(f"  источников с находками: {st['sources_with_hits']}")
    print(f"  упоминаний         : {st['mentions']}")
    print(f"  пассажей (с контекстом): {st['passages']}")
    print(f"  материала          : {st['chars']:,} символов".replace(",", " "))
    print("\n  по формам имени:")
    for f, n in sorted(per_form.items(), key=lambda x: -x[1]):
        print(f"    {f:<16} {n:>5}")
    print("\n  по источникам:")
    for s, v in sorted(per_source.items(), key=lambda x: -x[1]["mentions"]):
        print(f"    {Path(s).name[:48]:<50} {v['mentions']:>5} упом. / {v['passages']:>4} пасс.")


def cmd_audit(args):
    """Стадия 4 — ГЕЙТ ЗОЛОТА. Уровень вычисляется, а не проставляется (ЗКН-Р004)."""
    dp = DOSSIERS / f"{args.entity_id}.dossier.json"
    if not dp.exists():
        sys.exit(f"нет досье {dp} — сначала стадия harvest")
    d = json.loads(dp.read_text(encoding="utf-8"))
    found = d["stats"]["passages"]
    found_chars = d["stats"]["chars"]

    card_chars, cited = 0, 0
    if args.card and Path(args.card).exists():
        raw = Path(args.card).read_text(encoding="utf-8")
        card_chars = len(raw)
        cited = len(re.findall(r'"(?:ref|to)"\s*:', raw))

    coverage = (cited / found * 100) if found else 0.0
    verdict = "gold" if (found and coverage >= 100.0) else ("silver" if card_chars > 5000 else "bronze")

    print(f"ГЕЙТ ЗОЛОТА · {args.entity_id}")
    print(f"  найдено в источниках : {found} пассажей / {found_chars:,} симв.".replace(",", " "))
    print(f"  внесено в карточку   : {cited} ссылок / {card_chars:,} симв.".replace(",", " "))
    print(f"  ПОКРЫТИЕ             : {coverage:.1f}%")
    print(f"  ВЕРДИКТ              : {verdict}")
    if verdict != "gold":
        print("\n  золото НЕ присвоено: источники не исчерпаны (ЗКН-Р003).")
    return 0 if verdict == "gold" else 1


def main():
    ap = argparse.ArgumentParser(description="Кузница золота — сборка мини-книги о личности")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("passport", help="стадия 0: все формы имени")
    p.add_argument("entity_id")
    p.add_argument("--names", help="JSON-выгрузка entity_names")
    p.add_argument("--name", action="append", help="имя вручную (можно несколько)")
    p.add_argument("--form", action="append", help="доп. поисковая форма")
    p.add_argument("--exclude", action="append", help="паттерн-омоним для отсева")
    p.set_defaults(func=cmd_passport)

    h = sub.add_parser("harvest", help="стадии 1–2: жатва и досье")
    h.add_argument("entity_id")
    h.set_defaults(func=cmd_harvest)

    a = sub.add_parser("audit", help="стадия 4: гейт золота")
    a.add_argument("entity_id")
    a.add_argument("--card", help="файл текущей карточки (longform JSON)")
    a.set_defaults(func=cmd_audit)

    args = ap.parse_args()
    sys.exit(args.func(args) or 0)


if __name__ == "__main__":
    main()
