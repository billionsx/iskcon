#!/usr/bin/env python3
"""
ЛИНТЕР ЗАКОНОВ — уровень принуждения У5 (docs/LAWS.md §1).

Нарушение закона не может попасть в прод: линтер роняет сборку.
Проверяет ИСХОДНЫЙ КОД приложения: apps/web/src/** И воркер-файлы рядом
(worker.ts, workerCalendar.ts, workerHome.ts) — не данные D1.
Воркер отдаёт человеку тот же текст, что и экран: закон, применённый к части
файлов, не применён.

Правила:
  Д003  ноль шаблонного мусора (leftover `Apartsales`)
  И001  голая «Шри Чайтанья Махапрабху» в UI-строках запрещена
  И003  «Гауранга-лила» / «Кришна-лила» — с заглавной, без дефиса (кроме slug/id)
  Т002  проза карточки идёт через cleanCardText (единая точка renderProse)
  Ц001  секреты не хардкодятся (ghp_ / github_pat_)

Чужой голос (ЗКН-БТ004): цитаты, стихи и выдержки Прабхупады НЕ проверяются на
канон имён — они не редактируются. В коде это данные из БД, линтер их не видит.

Запуск: python3 tools/laws-lint.py
"""
import json
import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps" / "web" / "src"

# ═══ ЗКН-Ц006 — СЛЕПАЯ ЗОНА ЛИНТЕРА (закрыта 13.07.2026) ═══
# Линтер смотрел ТОЛЬКО в `apps/web/src`. А рядом с ним, на этаж выше, лежат
# ВОРКЕР-ФАЙЛЫ — и они отдают человеку тот же текст, что и экран. За пределами
# `src` закон просто НЕ ДЕЙСТВОВАЛ, и это не теория:
#
#   · `workerCalendar.ts` печатал «явление Шри Чайтаньи Махапрабху» (ЗКН-И001) —
#     голая форма, в ПРОДЕ, в каждой строке Гаура-пурнимы;
#   · `worker.ts` держал ВТОРУЮ КОПИЮ фильтра даршанов с теми самыми тремя
#     мёртвыми условиями (`\bкурс\b`, `\bбилет`, `\bзакат\b`), ради которых и
#     писался ЗКН-Ф011. Копию в `src` починили — эту не увидели;
#   · `worker.ts` строил `https://gaurangers.com/...` строкой (ЗКН-Н020) — и это
#     адреса, уходящие В БУМАГУ (QR страницы книги) и В ПОЧТУ.
#
# Закон, применённый к части файлов, не применён (ср. ЗКН-Н016). Область — весь
# исполняемый код приложения, а не одна папка.
WORKERS = sorted((ROOT / "apps" / "web").glob("*.ts"))

# cardText.ts САМ определяет запрещённые формы (в regex) — он освобождён.
ALLOW = {"cardText.ts", "nav.ts", "routes.ts", "SectionSubTabs.tsx"}

RULES = [
    {
        "id": "card_text_raw",
        "law": "ЗКН-Т002",
        "name": "текст личности НЕ прошёл cleanCardText",
        # Очистка — не косметика. Она правит канонические имена («Шри Чайтанья
        # Махапрабху» → «Гауранга Махапрабху») и разбивает предложения, нанизанные
        # через точку с запятой.
        #
        # Пропустили её ровно там, где ошибку уже НЕ ИСПРАВИТЬ: в PDF. Экран можно
        # перевыкатить — БУМАГУ нельзя. Человек унесёт её с собой, и ошибка
        # переживёт все правки.
        "pattern": re.compile(r"lines[.]push[(]para[.]trim[(][)][)]"),
        "hint": "→ любой текст личности — через cleanCardText(). PDF это БУМАГА: "
                "ошибку в ней уже не поправить (ЗКН-Т002)",
    },
    {
        "id": "scripture_font",
        "law": "ЗКН-С002",
        "name": "чужой голос набран СВОИМ шрифтом (в обход Skt)",
        # Georgia + курсив = «говорит НЕ автор карточки»: стих, цитата, пословный
        # перевод, IAST. Для этого есть общий компонент `ui/Skt.tsx`.
        #
        # Кто рисует цитату САМ — рано или поздно наберёт её не тем шрифтом, и
        # чужой голос сольётся с нашим. Читатель перестанет различать, где
        # священный текст, а где пересказ. Это уже не типографика — это
        # достоверность (ср. ЗКН-БТ004).
        # Курсив и сериф рядом — в любом порядке.
        "pattern": re.compile(
            r'(?:fontStyle:\s*"italic"[^;}]{0,160}?(?:Georgia|serif)'
            r'|(?:Georgia|"[^"]*serif)[^;}]{0,160}?fontStyle:\s*"italic")'),
        "hint": "→ чужой голос — через <Skt> (Georgia + курсив, --font-scripture). "
                "Свой шрифт для цитаты стирает границу между голосами (ЗКН-С002)",
    },
    {
        "id": "ЗКН-Д007c",
        "name": "БЕЛАЯ заглушка в массиве обложек ГЕРОЯ",
        # ВБК сам рисует ТЁМНУЮ заглушку, когда обложек НЕТ (`n === 0`).
        # Положить туда белую = обойти закон: массив непуст, тёмная не сработает,
        # и белый текст ляжет на светлый логотип. Массив обложек должен быть ПУСТ.
        "pattern": re.compile(r"covers:\s*\[\s*COVER_FALLBACK\s*[,\]]"),
        "hint": "→ covers: [] — тогда ВБК нарисует ТЁМНУЮ заглушку сам (ЗКН-Д007)",
    },
    {
        "id": "ЗКН-Д003",
        "name": "ноль шаблонного мусора (Apartsales)",
        "pattern": re.compile(r"apartsales", re.I),
        "hint": "заменить на наши названия (ISKCON ONE LOVE) и токены --color-gold*",
    },
    {
        "id": "ЗКН-И001",
        "name": "голая «Шри Чайтанья Махапрабху»",
        # «Шри Кришна Чайтанья Махапрабху» — КАНОНИЧНА (между Шри и Чайтанья стоит Кришна)
        "pattern": re.compile(r"Шри\s+Чайтань[а-я]*\s+Махапрабху"),
        "hint": "→ «Гауранга Махапрабху» (общий/Навадвипа) или «Шри Кришна Чайтанья Махапрабху» (санньяса/Пури)",
    },
    {
        "id": "ЗКН-И003",
        "name": "дефисные «Гауранга-лила» / «Кришна-лила»",
        "pattern": re.compile(r"(Гауранга|Кришна)-лил[а-я]"),
        "hint": "→ «Гауранга Лила» / «Кришна Лила» (оба слова с заглавной, без дефиса)",
    },
    {
        "id": "ЗКН-Д007",
        "name": "суррогатная обложка (спектрограмма / буква-монограмма / авто-парсинг)",
        "pattern": re.compile(r"archive\.org/services/img|audio-cover(-light)?\.png|/covers/[a-z-]+-ia\.jpg"),
        "hint": "→ COVER_FALLBACK / <CoverFallback dark /> (ЗКН-Д005/Д007). Суррогат хуже честной заглушки",
    },
    {
        "id": "ЗКН-Н001",
        "name": "прямая запись истории мимо nav.ts",
        "pattern": re.compile(r"history\.(push|replace)State"),
        "hint": "→ pushUrl() / replaceUrl() из ./nav. Сырой replaceState стирает appIdx и ломает «назад»",
    },
    {
        "id": "ЗКН-Н005",
        "name": "суб-таб в переменной модуля (мимо URL)",
        "pattern": re.compile(r"^let\s+\w*(Sub|Tab)\s*=", re.M),
        "hint": "→ состояние навигации живёт в URL: pushUrl()/replaceUrl(). Было: bogSub, sadSub",
    },
    {
        "id": "ЗКН-Н010",
        "name": "второй липкий слой на top:0 (наложение)",
        "pattern": re.compile(r"position:\s*sticky;\s*top:\s*0[;\"']"),
        "hint": "→ липнуть ПОД вышестоящим: top: var(--h-hall-tabs). Два слоя на top:0 = нижний исчезает",
    },
    {
        "id": "ЗКН-Д007b",
        "name": "буква-монограмма вместо фирменной заглушки",
        "pattern": re.compile(r"charAt\(0\)\.toUpperCase\(\)"),
        "hint": "→ COVER_FALLBACK / <CoverFallback />. Инициал в кружке — суррогат (ЗКН-Д007)",
    },
    {
        "id": "ЗКН-Н016",
        "name": "навигация мимо ui/nav4 (своя копия или старые чёрные капсулы)",
        # Ловит и свои компоненты, и старый SectionSubTabs variant="chips" —
        # именно им остались Центры/Рестораны/Документы/Календарь, и линтер их не видел.
        "pattern": re.compile(r"function (FilterChip|Pills|SegRow)\b|variant=[\"']chips[\"']"),
        "hint": "→ FilterChips/ScopeTitle/HallTabs из ./ui/nav4 (ЗКН-Н006/Н016)",
    },
    {
        "id": "ЗКН-Н009",
        "name": "жёсткий дефолт-фильтр при входе (вместо «Все»)",
        "pattern": re.compile(r"sub:\s*[\"'](wave-|rasa:|bhag-)"),
        "hint": "→ sub: \"\" («Все»). Вход на витрину без фильтра в адресе показывает ВСЁ",
    },
    {
        "id": "ЗКН-Н020",
        "name": "адрес собран строкой мимо реестра маршрутов",
        "pattern": re.compile(r"\$\{ORIGIN\}/|https://gaurangers\.com/"),
        "hint": "→ ROUTES.* + url() из ./routes. Переименование маршрута ломало QR-коды и ссылки",
    },
    {
        "id": "ЗКН-С001",
        "name": "Georgia у ТЕРМИНА (можно только у стиха/цитаты/пословного)",
        "pattern": re.compile(r"class(Name)?=[\"']skt[\"'][\s\S]{0,40}font-scripture|SCRIPT_MARK[\s\S]{0,80}font-scripture"),
        "hint": "→ термин обычным шрифтом. Georgia = «говорит не автор карточки» (ЗКН-С001)",
    },
    {
        "id": "ЗКН-Т001",
        "name": "точка с запятой в тексте карточки",
        # «A; b» → «A. B». В карточке точка с запятой — всегда следствие машинной склейки.
        "pattern": re.compile(r'(summary|note|blurb|tagline):\s*"[^"]*;\s'),
        "hint": "→ «A; b» превратить в «A. B» (ЗКН-Т001). Санитайзер чистит рантайм, но в коде так писать нельзя",
    },
    {
        "id": "ЗКН-И002",
        "name": "«Радхарани» без «Шримати»",
        # Исключение: `radharani-de` — реальное лицо (мать Джаганнатхи даса Бабаджи).
        # Не нарушение: комментарий (//), поисковый алиас (q:), id сущности,
        # а также реальное лицо `radharani-de` (мать Джаганнатхи даса Бабаджи).
        "pattern": re.compile(r'^(?!\s*(//|\*)).*?(?<!Шримати )(?<!Шримати-)(?<!q: ")(?<!q: \')\bРадхарани\b(?![-\w])'),
        "hint": "→ «Шримати Радхарани» (ЗКН-И002). Компаунды «Радха-…» и поисковые алиасы допустимы",
    },
    {
        "id": "ЗКН-Ц002",
        "name": "многострочное сообщение коммита в скрипте",
        "pattern": re.compile(r'git commit[^\n]*-m\s+"[^"]*\\n'),
        "hint": "→ однострочное сообщение: многострочные ломают сериализацию тул-вызова (ЗКН-Ц002)",
    },
    {
        "id": "ЗКН-Д005",
        "name": "БЕЛАЯ заглушка у ГЕРОЯ книги (текст поверх → нужна ТЁМНАЯ)",
        # У героя книги название лежит ПОВЕРХ обложки. На белой заглушке белый
        # текст не читается. Я поставил белую четырём новым книгам — так нельзя.
        "pattern": re.compile(r"covers:\s*\[\s*COVER_FALLBACK\s*[,\]]"),
        "hint": "→ COVER_FALLBACK_DARK: на обложке-герое лежит текст (ЗКН-Д005/Д007)",
    },
    {
        "id": "ЗКН-Ф011",
        "name": "`\\b` в регулярке С КИРИЛЛИЦЕЙ (не сработает)",
        # В JavaScript `\b` определяется через `\w` = [A-Za-z0-9_]. Кириллицы там НЕТ.
        # `/^ГГД\b/` НЕ совпадает с «ГГД 193» — и функция МОЛЧА возвращает вход.
        # Вместо `\b` — явный просмотр вперёд: (?![А-Яа-яЁёA-Za-z]).
        # Ловим `\b` ВПРИТЫК к кириллице — только там он не сработает.
        # `\brsvp\b` рядом с русскими словами в одной регулярке — НЕ нарушение:
        # `\b` стоит у латиницы, с ней он работает.
        # Комментарии пропускаем: там закон ОБЪЯСНЯЕТСЯ, а не нарушается.
        "pattern": re.compile(r"^(?!\s*(?:\*|//|#)).*?(\\b[А-Яа-яЁё]|[А-Яа-яЁё]\\b)"),
        "hint": "→ `\\b` не работает с кириллицей (JS: \\w = [A-Za-z0-9_]). "
                "Взять (?![А-Яа-яЁёA-Za-z]) (ЗКН-Ф011)",
    },
    {
        "id": "ЗКН-Ц001",
        "name": "секрет в коде",
        "pattern": re.compile(r"(ghp_|github_pat_)[A-Za-z0-9_]{10,}"),
        "hint": "секреты только в GitHub Secrets / D1 app_config",
    },
]


def check_rules():
    """Правила без пометки — по коду приложения. С пометкой `"scope": "tools"` —
    по инструментам и воркфлоу: ловушки Ф011–Ф014 живут именно там."""
    bad = []
    app_rules = [r for r in RULES if r.get("scope") != "tools"]
    tool_rules = [r for r in RULES if r.get("scope") == "tools"]

    # ВЕСЬ код приложения: `apps/web/src/**` + воркер-файлы рядом с ним (WORKERS).
    for fp in sorted(SRC.rglob("*")) + WORKERS:
        if fp.suffix not in (".ts", ".tsx", ".css") or fp.name in ALLOW:
            continue
        try:
            text = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        for i, line in enumerate(text.split("\n"), 1):
            st = line.strip()
            # ЗКН-Ц005 — ИНСТРУМЕНТ НЕ ЛОВИТ ОБЪЯСНЕНИЕ НАРУШЕНИЯ.
            #
            # Я написал в комментарии: «она правит имена (запрещённая форма →
            # канон)» — и линтер поймал ЗАПРЕЩЁННУЮ ФОРМУ в тексте, где она
            # ПРИВЕДЕНА КАК ПРИМЕР. CI упал.
            #
            # Комментарий — это место, где закон ОБЪЯСНЯЮТ. Запретить в нём
            # называть нарушение — значит запретить объяснять, ПОЧЕМУ так нельзя.
            # Тогда в коде останутся правила без причин, и первый же человек их
            # снесёт, не поняв.
            #
            # Гейты стерегут КОД. Комментарий — не код.
            is_comment = st.startswith(("*", "//", "/*", "#"))

            for r in app_rules:
                if is_comment:
                    continue
                if "lint-ok" in line:      # явное исключение с объяснением рядом
                    continue
                if r["pattern"].search(line):
                    bad.append((r, str(fp.relative_to(ROOT)), i, line.strip()[:90]))

    if tool_rules:
        for fp in sorted((ROOT / "tools").rglob("*.py")):
            try:
                text = fp.read_text(encoding="utf-8")
            except Exception:
                continue
            for i, line in enumerate(text.split("\n"), 1):
                for r in tool_rules:
                    if r["pattern"].search(line):
                        bad.append((r, str(fp.relative_to(ROOT)), i, line.strip()[:90]))
    return bad


def check_floor_law():
    """ЗКН-Д006: пол типографики 11px. Ниже — нечитаемо (Apple HIG + правило globals.css).
    Исключения: печатная вёрстка (mm/pt), декоративные глифы, водяные знаки."""
    import re as _re
    pat = _re.compile(r"fontSize:\s*(\d+(?:\.\d+)?)(?![\d.])")
    pr = _re.compile(r"\d+(mm|pt)\b")
    GLYPHS = "◆●•★▸▾·✦"
    bad = []
    for fp in sorted(SRC.rglob("*")):
        if fp.suffix not in (".ts", ".tsx") or fp.name in DESIGN_EXEMPT | {"PdfDoc.tsx", "pdf.ts", "pdfCover.ts"}:
            continue
        for i, line in enumerate(fp.read_text(encoding="utf-8").split("\n"), 1):
            if pr.search(line) or any(g in line for g in GLYPHS):
                continue
            for m in pat.finditer(line):
                v = float(m.group(1))
                if v < 11:
                    bad.append(({"id": "ЗКН-Д006", "name": "кегль ниже пола 11px",
                                 "hint": "→ var(--text-caption2) (11px). Ниже 11px текст нечитаем (Apple HIG)"},
                                str(fp.relative_to(ROOT)), i, line.strip()[:80]))
    return bad


def check_prose_law():
    """ЗКН-Т002: EntityPage — единая точка прозы обязана прогонять cleanCardText."""
    ep = SRC / "EntityPage.tsx"
    if not ep.exists():
        return []
    s = ep.read_text(encoding="utf-8")
    m = re.search(r"function renderProse\([^)]*\)[^{]*\{(.{0,400})", s, re.S)
    if not m or "cleanCardText" not in m.group(1):
        return [({"id": "ЗКН-Т002", "name": "проза мимо закона",
                  "hint": "renderProse обязан прогонять текст через cleanCardText"},
                 "apps/web/src/EntityPage.tsx", 0, "renderProse без cleanCardText")]
    return []


# ═══════════════════════════════════════════════════════════════════════════
# ХРАПОВИК ДОЛГА (ЗКН-Д001) — ISKCON Design.
#
# Долг велик (~2000 магических значений), разовый рефакторинг опасен. Поэтому:
# база фиксируется, сборка падает при РОСТЕ. Уменьшать можно и нужно — база
# пересчитывается вниз (`python3 tools/laws-lint.py --update-baseline`).
# ═══════════════════════════════════════════════════════════════════════════

BASELINE = ROOT / "tools" / "laws-baseline.json"
# tokens.ts и globals.css ОПРЕДЕЛЯЮТ токены — им можно
DESIGN_EXEMPT = {"tokens.ts", "globals.css"}

DEBT = {
    "magic_font_size": {
        "law": "ЗКН-Д001",
        "name": "магический кегль вместо токена (fontSize: 13)",
        "pattern": re.compile(r"fontSize:\s*[0-9]"),
        "hint": "→ tk.text.* или var(--…); см. docs/STANDARD_design.md",
    },
    "gates_removed": {
        "law": "ЗКН-Ц011",
        "name": "гейт исчез (удаление не проходит молча)",
        "scope": "tools",
        "hint": "→ гейтов стало МЕНЬШЕ. Гейт можно срезать нечаянно — вырезая "
                "соседний блок, или заняв чужой номер. Пропал МОЛЧА: ни ошибки, "
                "ни падения, просто одной проверкой меньше (ЗКН-Ц011)",
    },
    "long_union": {
        "law": "ЗКН-Ф015",
        "name": "цепочка UNION ALL (падает в D1)",
        "scope": "tools",
        "hint": "→ D1: «too many terms in compound SELECT» при ~8 звеньях. "
                "Брать `WITH t(a,b) AS (VALUES …)` — у него предела нет (ЗКН-Ф015)",
    },
    "type_errors": {
        "law": "ЗКН-Ф016",
        "name": "ошибка типа (= КРАШ в браузере)",
        "scope": "tsc",
        "hint": "→ ошибка типа падает в браузере как React #31 и УБИВАЕТ ВСЁ приложение "
                "(белый лист везде). Сборка esbuild этого не ловит (ЗКН-Ф016)",
    },
    "bare_urlopen": {
        "law": "ЗКН-Ф014",
        "name": "urlopen БЕЗ перехвата HTTPError (падает молча)",
        # `urlopen` кидает HTTPError на 400, и без перехвата CI показывает лишь
        # «exit code 1». Три прогона ушли впустую, пока d1() не начал печатать тело
        # ответа: настоящей ошибкой было «too many SQL variables».
        # Долг — старые разовые скрипты. Новые обязаны ловить и печатать.
        "scope": "tools",
        "hint": "→ try/except urllib.error.HTTPError + напечатать тело ответа (ЗКН-Ф014)",
    },
    "hardcoded_hex": {
        "law": "ЗКН-Д001",
        "name": "голый hex вместо токена (#D2AA1B)",
        "pattern": re.compile(r"[\"'`]#[0-9a-fA-F]{3,8}[\"'`]"),
        "hint": "→ var(--color-gold) / var(--color-gold-deep); см. docs/STANDARD_design.md",
    },
    "tracked_big_binary": {
        "law": "ЗКН-Ф025",
        "name": "тяжёлый бинарь закоммичен в git (>512 КБ)",
        "scope": "git",
        "hint": "→ бинарь (фото/видео/аудио/pdf) НЕ живёт в git — раздувает клон, "
                "жрёт минуты CI, история не чистится. Выноси на два зеркала: "
                "`tools/assets/offload.py` (archive.org + GitHub Releases), индекс в "
                "docs/assets/manifest.jsonl (ЗКН-Пл023/Ф025). Шрифты не в счёт",
    },
}


def count_long_union():
    """ЗКН-Ф015 — ЦЕПОЧКА `UNION ALL` ПАДАЕТ В D1.

    D1 не переваривает длинный compound SELECT: «too many terms in compound
    SELECT». Порог — примерно 8 звеньев. Запрос ПРОСТО НЕ ВЫПОЛНЯЕТСЯ, и это
    выглядит как «база не отвечает», а не как «запрос слишком длинный».

    Брать `WITH t(a,b) AS (VALUES ('x','y'), …) SELECT …` — он не имеет предела.
    """
    n = 0
    for p in sorted((ROOT / "tools").glob("*.py")):
        t = p.read_text(encoding="utf-8")
        # SQL-строки в тройных кавычках
        for m in re.finditer(r'"""([\s\S]*?)"""', t):
            cnt = len(re.findall(r"\bUNION ALL\b", m.group(1), re.I))
            if cnt >= 8:
                n += 1
    return n


def count_type_errors():
    """ЗКН-Ф016 — ОШИБКА ТИПА = КРАШ В БРАУЗЕРЕ.

    В экране Рецептов стояло `CATEGORIES.map((c) => ({ id: c, label: c }))`,
    где CATEGORIES — УЖЕ `{id, label}[]`. React получал ОБЪЕКТ вместо текста
    и падал: «Minified React error #31».

    И вот что важнее самой ошибки: React, не найдя границы ошибок, размонтирует
    ВСЁ ДЕРЕВО. Человек видел белый лист ВЕЗДЕ — на «назад», на любой вкладке —
    пока не перезагрузит. ОДИН битый экран делал мёртвым ВСЁ приложение.

    Сборка это НЕ ЛОВИЛА: esbuild не проверяет типы. `tsc` ругался — но типы
    React вообще не были установлены (223 ошибки, из них 89 — «нет namespace
    React»), и никто в этот шум не смотрел.

    Теперь: типы установлены, ошибок 20, ХРАПОВИК. Рост запрещён.
    """
    import subprocess
    r = subprocess.run(["../../node_modules/.bin/tsc", "--noEmit", "-p", "tsconfig.json"],
                       cwd=str(ROOT / "apps" / "web"), capture_output=True, text=True)
    return sum(1 for l in (r.stdout + r.stderr).split("\n") if "error TS" in l)


def count_gates():
    """ЗКН-Ц011 — УДАЛЕНИЕ ГЕЙТА НЕ ПРОХОДИТ МОЛЧА.

    Гейт можно срезать НЕЧАЯННО. Вырезая один блок из `data-audit.py`, автор
    закона срезал вместе с ним ТРИ СОСЕДНИХ — и обнаружил это случайно.

    Со мной случилось иначе, но с тем же исходом: параллельная сессия завела свой
    закон под НОМЕРОМ МОЕГО, её гейт занял место моего — и мой ПРОСТО ИСЧЕЗ. Свод
    продолжал обещать то, чего в коде уже не было.

    Оба раза гейт пропал МОЛЧА. Ни ошибки, ни падения — просто одной проверкой
    меньше, и никто не знает какой.

    Механизм: гейты СЧИТАЮТСЯ. Число может РАСТИ, но не падать. Убыло — храповик
    ловит, и надо объяснить, какой гейт ушёл и почему.

    Возвращаем ОТРИЦАТЕЛЬНОЕ число: храповик стережёт рост долга, а здесь беречь
    надо УБЫЛЬ. Минус превращает одно в другое.
    """
    n = 0
    for f in ("data-audit.py", "nav-audit.py", "cards-audit.py",
              "infra-audit.py", "product-audit.py", "pkl-audit.py",
              "url-audit.py"):
        p = ROOT / "tools" / f
        if p.exists():
            n += p.read_text(encoding="utf-8").count('"law":')
    return -n


def count_bare_urlopen():
    """ЗКН-Ф014: `urlopen` без перехвата HTTPError — падает молча.

    ⚠️ ПРАВИЛО СЧИТАЛОСЬ ПО ОКНУ В ТРИ СТРОКИ: «есть ли `try:` выше?». И ловило
    ИСПРАВНЫЙ код: в `goldforge/d1.py` `try:` стоит на ЧЕТЫРЕ строки выше, потому
    что между ними — многострочный `Request(...)`. Перехват там есть, а линтер
    кричал. Гейт, который кричит на исправный код, отключат через неделю — и
    вместе с ним умрёт закон (тот же урок, что и с ЗКН-Н024).

    Считаем по СИНТАКСИЧЕСКОМУ ДЕРЕВУ: нарушение — это `urlopen`, который НЕ
    лежит внутри `try` с обработчиком `HTTPError`. Ни окон, ни угадайки.
    """
    n = 0
    for fp in sorted((ROOT / "tools").rglob("*.py")):
        # ЗКН-Ц004 — ЛИНТЕР НЕ СЧИТАЕТ САМ СЕБЯ (он упоминает `urlopen` в правиле).
        if fp.name == "laws-lint.py":
            continue
        try:
            tree = ast.parse(fp.read_text(encoding="utf-8"))
        except Exception:
            continue

        def guards_http(node) -> bool:
            for h in node.handlers:
                src = ast.dump(h.type) if h.type else ""
                if "HTTPError" in src:
                    return True
            return False

        protected = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Try) and guards_http(node):
                for inner in ast.walk(node):
                    if isinstance(inner, ast.Call):
                        protected.add(id(inner))

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            f = node.func
            name = f.attr if isinstance(f, ast.Attribute) else getattr(f, "id", "")
            if name != "urlopen":
                continue
            if id(node) not in protected:
                n += 1
    return n


BIG_BIN_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".pdf",
               ".doc", ".docx", ".ppt", ".pptx", ".mp3", ".mp4", ".m4a", ".wav",
               ".ogg", ".mov", ".zip", ".gz", ".ico"}
BIG_BIN_BYTES = 512 * 1024  # шрифты (.ttf/.otf/.woff2) сюда не входят — им можно


def count_big_binaries():
    """Отслеживаемые в git медиа/документы тяжелее 512 КБ. Шрифты не в счёт."""
    import subprocess
    try:
        out = subprocess.run(["git", "ls-files"], cwd=str(ROOT),
                             capture_output=True, text=True).stdout
    except Exception:
        return 0
    n = 0
    for line in out.splitlines():
        p = ROOT / line
        if p.suffix.lower() in BIG_BIN_EXT:
            try:
                if p.stat().st_size > BIG_BIN_BYTES:
                    n += 1
            except OSError:
                pass
    return n


def count_debt():
    counts = {k: 0 for k in DEBT}
    counts["bare_urlopen"] = count_bare_urlopen()
    counts["type_errors"] = count_type_errors()
    counts["long_union"] = count_long_union()
    counts["gates_removed"] = count_gates()
    counts["tracked_big_binary"] = count_big_binaries()
    for fp in sorted(SRC.rglob("*")):
        if fp.suffix not in (".ts", ".tsx") or fp.name in DESIGN_EXEMPT:
            continue
        try:
            t = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        for k, d in DEBT.items():
            if d.get("scope") in ("tools", "tsc", "git"):
                continue
            counts[k] += len(d["pattern"].findall(t))
    return counts


def check_ratchet(update=False):
    now = count_debt()
    if update or not BASELINE.exists():
        BASELINE.write_text(json.dumps(now, indent=2) + "\n", encoding="utf-8")
        print("ХРАПОВИК: база записана → %s" % BASELINE.name)
        for k, v in now.items():
            print("  %-18s %d" % (k, v))
        return []
    base = json.loads(BASELINE.read_text(encoding="utf-8"))
    bad = []
    print("ХРАПОВИК ДОЛГА (ISKCON Design):")
    for k, d in DEBT.items():
        b, n = base.get(k, 0), now[k]
        if n > b:
            print("  ✗ %-18s %d  (база %d, ВЫРОС на %d)" % (k, n, b, n - b))
            bad.append(({"id": "%s · %s" % (d["law"], k), "name": d["name"],
                         "hint": d["hint"]},
                        "долг вырос: %d → %d" % (b, n), 0, ""))
        elif n < b:
            print("  ↓ %-18s %d  (база %d, СНИЖЕН на %d) — обнови базу" % (k, n, b, b - n))
        else:
            print("  = %-18s %d  (база держится)" % (k, n))
    return bad


def check_missing_imports():
    """ЗКН-Ф006: отсутствующий импорт (TS2304) собирается vite'ом и падает
    в браузере БЕЛОЙ СТРАНИЦЕЙ. esbuild не проверяет типы — нужен tsc."""
    import subprocess
    web = ROOT / "apps" / "web"
    tsc = ROOT / "node_modules" / ".bin" / "tsc"
    if not tsc.exists():
        return []
    try:
        out = subprocess.run([str(tsc), "--noEmit", "-p", "tsconfig.json"],
                             cwd=str(web), capture_output=True, text=True, timeout=180).stdout
    except Exception:
        return []
    bad = []
    for line in out.split("\n"):
        if any(e in line for e in ("TS2304", "TS2552", "TS2448")):   # нет имени / использовано до объявления
            bad.append(({"id": "ЗКН-Ф006", "name": "отсутствующий импорт (белая страница в проде)",
                         "hint": "→ добавить импорт. vite соберёт, но браузер упадёт ReferenceError"},
                        line.split("(")[0], 0, line.strip()[:90]))
    return bad



def check_cyrillic_b():
    """ЗКН-С004 — `\\b` В РЕГУЛЯРКЕ НА КИРИЛЛИЦЕ НЕ РАБОТАЕТ.

    `\\b` определена через `\\w` = [A-Za-z0-9_]. Между «Харе» и пробелом движок
    границы НЕ ВИДИТ — регулярка молчит. Она ничего не ломает: она просто не
    срабатывает, и это худший род поломки — беззвучный.

    Ловим литералы регулярок, где `\\b` стоит вплотную к кириллице.
    """
    rule = {"id": "ЗКН-С004", "name": "`\\b` в регулярке на кириллице не работает",
            "hint": "`\\b` определена через `\\w` = [A-Za-z0-9_] — между кириллицей и пробелом "
                    "границы НЕТ. Регулярка не падает, она МОЛЧИТ. Границу даёт `\\p{L}` + флаг `u`."}
    bad = []
    # литерал регулярки, где рядом стоят \b и кириллица (в любом порядке)
    pat = re.compile(r"=\s*/.*?/[gimsuy]*\s*;")
    for fp in sorted(SRC.rglob("*.ts")) + sorted(SRC.rglob("*.tsx")) + WORKERS:
        for i, line in enumerate(fp.read_text(encoding="utf-8").split("\n"), 1):
            st = line.strip()
            if st.startswith(("*", "//", "/*")):
                continue
            m = pat.search(line)
            if not m:
                continue
            lit = m.group(0)
            if not re.search(r"[А-Яа-яЁё]", lit):
                continue
            # ⚠️ ПРЕДМЕТ ИСКАЛСЯ ДВАЖДЫ, И ОБА РАЗА МИМО.
            #
            # (1) «есть `\b` и есть кириллица» → обвинил фильтр даршанов, где `\b`
            #     стоит у ЛАТИНСКИХ слов (`\brsvp\b`), а кириллица живёт в соседней
            #     ветке альтернации. Ложная тревога подрывает доверие ко всем гейтам.
            # (2) «`\b` ВПЛОТНУЮ к кириллице» → не поймал живое нарушение: в коде
            #     между ними стоят скобки группировки — `\b(?:(?:Харе|Кришна|Рама)`.
            #
            # НАСТОЯЩИЙ класс: в регулярке есть кириллица, и хотя бы одно `\b`
            # НЕ ПРИМЫКАЕТ К ЛАТИНСКОЙ БУКВЕ. Такое `\b` не может стеречь латинское
            # слово — значит, оно поставлено для кириллицы и молчит.
            for b in re.finditer(r"\\b", lit):
                prev = lit[b.start() - 1] if b.start() else ""
                nxt = lit[b.end()] if b.end() < len(lit) else ""
                if re.match(r"[A-Za-z]", prev) or re.match(r"[A-Za-z]", nxt):
                    continue          # `\b` стережёт латинское слово — законно
                bad.append((rule, str(fp.relative_to(ROOT)), i,
                            "`\\b` в регулярке с кириллицей — она НЕ СРАБОТАЕТ"))
                break
    return bad


def check_unique_ids():
    """НОМЕР ЗАКОНА УНИКАЛЕН. Два закона под одним номером — это не свод, а каша:
    ссылка «см. ЗКН-Б008» ведёт в два разных места, и гейт нельзя привязать к закону.
    Поймано на живом: я сам налетел на занятый ЗКН-Б008 («у каждого бхаджана есть стихи»),
    а заодно нашлись три давних дубля. Раньше это не проверял никто."""
    import collections
    laws = ROOT / "docs" / "LAWS.md"
    if not laws.exists():
        return []
    text = laws.read_text(encoding="utf-8")
    ids = re.findall(r"^\|\s*(ЗКН-[А-Яа-яA-Za-z]{1,3}\d{3}(?:-бис)?)\s*\|", text, re.M)
    # Храповик: эти три дубля давние, их гейты переплетены (laws-audit ↔ data-audit ссылаются
    # на РАЗНЫЕ строки одного номера). Разводить наспех — сломать гейты, которых не понимаешь.
    # Долг зафиксирован и расти не может: любой НОВЫЙ дубль валит линтер.
    LEGACY = {"ЗКН-Сд005", "ЗКН-Ц004", "ЗКН-Ц006"}
    dupes = [(i, n) for i, n in collections.Counter(ids).items() if n > 1 and i not in LEGACY]
    rule = {"id": "ЗКН-Ц010", "name": "номер закона уникален",
            "hint": "два закона под одним номером — ссылка ведёт в два места, гейт не привязать"}
    return [(rule, "docs/LAWS.md", 0, "%s — занят %d раза" % (i, n)) for i, n in sorted(dupes)]


def check_d002_primitives():
    """ЗКН-Д002 — ПОВТОРЯЮЩИЙСЯ БЛОК БЕРЁТСЯ ИЗ ПРИМИТИВОВ, А НЕ КОПИРУЕТСЯ.

    Русское число (`plural`) лежало слово-в-слово в СЕМИ файлах: BooksHub,
    KirtansScreen, DhamaScreen, DhamaDetailPage — и под псевдонимами `pluralRu`
    (SadhanaScreen), `pluralDays` (VowScreen, AccountScreen). Семь копий — семь
    мест, куда правка не доедет; и семь способов написать «3 дня» по-разному.

    Правило простое и проверяемое: объявлять `plural*` вне `ui/primitives.tsx`
    нельзя. Нужна новая общая функция — она едет в примитивы, а не в файл рядом.
    """
    rule = {"id": "ЗКН-Д002", "name": "повторяющийся блок — из примитивов",
            "hint": "объявлять plural/pluralRu/pluralDays вне ui/primitives.tsx запрещено"}
    bad = []
    home = SRC / "ui" / "primitives.tsx"
    for fp in sorted(SRC.rglob("*.tsx")) + sorted(SRC.rglob("*.ts")):
        if fp == home:
            continue
        for i, line in enumerate(fp.read_text(encoding="utf-8").split("\n"), 1):
            if re.search(r"\bfunction\s+plural[A-Za-z]*\s*\(", line):
                bad.append((rule, str(fp.relative_to(ROOT)), i, line.strip()[:80]))
    return bad


def check_f022_glob():
    """ЗКН-Ф023 — КЛАССЫ РЕГИСТРА В GLOB ЗАПРЕЩЕНЫ.

    D1 ограничивает GLOB-шаблон 50 БАЙТАМИ (измерено: 7 классов проходят, 8 — нет).
    Класс `[аА]` стоит 6 байт → потолок 8 кириллических букв. «прабхупада» — 10.
    Поиск личностей отдавал 500 на любое настоящее имя, а человек читал «Ничего
    не найдено» и верил, что Прабхупады в приложении НЕТ.

    Регистр складывается НОРМАЛИЗАЦИЕЙ обеих сторон (`normSql` + `normNeedle`),
    а не шаблоном. Кто снова начнёт клеить `[" + lo + up + "]` — упрётся в этот гейт.
    """
    rule = {"id": "ЗКН-Ф023", "name": "кириллица ищется нормализацией, не классами GLOB",
            "hint": "D1 рубит GLOB-шаблон на 50 байтах; классы [аА] = 6 байт/букву → звать normSql/normNeedle"}
    bad = []
    for fp in sorted(ROOT.glob("apps/web/*.ts")) + sorted(SRC.rglob("*.ts")):
        for i, line in enumerate(fp.read_text(encoding="utf-8").split("\n"), 1):
            s = line.strip()
            if s.startswith("*") or s.startswith("//"):
                continue                      # объяснение закона — не нарушение
            if 'toUpperCase()' in line and ('GLOB' in line or '"[" +' in line or "'[' +" in line):
                bad.append((rule, str(fp.relative_to(ROOT)), i, s[:80]))
            elif "ciClasses" in line or "ciGlob" in line:
                bad.append((rule, str(fp.relative_to(ROOT)), i, s[:80]))
    return bad


def check_d016_liquidglass():
    """ЗКН-Д016 — ТАБ-БАР = LIQUID GLASS iOS 26 (эталон — App Store).

    Основатель сверил бар со скринами App Store (15.07.2026): расхождение во
    всех трёх слоях. «Линза» была blur-плёнкой (blur ≠ линзирование: стекло
    ГНЁТ и УВЕЛИЧИВАЕТ контент, а не мылит), выделение красилось радужным
    градиентом-плёнкой во всю пилюлю, а долгое нажатие вскрывало меню как
    обычный текст — iOS показывала системную лупу и маркеры выделения.

    Гейт держит три опоры материала:
      1) слои линзирования .gtab-lens-mag / .gtab-lens-edge существуют
         и в CSS, и в разметке TabBar (App.tsx рендерит копии .gtab-lens-row);
      2) меню невыделяемо: в globals.css есть `-webkit-user-select: none`;
      3) цветные плёнки на выделении запрещены: маркеры старой «дисперсии»
         `rgba(230, 120, 220` / `rgba(90, 150, 255` в globals.css отсутствуют.
    """
    rule = {"id": "ЗКН-Д016", "name": "таб-бар — Liquid Glass iOS 26, эталон App Store",
            "hint": "линзирование = mag/edge-копии; user-select: none в баре; без цветных плёнок на пилюле"}
    bad = []
    css = SRC / "ui" / "globals.css"
    app = SRC / "App.tsx"
    ct = css.read_text(encoding="utf-8")
    at = app.read_text(encoding="utf-8")
    for marker in ("gtab-lens-mag", "gtab-lens-edge", "-webkit-user-select: none"):
        if marker not in ct:
            bad.append((rule, str(css.relative_to(ROOT)), 1, "нет обязательного слоя/правила: " + marker))
    for marker in ("gtab-lens-mag", "gtab-lens-edge", "gtab-lens-row"):
        if marker not in at:
            bad.append((rule, str(app.relative_to(ROOT)), 1, "TabBar не рендерит слой линзы: " + marker))
    for i, line in enumerate(ct.split("\n"), 1):
        if "rgba(230, 120, 220" in line or "rgba(90, 150, 255" in line:
            bad.append((rule, str(css.relative_to(ROOT)), i, line.strip()[:80]))
    return bad


def main():
    if "--update-baseline" in sys.argv:
        check_ratchet(update=True)
        return 0
    bad = (check_rules() + check_prose_law() + check_floor_law() + check_missing_imports()
           + check_unique_ids() + check_cyrillic_b() + check_d002_primitives() + check_f022_glob() + check_d016_liquidglass() + check_ratchet())
    if not bad:
        print("\nЛИНТЕР ЗАКОНОВ: нарушений нет ✓")
        print("  правил: %d + проза (Т002) + пол 11px (Д006) + храповик (Д001)" % len(RULES))
        return 0

    by_rule = {}
    for r, f, i, line in bad:
        by_rule.setdefault(r["id"], []).append((r, f, i, line))

    print("ЛИНТЕР ЗАКОНОВ: НАРУШЕНИЯ (%d)\n" % len(bad))
    for rid, items in sorted(by_rule.items()):
        r = items[0][0]
        print("── %s · %s ── (%d)" % (rid, r["name"], len(items)))
        print("   %s" % r["hint"])
        for _, f, i, line in items[:12]:
            print("   %s:%s  %s" % (f, i, line))
        if len(items) > 12:
            print("   … ещё %d" % (len(items) - 12))
        print("")
    print("Свод законов: docs/LAWS.md")
    return 1


if __name__ == "__main__":
    sys.exit(main())
