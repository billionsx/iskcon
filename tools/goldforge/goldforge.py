#!/usr/bin/env python3
"""
КУЗНИЦА ЗОЛОТА · конвейер онлайн-книги о личности.

    python3 tools/goldforge/goldforge.py forge jiva-goswami

Одна команда: паспорт имён → жатва по СЕМИ каналам → сборка книги → гейт →
запись в D1. Ни одного вопроса пользователю по дороге (ЗКН-П008: если скрипт
спрашивает «идти ли дальше» — значит он неполон, и чинить надо скрипт).

СЕМЬ КАНАЛОВ ЖАТВЫ (ЗКН-П001):
  k1 книги приложения · k2 архив библиотеки · k3 книги онлайн ·
  k4 бхаджаны приложения · k5 бхаджаны онлайн · k6 Википедия ·
  k7 сайты ИСККОН и связанные

ТРИ УРОВНЯ УВЕРЕННОСТИ (ЗКН-П009 — ничего не выбрасывается):
  strong    точное имя с титулом       → идёт в книгу
  candidate голое имя                  → идёт в бриф куратору
  homonym   нарицательное («джива»)    → остаётся в досье, в книгу не идёт

Стадии по отдельности: passport · harvest · compose · gate · publish · audit · sql.
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from goldforge import canon, channels, compose, d1, gate, prose   # noqa: E402,F401
from goldforge.channels import CHANNELS, REQUIRED                 # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DOSSIERS = ROOT / "docs" / "dossiers"
PASSPORTS = DOSSIERS / "passports"
CARDS = ROOT / "data" / "pkl"

MIN_STEM = 4      # «Рупа», «Сита», «Джива» — четыре буквы. Пять их убивало
STOP = {"дас", "даса", "das", "dasa", "деви", "devi", "шри", "sri", "шрила", "srila",
        "госвами", "gosvami", "goswami", "тхакур", "thakura", "thakur", "прабху",
        "prabhu", "махарадж", "maharaja", "пандит", "pandita", "ачарья", "acarya",
        "acharya", "кавирадж", "kaviraja", "the", "of", "and"}
QUALIFIERS = ["госвами", "тхакур", "прабху", "пандит", "ачарья", "махарадж", "кавирадж",
              "дас", "деви", "свами", "goswami", "gosvami", "thakur", "thakura",
              "prabhu", "pandit", "acarya", "das", "dasa", "swami"]
ENDINGS = ["ы", "е", "у", "ой", "ою", "и", "ом", "а"]


def fold(s):
    s = (s or "").lower().replace("ё", "е")
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


def stem(tok):
    t = fold(tok)
    while len(t) > MIN_STEM and t[-1] in "аеиоуыэюяaeiou":
        t = t[:-1]
    return t


def declensions(name):
    """«Джива Госвами» → Джива/Дживы/Дживе/Дживу/Дживой… + « Госвами»."""
    toks = name.split()
    if len(toks) < 2:
        return [name]
    first, rest = toks[0], " ".join(toks[1:])
    base = first[:-1] if first[-1] in "аяьй" else first
    out = {name, "%s %s" % (first, rest)}
    for e in ENDINGS:
        out.add("%s%s %s" % (base, e, rest))
    return sorted(out)


def build_forms(names, extra=()):
    forms = set()
    for n in names:
        for tok in re.split(r"[\s\-·,\.]+", n or ""):
            f = fold(tok.strip())
            if not f or f in STOP or len(f) < MIN_STEM:
                continue
            s = stem(tok)
            if len(s) >= MIN_STEM:
                forms.add(s)
    for e in extra:
        if len(stem(e)) >= MIN_STEM:
            forms.add(stem(e))
    return sorted(forms)


def names_from_d1(eid):
    rows = d1.query("SELECT lang, value FROM entity_names WHERE entity_id=?1", [eid]) or []
    return [r["value"] for r in rows]


def genitive(full):
    """«Джива Госвами» → «Дживы Госвами». Титул не склоняем — он и так несклоняем."""
    toks = full.split()
    if not toks:
        return full
    f = toks[0]
    if f[-1] in "ая":
        g = f[:-1] + ("и" if f[-1] == "я" else "ы")
    elif f[-1] in "оеиуыэюй":
        g = f
    else:
        g = f + "а"
    return " ".join([g] + toks[1:])


def full_name(eid, names):
    ru = [n for n in names if re.search(r"[А-Яа-я]", n)]
    ru.sort(key=len, reverse=True)
    full = ru[0] if ru else (names[0] if names else eid)
    return full.split()[0], full


# ── passport ──────────────────────────────────────────────────────────────
def cmd_passport(a):
    names = names_from_d1(a.entity_id) if d1.available() else []
    names += (a.name or [])
    if not names:
        sys.exit("нет имён: ни в entity_names, ни в --name")
    pp = PASSPORTS / ("%s.json" % a.entity_id)
    old = json.loads(pp.read_text(encoding="utf-8")) if pp.exists() else {}
    # ПАСПОРТ КУРАТОРА СИЛЬНЕЕ АВТОМАТИКИ. У Господа автоформы дают основу
    # «кришн» — она стоит в десятках тысяч стихов как имя Самого Кришны.
    # У Шрилы Прабхупады «Прабхупада» — ТИТУЛ, его носил и его гуру. Такие
    # паспорта пишутся рукой и не пересобираются.
    if old.get("curated"):
        print("паспорт: %s (КУРИРОВАННЫЙ — не пересобираю)" % pp)
        print("  полное имя: «%s» · точных форм %d · основ %d"
              % (old["full"], len(old["strict"]), len(old["forms"])))
        return old
    short, full = full_name(a.entity_id, names)
    strict = sorted({s for n in names if re.search(r"[А-Яа-я]", n) and len(n.split()) > 1
                     for s in declensions(n)})
    doc = {
        "entity_id": a.entity_id, "names": sorted(set(names)),
        "short": short, "full": full, "gen": genitive(full),
        "strict": sorted(set(strict + (old.get("strict") or []))) or [full],
        "forms": build_forms(names, a.form or []),
        "qualifiers": sorted(set((a.qualifier or []) + old.get("qualifiers", []) + QUALIFIERS)),
        "homonyms": sorted(set((a.homonym or []) + old.get("homonyms", []))),
        "excludes": sorted(set((a.exclude or []) + old.get("excludes", []))),
    }
    PASSPORTS.mkdir(parents=True, exist_ok=True)
    pp.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print("паспорт: %s" % pp)
    print("  полное имя: «%s»  ·  краткое: «%s»" % (doc["full"], doc["short"]))
    print("  имён %d · точных форм %d · основ %d"
          % (len(doc["names"]), len(doc["strict"]), len(doc["forms"])))
    print("  основы: %s" % ", ".join(doc["forms"]))
    return doc


def load_passport(eid):
    pp = PASSPORTS / ("%s.json" % eid)
    if not pp.exists():
        sys.exit("нет паспорта %s — сначала стадия passport" % pp)
    return json.loads(pp.read_text(encoding="utf-8"))


# ── harvest ───────────────────────────────────────────────────────────────
def cmd_harvest(a):
    doc = load_passport(a.entity_id)
    only = [x.strip() for x in (a.only or "").split(",") if x.strip()] or None
    findings = channels.harvest(doc, only=only, net=not a.offline)
    per_ch, per_tier = {}, {"strong": 0, "candidate": 0, "homonym": 0}
    for f in findings:
        c = per_ch.setdefault(f["ch"], {"n": 0, "chars": 0})
        c["n"] += 1
        c["chars"] += len(f["text"])
        per_tier[f["tier"]] = per_tier.get(f["tier"], 0) + 1
    DOSSIERS.mkdir(parents=True, exist_ok=True)
    out = DOSSIERS / ("%s.dossier.json" % a.entity_id)
    total = sum(len(f["text"]) for f in findings)
    out.write_text(json.dumps({
        "entity_id": a.entity_id, "passport": doc,
        "stats": {"passages": len(findings), "chars": total,
                  "per_channel": per_ch, "per_tier": per_tier},
        "findings": findings}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("досье: %s" % out)
    print("  пассажей %d · материала %s симв."
          % (len(findings), format(total, ",").replace(",", " ")))
    print("\n  уверенность (ничего не выброшено):")
    print("    strong    точное имя      %5d  → в книгу" % per_tier["strong"])
    print("    candidate голое имя       %5d  → в бриф куратору" % per_tier["candidate"])
    print("    homonym   нарицательное   %5d  → не в книгу" % per_tier["homonym"])
    print("\n  каналы:")
    for c, title in CHANNELS.items():
        v = per_ch.get(c)
        got = ("%4d пасс. / %9s симв." % (v["n"], format(v["chars"], ",").replace(",", " "))
               if v else "НЕ СОБРАН")
        print("    %s %-16s %-38s %s" % ("✓" if v else "—", c, title[:38], got))
    miss = REQUIRED - set(per_ch)
    if miss:
        print("\n::warning::обязательные каналы пусты: %s" % ", ".join(sorted(miss)))
    return findings


def load_dossier(eid):
    dp = DOSSIERS / ("%s.dossier.json" % eid)
    if not dp.exists():
        sys.exit("нет досье %s — сначала harvest" % dp)
    return json.loads(dp.read_text(encoding="utf-8"))


def prev_card(eid):
    if not d1.available():
        return None
    r = d1.query("SELECT longform FROM entity_profiles WHERE entity_id=?1", [eid]) or []
    if not r or not r[0].get("longform"):
        return None
    try:
        o = json.loads(r[0]["longform"])
        return o if isinstance(o, dict) and o.get("tabs") else None
    except Exception:                                            # noqa: BLE001
        return None


# ── compose ───────────────────────────────────────────────────────────────
def cmd_compose(a):
    dos = load_dossier(a.entity_id)
    pp = dos["passport"]
    hero = {"short": pp.get("short") or a.entity_id, "full": pp.get("full") or a.entity_id,
            "gen": pp.get("gen") or pp.get("full") or a.entity_id}
    keep = prev_card(a.entity_id) if a.keep_old else None
    tiers = ("strong",) if not a.candidates else ("strong", "candidate")
    sel = dict(dos, findings=[f for f in dos["findings"] if f["tier"] in tiers])
    book, per_work, size = compose.build_fit(sel, hero, keep=keep)
    if per_work < compose.MAX_PER_WORK:
        print("  вес: потолок по книге снижен до %d — карточка обязана влезать (%s симв.)"
              % (per_work, format(size, ",").replace(",", " ")))
    ev = {compose.ref_of(f): f["text"] for f in sel["findings"]}
    if not a.no_prose:
        _, msg = prose.polish(book, hero["full"], ev)
        print("  проза: %s" % msg)
    CARDS.mkdir(parents=True, exist_ok=True)
    card = CARDS / ("%s.json" % a.entity_id)
    card.write_text(json.dumps(book, ensure_ascii=False, indent=1), encoding="utf-8")
    st = compose.stats(book)
    print("книга: %s" % card)
    print("  табов %d · суб-табов %d · секций %d · цитат %d · %s симв."
          % (st["tabs"], st["subtabs"], st["sections"], st["quotes"],
             format(st["chars"], ",").replace(",", " ")))
    brief(a.entity_id, dos)
    return book


def brief(eid, dos):
    """Бриф куратору: кандидаты и омонимы. Ничего не потеряно (ЗКН-П009)."""
    cand = [f for f in dos["findings"] if f["tier"] == "candidate"]
    hom = [f for f in dos["findings"] if f["tier"] == "homonym"]
    p = DOSSIERS / ("%s.brief.md" % eid)
    lines = ["# Бриф куратора · %s" % eid, "",
             "Материал, который конвейер НЕ внёс в книгу автоматически.",
             "Он не выброшен (ЗКН-П009) — он ждёт решения человека.", "",
             "## Кандидаты (голое имя — нужен взгляд куратора): %d" % len(cand), ""]
    for f in cand[:100]:
        lines.append("- **%s** · `%s` — %s"
                     % (f["ref"], f["ch"], f["text"][:170].replace("\n", " ")))
    lines += ["", "## Омонимы (нарицательное, в книгу не идут): %d" % len(hom), ""]
    for f in hom[:30]:
        lines.append("- %s · `%s`" % (f["ref"], f["ch"]))
    p.write_text("\n".join(lines), encoding="utf-8")
    print("  бриф: %s (кандидатов %d, омонимов %d)" % (p, len(cand), len(hom)))


# ── gate / audit ──────────────────────────────────────────────────────────
def cmd_gate(a):
    dos = load_dossier(a.entity_id)
    card = CARDS / ("%s.json" % a.entity_id)
    if not card.exists():
        sys.exit("нет книги %s — сначала compose" % card)
    book = json.loads(card.read_text(encoding="utf-8"))
    pp = dos["passport"]
    print("ГЕЙТ · %s" % a.entity_id)
    bad = gate.run(book, dos, prev_card(a.entity_id) if not a.no_ratchet else None,
                   pp.get("short"), pp.get("full"))
    st = compose.stats(book)
    used = set(dos["stats"]["per_channel"])
    strong = dos["stats"]["per_tier"].get("strong", 0)
    # ЗОЛОТО = ИСТОЧНИКИ ИСЧЕРПАНЫ (ЗКН-Р003), а не «много букв».
    # Мерить покрытие долей ВСЕХ улик — ошибка: пассаж из Википедии или из
    # архива библиотеки цитатой стать НЕ МОЖЕТ (ЗКН-П004 — он идёт в прозу).
    # Считать его «непокрытым» — значит наказывать карточку за богатство
    # внешних источников. Мерим то, что ОБЯЗАНО было стать цитатой: стих,
    # комментарий и куплет из самого приложения.
    quotable = sum(1 for f in dos["findings"]
                   if f.get("tier") == "strong"
                   and f.get("ch") in ("k1-books-app", "k4-bhajans-app")
                   and f.get("kind") in ("translation", "purport", "bhajan"))
    external = len(used & {"k2-archive", "k3-books-web", "k5-bhajans-web",
                           "k6-wikipedia", "k7-iskcon-web"})
    coverage = min(100.0, st["quotes"] / quotable * 100) if quotable else 0.0
    verdict = ("gold" if (not bad and not (REQUIRED - used) and coverage >= 85 and external >= 2)
               else ("silver" if not bad else "bronze"))
    print("  " + "─" * 62)
    print("  каналов %d/%d (внешних %d) · цитируемых улик %d · цитат %d · ПОКРЫТИЕ %.0f%%"
          % (len(used), len(CHANNELS), external, quotable, st["quotes"], coverage))
    print("  ВЕРДИКТ: %s" % verdict)
    if bad:
        print("\n  НАРУШЕНИЙ: %d" % len(bad))
        for name, path, why in bad[:25]:
            print("    ✗ %-20s %-36s %s" % (name[:20], str(path)[:36], why[:66]))
        return 1, verdict
    print("  нарушений нет ✓")
    return 0, verdict


# ── publish ───────────────────────────────────────────────────────────────
def cmd_publish(a):
    rc, verdict = cmd_gate(a)
    if rc and not a.force:
        sys.exit("::error title=ГЕЙТ::книга не прошла гейт — публикация отменена")
    if a.dry:
        print("\n--dry: в D1 не пишу")
        return 0
    card = CARDS / ("%s.json" % a.entity_id)
    longform = card.read_text(encoding="utf-8")
    old = prev_card(a.entity_id)
    if old:
        (DOSSIERS / ("%s.prev.json" % a.entity_id)).write_text(
            json.dumps(old, ensure_ascii=False, indent=1), encoding="utf-8")
    if d1.query("UPDATE entity_profiles SET longform=json(?1), level=?2, "
                "updated_at=datetime('now') WHERE entity_id=?3",
                [longform, verdict, a.entity_id]) is None:
        sys.exit("нет доступа к D1 (CLOUDFLARE_API_TOKEN)")
    d1.query("INSERT INTO entity_profiles (entity_id, longform, level) "
             "SELECT ?1, json(?2), ?3 WHERE NOT EXISTS "
             "(SELECT 1 FROM entity_profiles WHERE entity_id=?1)",
             [a.entity_id, longform, verdict])
    print("\nЗАПИСАНО в D1 · %s · level=%s · %s симв."
          % (a.entity_id, verdict, format(len(longform), ",").replace(",", " ")))
    print("Карточка: https://gaurangers.com/%s" % a.entity_id)
    return 0


def cmd_forge(a):
    print("=" * 70)
    print("КУЗНИЦА · %s" % a.entity_id)
    print("=" * 70)
    print("\n[1/5] ПАСПОРТ ИМЁН")
    cmd_passport(a)
    print("\n[2/5] ЖАТВА · 7 каналов")
    cmd_harvest(a)
    print("\n[3/5] СБОРКА КНИГИ")
    cmd_compose(a)
    print("\n[4/5] ГЕЙТ И [5/5] ПУБЛИКАЦИЯ")
    return cmd_publish(a)


def cmd_queue(a):
    """Очередь ковки: самые бедные карточки — первыми."""
    rows = d1.query(
        "SELECT e.id, coalesce(length(p.longform),0) AS n FROM entities e "
        "LEFT JOIN entity_profiles p ON p.entity_id=e.id "
        "WHERE e.type='personality' AND e.status='published' "
        "ORDER BY n ASC, e.id LIMIT ?1", [int(a.only or 0) or 730]) or []
    ids = [r["id"] for r in rows]
    print(",".join(ids))
    print("\n# личностей в очереди: %d" % len(ids), file=sys.stderr)


def cmd_sql(a):
    doc = load_passport(a.entity_id)
    print("-- k1\nSELECT v.ref FROM verses v JOIN verse_texts vt ON vt.verse_id=v.id "
          "WHERE (%s) OR (%s);" % (d1.ors("vt.translation", doc["forms"]),
                                   d1.ors("vt.purport", doc["forms"])))
    print("\n-- k4\nSELECT slug, ord FROM prayer_verses WHERE %s;"
          % d1.ors("verse_text", doc["forms"]))


def main():
    ap = argparse.ArgumentParser(description="Кузница золота — онлайн-книга о личности")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("entity_id", nargs="?", default="")
        p.add_argument("--name", action="append")
        p.add_argument("--form", action="append")
        p.add_argument("--exclude", action="append")
        p.add_argument("--qualifier", action="append")
        p.add_argument("--homonym", action="append")
        p.add_argument("--only", default="")
        p.add_argument("--offline", action="store_true")
        p.add_argument("--keep-old", action="store_true")
        p.add_argument("--candidates", action="store_true")
        p.add_argument("--no-prose", action="store_true")
        p.add_argument("--no-ratchet", action="store_true")
        p.add_argument("--dry", action="store_true")
        p.add_argument("--force", action="store_true")
        return p

    for name, fn in (("passport", lambda a: cmd_passport(a) and 0),
                     ("harvest", lambda a: cmd_harvest(a) and 0),
                     ("compose", lambda a: cmd_compose(a) and 0),
                     ("gate", lambda a: cmd_gate(a)[0]),
                     ("audit", lambda a: cmd_gate(a)[0]),
                     ("publish", cmd_publish),
                     ("forge", cmd_forge),
                     ("queue", lambda a: cmd_queue(a) and 0),
                     ("sql", lambda a: cmd_sql(a) and 0)):
        common(sub.add_parser(name)).set_defaults(func=fn)
    a = ap.parse_args()
    sys.exit(a.func(a) or 0)


if __name__ == "__main__":
    main()
