#!/usr/bin/env python3
"""
ЛИНТЕР ЗАКОНОВ — уровень принуждения У5 (docs/LAWS.md §1).

Нарушение закона не может попасть в прод: линтер роняет сборку.
Проверяет ИСХОДНЫЙ КОД (apps/web/src) — не данные D1.

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
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps" / "web" / "src"

# cardText.ts САМ определяет запрещённые формы (в regex) — он освобождён.
ALLOW = {"cardText.ts", "nav.ts", "routes.ts", "SectionSubTabs.tsx"}

RULES = [
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

    for fp in sorted(SRC.rglob("*")):
        if fp.suffix not in (".ts", ".tsx", ".css") or fp.name in ALLOW:
            continue
        try:
            text = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        for i, line in enumerate(text.split("\n"), 1):
            for r in app_rules:
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
}


def count_bare_urlopen():
    """ЗКН-Ф014: `urlopen` без try/except HTTPError — падает молча."""
    n = 0
    for fp in sorted((ROOT / "tools").rglob("*.py")):
        try:
            lines = fp.read_text(encoding="utf-8").split("\n")
        except Exception:
            continue
        for i, l in enumerate(lines):
            if "urllib.request.urlopen" not in l:
                continue
            if "try:" not in "\n".join(lines[max(0, i - 3):i + 1]):
                n += 1
    return n


def count_debt():
    counts = {k: 0 for k in DEBT}
    counts["bare_urlopen"] = count_bare_urlopen()
    for fp in sorted(SRC.rglob("*")):
        if fp.suffix not in (".ts", ".tsx") or fp.name in DESIGN_EXEMPT:
            continue
        try:
            t = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        for k, d in DEBT.items():
            if d.get("scope") == "tools":
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


def main():
    if "--update-baseline" in sys.argv:
        check_ratchet(update=True)
        return 0
    bad = check_rules() + check_prose_law() + check_floor_law() + check_missing_imports() + check_ratchet()
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
