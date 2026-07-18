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


def check_pl003():
    """ЗКН-Пл003 — ОДНА СЕССИЯ TELEGRAM — ОДНА ОЧЕРЕДЬ.

    Сессия Telegram (`TG_SESSION_STRING`) ОДНА на все качалки: аудио, видео,
    сторис, архив. И на вход тоже.

    ВХОД СОЗДАЁТ НОВУЮ СЕССИЮ И ТЕМ САМЫМ ГАСИТ СТАРУЮ. Если в этот миг качается
    видео — оно оборвётся на полпути. И никто не поймёт почему: логи качалки
    скажут «сессия недействительна», а настоящая причина — вход, запущенный рядом.

    Такую поломку невозможно воспроизвести: она зависит от того, кто когда нажал.

    Все `tg-*` воркфлоу обязаны стоять в ОДНОЙ очереди.
    """
    bad = []
    wf = ROOT / ".github" / "workflows"
    for p in sorted(wf.glob("tg-*.yml")):
        t = read(p)
        if "group: tg-archive-session" not in t:
            bad.append((p.name, "нет общей очереди `tg-archive-session` — вход погасит "
                                "сессию у работающей качалки (ЗКН-Пл003)"))
    return bad


def check_pf002():
    """ЗКН-Пф002 — PDF СОБИРАЕТСЯ ИЗ ЖИВЫХ ДАННЫХ, А НЕ ИЗ СНИМКА.

    Снимок устаревает молча: исправил стих в базе — а PDF всё ещё печатает
    старый. Человек уносит с собой БУМАГУ С ОШИБКОЙ, и она переживёт все правки.

    PDF обязан тянуть из API (`/books/…`), а не из вшитого файла.
    """
    p = ROOT / "apps" / "web" / "src" / "PdfDoc.tsx"
    if not p.exists():
        return []
    t = read(p)
    bad = []
    if 'fetch(api(' not in t:
        bad.append(("PdfDoc.tsx", "PDF не тянет из живого API — напечатает УСТАРЕВШЕЕ "
                                  "и человек унесёт бумагу с ошибкой (ЗКН-Пф002)"))
    return bad


def check_f013():
    """ЗКН-Ф013 — D1: «too many SQL variables». ПРЕДЕЛ ~100 ПЕРЕМЕННЫХ НА ЗАПРОС.

    Батч из 40 стихов x 6 полей = 240 переменных. D1 такой запрос НЕ ВЫПОЛНИТ, и
    ошибка выглядит как «база не отвечает», а не как «запрос слишком широкий».

    Считать надо ПРОИЗВЕДЕНИЕ: (полей на строку) x (размер батча). Сейчас в
    `ingest-books.py`: 5 x 20 = 100 — РОВНО НА ПРЕДЕЛЕ. Одно новое поле в схеме,
    и заливка книг молча упадёт: 6 x 20 = 120.

    Такое не поймать глазами — надо считать. Гейт считает.
    """
    import re as _re
    bad = []
    for p in sorted((ROOT / "tools").glob("*.py")):
        t = read(p)
        m = _re.search(r'ph = ",".join\(\["\(([^"]+)\)"\] \* len\(chunk\)\)', t)
        if not m:
            continue
        q = m.group(1).count("?")
        mb = _re.search(r'\bB\s*=\s*(\d+)', t)
        if not (q and mb):
            continue
        b = int(mb.group(1))
        total = q * b
        if total > 100:
            bad.append((p.name, "батч даёт %d переменных на запрос (%d полей x %d строк) — "
                                "D1 не выполнит, предел ~100 (ЗКН-Ф013)" % (total, q, b)))
    return bad


def check_f009():
    """ЗКН-Ф009 — МАКСИМУМ 3 КРОН-ТРИГГЕРА НА ВОРКЕР.

    Cloudflare не даст больше. Четвёртый триггер — деплой падает, и падает он
    не при написании, а при ВЫКАТЕ: локально всё собралось, а прод не обновился.

    Больше трёх задач — собирать в один `scheduled()` с тайм-гейтингом внутри.
    """
    import re as _re
    p = ROOT / "apps" / "web" / "wrangler.toml"
    if not p.exists():
        return []
    t = read(p)
    m = _re.search(r'crons\s*=\s*\[([^\]]*)\]', t)
    if not m:
        return []
    n = len(_re.findall(r'"[^"]+"', m.group(1)))
    if n > 3:
        return [("wrangler.toml", "крон-триггеров %d — Cloudflare даёт максимум 3, "
                                  "деплой упадёт при выкате (ЗКН-Ф009)" % n)]
    return []



# ═══ ЗКН-Ф022 — ПУШ ИЗ ВОРКФЛОУ НЕ ЗАПУСКАЕТ ДЕПЛОЙ ═══
# GitHub НАМЕРЕННО не поднимает воркфлоу на коммиты, сделанные `GITHUB_TOKEN`
# (защита от рекурсии). Значит любой пайплайн, который кладёт ассеты в `apps/web/`,
# кладёт их В РЕПОЗИТОРИЙ — и НИКОГДА не доносит до людей. Все гейты при этом
# зелёные: файл есть, коммит есть, воркфлоу «success». А в проде — ничего.
#
# Так чуть не пропал архив календаря: 4403 файла легли в main, deploy-web не
# проснулся, и я бы считал работу сделанной. Данные без деплоя = данных нет
# (тот же корень, что у ЗКН-Ф021: починка, которая не доехала, — не починка).
#
# ДОЛГ: 16 пайплайнов писали ассеты и не звали деплой. Разовая правка 16 чужих
# воркфлоу вслепую опаснее долга, поэтому — ХРАПОВИК (как ЗКН-Д001): список
# известного долга зафиксирован, НОВЫЙ нарушитель роняет сборку.
F022_DEBT = {
    "audio-verify.yml", "book-counts.yml", "build-cis-density.yml",
    "build-world-feeds.yml", "centres-official.yml", "fetch-puri-cover.yml",
    "fetch-vrindavan-cover.yml", "fix-exussr-tz.yml", "home-catalog-load.yml",
    "iskcon-places-scrape.yml", "places-health.yml", "pull-covers.yml",
    "vaisnava-calendar-fetch.yml", "vd-prose.yml", "vd-spl.yml", "vd-verse.yml",
}


def check_f022():
    """Воркфлоу, кладущий ассеты в apps/web/, ОБЯЗАН сам запустить deploy-web."""
    bad = []
    wf = ROOT / ".github" / "workflows"
    for f in sorted(wf.glob("*.yml")):
        t = read(f)
        commits = re.search(r"git\s+(add|commit)", t) and "apps/web/" in t
        if not commits:
            continue
        if "deploy-web.yml/dispatches" in t:
            continue
        if f.name in F022_DEBT:
            continue
        bad.append((f.name, "коммитит ассеты в apps/web/, но НЕ запускает deploy-web "
                            "— пуш из воркфлоу деплой не триггерит, данные не доедут"))
    return bad

def check_pl015():
    """ЗКН-Пл016 — ИСТОЧНИК СМЕРТЕН. ОПИРАТЬСЯ НА ОДИН — ЗНАЧИТ ЖДАТЬ ЕГО СМЕРТИ.

    Координаты 520 мест Враджа должны были прийти с `vrajapedia.com` — у мест уже
    проставлена ссылка `vp_link`. Инструмент написан, воркфлоу настроен, гейт
    проверяет попадание точки во Врадж.

    САЙТ УМЕР. Он отвечает `302` НА САМОГО СЕБЯ — бесконечная петля. Поиск его не
    находит. Снимка в архиве НЕТ.

    Инструмент цел. Источника — больше нет.

    Мы не заметили: скрипт падал, воркфлоу отменяли, и все думали, что дело в
    скрипте. Никто не спросил, ЖИВ ЛИ ИСТОЧНИК (ЗКН-Пл006).

    Гейт: воркфлоу, который ходит на внешний сайт, обязан ПРОВЕРЯТЬ, что сайт
    отвечает — и сказать это ясно, а не падать «15 отказов подряд».
    """
    p = ROOT / "tools" / "vraja-coords.py"
    if not p.exists():
        return []
    if "def source_alive" not in read(p):
        return [("vraja-coords.py",
                 "ходит на внешний источник и НЕ проверяет, ЖИВ ЛИ ОН. "
                 "vrajapedia.com умер (302 сам на себя) — а скрипт месяцами падал "
                 "«15 отказов подряд», и все винили скрипт (ЗКН-Пл016)")]
    return []


def check_pl025():
    """ЗКН-Пл025: видео из Telegram — часто и автоматически в archive.org; лента играет с зеркала, без сырого Telegram-виджета.

    (1) tg-video.yml обязан иметь ЧАСТЫЙ cron (интервал ≤ 60 мин, форма `*/N` при `*` в
    часах) — миррор идёт постоянно, не в ручном режиме. (2) Воркер подаёт видео из
    archive.org-зеркала: workerHome.ts джойнит feed_video. (3) Лента не встраивает сырой
    Telegram-виджет: в HomeFeed.tsx нет iframe `embed=1&mode=tme` («Media is too big»-бред).
    """
    bad = []
    tv = read(CI / "tg-video.yml")
    if not tv:
        bad.append(("tg-video.yml", "Пл005: воркфлоу миррора видео отсутствует"))
    else:
        m = re.search(r"cron:\s*[\"']([^\"']+)[\"']", tv)
        if not m:
            bad.append(("tg-video.yml", "Пл005: нет schedule/cron — миррор стал ручным"))
        else:
            fields = m.group(1).split()
            minute = fields[0] if fields else ""
            hour = fields[1] if len(fields) > 1 else ""
            mm = re.fullmatch(r"\*/(\d+)", minute.strip())
            ok_fast = hour.strip() == "*" and ((mm and int(mm.group(1)) <= 60) or minute.strip() == "*")
            if not ok_fast:
                bad.append(("tg-video.yml", "Пл005: cron '%s' реже 60 мин — видео висит в Telegram-эмбеде до миррора" % m.group(1)))
    wh = read(WEB / "workerHome.ts")
    if wh and "feed_video" not in wh:
        bad.append(("workerHome.ts", "Пл005: нет джойна feed_video — видео не подаётся из archive.org-зеркала"))
    hf = read(WEB / "src" / "HomeFeed.tsx")
    if hf and re.search(r"embed=1&mode=tme", hf):
        bad.append(("HomeFeed.tsx", "Пл005: сырой Telegram-виджет (embed=1&mode=tme) в ленте — «Media is too big»-бред"))
    return bad


def check_f026():
    """ЗКН-Ф026: GET-чтения книг (/api/books/*) кэшируются на краю Cloudflare.

    Прокси на api.gaurangers.com/v1 раньше ставил no-store на ВСЕ ответы — и каждый
    заход на стих/главу делал полный хоп worker->/v1->D1: лишний сетевой хоп на каждый
    экран И 100k запросов в D1 при масштабе. Инвариант: статичные чтения книг
    обслуживаются из caches.default (край) и браузерного кэша, в D1 идёт лишь первый
    заход в регионе. Кэшируется только успех (200) — динамика остаётся no-store.
    """
    w = read(WEB / "worker.ts")
    bad = []
    if w:
        if "isBookRead" not in w or "/api/books/" not in w:
            bad.append(("worker.ts", "Ф026: в прокси нет предиката чтения книг (isBookRead + /api/books/)"))
        if "caches.default" not in w or "cache.match(request)" not in w:
            bad.append(("worker.ts", "Ф026: прокси не смотрит край (caches.default / cache.match) перед хопом на /v1 — каждый заход бьёт в D1"))
        if "ctx.waitUntil(cache.put(request, out.clone()))" not in w:
            bad.append(("worker.ts", "Ф026: успешный ответ книги не кладётся в край (ctx.waitUntil(cache.put)) — кэш не греется"))
        if 'out.headers.set("Cache-Control", "public, max-age=60")' not in w:
            bad.append(("worker.ts", "Ф026: чтения книг не помечены кэшируемыми (public, max-age) — вернулся no-store на статику, каждый заход = хоп в D1"))
    return bad



def check_n087():
    """ЗКН-Н087 — ДОМЕН ЖИВЁТ В РЕЕСТРЕ, ПЕРЕЕЗД = ОДНА СТРОКА.

    Домен приложения меняется (gaurangers.com → brajs.com → iskcone.com). Пока он
    был записан строкой в воркере, в wrangler.toml и в шагах деплоя, переезд был
    охотой за хардкодами: что-то оставалось на старом хосте и молча ломалось —
    канонический 301, адрес отправителя писем, прод-пробы CI.

    СТАТЬИ:
      A. В исходниках apps/web (кроме самого реестра src/routes.ts) нет голого
         домена вида *.com. Комментарии и текст документации не в счёт — ломается
         КОД, а не пояснение.
      B. Маршруты apps/web/wrangler.toml покрывают канонический хост (SITE_HOST),
         его www и каждый ALIAS_HOST. Иначе прежний домен перестанет быть
         привязан к воркеру, и 301 на канонический просто некому будет отдать —
         старые ссылки и QR-коды умрут молча.
      Г. API_HOST переезжает ВМЕСТЕ с сайтом: поддомен SITE_HOST/alias (снятый —
         авария), custom_domain apps/api/wrangler.toml и smoke deploy-api.yml
         стоят ровно на нём. Авария 18.07.2026: api остался на снятом
         gaurangers.com — /api-прокси бил в мёртвую зону, витрины опустели.
    """
    bad = []
    routes = ROOT / "apps" / "web" / "src" / "routes.ts"
    if not routes.exists():
        return [("routes.ts", "нет реестра адресов — Н087 не на чем держаться")]
    reg = routes.read_text(encoding="utf-8")

    m = re.search(r'SITE_HOST\s*=\s*"([^"]+)"', reg)
    if not m:
        return [("routes.ts", "нет константы SITE_HOST — канонический хост негде прочитать")]
    site = m.group(1)
    mail = (re.search(r'MAIL_HOST\s*=\s*"([^"]+)"', reg) or m).group(1)
    # API_HOST задаётся либо литералом "api.xxx", либо шаблоном `api.${SITE_HOST}`
    # (канон после аварии 18.07.2026: производная форма переезжает сама).
    _api = re.search(r'API_HOST\s*=\s*[`"]([^`"]+)[`"]', reg)
    api_host = (_api.group(1) if _api else site).replace("${SITE_HOST}", site)
    aliases = re.findall(r'"([a-z0-9.-]+\.[a-z]{2,})"', 
                         (re.search(r'ALIAS_HOSTS[^=]*=\s*\[(.*?)\]', reg, re.S) or
                          re.match(r'(?P<x>)', '')).group(1) if re.search(r'ALIAS_HOSTS[^=]*=\s*\[(.*?)\]', reg, re.S) else "")

    # ── A · голый домен в коде мимо реестра ──
    known = {site, mail, api_host, *aliases}
    dom_re = re.compile(r'["\'`][^"\'`]*\b([a-z0-9-]+\.(?:com|ru|org|net))\b')
    src = ROOT / "apps" / "web" / "src"
    for f in list(src.rglob("*.ts")) + list(src.rglob("*.tsx")) + [ROOT / "apps" / "web" / "worker.ts"]:
        if f.name == "routes.ts":
            continue
        for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            s = line.strip()
            if s.startswith("*") or s.startswith("//") or s.startswith("/*"):
                continue
            for hit in dom_re.findall(line):
                if hit in known:
                    bad.append((f.name, "стр.%d: домен «%s» строкой мимо src/routes.ts" % (i, hit)))

    # ── C · снятый домен не возвращается в маршруты ──
    retired = re.findall(r'"([a-z0-9.-]+\.[a-z]{2,})"',
                         (re.search(r'RETIRED_HOSTS[^=]*=\s*\[(.*?)\]', reg, re.S).group(1)
                          if re.search(r'RETIRED_HOSTS[^=]*=\s*\[(.*?)\]', reg, re.S) else ""))

    # ── C · снятый домен не возвращается в маршруты ──
    # Домен, снятый с проекта, не должен once again оказаться привязанным: иначе
    # он начнёт отдавать вторую живую копию приложения (или молча её редиректить,
    # создавая у команды иллюзию, что он всё ещё «наш»).
    retired = re.findall(r'"([a-z0-9.-]+\.[a-z]{2,})"',
                         (re.search(r'RETIRED_HOSTS[^=]*=\s*\[(.*?)\]', reg, re.S).group(1)
                          if re.search(r'RETIRED_HOSTS[^=]*=\s*\[(.*?)\]', reg, re.S) else ""))
    wr_c = ROOT / "apps" / "web" / "wrangler.toml"
    if wr_c.exists():
        conf_c = wr_c.read_text(encoding="utf-8")
        for host in retired:
            if re.search(r'pattern\s*=\s*"%s"\s*$' % re.escape(host), conf_c, re.M):
                bad.append(("wrangler.toml", "снятый хост «%s» снова привязан маршрутом" % host))

    # ── B · маршруты воркера покрывают все хосты реестра ──
    wr = ROOT / "apps" / "web" / "wrangler.toml"
    if wr.exists():
        conf = wr.read_text(encoding="utf-8")
        need = [site, "www." + site] + [h for a in aliases for h in (a, "www." + a)]
        for host in need:
            if not re.search(r'pattern\s*=\s*"%s"' % re.escape(host), conf):
                bad.append(("wrangler.toml", "хост «%s» из реестра не привязан маршрутом" % host))
        for host in retired:
            if re.search(r'pattern\s*=\s*"%s"' % re.escape(host), conf):
                bad.append(("wrangler.toml", "снятый хост «%s» снова привязан маршрутом" % host))

    # ── Г · API-хост переезжает ВМЕСТЕ с каноническим ──
    # Авария 18.07.2026: gaurangers.com сняли с проекта, а API_HOST остался на
    # api.gaurangers.com — прокси /api/* сайта бил в мёртвую зону, и ВСЕ витрины
    # («Личности», «Бхаджаны»…) показывали пустоту при живой D1. Статьи A–B этого
    # не ловили: они сканируют только apps/web. Инвариант из трёх звеньев:
    #   1) API_HOST — поддомен SITE_HOST или alias; поддомен RETIRED — авария;
    #   2) apps/api/wrangler.toml привязывает custom_domain ровно на API_HOST;
    #   3) smoke-проверка deploy-api.yml бьёт ровно в API_HOST.
    parent = api_host.split(".", 1)[1] if "." in api_host else api_host
    if parent in retired or api_host in retired:
        bad.append(("routes.ts", "API_HOST «%s» стоит на СНЯТОМ домене — /api-прокси бьёт в мёртвую зону" % api_host))
    elif parent not in {site, *aliases}:
        bad.append(("routes.ts", "API_HOST «%s» не на каноническом хосте и не на alias" % api_host))
    wr_api = ROOT / "apps" / "api" / "wrangler.toml"
    if wr_api.exists():
        conf_api = wr_api.read_text(encoding="utf-8")
        if not re.search(r'pattern\s*=\s*"%s"' % re.escape(api_host), conf_api):
            bad.append(("apps/api/wrangler.toml", "custom_domain не привязан на API_HOST «%s» реестра" % api_host))
        for host in retired:
            if re.search(r'pattern\s*=\s*"(?:[a-z0-9-]+\.)?%s"' % re.escape(host), conf_api):
                bad.append(("apps/api/wrangler.toml", "маршрут на поддомене снятого «%s»" % host))
    dep_api = ROOT / ".github" / "workflows" / "deploy-api.yml"
    if dep_api.exists() and ("https://" + api_host) not in dep_api.read_text(encoding="utf-8"):
        bad.append(("deploy-api.yml", "smoke-проверка не бьёт в API_HOST «%s» реестра" % api_host))
    return bad


def check_pl026() -> list:
    """ЗКН-Пл026: самоцепочка заливки катхи умирает, если счётчик не сдвинулся.

    Без признака прогресса звено с недостижимыми записями крутит себя вечно и
    держит группу `tg-archive-session` занятой — соседние каналы не доедут.
    """
    bad = []
    y = ROOT / ".github" / "workflows" / "katha-ingest.yml"
    if not y.exists():
        return [(".github/workflows/katha-ingest.yml", "воркфлоу пропал — самоцепочке негде остановиться")]
    txt = y.read_text(encoding="utf-8")
    if 'PREV="${{ inputs.note }}"' not in txt:
        bad.append((str(y.relative_to(ROOT)), "звено не получает прошлый счётчик (PREV) — ЗКН-Пл026"))
    if '"$LEFT" = "$PREV"' not in txt:
        bad.append((str(y.relative_to(ROOT)), "нет остановки при незыблемом счётчике — ЗКН-Пл026"))
    return bad


CHECKS = [
    ("ЗКН-Н087", "домен только из реестра routes.ts", check_n087),
    ("ЗКН-Ф026", "чтения книг кэшируются на краю", check_f026),
    ("ЗКН-Пл025", "видео мирроринг частый + лента с зеркала без Telegram-виджета", check_pl025),
    ("ЗКН-Пл026", "самоцепочка умирает, если счётчик не движется", check_pl026),
    ("ЗКН-Пл016", "источник смертен — проверять живость", check_pl015),
    ("ЗКН-Ф013", "батч D1 не превышает 100 переменных", check_f013),
    ("ЗКН-Ф009", "не более 3 крон-триггеров", check_f009),
    ("ЗКН-Ф001", "registry-load выключен (он DROP+CREATE)", check_f001),
    ("ЗКН-Пл003", "одна сессия Telegram — одна очередь", check_pl003),
    ("ЗКН-Пф002", "PDF из живых данных, не из снимка", check_pf002),
    ("ЗКН-Р002", "массовое удаление запрещено", check_r002),
    ("ЗКН-Ф017", "service worker всегда отдаёт Response", check_f017),
    ("ЗКН-Ф004", "откат D1 Time Travel на месте", check_f004),
    ("ЗКН-Пл009", "координата человека не перезаписывается", check_pl009),
    ("ЗКН-Ф003", "критерий свежести деплоя на месте", check_f003),
    ("ЗКН-Ф022", "пайплайн ассетов сам зовёт деплой", check_f022),
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
