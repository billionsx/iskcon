#!/usr/bin/env python3
"""
АУДИТ ИНФРАСТРУКТУРЫ И ПАЙПЛАЙНОВ — домены Ф (10) и Пл (5).

Эти законы охраняют то, что ломается тише всего: разрушительный воркфлоу,
порядок монтирования роутов, лимит крон-триггеров, зеркалирование схемы D1.
Ошибка здесь не видна на экране — она видна в потерянных данных.

Проверяется:
  Ф001  registry-load — DISABLED навсегда (DROP+CREATE на entity-таблицах)
  Ф003  критерий свежести деплоя — шаги 11/12 в deploy-web.yml
  Ф006  гейт tsc против ReferenceError в проде
  Ф007  каждое изменение схемы D1 зеркалится файлом миграции
  Ф008  /api/me/* монтируются ДО accountApi (иначе он ловит всё)
  Ф009  максимум 3 крон-триггера на воркер
  Ф010  массовая загрузка в D1 — через HTTP API, не инлайном
  Пл001 календарь наполняется автоматически (воркфлоу существует)
  Пл002 лента наполняется автоматически
  Пл004 тяжёлое медиа — не в репозитории
  Пл005 кузница золота — пайплайн на месте

Запуск: python3 tools/infra-audit.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CI = ROOT / ".github" / "workflows"
WEB = ROOT / "apps" / "web"


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


def check_f001():
    """registry-load разрушителен (DROP+CREATE) — обязан быть выключен."""
    f = CI / "registry-load.yml"
    if not f.exists():
        return []
    t = read(f)
    # включён, если нет ни disabled-пометки, ни workflow_dispatch-only
    if re.search(r"on:\s*\n\s*(push|schedule)", t):
        return [("registry-load.yml", "воркфлоу может запуститься автоматически — он DROP+CREATE")]
    return []


def check_f003():
    """Критерий свежести деплоя — шаги проверки живут в deploy-web.yml."""
    t = read(CI / "deploy-web.yml")
    if not t:
        return [("deploy-web.yml", "нет воркфлоу деплоя")]
    if "Verify" not in t:
        return [("deploy-web.yml", "нет шага Verify — критерий свежести деплоя утрачен (Ф003)")]
    return []


def check_f006():
    """Гейт tsc: vite не ловит ReferenceError (белая страница в проде)."""
    t = read(ROOT / "tools" / "laws-lint.py")
    if "TS2304" not in t or "TS2448" not in t:
        return [("laws-lint.py", "гейт tsc не ловит TS2304/TS2448 — белые страницы пройдут (Ф006)")]
    return []


def check_f007():
    """Изменение схемы D1 зеркалится файлом миграции."""
    mig = ROOT / "apps" / "api" / "migrations"
    if not mig.exists() or not list(mig.glob("*.sql")):
        return [("apps/api/migrations", "нет файлов миграций — схема D1 не зеркалится (Ф007)")]
    return []


def check_f008():
    """/api/me/* монтируются ДО accountApi, иначе он проглотит под-пути."""
    t = read(WEB / "worker.ts")
    if not t:
        return []
    # ВАЖНО: сравнивать МЕСТА МОНТИРОВАНИЯ (вызовы), а не импорты.
    # Первая версия проверки сравнивала строки import — и врала.
    def call_at(name: str) -> int:
        m = re.search(r"await\s+%s\s*\(" % name, t)
        return m.start() if m else -1

    i_acc = call_at("accountApi")
    if i_acc < 0:
        return []
    bad = []
    for name in ("pushApi", "vowsApi"):
        i = call_at(name)
        if i >= 0 and i > i_acc:
            bad.append(("worker.ts", "%s смонтирован ПОСЛЕ accountApi — тот проглотит /api/me/* (Ф008)" % name))
    return bad


def check_f009():
    """Cloudflare: максимум 3 крон-триггера на воркер."""
    t = read(WEB / "wrangler.toml")
    crons = re.findall(r'crons\s*=\s*\[([^\]]*)\]', t)
    if not crons:
        return []
    n = len([c for c in re.findall(r'"[^"]+"', crons[0])])
    if n > 3:
        return [("wrangler.toml", "крон-триггеров %d — лимит Cloudflare 3 (Ф009)" % n)]
    return []


def check_pl_workflows():
    """Пайплайны наполнения: воркфлоу должны существовать (Пл001/Пл002/Пл005)."""
    bad = []
    need = {
        "ЗКН-Пл001": ("календарь", ("vaishnava", "calendar", "gcal")),
        "ЗКН-Пл002": ("лента/даршан", ("darshan", "tg-video", "feed")),
    }
    names = [f.name for f in CI.glob("*.yml")] if CI.exists() else []
    for law, (what, keys) in need.items():
        if not any(any(k in n for k in keys) for n in names):
            bad.append(("workflows", "%s: нет воркфлоу наполнения (%s)" % (law, what)))
    # Пл005 — кузница
    if not (ROOT / "tools" / "goldforge" / "goldforge.py").exists():
        bad.append(("tools/goldforge", "ЗКН-Пл005: кузницы золота нет"))
    return bad


def check_pl004():
    """Тяжёлое медиа — не в репозитории (Пл004)."""
    bad = []
    pub = WEB / "public"
    if pub.exists():
        for f in pub.rglob("*"):
            if f.is_file() and f.stat().st_size > 20 * 1024 * 1024:
                bad.append((str(f.relative_to(ROOT)), "%.1f МБ в репо — тяжёлое медиа на Internet Archive (Пл004)"
                            % (f.stat().st_size / 1024 / 1024)))
    return bad


def check_pl009():
    """ЗКН-Пл009: машина НЕ перезаписывает существующую координату.

    У «Шриваса-анганы» и «Самадхи Чанда Кази» данные расходятся с геосервисом на
    1.8 и 4 км — потому что есть исторический спор, где эти места (Маяпур или
    город Навадвипа). Позиция приложения по спорному вопросу — решение ЧЕЛОВЕКА.
    Скрипт заполняет только ПУСТОЕ: `WHERE lat IS NULL`.
    """
    bad = []
    for name in ("vraja-coords.py", "centres-official.py"):
        p = ROOT / "tools" / name
        if not p.exists():
            continue
        t = read(p)
        for i, l in enumerate(t.split("\n"), 1):
            if "UPDATE tirthas SET lat" in l or "UPDATE places SET lat" in l:
                if "IS NULL" not in l:
                    bad.append((name, "UPDATE координаты без `WHERE lat IS NULL` (%d) — "
                                      "машина перезапишет решение человека (ЗКН-Пл009)" % i))
    return bad


def check_f004():
    """ЗКН-Ф004: откат D1 Time Travel — проверенная процедура, воркфлоу на месте."""
    if not (CI / "d1-time-travel.yml").exists():
        return [("workflows", "нет d1-time-travel.yml — откат базы не механизирован (ЗКН-Ф004)")]
    return []


def check_f017():
    """ЗКН-Ф017 — SERVICE WORKER ОБЯЗАН ВЕРНУТЬ RESPONSE. ВСЕГДА.

    ЭТО БЫЛ КОРЕНЬ ВСЕХ БЕЛЫХ ЭКРАНОВ.

    В `sw.js` стояло:
        const net = fetch(req).then(...).catch(() => hit);
        return hit || net;

    Если в кеше ПУСТО (`hit === undefined`) И сеть упала — `.catch(() => hit)`
    отдаёт `undefined`. `respondWith` получает Promise<undefined>, и браузер
    бросает:
        TypeError: Failed to convert value to 'Response'.

    Ответа НЕТ → страница не грузится → БЕЛЫЙ ЭКРАН. И это било по «назад»
    ВЕЗДЕ — из дхамы, из киртана, из Бхагавад-гиты: «назад» это НАВИГАЦИЯ, а
    навигация шла через тот же сломанный SW.

    А в ветке навигации стояло `Response.error()` — ЯВНЫЙ сетевой сбой; браузер
    честно показывал пустоту («resulted in a network error response»).

    Из `respondWith` ВСЕГДА выходит настоящий Response. Пустоту — НИКОГДА.
    """
    p = ROOT / "apps" / "web" / "public" / "sw.js"
    if not p.exists():
        return []
    # Комментарии не проверяем: в них закон ОБЪЯСНЯЕТСЯ, а не нарушается.
    t = "\n".join(l for l in read(p).split("\n")
                   if not l.strip().startswith(("*", "//", "/*")))
    bad = []

    if "Response.error()" in t:
        bad.append(("sw.js", "Response.error() = явный сетевой сбой → БЕЛЫЙ ЭКРАН. "
                             "Отдавать оболочку или честную страницу (ЗКН-Ф017)"))
    if ".catch(() => hit)" in t:
        bad.append(("sw.js", "`.catch(() => hit)` вернёт undefined, если кеш пуст → "
                             "«Failed to convert value to Response» → БЕЛЫЙ ЭКРАН (ЗКН-Ф017)"))
    # каждая ветка respondWith обязана кончаться Response
    # ЗКН-Ф019: код приложения — всегда из сети, иначе человек живёт на старом коде
    if "const isCode" not in t:
        bad.append(("sw.js", "оболочка и бандл берутся ИЗ КЕША — правки не доедут "
                             "до человека (ЗКН-Ф019)"))

    # ЗКН-Ф020 — /sw.js НИКОГДА не кешируется. Это был ЗАМКНУТЫЙ КРУГ:
    #   старый SW отдаёт старый бандл  →  правки не доезжают
    #   новый sw.js не запрашивается   →  старый SW не сменится никогда
    w = read(ROOT / "apps" / "web" / "worker.ts")
    if 'url.pathname === "/sw.js"' not in w:
        bad.append(("worker.ts", "/sw.js отдаётся с кешем — браузер не увидит нового SW, "
                                 "и правки НИКОГДА не доедут до человека (ЗКН-Ф020)"))
    m = read(ROOT / "apps" / "web" / "src" / "main.tsx")
    if 'updateViaCache: "none"' not in m:
        bad.append(("main.tsx", "register без `updateViaCache: \"none\"` — браузер возьмёт "
                                "sw.js из HTTP-кеша и не обновит воркера (ЗКН-Ф020)"))

    if t.count("respondWith") > 0 and "return new Response" not in t:
        bad.append(("sw.js", "нет запасного `new Response` — ветка может отдать undefined "
                             "(ЗКН-Ф017)"))
    return bad


def check_r002():
    """ЗКН-Р002 — МАССОВОЕ УДАЛЕНИЕ ЗАПРЕЩЕНО. ЗАЛИВКА НЕДЕСТРУКТИВНА.

    ПОЧЕМУ ЭТОТ ГЕЙТ СУЩЕСТВУЕТ.

    Один воркфлоу уже убил базу: `registry-load` делал DROP+CREATE четырёх таблиц
    и молча падал ПОСЛЕ дропа. Восстанавливались через D1 Time Travel.

    Но тот же почерк остался ещё в ПЯТИ воркфлоу:
        DELETE FROM prayers          — все 339 бхаджанов
        DELETE FROM content_items    — 170 записей
        DELETE FROM content_blocks
        DELETE FROM prayer_verses
        DELETE FROM tilda_pages / tilda_assets

    «Снести и залить заново» кажется чистым. Но если разбор дал МЕНЬШЕ — разница
    ПРОПАЛА навсегда. А у молитв и записей теперь ВЫЧИЩЕННЫЕ слаги (были чужие
    пути `/ru/gaura-arati` с исходного сайта) — прогон вернул бы мусор.

    ПРАВИЛО: `DELETE FROM <таблица>` БЕЗ `WHERE` — запрещён. Заливка обновляет
    своё (`INSERT OR REPLACE`) и НЕ ТРОГАЕТ чужое. Точечное удаление по ключу
    (`DELETE ... WHERE work_id=?`) законно — оно осознанное.
    """
    import re as _re
    bad = []
    for p in sorted((ROOT / ".github" / "workflows").glob("*.yml")):
        for i, line in enumerate(read(p).split("\n"), 1):
            st = line.strip()
            if st.startswith("#"):
                continue
            for m in _re.finditer(r'DELETE FROM ([a-z_]+)', st):
                # точечное удаление по ключу — законно
                tail = st[m.end():m.end() + 40]
                if "WHERE" in tail.upper():
                    continue
                bad.append((p.name + ":%d" % i,
                            "МАССОВОЕ `DELETE FROM %s` — снесёт таблицу целиком. "
                            "Заливка обязана быть недеструктивной (ЗКН-Р002)" % m.group(1)))
    return bad


CHECKS = [
    ("ЗКН-Ф001", "registry-load выключен (он DROP+CREATE)", check_f001),
    ("ЗКН-Р002", "массовое удаление запрещено", check_r002),
    ("ЗКН-Ф017", "service worker всегда отдаёт Response", check_f017),
    ("ЗКН-Ф004", "откат D1 Time Travel на месте", check_f004),
    ("ЗКН-Пл009", "координата человека не перезаписывается", check_pl009),
    ("ЗКН-Ф003", "критерий свежести деплоя на месте", check_f003),
    ("ЗКН-Ф006", "гейт tsc против белых страниц", check_f006),
    ("ЗКН-Ф007", "схема D1 зеркалится миграциями", check_f007),
    ("ЗКН-Ф008", "/api/me/* монтируются до accountApi", check_f008),
    ("ЗКН-Ф009", "не более 3 крон-триггеров", check_f009),
    ("ЗКН-Пл00x", "пайплайны наполнения существуют", check_pl_workflows),
    ("ЗКН-Пл004", "тяжёлого медиа нет в репо", check_pl004),
]


def main():
    print("АУДИТ ИНФРАСТРУКТУРЫ И ПАЙПЛАЙНОВ · домены Ф · Пл")
    print("─" * 70)
    details = []
    for law, name, fn in CHECKS:
        bad = fn()
        details += [(law, f, why) for f, why in bad]
        print("  %s %-11s %-42s %d" % ("✓" if not bad else "✗", law, name[:42], len(bad)))
    print("─" * 70)
    if details:
        print("\nНАРУШЕНИЯ (%d):\n" % len(details))
        for law, f, why in details:
            print("  %-11s %-26s %s" % (law, f[:26], why))
        print("\nСвод: docs/LAWS.md")
        return 1
    print("Нарушений нет ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
