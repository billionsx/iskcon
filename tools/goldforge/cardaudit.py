#!/usr/bin/env python3
"""
ПРОВЕРКА ГОТОВОЙ КАРТОЧКИ (ЗКН-П017).

Гейт проверял СБОРКУ. Но карточка живёт в базе, её читают люди, и проверять надо
ЕЁ — а не намерения конвейера. Здесь карточка берётся из D1 такой, какой её
видит человек, и каждая цитата допрашивается по пяти статьям:

  1. ЛОГИКА       мог ли подписанный это сказать (анахронизм)
  2. ИСТОЧНИК     это стих — или предисловие, склейка, колонтитул
  3. КАТЕГОРИЯ    раздел соответствует виду источника
                  (житие — из повествования, «его слово» — из ЕГО книг)
  4. НЕОБХОДИМОСТЬ что этот факт даёт: событие, труд, учение, славу — или ничего
  5. ДОСЛОВНОСТЬ  текст совпадает с базой подстрочно

Отчёт печатает не «всё хорошо», а КОНКРЕТНУЮ цитату и статью, по которой она
не проходит. Что нельзя предъявить — то не проверено.
"""
import json
import re

from . import canon, compose, d1, role as roles
from .channels import FRONT_MATTER, MAX_VERSE_LEN, VERSE_WORKS, WORKS, pattern

# Какой раздел какой источник имеет право показывать (ЗКН-П016).
TAB_RULE = {
    "zhitie": ("житие", lambda w, own: w in compose.LIFE_SRC and w not in own),
    "uchenie": ("учение", lambda w, own: True),
    "proslavlenie": ("прославление", lambda w, own: w in compose.GLORY_SRC),
    "trudy": ("труды", lambda w, own: True),
    "prabhupada": ("комментарии", lambda w, own: True),
    "vklad-gauranga-lila": ("вклад", lambda w, own: True),
    "kniga-o-nem": ("книги о нём", lambda w, own: True),
    "istochniki": ("источники", lambda w, own: True),
}


def load_card(eid):
    r = d1.query("SELECT longform, level FROM entity_profiles WHERE entity_id=?1", [eid]) or []
    if not r or not r[0].get("longform"):
        return None, None
    return json.loads(r[0]["longform"]), r[0].get("level")


def walk(book):
    for t in book.get("tabs", []):
        for sub in (t.get("subtabs") or [{"label": "", "sections": t.get("sections") or []}]):
            for si, sec in enumerate(sub.get("sections", [])):
                yield t, sub, si, sec


def sources(quotes, slug2work):
    """Достать тексты источников из D1 разом — цитата сверяется, а не берётся на веру."""
    ids = []
    for q in quotes:
        to = q.get("to") or ""
        seg = to.strip("/").split("/")
        if len(seg) < 2 or seg[0] == "bhajans":
            continue
        w = slug2work.get(seg[0])
        if w:
            ids.append(".".join([w] + seg[1:]))
    out = {}
    for chunk in d1.chunks(sorted(set(ids)), 40):
        inlist = ",".join("'" + i.replace("'", "''") + "'" for i in chunk)
        for r in (d1.query(
                "SELECT v.id, v.ref, v.division_id, v.work_id, vt.translation, vt.purport "
                "FROM verses v JOIN verse_texts vt ON vt.verse_id=v.id "
                "WHERE v.id IN (%s)" % inlist) or []):
            out[r["id"]] = r
    return out


def norm(s):
    return re.sub(r"\s+", " ", (s or "").replace("\u00a0", " ").replace("ё", "е")).strip()


def audit(eid, passport):
    book, level = load_card(eid)
    if not book:
        return None
    forms = passport.get("forms", [])
    pat = pattern(forms) if forms else None
    hero_works = [b["title"] for b in compose.own_works(eid)]
    own = compose.own_work_ids(eid)
    slug2work = {v: k for k, v in compose.work_slugs().items()}

    allq = []
    for t, sub, si, sec in walk(book):
        for q in ([sec["quote"]] if sec.get("quote") else []) + sec.get("quotes", []):
            allq.append((t, sub, si, sec, q))
    src = sources([q for *_x, q in allq], slug2work)

    bad = {"логика": [], "источник": [], "категория": [], "необходимость": [],
           "дословность": [], "секция": []}

    seen_sec = set()
    for t, sub, si, sec, q in allq:
        tab = t.get("id")
        where = "%s › %s › %s" % (tab, sub.get("label", "")[:22], (sec.get("h") or "")[:28])
        text, ref, to = q.get("t", ""), q.get("ref", ""), q.get("to") or ""

        # 5. секция обязана объявить, ЧТО она даёт
        key = (tab, sub.get("id"), si)
        if key not in seen_sec:
            seen_sec.add(key)
            p = " ".join(sec.get("p") or [])
            if tab in ("zhitie", "uchenie", "proslavlenie", "trudy", "prabhupada") and \
               not re.search(r"Что даёт|Эпизод", p):
                bad["секция"].append((where, "секция не объявляет, что даёт"))

        # 1. ЛОГИКА — мог ли подписанный это сказать
        why = canon.anachronism(text, q.get("byId"))
        if why:
            bad["логика"].append((where, "%s :: %s" % (why[:70], text[:60])))

        seg = to.strip("/").split("/")
        if len(seg) < 2 or seg[0] == "bhajans":
            continue
        w = slug2work.get(seg[0])
        vid = ".".join([w] + seg[1:]) if w else None
        row = src.get(vid) if vid else None

        # 2. ИСТОЧНИК — стих или предисловие/склейка
        if row:
            if FRONT_MATTER.search(row.get("division_id") or "") or \
               FRONT_MATTER.search(row.get("ref") or ""):
                bad["источник"].append((where, "ПРЕДИСЛОВИЕ выдано за стих: %s" % ref))
            tr = row.get("translation") or ""
            if row["work_id"] in VERSE_WORKS and len(tr) > MAX_VERSE_LEN:
                bad["источник"].append((where, "СКЛЕЙКА (%d знаков в поле перевода): %s"
                                        % (len(tr), ref)))
        elif vid:
            bad["источник"].append((where, "стиха %s нет в базе" % vid))

        # 3. КАТЕГОРИЯ — раздел соответствует виду источника
        rule = TAB_RULE.get(tab)
        if rule and w and not rule[1](w, own):
            bad["категория"].append((where, "«%s» не имеет права стоять в разделе «%s»"
                                     % (WORKS.get(w, {}).get("title", w), rule[0])))
        if tab == "uchenie" and "Его слово" in (sub.get("label") or "") and w not in own:
            bad["категория"].append((where, "«%s» — не его книга, а стоит в «Его слово»" % w))

        # 4. НЕОБХОДИМОСТЬ — что этот факт даёт
        if pat and row:
            r = roles.classify(text, pat, hero_works)
            about = WORKS.get(w, {}).get("about") == eid or w in own
            if r not in roles.IN_CARD and not about:
                bad["необходимость"].append(
                    (where, "факт ничего не даёт (%s): %s" % (r, text[:60])))

        # 5. ДОСЛОВНОСТЬ
        if row:
            body = (row.get("translation") or "") + "\n" + (row.get("purport") or "")
            core = text.strip("… ").strip()
            if core and norm(core) not in norm(body):
                bad["дословность"].append((where, "НЕ дословно: %s" % ref))

    return {"level": level, "quotes": len(allq), "bad": bad,
            "total": sum(len(v) for v in bad.values())}


def report(eid, res):
    print("\n" + "=" * 72)
    print("ПРОВЕРКА КАРТОЧКИ · %s · цитат %d · level=%s"
          % (eid, res["quotes"], res["level"]))
    print("=" * 72)
    for name, items in res["bad"].items():
        mark = "✓" if not items else "✗"
        print("  %s %-14s %d" % (mark, name, len(items)))
        for where, why in items[:4]:
            print("      %-42s %s" % (where[:42], why[:60]))
    print("  " + "─" * 68)
    print("  ИТОГО НАРУШЕНИЙ: %d" % res["total"])
    return res["total"]
