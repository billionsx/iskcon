#!/usr/bin/env python3
"""
СБОРКА ОНЛАЙН-КНИГИ · досье → `entity_profiles.longform`.

Что здесь важно понять раз и навсегда.

**Цитата рождается в БД, а не в голове.** Текст стиха, комментария и куплета
берётся ИЗ D1 и кладётся в карточку без единой правки (ЗКН-П002 · ЗКН-БТ004).
Поэтому дословность тут не обещание, а свойство конвейера: чтобы её нарушить,
надо специально сломать код.

**Внешний источник не даёт дословной цитаты.** Википедия, сайты ИСККОН,
онлайн-книги и вторичная литература дают ФАКТ — и он идёт в прозу со ссылкой
на источник, но НИКОГДА не в кавычки как шастра (ЗКН-П004). Дословный блок
появляется только тогда, когда книга внесена в приложение и у цитаты есть `to`.

**Структура — не украшение.** Первый таб ВСЕГДА «Вклад в Гауранга Лилу»
(крит. 10 плейбука): смысл жизни героя — впереди хронологии, а не в приложении
к ней.

Формат рендера (`EntityPage.tsx`):
  {tabs:[{id,label,kicker,subtabs:[{id,label,sections:[
     {h, p:[…], quotes:[{t,translit?,ref,to,by,byId}], cite:[{ref}], see:[{id,t}]}
  ]}]}]}
"""
import json
import re
from pathlib import Path

from . import canon, d1, role as roles
from .channels import WORKS, fold, pattern

MAX_PURPORT = 1000          # выдержка из комментария (дословная, не пересказ)
MAX_QUOTE = 1500            # «Прабхупада-шикшамрита» держит письма целиком — стена текста
MIN_QUOTE = 30              # «А.Ч. Бхактиведанта Свами» — подпись (3 слова), а не цитата
MIN_WORDS = 5               # стих может быть коротким, но он — фраза
# Повествовательные источники (там ЖИТИЕ) против доктринальных (там УПОМИНАНИЯ).
# Смешивать нельзя: «Нектар преданности, глава 19» — не эпизод биографии.
NARRATIVE = {"cc", "cb", "cm", "br", "ndm", "spl", "gl"}
MAX_PER_SECTION = 14        # глава редко даёт больше — а если даёт, это уже не глава
MAX_PER_WORK = 180          # книга-о-герое не переписывается в карточку, а линкуется
MAX_CARD = 600_000          # воркер отдаёт longform ЦЕЛИКОМ: карточка обязана влезать
TRANSLIT_MAP = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
    "я": "ya", " ": "-", "·": "-", ".": "-", ",": "", "«": "", "»": "",
}
LILA_LABEL = {"adi": "Ади", "madhya": "Мадхья", "antya": "Антья", "sutra": "Сутра",
              "shesha": "Шеша", "khanda": "Кханда"}
SITE_NAMES = {
    "wikipedia-ru": "Википедия (русская)", "wikipedia-en": "Википедия (английская)",
    "vaniquotes": "Vaniquotes — цитаты Шрилы Прабхупады",
    "vanisource": "Vanisource — исходные тексты BBT",
    "vanipedia": "Vanipedia", "vedabase": "Vedabase (BBT)",
    "iskcon-org": "iskcon.org — официальный сайт", "iskcon-news": "ISKCON News",
    "iskcon-desire-tree": "ISKCON Desire Tree", "gaudiya-history": "Gaudiya History",
    "harekrishna-ru": "harekrishna.ru", "kksongs": "Vaishnava Songbook (kksongs)",
    "vaishnavasongs": "Vaishnava Songs", "gaudiya-granthamandira": "Granthamandira",
}


def slugify(s):
    out = "".join(TRANSLIT_MAP.get(c, c if c.isalnum() else "-") for c in (s or "").lower())
    out = re.sub(r"-{2,}", "-", out).strip("-")
    return re.sub(r"[^a-z0-9-]", "", out) or "razdel"


def top_div(f):
    """Верхний уровень книги: `cc.madhya.19` → `madhya`; `sb.3.24` → `3`."""
    parts = (f.get("div") or "").split(".")
    return parts[1] if len(parts) > 1 else ""


def div_label(f):
    t = top_div(f)
    if not t:
        return f.get("book") or f["src"]
    if t.isdigit():
        return ("Песнь %s" if f["src"] == "sb" else "Глава %s") % t
    return "%s-лила" % LILA_LABEL.get(t, t.capitalize())


def chapter_label(f):
    """«Мадхья 19 · Шри Чайтанья Махапрабху наставляет…»"""
    ref = (f.get("ref") or "").split(",")[0]
    loc = re.sub(r"^[А-ЯЁA-Z]+\s*", "", ref)
    loc = re.sub(r"\.\d+([-–]\d+)?$", "", loc).strip()
    title = (f.get("div_title") or "").strip()
    head = "%s %s" % (f.get("book") or f["src"], loc) if loc else (f.get("book") or f["src"])
    return "%s · %s" % (head, title) if title else head


def ref_of(f):
    """Как в эталоне `rupa-goswami`: «Книга, локатор, перевод|комментарий»."""
    base = f.get("ref") or ""
    book = f.get("book") or ""
    loc = re.sub(r"^[А-ЯЁA-Z]+\s*", "", base).strip()
    kind = {"translation": "перевод", "purport": "комментарий"}.get(f.get("kind"), "")
    parts = [p for p in (book, loc, kind) if p]
    return ", ".join(parts) if parts else base


def extract(text, forms, limit=MAX_PURPORT):
    """Дословная ВЫДЕРЖКА вокруг имени: абзац(ы), а не пересказ и не обрывок."""
    t = (text or "").strip()
    if len(t) <= limit:
        return t
    pat = pattern(forms)
    m = pat.search(fold(t))
    if not m:
        return t[:limit].rsplit(" ", 1)[0] + "…"
    paras, pos = t.split("\n"), 0
    for p in paras:
        if pos <= m.start() < pos + len(p) + 1 and p.strip():
            if len(p) <= limit:
                return p.strip()
            break
        pos += len(p) + 1
    lo = max(0, m.start() - limit // 2)
    hi = min(len(t), m.end() + limit // 2)
    lo = t.rfind(". ", 0, lo + 1) + 2 if t.rfind(". ", 0, lo + 1) > 0 else lo
    hi = t.find(". ", hi) + 1 if t.find(". ", hi) > 0 else hi
    return ("…" if lo > 0 else "") + t[lo:hi].strip() + ("…" if hi < len(t) else "")


def quote_of(f, forms, ids_ok, used=None):
    """Цитата рождается в БД. Подпись — ЗАРАБАТЫВАЕТСЯ (ЗКН-П013 · П014).

    Раньше сюда безоговорочно ставился «повествователь книги». Это и породило
    Вриндавана даса Тхакура, рассказывающего о Шриле Прабхупаде. Теперь подпись
    проходит проверку анахронизмом, а не проходит — снимается вместе с цитатой:
    ссылка на источник остаётся правдой, ложное свидетельство — нет.
    """
    # ЗКН-П016: факт без роли — факт, который ничего не даёт. Он не цитируется.
    # Это ПОСЛЕДНИЙ рубеж: даже если сборка ошибётся разделом, свалка не пройдёт.
    if f["ch"] == "k1-books-app" and f.get("role") not in roles.IN_CARD:
        return None
    ref = ref_of(f)
    if used is not None:
        if ref in used:
            return None                    # ЗКН-П003: 0 дублей ссылок
        used.add(ref)
    lim = MAX_PURPORT if f["kind"] == "purport" else MAX_QUOTE
    t = extract(f["text"], forms, lim)
    if len(t.strip()) < MIN_QUOTE or len(t.split()) < MIN_WORDS:
        return None                        # подпись, колонтитул, обрывок — не цитата
    why = canon.anachronism(t, f.get("byId"))
    if why:
        return None                        # ЗКН-П014: ложное свидетельство — вон
    q = {"t": t, "ref": ref}
    if f.get("translit"):
        q["translit"] = f["translit"]
    if f.get("to"):
        q["to"] = f["to"]
    if f.get("by"):
        q["by"] = f["by"]
        if f.get("byId") and f["byId"] in ids_ok:
            q["byId"] = f["byId"]
    return q


OWN_NUMBERS = set()          # числа, посчитанные конвейером (не факты источника)


def section(h, p, quotes=None, cite=None, see=None, hero=None):
    quotes = [q for q in (quotes or []) if q]          # снятые дубли отсеиваются
    for line in (p or []):
        OWN_NUMBERS.update(re.findall(r"\d{2,6}", str(line)))
    s = {"h": canon.clean_card_text(canon.enforce_hero(h, *hero) if hero else h)}
    if p:
        s["p"] = [canon.clean_card_text(canon.enforce_hero(x, *hero) if hero else x) for x in p]
    if quotes:
        s["quotes"] = quotes
    if cite:
        s["cite"] = cite
    if see:
        s["see"] = see
    return s


def verified_ids(cands):
    """byId обязан существовать в `entities` — иначе ссылка ведёт в никуда."""
    cands = sorted({c for c in cands if c})
    ck = ("ids", tuple(cands))
    if ck in _CACHE:
        return _CACHE[ck]
    if not cands or not d1.available():
        return set()
    ok = set()
    for chunk in d1.chunks(cands, 60):
        inlist = ",".join("'" + c.replace("'", "''") + "'" for c in chunk)
        for r in (d1.query("SELECT id FROM entities WHERE id IN (%s)" % inlist) or []):
            ok.add(r["id"])
    _CACHE[ck] = ok
    return ok


def graph_see(hero, ids_ok, limit=12):
    if not d1.available():
        return []
    rows = d1.query(
        "SELECT r.to_id AS id, coalesce((SELECT value FROM entity_names n WHERE n.entity_id=r.to_id "
        "AND n.lang='ru' LIMIT 1), r.to_id) AS t, r.relation FROM entity_relations r "
        "WHERE r.from_id=?1 LIMIT 60", [hero]) or []
    out, seen = [], set()
    for r in rows:
        if r["id"] in seen or r["id"] == hero:
            continue
        seen.add(r["id"])
        out.append({"id": r["id"], "t": r["t"]})
        if len(out) >= limit:
            break
    return out


def own_works(hero):
    """Его книги в библиотеке. slug бывает пуст — тогда ссылки нет, но труд назван."""
    if not d1.available():
        return []
    return d1.query("SELECT title, slug FROM book_catalog WHERE author_entity_id=?1 "
                    "AND title IS NOT NULL ORDER BY sort", [hero]) or []


_CACHE = {}


def build_fit(dossier, hero_names, keep=None):
    """Собрать книгу, ужимая потолок по книгам, пока карточка не влезет.

    У Шрилы Прабхупады «Лиламрита» — 8 585 стихов, у Гауранги Махапрабху три
    полных жизнеописания. Без этого карточка вырастет в мегабайты, и страница,
    которая грузит longform целиком, встанет колом на телефоне.
    """
    for per_work in (MAX_PER_WORK, 120, 80, 50, 30, 20):
        book = build(dossier, hero_names, keep=keep, per_work=per_work)
        size = len(json.dumps(book, ensure_ascii=False))
        if size <= MAX_CARD:
            return book, per_work, size
    return book, 20, size


def cap(pool, per_work=MAX_PER_WORK):
    """Отобрать самое плотное по книге. Остальное — в бриф, не в мусор."""
    by_work, out, cut = {}, [], {}
    for f in sorted(pool, key=lambda x: (-len(x.get("text", "")), x.get("ordinal", 0))):
        w = f["src"]
        by_work.setdefault(w, []).append(f)
    for w, fs in by_work.items():
        out += fs[:per_work]
        if len(fs) > per_work:
            cut[w] = (len(fs) - per_work, fs[0].get("book") or w)
    return out, cut


def build(dossier, hero_names, keep=None, per_work=MAX_PER_WORK):
    """Досье → КНИГА О ЛИЧНОСТИ.

    ЗКН-П016. Раздел карточки определяет РОЛЬ факта, а не книга, в которой он
    лежит. Факт, который не даёт ни события, ни труда, ни учения, ни славы, ни
    связи, В КАРТОЧКУ НЕ ВХОДИТ — он уходит в бриф куратору.

    Прежняя сборка была свальщиком: «все стихи, где встретилось имя», разложенные
    по книгам и главам. Сто цитат, из которых девяносто не говорят о герое ничего.
    """
    hero = dossier["entity_id"]
    full = hero_names["full"]
    short = hero_names["short"]
    gen = hero_names.get("gen") or full
    HN = (short, full)
    F = [f for f in dossier["findings"] if f.get("tier") != "homonym"]
    forms = dossier["passport"]["forms"]
    ids_ok = verified_ids([f.get("byId") for f in F] + [hero])
    used = set()
    if keep:
        used |= {q["ref"] for _p, k, q in _walk_quotes(keep) if q.get("ref")}
    see = graph_see(hero, ids_ok)
    slugmap = work_slugs()

    def pick(ch, kind=None, role=None):
        out = [f for f in F if f["ch"] == ch]
        if kind:
            out = [f for f in out if f["kind"] == kind]
        if role:
            out = [f for f in out if f.get("role") in role]
        return out

    # ЗАКОН НЕОБХОДИМОСТИ: в карточку идут ТОЛЬКО роли, которые что-то дают
    actor = pick("k1-books-app", "translation", ("актор",))
    labour = pick("k1-books-app", "translation", ("труд",))
    author = pick("k1-books-app", "translation", ("авторитет",))
    glory = pick("k1-books-app", "translation", ("качество",))
    purports = pick("k1-books-app", "purport", roles.IN_CARD)
    bhajans = pick("k4-bhajans-app")
    archive = pick("k2-archive")
    online = [f for f in F if f["ch"] in ("k3-books-web", "k5-bhajans-web",
                                          "k6-wikipedia", "k7-iskcon-web")]

    actor, cut_a = cap(actor, per_work)
    purports, cut_p = cap(purports, per_work)
    tabs = []

    # ── ТАБ 0 · ВКЛАД В ГАУРАНГА ЛИЛУ (крит. 10 — ВСЕГДА первый) ──────────
    books = own_works(hero)
    own_bhajans = sorted({f["book"] for f in bhajans if f.get("byId") == hero})
    top = sorted([f for f in purports if f.get("role") in ("качество", "авторитет")],
                 key=lambda f: -len(f["text"]))[:6]
    vk = []
    if books or own_bhajans:
        lines = []
        if books:
            lines.append("Труды %s, вошедшие в библиотеку приложения: %s."
                         % (gen, ", ".join("«%s»" % b["title"] for b in books)))
        if own_bhajans:
            lines.append("Молитвы и песни его авторства: %s."
                         % ", ".join("«%s»" % b for b in own_bhajans[:8]))
        vk.append(section("Наследие, оставленное лиле", lines, hero=HN))
    if top:
        vk.append(section(
            "Шрила Прабхупада о его вкладе",
            ["Что даёт этот раздел: оценка вклада %s в миссию Шри Кришны Чайтаньи "
             "Махапрабху — словами Шрилы Прабхупады, дословно из комментариев." % gen],
            quotes=[quote_of(f, forms, ids_ok, used) for f in top], hero=HN))
    if see:
        vk.append(section("Связи в лиле",
                          ["Личности, с которыми %s связан в источниках." % full],
                          see=see, hero=HN))
    if not vk:
        note = d1.query("SELECT note FROM entities WHERE id=?1", [hero]) if d1.available() else None
        txt = (note or [{}])[0].get("note") if note else None
        vk.append(section("Место в Гауранга Лиле",
                          [txt] if txt else ["Материал собран в разделах ниже."], hero=HN))
    tabs.append({"id": "vklad-gauranga-lila", "label": "Вклад в Гауранга Лилу",
                 "kicker": "МИССИЯ", "subtabs": [
                     {"id": "missiya", "label": "Миссия", "sections": vk}]})

    # ── ТАБ · ЖИТИЕ — только там, где герой ДЕЙСТВУЕТ ─────────────────────
    zh = {}
    for f in sorted(actor, key=lambda x: (x["src"], x.get("div", ""), x.get("ordinal", 0))):
        zh.setdefault((f["src"], top_div(f)), {}).setdefault(chapter_label(f), []).append(f)
    subs = []
    for (src, _t), chapters in zh.items():
        sample = next(iter(next(iter(chapters.values()))))
        secs = []
        for h, fs in chapters.items():
            fs = sorted(fs, key=lambda x: x.get("ordinal", 0))[:MAX_PER_SECTION]
            secs.append(section(h, ["Эпизод: здесь %s действует." % full],
                                quotes=[quote_of(f, forms, ids_ok, used) for f in fs],
                                hero=HN))
        subs.append({"id": slugify("%s %s" % (sample.get("book", src), div_label(sample))),
                     "label": "%s · %s" % (sample.get("book", src), div_label(sample)),
                     "sections": secs})
    if subs:
        tabs.append({"id": "zhitie", "label": "Житие", "kicker": "СОБЫТИЯ",
                     "subtabs": subs})

    # ── ТАБ · ТРУДЫ ──────────────────────────────────────────────────────
    tr = []
    if books:
        tr.append(section(
            "Книги в библиотеке приложения",
            ["Что даёт этот раздел: его труды, которые можно открыть и читать целиком."],
            cite=[({"ref": b["title"], "to": "/" + b["slug"]} if b.get("slug")
                   else {"ref": b["title"]}) for b in books], hero=HN))
    by_work = {}
    for f in labour:
        by_work.setdefault(f["book"], []).append(f)
    for book, fs in by_work.items():
        tr.append(section(
            "О его трудах · %s" % book,
            ["Что даёт этот раздел: свидетельства источников о трудах %s." % gen],
            quotes=[quote_of(f, forms, ids_ok, used) for f in fs[:MAX_PER_SECTION]],
            hero=HN))
    if tr:
        tabs.append({"id": "trudy", "label": "Труды", "kicker": "НАСЛЕДИЕ",
                     "subtabs": [{"id": "knigi", "label": "Книги и свидетельства",
                                  "sections": tr}]})

    # ── ТАБ · УЧЕНИЕ И АВТОРИТЕТ — где на него ССЫЛАЮТСЯ ─────────────────
    uch = {}
    for f in author:
        uch.setdefault(f["book"], []).append(f)
    subs = [{"id": slugify(book), "label": book, "sections": [section(
        "%s · %s" % (book, div_label(fs[0])),
        ["Что даёт этот раздел: здесь на %s ссылаются как на авторитет — его слово "
         "приводится как доказательство." % full],
        quotes=[quote_of(f, forms, ids_ok, used) for f in fs[:MAX_PER_SECTION * 2]],
        hero=HN)]} for book, fs in uch.items()]
    if subs:
        tabs.append({"id": "uchenie", "label": "Учение и авторитет",
                     "kicker": "ПРАМАНА", "subtabs": subs})

    # ── ТАБ · ПРОСЛАВЛЕНИЕ ───────────────────────────────────────────────
    subs = []
    if glory:
        secs = []
        gl = {}
        for f in glory:
            gl.setdefault(f["book"], []).append(f)
        for book, fs in gl.items():
            secs.append(section(book, ["Что даёт этот раздел: как источники славят %s." % gen],
                                quotes=[quote_of(f, forms, ids_ok, used)
                                        for f in fs[:MAX_PER_SECTION]], hero=HN))
        subs.append({"id": "v-shastrah", "label": "В шастрах", "sections": secs})
    by_song = {}
    for f in bhajans:
        if f["kind"] == "bhajan":
            by_song.setdefault(f["book"], []).append(f)
    if by_song:
        mine = {k: v for k, v in by_song.items() if any(x.get("byId") == hero for x in v)}
        other = {k: v for k, v in by_song.items() if k not in mine}
        for label, group, sid in (("Его сочинения", mine, "sochineniya"),
                                  ("Молитвы к нему", other, "molitvy")):
            if not group:
                continue
            secs = [section(name, [], quotes=[quote_of(f, forms, ids_ok, used)
                                              for f in sorted(fs, key=lambda x: x["ordinal"])],
                            hero=HN) for name, fs in group.items()]
            subs.append({"id": sid, "label": label, "sections": secs})
    if subs:
        tabs.append({"id": "proslavlenie", "label": "Прославление",
                     "kicker": "СЛАВА", "subtabs": subs})

    # ── ТАБ · ШРИЛА ПРАБХУПАДА О НЁМ (комментарии — только по существу) ───
    pr = {}
    for f in sorted(purports, key=lambda x: (x["src"], x.get("div", ""), x.get("ordinal", 0))):
        pr.setdefault(f["src"], {}).setdefault(div_label(f), []).append(f)
    subs = []
    for src, groups in pr.items():
        book = next(iter(next(iter(groups.values()))))["book"]
        secs = [section(
            "%s · %s" % (book, g),
            ["Что даёт этот раздел: то, что Шрила Прабхупада говорит о %s по существу — "
             "не мимоходом." % ("нём" if hero != "prabhupada" else "себе")],
            quotes=[quote_of(f, forms, ids_ok, used) for f in fs[:MAX_PER_SECTION]],
            hero=HN) for g, fs in groups.items()]
        subs.append({"id": slugify(book), "label": book, "sections": secs})
    if subs and hero != "prabhupada":
        tabs.append({"id": "prabhupada", "label": "Шрила Прабхупада о нём",
                     "kicker": "КОММЕНТАРИИ", "subtabs": subs})
    elif subs:
        tabs.append({"id": "prabhupada", "label": "Его комментарии",
                     "kicker": "СЛОВО", "subtabs": subs})

    # ── КНИГА, КОТОРАЯ ВСЯ О НЁМ ─────────────────────────────────────────
    over = {**cut_a, **cut_p}
    if over:
        secs = []
        for w, (n, title) in sorted(over.items(), key=lambda kv: -kv[1][0]):
            secs.append(section(
                title,
                ["Эта книга говорит о герое на протяжении всего текста: в карточку взято "
                 "самое плотное, ещё %d мест ждут в самой книге. Карточка — свод, а не "
                 "копия библиотеки." % n],
                cite=[{"ref": title, "to": "/" + slugmap.get(w, w)}], hero=HN))
        tabs.append({"id": "kniga-o-nem", "label": "Книги о нём", "kicker": "ЦЕЛИКОМ",
                     "subtabs": [{"id": "polnye-knigi", "label": "Полные книги",
                                  "sections": secs}]})

    # ── ТАБ · ИСТОЧНИКИ (провенанс) ──────────────────────────────────────
    subs = []
    if archive:
        by_file = {}
        for f in archive:
            by_file.setdefault(f["src"], []).append(f)
        secs = []
        for src, fs in sorted(by_file.items(), key=lambda kv: -sum(x["ordinal"] for x in kv[1])):
            hits = sum(x["ordinal"] for x in fs)
            secs.append(section(
                Path(src).stem.replace("-", " ").replace("_", " · "),
                ["Пассажей с именем героя: %d, упоминаний: %d. Первоисточник даёт факты "
                 "в прозу жития. Дословная цитата отсюда появится, когда книга будет "
                 "внесена в приложение (ЗКН-П004)." % (len(fs), hits)],
                cite=[{"ref": src}], hero=HN))
        subs.append({"id": "biblioteka", "label": "Библиотека", "sections": secs})
    if online:
        by_site = {}
        for f in online:
            by_site.setdefault(f["src"], []).append(f)
        secs = []
        for site, fs in sorted(by_site.items(), key=lambda kv: -len(kv[1])):
            pages, seen_u = [], set()
            for f in fs:
                u = f.get("url") or f["ref"]
                if u in seen_u:
                    continue
                seen_u.add(u)
                pages.append({"ref": "%s — %s" % (f["ref"][:80], u)})
            secs.append(section(
                SITE_NAMES.get(site, site),
                ["Прочитано страниц: %d. Внешний источник даёт ФАКТ и дату — в прозу "
                 "жития. Дословной шастра-цитатой он не становится (ЗКН-П004)." % len(pages)],
                cite=pages[:12], hero=HN))
        subs.append({"id": "onlayn", "label": "Онлайн", "sections": secs})
    if subs:
        tabs.append({"id": "istochniki", "label": "Источники",
                     "kicker": "ПРОВЕНАНС", "subtabs": subs})

    # ── СОХРАННОСТЬ рукописных табов (ЗКН-Р002), с лечением ──────────────
    if keep:
        have = {t["id"] for t in tabs}
        for t in keep.get("tabs", []):
            if t.get("id") not in have:
                tabs.append(heal(t, HN, slugmap))

    for t in tabs:
        for sub in t.get("subtabs", []):
            sub["sections"] = [x for x in sub["sections"]
                               if x.get("quotes") or x.get("cite") or x.get("see")]
        t["subtabs"] = [x for x in t.get("subtabs", []) if x["sections"]]
    tabs = [t for t in tabs if t.get("subtabs") or t.get("sections")]

    dedupe_headings({"tabs": tabs})
    return {"tabs": tabs}


def work_slugs():
    if not d1.available():
        return {}
    if "slugs" not in _CACHE:
        _CACHE["slugs"] = {r["id"]: r["slug"] for r in (d1.query(
            "SELECT id, slug FROM book_catalog WHERE readable=1 AND slug IS NOT NULL") or [])}
    return _CACHE["slugs"]


def fix_to(to, slugmap):
    """`/book/cc/madhya/19/117` → `/chaitanya-charitamrita/madhya/19/117` (ЗКН-Н008)."""
    if not to or not to.startswith("/book/"):
        return to
    seg = to.strip("/").split("/")[1:]
    if not seg:
        return to
    slug = slugmap.get(seg[0], seg[0])
    return "/" + "/".join([slug] + seg[1:])


def heal(node, hero, slugmap):
    """Прогнать чужой (рукописный) узел через законы текста и адресов."""
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k in ("h", "label", "kicker", "title", "lead") and isinstance(v, str):
                out[k] = canon.clean_card_text(canon.enforce_hero(v, *hero))
            elif k == "p" and isinstance(v, list):
                out[k] = [canon.clean_card_text(canon.enforce_hero(x, *hero))
                          if isinstance(x, str) else x for x in v]
            elif k == "to" and isinstance(v, str):
                out[k] = fix_to(v, slugmap)
            elif k == "see" and isinstance(v, list):
                out[k] = [{**x, "t": canon.clean_card_text(x.get("t", ""))}
                          if isinstance(x, dict) else x for x in v]
            elif k in ("t", "translit"):        # ЗКН-БТ004: чужой голос не правим
                out[k] = v
            else:
                out[k] = heal(v, hero, slugmap)
        return out
    if isinstance(node, list):
        return [heal(x, hero, slugmap) for x in node]
    return node


def dedupe_headings(book):
    """total_h = distinct_h — по построению, а не по молитве.

    Дубль заголовка — не косметика: в оглавлении две одинаковые строки, и человек
    не знает, куда он уже заходил.
    """
    seen = {}
    for t in book.get("tabs", []):
        for sub in t.get("subtabs", []) or [{"label": "", "sections": t.get("sections") or []}]:
            for sec in sub.get("sections", []):
                h = sec.get("h")
                if not h:
                    continue
                if h not in seen:
                    seen[h] = 1
                    continue
                seen[h] += 1
                alt = "%s · %s" % (h, sub.get("label") or t.get("label") or "")
                if alt in seen:
                    alt = "%s (%d)" % (h, seen[h])
                sec["h"] = alt.strip(" ·")
                seen[sec["h"]] = 1


def stats(book):
    j = json.dumps(book, ensure_ascii=False)
    hs = re.findall(r'"h":\s*"([^"]*)"', j)
    return {"tabs": len(book.get("tabs", [])),
            "subtabs": sum(len(t.get("subtabs", [])) for t in book.get("tabs", [])),
            "sections": len(hs), "distinct_h": len(set(hs)),
            "quotes": j.count('"ref":'), "chars": len(j)}
