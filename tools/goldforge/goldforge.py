#!/usr/bin/env python3
"""
КУЗНИЦА ЗОЛОТА (goldforge) — сборка авторитетной мини-книги о личности.

Законы: ЗКН-Р003 (золото = исчерпание источников) · ЗКН-Р004 (уровень вычисляется
гейтом) · ЗКН-Р005 (паспорт имён: ВСЕ формы) · ЗКН-Р006 (досье прежде сборки) ·
ЗКН-БТ001 (ноль фабрикации: только найденное, с провенансом).

ШЕСТЬ КАНАЛОВ ЖАТВЫ (ЗКН-П001) — сбор идёт по ВСЕМ, не по одному:

  k1  книги приложения    — D1: verses + verse_texts (33 книги, 38 655 стихов:
                             перевод И комментарий) + quotes
  k2  архив библиотеки    — docs/sources (69 МБ, RU + EN)
  k3  книги онлайн        — vedabase.io и прочие авторитетные
  k4  бхаджаны приложения — D1: prayers (авторство) + prayer_verses (упоминания)
  k5  бхаджаны онлайн     — kksongs и прочие
  k6  Википедия           — ru + en

Сеть: k1/k4 идут в D1 напрямую при CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID +
D1_DATABASE_ID (так работает в CI). Без токена — принимаем готовую выгрузку через
--inject. То же для k3/k5/k6.

Стадии: passport → harvest → audit. `sql` печатает запросы каналов k1/k4.
Только stdlib.
"""
import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "docs" / "sources"
DOSSIERS = ROOT / "docs" / "dossiers"
PASSPORTS = DOSSIERS / "passports"

WINDOW = 1200
MIN_STEM = 5
MAX_SUFFIX = 4
RU_VOWELS = "аеёиоуыэюя"
EN_VOWELS = "aeiou"

CHANNELS = {
    "k1-books-app": "книги приложения (D1: стихи + комментарии + цитаты)",
    "k2-archive": "архив библиотеки (docs/sources)",
    "k3-books-web": "книги онлайн (vedabase и др.)",
    "k4-bhajans-app": "бхаджаны приложения (D1: prayers + prayer_verses)",
    "k5-bhajans-web": "бхаджаны онлайн",
    "k6-wikipedia": "Википедия (ru + en)",
}
REQUIRED = {"k1-books-app", "k2-archive", "k4-bhajans-app"}

STOP = {
    "дас", "даса", "das", "dasa", "деви", "devi", "шри", "sri", "шрила", "srila",
    "госвами", "gosvami", "goswami", "тхакур", "thakura", "thakur", "прабху",
    "prabhu", "махарадж", "maharaja", "пандит", "pandita", "ачарья", "acarya",
    "acharya", "кавирадж", "kaviraja", "the", "of", "and",
}


def fold(s):
    s = (s or "").lower().replace("ё", "е")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", s)


def stem(token):
    t = fold(token)
    vowels = RU_VOWELS + EN_VOWELS
    while len(t) > MIN_STEM and t[-1] in vowels:
        t = t[:-1]
    return t


def build_forms(names, extra=None, min_token=5):
    forms = {}
    for n in names:
        for tok in re.split(r"[\s\-·,\.]+", n or ""):
            f = fold(tok.strip())
            if not f or f in STOP or len(f) < min_token:
                continue
            s = stem(tok)
            if len(s) >= MIN_STEM:
                forms.setdefault(s, set()).add(n)
    for e in (extra or []):
        s = stem(e)
        if len(s) >= MIN_STEM:
            forms.setdefault(s, set()).add("(ручная)")
    return forms


def compile_pattern(forms):
    body = "|".join(re.escape(a) for a in sorted(forms, key=len, reverse=True))
    return re.compile(rf"(?<![a-zа-я])({body})[a-zа-я]{{0,{MAX_SUFFIX}}}(?![a-zа-я])")


NEAR = 60  # окно вокруг имени, где ищем уточнитель


def tier(passage, forms, quals, homs):
    """Уровень уверенности пассажа. Ничего не выбрасываем — маркируем (ЗКН-П009).
      strong    — рядом с именем стоит уточнитель (дас / тхакур / das / thakur)
      homonym   — рядом стоит маркер нарицательного (дхира, «лучший из людей»)
      candidate — голое имя: скорее всего личность, но нужен взгляд куратора
    """
    f = fold(passage)
    pat = compile_pattern(forms)
    best = "candidate"
    for m in pat.finditer(f):
        lo, hi = max(0, m.start() - NEAR), min(len(f), m.end() + NEAR)
        near = f[lo:hi]
        if any(fold(q) in near for q in quals):
            return "strong"
        if any(fold(h) in near for h in homs):
            best = "homonym" if best == "candidate" else best
    return best


def snap(text, lo, hi):
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


def d1_sql(forms):
    """SQL каналов k1 и k4. Кириллица в LIKE ненадёжна → instr()."""
    def ors(col):
        return " OR ".join("instr(lower(%s),'%s')>0" % (col, f) for f in sorted(forms))
    q = "''"
    return {
        "k1_verses":
            "SELECT 'k1-books-app' AS channel, v.work_id AS source, v.ref, "
            "vt.translation, vt.purport FROM verse_texts vt "
            "JOIN verses v ON v.id=vt.verse_id WHERE %s OR %s"
            % (ors("vt.translation"), ors("vt.purport")),
        "k1_quotes":
            "SELECT 'k1-books-app' AS channel, source, text FROM quotes WHERE %s"
            % ors("text"),
        "k4_authored":
            "SELECT 'k4-bhajans-app' AS channel, slug AS source, name AS ref, "
            "text, translation FROM prayers WHERE %s OR %s"
            % (ors("coalesce(author_name,%s)" % q), ors("coalesce(author_slug,%s)" % q)),
        "k4_mentions":
            "SELECT 'k4-bhajans-app' AS channel, slug AS source, ord AS ref, "
            "verse_text, signature FROM prayer_verses WHERE %s OR %s OR %s"
            % (ors("coalesce(verse_text,%s)" % q), ors("coalesce(signature,%s)" % q),
               ors("coalesce(verse_translit,%s)" % q)),
    }


def d1_query(sql):
    acc = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    tok = os.environ.get("CLOUDFLARE_API_TOKEN")
    dbid = os.environ.get("D1_DATABASE_ID")
    if not (acc and tok and dbid):
        return None
    url = "https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query" % (acc, dbid)
    req = urllib.request.Request(
        url, data=json.dumps({"sql": sql}).encode(),
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.load(r)
    out = []
    for blk in body.get("result", []):
        out.extend(blk.get("results", []))
    return out


def load_passport(eid):
    pp = PASSPORTS / ("%s.json" % eid)
    if not pp.exists():
        sys.exit("нет паспорта %s — сначала стадия passport" % pp)
    return json.loads(pp.read_text(encoding="utf-8"))


def cmd_passport(args):
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
        sys.exit("нет имён: --names names.json или --name «Имя»")
    forms = build_forms(names, args.form)
    PASSPORTS.mkdir(parents=True, exist_ok=True)
    out = PASSPORTS / ("%s.json" % args.entity_id)
    out.write_text(json.dumps({
        "entity_id": args.entity_id, "names": names,
        "forms": sorted(forms), "excludes": args.exclude or [],
        "qualifiers": args.qualifier or [],
        "homonyms": args.homonym or [],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print("паспорт: %s" % out)
    print("  имён:  %d → %s" % (len(names), ", ".join(names)))
    print("  основ: %d → %s" % (len(forms), ", ".join(sorted(forms))))
    if args.qualifier:
        print("  уточнители (→ уверенно): %s" % ", ".join(args.qualifier))
    if args.homonym:
        print("  омонимы (→ отсев):       %s" % ", ".join(args.homonym))


def cmd_sql(args):
    doc = load_passport(args.entity_id)
    for k, v in d1_sql(doc["forms"]).items():
        print("\n-- %s\n%s;" % (k, v))


def harvest_local(forms, excludes, quals=None, homs=None):
    pat = compile_pattern(forms)
    ex = [re.compile(fold(e)) for e in excludes]
    quals, homs = quals or [], homs or []
    findings = []
    for fp in sorted(SOURCES.rglob("*.txt")):
        try:
            text = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        spans = [(m.start(), m.end(), m.group(1)) for m in pat.finditer(fold(text))]
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
        for lo, hi, bases, hits in merged:
            passage = text[lo:hi].strip()
            if any(x.search(fold(passage)) for x in ex):
                continue
            findings.append({"channel": "k2-archive", "source": rel,
                             "ref": "offset:%d" % lo, "hits": hits,
                             "forms": sorted(bases), "passage": passage,
                             "tier": tier(passage, forms, quals, homs)})
    return findings


def normalize(rows, forms=None, excludes=None, quals=None, homs=None):
    ex = [re.compile(fold(e)) for e in (excludes or [])]
    forms, quals, homs = forms or [], quals or [], homs or []
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        ch = r.get("channel") or "k1-books-app"
        src = r.get("source") or r.get("work_id") or r.get("slug") or r.get("url") or "?"
        ref = r.get("ref") or r.get("verse_id") or r.get("ord") or r.get("title") or ""
        parts = [r.get(k) for k in ("translation", "purport", "text", "verse_text",
                                    "signature", "passage", "extract") if r.get(k)]
        passage = "\n\n".join(str(p) for p in parts).strip()
        if not passage:
            continue
        if any(x.search(fold(passage)) for x in ex):
            continue
        out.append({"channel": ch, "source": str(src), "ref": str(ref),
                    "hits": 1, "forms": [], "passage": passage,
                    "tier": tier(passage, forms, quals, homs)})
    return out


def cmd_harvest(args):
    doc = load_passport(args.entity_id)
    forms, excludes = doc["forms"], doc.get("excludes", [])
    quals, homs = doc.get("qualifiers", []), doc.get("homonyms", [])
    findings = []

    if not args.only or "k2" in args.only:
        findings += harvest_local(forms, excludes, quals, homs)

    if os.environ.get("CLOUDFLARE_API_TOKEN") and (not args.only or "k1" in args.only or "k4" in args.only):
        for _, sql in d1_sql(forms).items():
            rows = d1_query(sql)
            if rows:
                findings += normalize(rows, forms, excludes, quals, homs)

    for f in (args.inject or []):
        p = Path(f)
        if not p.exists():
            print("  ! нет файла %s" % f, file=sys.stderr)
            continue
        raw = json.loads(p.read_text(encoding="utf-8"))
        rows = raw.get("results", raw) if isinstance(raw, dict) else raw
        findings += normalize(rows, forms, excludes, quals, homs)

    per_ch, per_tier = {}, {"strong": 0, "candidate": 0, "homonym": 0}
    for f in findings:
        c = per_ch.setdefault(f["channel"], {"passages": 0, "chars": 0})
        c["passages"] += 1
        c["chars"] += len(f["passage"])
        per_tier[f.get("tier", "candidate")] = per_tier.get(f.get("tier", "candidate"), 0) + 1

    DOSSIERS.mkdir(parents=True, exist_ok=True)
    out = DOSSIERS / ("%s.dossier.json" % args.entity_id)
    total = sum(len(f["passage"]) for f in findings)
    out.write_text(json.dumps({
        "entity_id": args.entity_id, "passport": doc,
        "stats": {"passages": len(findings), "chars": total,
                  "per_channel": per_ch, "per_tier": per_tier},
        "findings": findings,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print("досье: %s" % out)
    print("  пассажей : %d" % len(findings))
    print("  материала: %s симв." % format(total, ",").replace(",", " "))
    print("\n  по уверенности (ничего не выброшено):")
    print("    уверенно  (имя + уточнитель) : %d" % per_tier["strong"])
    print("    кандидат  (голое имя)        : %d  ← решает куратор" % per_tier["candidate"])
    print("    омоним    (нарицательное)    : %d  ← в сборку не идёт" % per_tier["homonym"])
    print("\n  по каналам:")
    for c in CHANNELS:
        v = per_ch.get(c)
        mark = "✓" if v else "—"
        got = ("%4d пасс. / %9s симв." % (v["passages"], format(v["chars"], ",").replace(",", " "))) if v else "не собран"
        print("    %s %-16s %-42s %s" % (mark, c, CHANNELS[c][:40], got))


def cmd_audit(args):
    dp = DOSSIERS / ("%s.dossier.json" % args.entity_id)
    if not dp.exists():
        sys.exit("нет досье %s — сначала harvest" % dp)
    d = json.loads(dp.read_text(encoding="utf-8"))
    found = d["stats"]["passages"]
    used = set(d["stats"]["per_channel"])

    card_chars, cited = 0, 0
    if args.card and Path(args.card).exists():
        raw = Path(args.card).read_text(encoding="utf-8")
        card_chars, cited = len(raw), len(re.findall(r'"(?:ref|to)"\s*:', raw))

    coverage = (cited / found * 100) if found else 0.0
    missing_req = REQUIRED - used
    gold = found > 0 and coverage >= 100.0 and not missing_req
    verdict = "gold" if gold else ("silver" if card_chars > 5000 else "bronze")

    print("ГЕЙТ ЗОЛОТА · %s" % args.entity_id)
    print("  каналов задействовано: %d / %d" % (len(used), len(CHANNELS)))
    print("  найдено в источниках : %d пассажей / %s симв."
          % (found, format(d["stats"]["chars"], ",").replace(",", " ")))
    print("  внесено в карточку   : %d ссылок / %s симв."
          % (cited, format(card_chars, ",").replace(",", " ")))
    print("  ПОКРЫТИЕ             : %.1f%%" % coverage)
    print("  ВЕРДИКТ              : %s" % verdict)
    if missing_req:
        print("\n  обязательные каналы не собраны: %s" % ", ".join(sorted(missing_req)))
    if not gold:
        print("  золото НЕ присвоено (ЗКН-Р003): источники не исчерпаны.")
    return 0 if gold else 1


def main():
    ap = argparse.ArgumentParser(description="Кузница золота — мини-книга о личности")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("passport"); p.add_argument("entity_id")
    p.add_argument("--names"); p.add_argument("--name", action="append")
    p.add_argument("--form", action="append"); p.add_argument("--exclude", action="append")
    p.add_argument("--qualifier", action="append",
                   help="уточнитель рядом с именем → пассаж «уверенный» (дас, тхакур)")
    p.add_argument("--homonym", action="append",
                   help="паттерн нарицательного употребления → пассаж «омоним»")
    p.set_defaults(func=cmd_passport)
    s = sub.add_parser("sql"); s.add_argument("entity_id"); s.set_defaults(func=cmd_sql)
    h = sub.add_parser("harvest"); h.add_argument("entity_id")
    h.add_argument("--inject", action="append"); h.add_argument("--only")
    h.set_defaults(func=cmd_harvest)
    a = sub.add_parser("audit"); a.add_argument("entity_id"); a.add_argument("--card")
    a.set_defaults(func=cmd_audit)
    args = ap.parse_args()
    sys.exit(args.func(args) or 0)


if __name__ == "__main__":
    main()
