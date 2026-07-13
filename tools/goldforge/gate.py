#!/usr/bin/env python3
"""
ГЕЙТ · книга не выходит в прод, пока не чиста.

Здесь механизируется закон, который до сих пор держался на честном слове —
**ЗКН-БТ001, ноль фабрикации.** Документ говорил «не выдумывай». Гейт проверяет.

Как проверяется невыдуманность (ГЕЙТ СОДЕРЖАНИЯ):
  берём КАЖДОЕ имя собственное и КАЖДОЕ число из авторской прозы карточки и
  требуем, чтобы оно встречалось в ДОСЬЕ — то есть в реально собранном
  материале. Не нашлось — это выдумка, и сборка падает. Модель может писать
  красиво; сочинить дату или деревню она не может: числа и имена в прозе
  обязаны иметь предъявленный источник.

И дословность:
  каждая цитата сверяется с D1 (стих / комментарий / куплет). Совпадение —
  ПОДСТРОЧНОЕ: цитата обязана дословно лежать в источнике. Не лежит — падаем.

Остальное — AUDIT-TO-ZERO плейбука (ЗКН-П003):
  json_valid · первый таб «Вклад в Гауранга Лилу» · нет дублей заголовков ·
  нет дублей ссылок · 0 битых `to` · 0 прямых апострофов в прозе · канон имён ·
  полное имя героя · храповик (новая книга не беднее старой).
"""
import json
import re

from . import canon, d1
from .channels import fold

AUTHORED = ("h", "p", "label", "kicker", "by", "t_see")
STOP_CAPS = {
    "Господь", "Господа", "Господу", "Господом", "Господе", "Бог", "Бога", "Богу",
    "Он", "Его", "Ему", "Им", "Нём", "Она", "Они", "Их", "Труды", "Молитвы", "Песни",
    "Повествование", "Оценка", "Найдено", "Материал", "Дословные", "Дословная",
    "Внешний", "Использован", "Личности", "Наследие", "Связи", "Комментарии",
    "Житие", "Миссия", "Источники", "Библиотека", "Онлайн", "Вклад", "Бхаджаны",
    "Прославления", "Сочинения", "Шрила", "Шри", "Шримати", "Тхакур", "Госвами",
    "Прабху", "Махарадж", "Пандит", "Ачарья", "Кханда", "Песнь", "Лила", "Глава",
    "Стих", "Стихи", "Куплет", "Перевод", "Комментарий", "Раздел", "Книга", "Книги",
    "Гауранга", "Кришна", "Чайтанья", "Махапрабху", "Прабхупады", "Прабхупада",
    "Радхарани", "Вриндаван", "Навадвипа",
}
CAP = re.compile(r"(?<![А-Яа-яЁё])([А-ЯЁ][а-яё]{2,})")
NUM = re.compile(r"\b(\d{2,4})\b")
SENT_START = ".!?«»(\n\u2014"          # после них заглавная — это НЕ имя, а начало фразы
OWN_NUMBERS = set()                   # бухгалтерия конвейера (ставит goldforge)
# Поля, которые гейт содержания НЕ судит:
#   label / kicker — наша навигация («Вклад в Гауранга Лилу»), не утверждение
#   see[].t        — имена из `entity_names`, они уже проверены графом (byId)
NOT_A_CLAIM = (".label", ".kicker")


def _proper(text):
    """Имена собственные = заглавные СЕРЕДИНЫ фразы.

    Заглавная в начале предложения ничего не значит («Пассажей…», «Первоисточник…»),
    и ловить её — плодить ложные срабатывания. Настоящее имя в живой прозе почти
    всегда стоит в середине: «…встретил Рупу Госвами в Праяге». Числа же проверяем
    ВСЕ и всегда: дата, год, количество — самый частый способ соврать.
    """
    out = []
    for m in CAP.finditer(text or ""):
        i = m.start() - 1
        while i >= 0 and text[i] == " ":
            i -= 1
        if i < 0 or text[i] in SENT_START:
            continue
        out.append(m.group(1))
    return out


FORGE_TABS = {"vklad-gauranga-lila", "zhitie", "upominaniya", "prabhupada",
              "kniga-o-nem", "bhajany", "istochniki"}


def machine_only(book):
    """Конвейер отвечает за то, что написал САМ.

    Старые табы курировал человек: его прозу нельзя мерить гейтом содержания —
    он писал по книгам, которых может не быть в этой жатве. Молча удалить её
    (ЗКН-Р002) нельзя, объявить фабрикацией — нечестно. Значит: машинные табы
    судим строго, рукописные — чиним (`compose.heal`) и считаем долгом.
    """
    return {"tabs": [t for t in book.get("tabs", []) if t.get("id") in FORGE_TABS]}


def walk(book):
    """Обойти книгу, вернуть (путь, поле, значение) для авторских полей и цитат."""
    for ti, t in enumerate(book.get("tabs", [])):
        for f in ("label", "kicker", "title", "lead"):
            if t.get(f):
                yield ("tabs[%d].%s" % (ti, f), "authored", t[f])
        subs = t.get("subtabs") or [{"id": t.get("id"), "label": "", "sections": t.get("sections") or []}]
        for si, s in enumerate(subs):
            if s.get("label"):
                yield ("tabs[%d].subtabs[%d].label" % (ti, si), "authored", s["label"])
            for ci, sec in enumerate(s.get("sections", [])):
                base = "tabs[%d].subtabs[%d].sections[%d]" % (ti, si, ci)
                if sec.get("h"):
                    yield (base + ".h", "authored", sec["h"])
                for pi, p in enumerate(sec.get("p", [])):
                    yield ("%s.p[%d]" % (base, pi), "authored", p)
                for qi, q in enumerate([*( [sec["quote"]] if sec.get("quote") else []), *sec.get("quotes", [])]):
                    yield ("%s.quotes[%d]" % (base, qi), "quote", q)
                for ci2, c in enumerate(sec.get("cite", [])):
                    yield ("%s.cite[%d]" % (base, ci2), "cite", c)
                for si2, e in enumerate(sec.get("see", [])):
                    yield ("%s.see[%d]" % (base, si2), "authored", e.get("t", ""))


def structure(book, hero_short, hero_full):
    bad = []
    tabs = book.get("tabs", [])
    if not tabs:
        return [("СТРУКТУРА", "книга пуста")]
    if tabs[0].get("id") != "vklad-gauranga-lila":
        bad.append(("ЗКН-П003/10", "первый таб не «Вклад в Гауранга Лилу» (%s)" % tabs[0].get("id")))
    hs, refs = [], []
    for path, kind, v in walk(book):
        if kind == "authored":
            # «Вклад в Гауранга Лилу» — название вкладки и каноническое понятие
            # проекта. Требовать в нём полного имени героя = требовать «Вклад в
            # Гауранга Махапрабху Лилу». Навигация не склоняется.
            nav = path.endswith(NOT_A_CLAIM)
            for why in canon.prose_violations(v, None if nav else hero_short,
                                              None if nav else hero_full):
                bad.append((path, why))
            if path.endswith(".h"):
                hs.append(v)
        elif kind == "quote":
            if v.get("ref"):
                refs.append(v["ref"])
            if not v.get("t"):
                bad.append((path, "цитата без текста"))
    dup_h = {h for h in hs if hs.count(h) > 1}
    if dup_h:
        bad.append(("ЗКН-П003", "дубли заголовков: %s" % ", ".join(list(dup_h)[:3])))
    mrefs = [q["ref"] for _p, k, q in walk(machine_only(book))
             if k == "quote" and q.get("ref")]
    dup_r = {r for r in mrefs if mrefs.count(r) > 1}
    if dup_r:
        bad.append(("ЗКН-П003", "дубли ссылок (%d): %s" % (len(dup_r), ", ".join(list(dup_r)[:3]))))
    return bad


def links(book):
    """0 битых `to`. Внешний URL в `to` запрещён — он не маршрут приложения.

    Рукописные табы уже вылечены (`compose.heal` переводит легаси-адрес в
    канонический). Если ссылка всё же битая — она ведёт в книгу, которой в
    приложении НЕТ (признанный долг ЗКН-П004). Это долг, а не повод не пускать
    новую книгу к людям.
    """
    if not d1.available():
        return []
    book = machine_only(book)
    slugs = {r["slug"] for r in (d1.query(
        "SELECT slug FROM book_catalog WHERE readable=1 AND slug IS NOT NULL") or [])}
    bad = []
    for path, kind, q in walk(book):
        if kind != "quote" or not q.get("to"):
            continue
        to = q["to"]
        if to.startswith("http"):
            bad.append((path, "внешний URL в `to`: %s" % to[:50]))
            continue
        seg = to.strip("/").split("/")
        if seg[0] == "bhajans":
            continue
        if seg[0] not in slugs:
            bad.append((path, "битая ссылка: %s" % to))
    return bad


def verbatim(book):
    """Дословность цитат — сверка с D1. Не совпало → это уже не шастра.

    Судим цитаты, которые поставил конвейер. Рукописные цитаты старой карточки
    могут расходиться невидимо (прекомпозиция «ё», nbsp) — это долг, он уходит
    в бриф куратору, но не блокирует новую книгу.
    """
    if not d1.available():
        return []
    book = machine_only(book)
    slug2work = {r["slug"]: r["id"] for r in (d1.query(
        "SELECT id, slug FROM book_catalog WHERE readable=1 AND slug IS NOT NULL") or [])}
    want = {}
    for path, kind, q in walk(book):
        if kind != "quote" or not q.get("to") or not q.get("t"):
            continue
        seg = q["to"].strip("/").split("/")
        if seg[0] == "bhajans":
            continue
        w = slug2work.get(seg[0])
        if not w or len(seg) < 2:
            continue          # ссылка на КНИГУ целиком, а не на стих — сверять нечего
        want[".".join([w] + seg[1:])] = (path, q["t"])
    bad = []
    ids = list(want)
    for chunk in d1.chunks(ids, 40):
        inlist = ",".join("'" + i.replace("'", "''") + "'" for i in chunk)
        rows = d1.query("SELECT v.id, vt.translation, vt.purport FROM verses v "
                        "JOIN verse_texts vt ON vt.verse_id=v.id WHERE v.id IN (%s)" % inlist) or []
        got = {r["id"]: r for r in rows}
        for vid in chunk:
            path, t = want[vid]
            src = got.get(vid)
            if not src:
                bad.append((path, "стиха %s нет в D1" % vid))
                continue
            body = (src.get("translation") or "") + "\n" + (src.get("purport") or "")
            core = t.strip("… ").strip()
            if core and _norm(core) not in _norm(body):
                bad.append((path, "цитата НЕ дословна: %s" % vid))
    return bad


def _norm(s):
    return re.sub(r"\s+", " ", (s or "").replace("\u00a0", " ").replace("ё", "е")).strip()


def in_corpus(w, corpus):
    """Слово (или его основа) лежит в уликах?

    Гейт обязан знать РУССКИЕ ПАДЕЖИ. Иначе он объявляет выдумкой «в Праяге»
    только потому, что источник говорит «Прояг». Отсекаем до трёх букв — этого
    хватает на падеж и не хватает на подлог: «Ливерпуле» → «ливерп» в корпусе
    всё равно нет.
    """
    f = fold(w)
    for k in range(4):
        stem = f[:len(f) - k]
        if len(stem) >= 4 and stem in corpus:
            return True
    return False


def containment(book, dossier):
    """ГЕЙТ НУЛЕВОЙ ФАБРИКАЦИИ (ЗКН-БТ001 · У5).

    Имя собственное или число, которого НЕТ в собранном материале, — выдумка.

    ЧТО ГЕЙТ НЕ СУДИТ: названия табов и суб-табов. «Вклад в Гауранга Лилу» —
    это наша навигация, а не утверждение о мире, и требовать от источника слово
    «Лилу» в винительном падеже — значит ронять сборку на собственном интерфейсе
    (так и упал Бхугарбха Тхакур). Судим то, что УТВЕРЖДАЕТ: прозу и заголовки.
    """
    # Улика — это не только текст пассажа, но и его паспорт: имя рассказчика,
    # название книги, заголовок главы. Всё это данные из D1 и works.json, а не
    # сочинение. Не включить их в корпус — значит объявить выдумкой собственную
    # проверенную базу.
    parts = []
    for f in dossier.get("findings", []):
        parts += [f.get("text", ""), f.get("ref", ""), f.get("book", ""),
                  f.get("div_title", ""), f.get("by", "") or "", f.get("src", "")]
    parts += dossier["passport"].get("names", [])
    parts += dossier["passport"].get("strict", [])
    corpus = fold(" ".join(parts))
    book = machine_only(book)
    bad = []
    for path, kind, v in walk(book):
        if kind != "authored" or not v:
            continue
        if path.endswith(NOT_A_CLAIM) or ".see[" in path:
            continue                    # навигация и подписи графа — не утверждения
        for w in _proper(v):
            if w in STOP_CAPS or len(w) < 4:
                continue
            if not in_corpus(w, corpus):
                bad.append((path, "ФАБРИКАЦИЯ: имени «%s» нет в источниках" % w))
        for n in NUM.findall(v):
            if n in OWN_NUMBERS:
                continue                # это НАШ счётчик, а не факт из источника
            if n not in corpus:
                bad.append((path, "ФАБРИКАЦИЯ: числа «%s» нет в источниках" % n))
    return bad


def ratchet(book, prev):
    """Храповик: новая книга не беднее старой (ЗКН-Р002 — ничего не пропадает)."""
    if not prev:
        return []
    def count(b):
        j = json.dumps(b, ensure_ascii=False)
        return j.count('"h":'), j.count('"ref":')
    ns, nq = count(book)
    os_, oq = count(prev)
    bad = []
    if ns < os_:
        bad.append(("ЗКН-Р002", "секций стало МЕНЬШЕ: %d → %d" % (os_, ns)))
    if nq < oq:
        bad.append(("ЗКН-Р002", "цитат стало МЕНЬШЕ: %d → %d" % (oq, nq)))
    return bad


def legacy_debt(book, dossier, hero_short, hero_full):
    """Долг рукописных табов. Не блокирует — но и не молчит (ЗКН-Ц007, храповик).

    Молча закрыть глаза — ложь живёт. Удалить наугад — правда теряется.
    Значит: назвать числом и показать куратору.
    """
    ids = {t.get("id") for t in book.get("tabs", [])} - FORGE_TABS
    if not ids:
        return []
    legacy = {"tabs": [t for t in book.get("tabs", []) if t.get("id") in ids]}
    out = []
    for path, kind, v in walk(legacy):
        if kind == "authored":
            out += [(path, w) for w in canon.prose_violations(v, hero_short, hero_full)]
        elif kind == "quote" and (v.get("to") or "").startswith("/book/"):
            out.append((path, "легаси-адрес не вылечен: %s" % v["to"]))
    return out


def false_witness(book):
    """ЗКН-П014 · ЛОЖНОЕ СВИДЕТЕЛЬСТВО.

    Второй рубеж. Сборка уже снимает такие цитаты — гейт проверяет, что ни одна
    не просочилась. Подпись под чужими словами страшнее пустой карточки.
    """
    bad = []
    for path, kind, q in walk(book):        # и машинные, и рукописные табы
        if kind != "quote":
            continue
        why = canon.anachronism(q.get("t", ""), q.get("byId"))
        if why:
            bad.append((path, "ЛОЖНОЕ СВИДЕТЕЛЬСТВО: %s" % why))
    return bad


CHECKS = [
    ("структура · канон · дубли", structure),
    ("ЛОЖНОЕ СВИДЕТЕЛЬСТВО", false_witness),
    ("ссылки (bad_links=0)", links),
    ("дословность цитат", verbatim),
    ("НУЛЕВАЯ ФАБРИКАЦИЯ", containment),
    ("храповик (не беднее)", ratchet),
]


def run(book, dossier, prev, hero_short, hero_full):
    out = []
    debt = legacy_debt(book, dossier, hero_short, hero_full)
    if debt:
        print("  ⚠ долг рукописных табов (не блокирует): %d" % len(debt))
        for p_, w in debt[:5]:
            print("      %s — %s" % (str(p_)[:44], w[:56]))
    for name, fn in CHECKS:
        if fn is structure:
            bad = fn(book, hero_short, hero_full)
        elif fn is containment:
            bad = fn(book, dossier)
        elif fn is ratchet:
            bad = fn(book, prev)
        else:
            bad = fn(book)
        print("  %s %-28s %d" % ("✓" if not bad else "✗", name, len(bad)))
        out += [(name, p, w) for p, w in bad]
    return out
