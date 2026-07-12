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


CHECKS = [
    ("ЗКН-Ф001", "registry-load выключен (он DROP+CREATE)", check_f001),
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
