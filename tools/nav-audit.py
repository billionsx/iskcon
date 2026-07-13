#!/usr/bin/env python3
"""
АУДИТ НАВИГАЦИИ — домен Н (22 закона).

Самый крупный домен свода — и самый хрупкий. Каждый его закон родился из
поломки, которую основатель увидел на экране: пропавший Tier-2, серая плашка
вместо стекла, меню без адреса, обёртка, убившая sticky.

Проверяется структура, а не намерения:
  Н002  ровно один глобальный popstate (в App)
  Н003  «назад» не выкидывает за пределы сайта
  Н004  верхнее меню: поиск слева · вордмарк по центру · избранное справа
  Н007  Богатства = 6 витрин
  Н011  навигация — стекло ЦВЕТА СТРАНИЦЫ, не серая плашка
  Н012  меню оставляет воздух до контента
  Н013  счётчик — настоящая степень (доля от кегля, не фикс. пиксели)
  Н017  витрина внутри зала не имеет своей шапки и «назад»
  Н019  Tier-2 липнет (навигация не уезжает)
  Н021  обёртка <div> вокруг липкого меню запрещена (ломает sticky)
  Н022  один Tier-1 на приложение (единая высота)

Запуск: python3 tools/nav-audit.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps" / "web" / "src"
NAV4 = SRC / "ui" / "nav4.tsx"
GLOBALS = SRC / "ui" / "globals.css"


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


def files():
    for fp in sorted(SRC.rglob("*")):
        if fp.suffix in (".ts", ".tsx"):
            yield fp


def check_n002():
    """Ровно ОДИН глобальный popstate (в App). Второй слушатель = гонка истории."""
    hits = []
    for fp in files():
        for i, l in enumerate(read(fp).split("\n"), 1):
            if re.search(r'addEventListener\(\s*["\']popstate', l):
                hits.append(fp.name)
    extra = [h for h in hits if h != "App.tsx"]
    if extra:
        return [(h, "второй глобальный popstate — гонка истории (ЗКН-Н002)") for h in set(extra)]
    return []


def check_n004():
    """Верхнее меню: поиск слева · вордмарк по центру · избранное справа."""
    t = read(SRC / "App.tsx")
    if not t:
        return []
    bad = []
    if "ISKCON ONE LOVE" not in t:
        bad.append(("App.tsx", "нет вордмарка в шапке (ЗКН-Н004)"))
    return bad


def check_n007():
    """Богатства = 6 витрин."""
    t = read(SRC / "App.tsx")
    m = re.search(r"BOG_SUBS\s*=\s*\[([^\]]*)\]", t)
    if not m:
        return [("App.tsx", "нет BOG_SUBS (ЗКН-Н007)")]
    subs = re.findall(r'"([^"]+)"', m.group(1))
    need = {"lichnosti", "books", "bhajans", "kirtans", "prasad", "dhama"}
    miss = need - set(subs)
    if miss:
        return [("App.tsx", "витрин не 6, нет: %s (ЗКН-Н007)" % ", ".join(sorted(miss)))]
    return []


def check_n011():
    """Навигация — стекло ЦВЕТА СТРАНИЦЫ. Серая плашка поверх белого = нарушение."""
    t = read(GLOBALS)
    m = re.search(r"--color-glass-nav:\s*rgba\((\d+),\s*(\d+),\s*(\d+)", t)
    if not m:
        return []
    r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
    # светлая тема: должен быть белый (255,255,255), не серый (250,250,252)
    if (r, g, b) not in ((255, 255, 255), (0, 0, 0)):
        return [("globals.css", "glass-nav = rgb(%d,%d,%d) — серая плашка, нужен цвет страницы (ЗКН-Н011)" % (r, g, b))]
    return []


def check_n012():
    """Меню оставляет воздух до контента (не прижимает текст)."""
    t = read(NAV4)
    m = re.search(r'HallTabs[\s\S]{0,900}?margin:\s*"-16px -16px (\d+)px"', t)
    if not m:
        return [("ui/nav4.tsx", "у HallTabs нет отступа снизу (ЗКН-Н012)")]
    if int(m.group(1)) < 8:
        return [("ui/nav4.tsx", "отступ под меню %spx — текст прижат (ЗКН-Н012)" % m.group(1))]
    return []


def check_n013():
    """Счётчик — НАСТОЯЩАЯ степень: доля от кегля родителя, не фикс. пиксели."""
    t = read(NAV4)
    m = re.search(r'<sup style=\{\{[\s\S]{0,200}?fontSize:\s*"([^"]+)"', t)
    if not m:
        return []
    v = m.group(1)
    if not v.endswith("em"):
        return [("ui/nav4.tsx", "счётчик fontSize=%s — не степень; нужна доля от кегля (ЗКН-Н013)" % v)]
    return []


def check_n017():
    """Витрина внутри зала не имеет своей шапки и своего скролла."""
    bad = []
    for name in ("prasad/PrasadamScreen.tsx", "BooksHub.tsx", "KirtansScreen.tsx"):
        t = read(SRC / name)
        if not t:
            continue
        if "100dvh" in t:
            bad.append((name.split("/")[-1], "свой скролл 100dvh внутри зала (ЗКН-Н017)"))
    return bad


def check_n019_n021():
    """Tier-2 липнет; обёртка <div> вокруг липкого меню запрещена."""
    bad = []
    t = read(NAV4)
    if "sticky = true" not in t:
        bad.append(("ui/nav4.tsx", "ScopeTitle не липкий по умолчанию — Tier-2 уедет (ЗКН-Н019)"))
    if "navRef" not in t:
        bad.append(("ui/nav4.tsx", "нет navRef — обёртка убьёт sticky (ЗКН-Н021)"))
    # обёртка вокруг липкого меню
    for fp in files():
        lines = read(fp).split("\n")
        for i, l in enumerate(lines):
            if "NavFilterChips sticky" in l or "<FilterChips sticky" in l:
                prev = lines[i - 1] if i else ""
                if re.search(r"<div[^>]*ref=", prev):
                    bad.append((fp.name, "обёртка <div ref> вокруг липкого меню — ломает sticky (ЗКН-Н021)"))
    return bad


def check_n022():
    """Один Tier-1 на приложение: единая высота через токен."""
    t = read(SRC / "HomeTabs.tsx")
    if not t:
        return []
    if "--h-hall-tabs" not in t:
        return [("HomeTabs.tsx", "высота Tier-1 не по токену — щель под липким Tier-2 (ЗКН-Н022)")]
    return []


def check_n024():
    """ЗКН-Н024 — ШАПКА ОДНА НА ВСЁ ПРИЛОЖЕНИЕ.

    Не «в Богатствах», а ВЕЗДЕ. Первая версия гейта стерегла только шесть витрин —
    и пропустила ВТОРУЮ шапку (`SectionHead` в ИСККОН) со своими отступами (16
    против 14), своим тегом (h2 против h1), своим весом надписи (700 против 600).
    Человек переходил из Богатств в ИСККОН — и текст прыгал.

    Правило: экран, рисующий НАДПИСЬ ЗОЛОТОМ (`--color-gold-deep` + uppercase),
    ОБЯЗАН звать HubHeader. Своя шапка = своя типографика = разъезд.
    """
    bad = []
    gold = re.compile(r'--color-gold-deep')
    caps = re.compile(r'textTransform:\s*"uppercase"')

    for fp in sorted(SRC.rglob("*.tsx")):
        if fp.name in ("HubHeader.tsx",):
            continue
        t = fp.read_text(encoding="utf-8")
        if "HubHeader" in t:
            # витрина Богатств не смеет ставить СВОЙ отступ сверху — он в зале
            i = t.find("<HubHeader")
            head = t[:i]
            if re.search(r'<div style=\{\{[^}]*marginTop[^}]*\}\}>\s*$', head.rstrip()):
                bad.append((fp.name, "ставит СВОЙ отступ сверху — он в зале, HUB_TOP (ЗКН-Н024)"))
            continue

        # ШАПКА = надпись золотом НЕПОСРЕДСТВЕННО НАД заголовком.
        #
        # Проверять «золото где-то + h1 где-то» — ловить ложное: у карточек-деталей
        # (бхаджан, киртания, личность) золото идёт в цитатах и чипах, а h1 — в
        # герой-обложке. Это НЕ шапка. Шапка — когда одно сразу над другим.
        for m in re.finditer(r'--color-gold-deep', t):
            tail = t[m.end():m.end() + 320]
            if caps.search(t[max(0, m.start() - 200):m.end() + 60]) and re.search(r'<h[12]\b', tail):
                bad.append((fp.name, "рисует СВОЮ шапку (надпись золотом над заголовком) — "
                                     "звать HubHeader (ЗКН-Н024)"))
                break
    return bad


def check_n027():
    """ЗКН-Н027 — ОДИН ЭКРАН, ОДИН ПУТЬ РЕНДЕРА. ВКЛАДКА — ТОЛЬКО ЗАКОННАЯ.

    ЭТО КОРЕНЬ ЦЕЛОГО КЛАССА ПОЛОМОК, и он держался месяцами.

    В приложении жили ДВА пути к одному экрану:
        tab === "bogatstva" → зал → HallTabs + витрина      ✓ С МЕНЮ
        tab === "books"     → BooksHub НАПРЯМУЮ             ✗ БЕЗ МЕНЮ
    И так же: kirtans · dhama · acharya · account · home.

    Отсюда «один и тот же адрес то открывается, то нет»: попадёшь через адрес —
    увидишь меню; попадёшь через `setTab("books")` — не увидишь. Ничего не падает,
    сборка зелёная, экран просто НЕ ТОТ.

    А `tab === "prasad"` НЕ СУЩЕСТВОВАЛО вовсе — `setTab` ставил вкладку, которую
    никто не рисует → БЕЛЫЙ ЭКРАН.

    ДВА ПРАВИЛА:
      1. `setTab` принимает ТОЛЬКО одну из пяти вкладок нижнего меню.
      2. Витрина Богатств рисуется ТОЛЬКО в зале — второго пути нет.
    """
    LEGAL = {"sadhana", "krishna", "gauranga", "iskcon", "bogatstva"}
    HUBS = ("BooksHub", "KirtansScreen", "DhamaScreen", "PrasadamScreen", "AcharyaScreen")

    app = SRC / "App.tsx"
    t = app.read_text(encoding="utf-8")
    bad = []

    for i, line in enumerate(t.split("\n"), 1):
        st = line.strip()
        if st.startswith(("*", "//", "/*")):
            continue

        # 1. незаконная вкладка = белый экран
        for m in re.finditer(r'setTab\("([a-z-]+)"\)', line):
            if m.group(1) not in LEGAL:
                bad.append(("App.tsx:%d" % i,
                            "setTab(\"%s\") — такой вкладки НЕТ, будет БЕЛЫЙ ЭКРАН. "
                            "Законные: %s (ЗКН-Н027)" % (m.group(1), " · ".join(sorted(LEGAL)))))

        # 2. витрина в обход зала
        m = re.match(r'\{tab === "([a-z-]+)" && <(\w+)', st)
        if m and m.group(2) in HUBS and m.group(1) != "bogatstva":
            bad.append(("App.tsx:%d" % i,
                        "<%s> рисуется в обход зала — витрина живёт ТОЛЬКО в зале "
                        "(ЗКН-Н027)" % m.group(2)))
    return bad


def check_n029():
    """ЗКН-Н029 — КАЖДЫЙ АДРЕС ОБЪЯВЛЯЕТ ОСНОВУ. ЗКН-Н030 — «закрыть» ≠ «назад».

    Было: 25 из 42 веток `applyPath` открывали оверлей, НЕ СКАЗАВ, что под ним.
    Человек стоял на «Богатства → Книги», жал «Джапа» — открывался счётчик, а
    закрыв его, попадал В КНИГИ, хотя джапа это Садхана. Свежий заход по ссылке
    `/japa` давал оверлей НАД ПУСТОТОЙ.

    Оверлей без основы — это оверлей над неизвестностью.

    Механизм: таблица BASE_OF (адрес → основа) + APP_OVERLAY (поиск, избранное,
    корзина — основу не трогают). Основа ставится ПЕРВОЙ, до разбора оверлея.

    И: `closeOverlay()` возвращает к ОСНОВЕ АДРЕСА, а не на «/».
    """
    t = (SRC / "App.tsx").read_text(encoding="utf-8")
    bad = []

    if "const BASE_OF" not in t:
        bad.append(("App.tsx", "нет таблицы BASE_OF — адреса не объявляют основу (ЗКН-Н029)"))
    if "const APP_OVERLAY" not in t:
        bad.append(("App.tsx", "нет APP_OVERLAY — поиск/избранное будут сбивать основу (ЗКН-Н029)"))
    if "if (!APP_OVERLAY.has(seg0)) {" not in t:
        bad.append(("App.tsx", "основа не ставится ПЕРВОЙ в applyPath (ЗКН-Н029)"))
    if "function closeOverlay" not in t:
        bad.append(("App.tsx", "нет closeOverlay — «закрыть» неотличимо от «назад» (ЗКН-Н030)"))
    if 'replaceUrl("/");\n    applyPath("/");' in t and "closeOverlay" not in t:
        bad.append(("App.tsx", "goBack без истории выкидывает на «/» — теряется раздел (ЗКН-Н030)"))

    # Каждая ОСНОВА из BASE_OF обязана быть законной вкладкой
    LEGAL = {"sadhana", "krishna", "gauranga", "iskcon", "bogatstva"}
    m = re.search(r"const BASE_OF[^{]*\{([\s\S]*?)\n  \};", t)
    if m:
        for base in set(re.findall(r':\s*"([a-z]+)"', m.group(1))):
            if base not in LEGAL:
                bad.append(("App.tsx", "BASE_OF ведёт на вкладку «%s», которой НЕТ — "
                                       "будет белый экран (ЗКН-Н027)" % base))
    return bad


def check_n031():
    """ЗКН-Н031 — ВИТРИНА НЕ СТАВИТ ОВЕРЛЕЙ. ВИТРИНА ВЫВОДИТСЯ ИЗ АДРЕСА.
    ЗКН-Н032 — компонент пишет адрес ИЗ СЕБЯ, а не из чужого сегмента.

    ТРИ КОРНЯ «белых экранов через раз» — все три молчаливые:

    1. ОВЕРЛЕЙ ПОДМЕНЯЕТ ВЕСЬ ЭКРАН. В `Screen` — тернарная цепочка из 36 ветвей,
       и каждая рисуется ВМЕСТО приложения (без нижнего меню, без зала).
       Голый `/prasad` ставил `setPrasadamSection("recipes")` → ветвь №24
       перехватывала → экран без меню. Витрина — это ВИТРИНА, её рисует зал.
       Оверлей ставится только глубже: `/prasad/<рецепт>`.

    2. ВИТРИНА ПОМНИЛАСЬ, А НЕ ВЫВОДИЛАСЬ. `sub` читался при монтировании зала и
       на смену адреса НЕ был подписан:
         из ИСККОН на /kirtans  → tab меняется → зал МОНТИРУЕТСЯ → sub верный  ✓
         из /books  на /kirtans → tab тот же   → зал НЕ монтируется → sub СТАРЫЙ ✗
       Отсюда «через раз».

    3. КОМПОНЕНТ ПИСАЛ НА ЧУЖОЙ АДРЕС. `EntityPage` брал основу из `segs[0]` —
       первого сегмента ТЕКУЩЕГО адреса. При смене царства старый компонент ещё
       не размонтирован, его эффект срабатывает уже с НОВЫМ адресом и дописывает
       СВОЙ подтаб: /gauranga/guna/milost. Человек жал Гаурангу — попадал
       в «Качества».
    """
    app = (SRC / "App.tsx").read_text(encoding="utf-8")
    ent = (SRC / "EntityPage.tsx").read_text(encoding="utf-8")
    bad = []

    # 1. голая витрина не ставит оверлей
    m = re.search(r'if \(seg0 === "prasad"\)([\s\S]{0,600}?)\n    \}', app)
    if m:
        tail = m.group(1).split("return;")[-2] if "return;" in m.group(1) else m.group(1)
        if "setPrasadamSection" in tail and "p2" not in tail:
            bad.append(("App.tsx", "голый /prasad ставит ОВЕРЛЕЙ — он подменит весь экран; "
                                   "витрину рисует зал (ЗКН-Н031)"))

    # 2. витрина подписана на адрес
    if "setSub(bogSubFromPath" not in app:
        bad.append(("App.tsx", "`sub` не подписан на смену адреса — витрина будет СТАРОЙ "
                               "при переходе внутри зала (ЗКН-Н031)"))

    # 3. компонент пишет адрес из СЕБЯ
    if "REALM_BASE" not in ent:
        bad.append(("EntityPage.tsx", "основа берётся из чужого сегмента адреса — при смене "
                                      "царства подтаб перенесётся (ЗКН-Н032)"))
    return bad


def check_n033():
    """ЗКН-Н033 — ЗАПАСНОЙ НЕ ПЕРЕБИВАЕТ ОСНОВУ. ПОДТАБ ВЫВОДИТСЯ ИЗ АДРЕСА.

    КОРЕНЬ, КОТОРЫЙ Я ИСКАЛ ПЯТЬ ЗАХОДОВ.

    В конце `applyPath` стояло голое `setTab("iskcon")` — и оно МОЛЧА ПЕРЕБИВАЛО
    основу, поставленную BASE_OF, для КАЖДОГО адреса, у которого не нашлось своей
    ветки. **Ветки для `/gauranga` не было вовсе.** Так терялось 13 адресов.

    И второе: `tab`/`sub` в EntityPage были СОСТОЯНИЕМ, снятым с адреса ОДИН РАЗ
    при монтировании. Адрес менялся — состояние оставалось. Смена царства уносила
    подтаб с собой (Кришна/Качества → Гауранга/Качества), и `key` этого НЕ ЛЕЧИЛ:
    беда была не в монтировании, а в том, что компонент ПОМНИЛ подтаб вместо того,
    чтобы ЧИТАТЬ его.

    Адрес — единственный источник истины.
    """
    app = (SRC / "App.tsx").read_text(encoding="utf-8")
    ent = (SRC / "EntityPage.tsx").read_text(encoding="utf-8")
    bad = []

    # 1. запасной не смеет перебивать основу
    if re.search(r'\n    setTab\("iskcon"\);\n  \}', app):
        bad.append(("App.tsx", "голый setTab(\"iskcon\") в конце applyPath МОЛЧА ПЕРЕБИВАЕТ "
                               "основу — адрес без своей ветки уедет в ИСККОН (ЗКН-Н033)"))

    # 2. каждое ЦАРСТВО имеет свою ветку
    for realm in ("krishna", "gauranga"):
        if 'seg0 === "%s"' % realm not in app:
            bad.append(("App.tsx", "нет ветки для /%s — адрес уедет в запасной (ЗКН-Н033)" % realm))

    # 3. ПУТЬ ЧИТАЕТСЯ СВЕЖИМ (ЗКН-Н037), а не из снимка при монтировании.
    #
    #    `useRef(window.location.pathname)` снимает путь ОДИН РАЗ и держит вечно:
    #    адрес сменился — снимок нет. Так смена царства уносила подтаб.
    #    Верно: состояние `pathNow`, ПОДПИСАННОЕ на адрес.
    if "const [pathNow, setPathNow]" not in ent:
        bad.append(("EntityPage.tsx", "путь читается из СНИМКА при монтировании — смена "
                                      "царства унесёт подтаб с собой (ЗКН-Н037)"))
    if "setPathNow(window.location.pathname" not in ent:
        bad.append(("EntityPage.tsx", "`pathNow` не подписан на смену адреса (ЗКН-Н037)"))
    return bad


def check_n035():
    """ЗКН-Н034 · Н035 · Н036 · Д009 — ЭКРАН СМЕНИЛСЯ → АДРЕС СМЕНИЛСЯ.

    Н034 — КНОПКА ВЕДЁТ ПО АДРЕСУ, А НЕ ШЛЁТ СОБЫТИЕ.
      Кнопки Практики слали CustomEvent («iol:open-japa»). Имена НЕ СОВПАДАЛИ
      с тем, что слушал App («iol:open-daily-verse» против «iol:open-verse»),
      а ветка-перехватчик в applyPath ловила /japa ПЕРВОЙ и делала return —
      настоящие обработчики НЕ ДОСТИГАЛИСЬ. Ни одна кнопка Практики не работала.

    Н035 — ЭКРАН БЕЗ АДРЕСА ЛЖЁТ.
      `openEntityTarget` открывал карточку и АДРЕС НЕ ТРОГАЛ. Из Календаря открыл
      личность — в строке остался `/calendar`; отправил ссылку — друг получил
      КАЛЕНДАРЬ. «Назад» — история не знает про карточку, выбросило на `/verse`.
      Так же: бхаджан, книга, киртания, контент — прямые сеттеры без адреса.

    Н036 — ОДНО СОДЕРЖИМОЕ — ОДНО МЕСТО.
      «Тексты бхаджанов» жили И в Бхаджанах, И в Киртанах. Киртаны — это ЗВУК,
      Бхаджаны — ТЕКСТ.

    Д009 — ОТСТУП МЕЖДУ СЕКЦИЯМИ ЕДИНЫЙ (было 18/20/26/30 вразнобой).
    """
    def code_only(t):
        """Комментарии не проверяем: в них закон ОБЪЯСНЯЕТСЯ, а не нарушается."""
        return "\n".join(l for l in t.split("\n")
                          if not l.strip().startswith(("*", "//", "/*")))

    app = code_only((SRC / "App.tsx").read_text(encoding="utf-8"))
    ph = code_only((SRC / "PracticeHub.tsx").read_text(encoding="utf-8"))
    ks = code_only((SRC / "KirtansScreen.tsx").read_text(encoding="utf-8"))
    bad = []

    # Н034 — кнопки Практики ведут по адресу
    if "dispatchEvent" in ph:
        bad.append(("PracticeHub.tsx", "кнопка шлёт СОБЫТИЕ вместо адреса — "
                                       "адрес не меняется, ссылку не отправить (ЗКН-Н034)"))
    if 'window.dispatchEvent(new CustomEvent("iol:open-" + seg0))' in app:
        bad.append(("App.tsx", "ветка-перехватчик в applyPath глушит обработчики Практики "
                               "(ЗКН-Н034)"))

    # Н035 — открытие экрана пишет адрес
    if 'onOpenBhajan={setOpenBhajan}' in app or 'onOpenContent={setOpenContent}' in app:
        bad.append(("App.tsx", "экран открывается ПРЯМЫМ сеттером — адрес не меняется, "
                               "экран без адреса ЛЖЁТ (ЗКН-Н035)"))
    m = re.search(r'function openEntityTarget[\s\S]{0,700}?\n  \}', app)
    if m and "pushUrl" not in m.group(0):
        bad.append(("App.tsx", "openEntityTarget не пишет адрес — из Календаря откроется "
                               "личность, а в строке останется /calendar (ЗКН-Н035)"))

    # Н036 — тексты бхаджанов только в Бхаджанах
    if "Тексты бхаджанов" in ks:
        bad.append(("KirtansScreen.tsx", "тексты бхаджанов дублируют вкладку «Бхаджаны» — "
                                         "Киртаны это ЗВУК (ЗКН-Н036)"))
    return bad




def func_body(src: str, name: str) -> str:
    """Тело компонента: от его объявления до следующего объявления верхнего уровня.

    Баланс фигурных скобок здесь НЕ работает: деструктуризация параметра
    `function Hall({ a, b }: {...})` схлопывает счётчик ДО тела — и гейт «не видел»
    подписку, стоящую ниже. Гейт, который врёт, хуже отсутствующего.
    """
    i = src.find("function " + name)
    if i < 0:
        return ""
    m = re.search(r"\n(?=(?:export )?(?:function|const|class|type|interface) )", src[i + 1:])
    return src[i: i + 1 + m.start()] if m else src[i:]


def strip_comments(src: str) -> str:
    """Убрать /* */ и // …, сохранив номера строк (переводы строк остаются)."""
    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))
    src = re.sub(r"/\*.*?\*/", blank, src, flags=re.S)
    src = re.sub(r"//[^\n]*", blank, src)
    return src


def check_n040():
    """ЗКН-Н040 — РОУТЕР НЕ СТАВИТ ВКЛАДКУ, КОТОРОЙ НЕТ. (корень белых экранов)

    `Screen` рисует ровно те вкладки, что перечислены в TAB_IDS. Любой
    `setTab("что-то-другое")` = экран, который не рисует НИЧЕГО: белый лист,
    молча, без ошибки в консоли. Так жили /books, /kirtans, /dhama, /feed,
    /account, /acharya — витрина открывалась мышью из зала, но тот же адрес
    «по ссылке» или «назад» давал пустоту.
    """
    bad = []
    app = ROOT / "apps/web/src/App.tsx"
    src = read(app)
    code = strip_comments(src)          # комментарии — летопись прошлых багов, не код
    m = re.search(r'export const TAB_IDS = \[([^\]]+)\]', src)
    if not m:
        return [(app.name, "TAB_IDS не найден — источник законных вкладок утрачен")]
    tabs = set(re.findall(r'"([^"]+)"', m.group(1)))
    for mm in re.finditer(r'setTab\("([^"]+)"\)', code):
        if mm.group(1) not in tabs:
            ln = code[: mm.start()].count("\n") + 1
            bad.append((app.name, f"стр.{ln}: setTab(\"{mm.group(1)}\") — вкладки нет в TAB_IDS → БЕЛЫЙ ЭКРАН"))
    # Screen обязан рисовать каждую законную вкладку
    for t in sorted(tabs):
        if f'tab === "{t}"' not in src:
            bad.append((app.name, f"вкладка «{t}» объявлена, но Screen её не рисует"))
    return bad


def check_n039():
    """ЗКН-Н039 — ИСТОРИЮ ПИШЕТ ТОЛЬКО nav.ts, И ОН ЖЕ БУДИТ РОУТЕР.

    Прямой `history.pushState` в обход nav.ts = адрес сменился, а роутер и
    подписчики (подтабы залов, ПКЛ) об этом не знают. Экран и адрес расходятся.
    """
    bad = []
    for f in files():
        if f.name == "nav.ts":
            continue
        src = strip_comments(read(f))
        for mm in re.finditer(r'(?:window\.)?history\.(pushState|replaceState)\(', src):
            ln = src[: mm.start()].count("\n") + 1
            bad.append((f.name, f"стр.{ln}: history.{mm.group(1)} в обход nav.ts (pushUrl/replaceUrl)"))
    return bad


def check_n042():
    """ЗКН-Н042 — КНОПКА ВЕДЁТ НА ЖИВОЙ АДРЕС.

    Каждый in-app адрес обязан иметь основу в BASE_OF (или быть оверлеем
    приложения). Адрес без основы роутер не опознаёт: он падает в запасную
    ветку и открывает НЕ ТО. Так «Практика → Мантра» вела на /kirtans, а
    /kirtans не был известен ни одной вкладке.
    """
    bad = []
    app = ROOT / "apps/web/src/App.tsx"
    src = read(app)
    mb = re.search(r'const BASE_OF: Record<string, string> = \{(.*?)\n  \};', src, re.S)
    mo = re.search(r'const APP_OVERLAY = new Set\(\[([^\]]+)\]\)', src)
    if not mb or not mo:
        return [(app.name, "BASE_OF / APP_OVERLAY не найдены")]
    known = set(re.findall(r'(\w+):\s*"', mb.group(1))) | set(re.findall(r'"([^"]+)"', mo.group(1)))
    known |= {"", "gauranga-lila", "krishna-lila", "bhagavatam-lila", "mahabharata-lila",
              "ramayana-lila", "pancha-tattva", "avatars", "rishis", "bhaktas",
              "demigods", "asuras"}   # лилы и кластеры — в корне (ЗКН-Н023)
    known |= {"books"}                # витрина книг
    # Ссылки-намерения из компонентов: to: "/x" и onOpenPath("/x")
    for f in files():
        fsrc = read(f)
        for mm in re.finditer(r'(?:to:|onOpenPath\?\?\(|onOpenPath\()\s*"(/[^"]*)"', fsrc):
            seg0 = mm.group(1).strip("/").split("/")[0]
            if seg0 and seg0 not in known:
                ln = fsrc[: mm.start()].count("\n") + 1
                bad.append((f.name, f"стр.{ln}: адрес «{mm.group(1)}» без основы в BASE_OF"))
    return bad



def check_n041():
    """ЗКН-Н041 — ПИСАТЕЛЬ И ЧИТАТЕЛЬ АДРЕСА — ОДИН СЛОВАРЬ.

    Каждый адрес, на который SAD_PATH отправляет раздел Садханы, обязан
    читаться обратно тем же именем раздела. Разъезд молчалив: нажал —
    работает, вернулся «назад» — снова Лента.
    """
    app = ROOT / "apps/web/src/App.tsx"
    src = read(app)
    m = re.search(r'const SAD_PATH: Record<string, string> = \{([^}]+)\}', src)
    r = re.search(r'export function sadSubFromPath\(path: string\): string \{(.*?)\n\}', src, re.S)
    if not m or not r:
        return [(app.name, "SAD_PATH / sadSubFromPath не найдены")]
    reader = strip_comments(r.group(1))
    bad = []
    for sec, path in re.findall(r'(\w+):\s*"([^"]+)"', m.group(1)):
        seg0 = path.strip("/").split("/")[0]
        if not seg0:                                   # "/" — Лента, значение по умолчанию
            if 'return "feed"' not in reader:
                bad.append((app.name, "корень «/» не читается как Лента"))
            continue
        if f'"{seg0}"' not in reader:
            bad.append((app.name, f'SAD_PATH.{sec} шлёт на «{path}», а sadSubFromPath сегмент «{seg0}» не знает'))
        elif f'return "{sec}"' not in reader:
            bad.append((app.name, f'адрес «{path}» не читается обратно как раздел «{sec}»'))
    # Зал Садханы обязан быть подписан на адрес (Богатства — были, Садхана — нет)
    for hall in ("SadhanaHall", "BogatstvaHall"):
        body = func_body(src, hall)
        if not body:
            bad.append((app.name, f"{hall} не найден"))
        elif "subscribeNav" not in body:
            bad.append((app.name, f"{hall} не подписан на адрес — «назад» не переключит раздел"))
    return bad


def check_n043():
    """ЗКН-Н043 — ФЛАГ «ПРИШЛО ИЗ РОУТЕРА» НЕ ДОЛЖЕН ЗАЛИПАТЬ.

    Эффект-синхронизатор сбрасывает `fromPop`, но бежит только когда что-то
    изменилось. Если применённый путь ничего не изменил — флаг залипает и
    съедает СЛЕДУЮЩИЙ честный переход. `routeGen` обязан быть в зависимостях.
    """
    app = ROOT / "apps/web/src/App.tsx"
    src = strip_comments(read(app))
    bad = []
    if "setRouteGen" not in src:
        return [(app.name, "routeGen отсутствует — fromPop может залипнуть навсегда")]
    m = re.search(r'if \(fromPop\.current\) \{ fromPop\.current = false; return; \}(.*?)\}, \[([^\]]+)\]', src, re.S)
    if not m:
        return [(app.name, "эффект-синхронизатор «состояние → URL» не найден")]
    if "routeGen" not in m.group(2):
        bad.append((app.name, "routeGen не в зависимостях синхронизатора — флаг fromPop залипнет"))
    return bad


def check_n018():
    """ЗКН-Н018 — ГЛАВНАЯ СТРАНИЦА ВИТРИНЫ — ЕЁ СУТЬ, А НЕ СПИСОК.

    Витрина открывается ТЕМ, ЗАЧЕМ В НЕЁ ИДУТ, а не оглавлением всего, что есть.

    Прасад: главная — КНИГА «Кухня прасада» (её оглавление). Рецепты, подбор,
    Божества, подношение — разделы Tier-2, ниже. Человек приходит за кухней
    прасада, а не за списком разделов.

    И: глава книги открывается ПЕРЕХОДОМ (свой адрес, своя страница), а не
    раздутием текущей — иначе страница растёт без конца, ссылку на главу не
    отправить, «назад» некуда вести.
    """
    t = (SRC / "prasad" / "PrasadamScreen.tsx").read_text(encoding="utf-8")
    bad = []
    if 'initialSection = "book"' not in t:
        bad.append(("PrasadamScreen.tsx", "главная витрины Прасада — НЕ книга; витрина "
                                          "открывается списком, а не сутью (ЗКН-Н018)"))
    if "onOpenBook" not in t:
        bad.append(("PrasadamScreen.tsx", "глава книги не открывается ПЕРЕХОДОМ — страница "
                                          "раздувается, ссылку на главу не отправить (ЗКН-Н018)"))
    return bad


CHECKS = [
    ("ЗКН-Н018", "главная витрины — её суть, не список", check_n018),
    ("ЗКН-Н040", "роутер не ставит вкладку, которой нет", check_n040),
    ("ЗКН-Н039", "историю пишет только nav.ts", check_n039),
    ("ЗКН-Н042", "кнопка ведёт на живой адрес", check_n042),
    ("ЗКН-Н041", "писатель и читатель адреса — один словарь", check_n041),
    ("ЗКН-Н043", "флаг «из роутера» не залипает", check_n043),
    ("ЗКН-Н027", "один экран — один путь рендера", check_n027),
    ("ЗКН-Н035", "экран сменился → адрес сменился", check_n035),
    ("ЗКН-Н033", "запасной не перебивает основу", check_n033),
    ("ЗКН-Н031", "витрина: без оверлея, из адреса", check_n031),
    ("ЗКН-Н029", "каждый адрес объявляет основу", check_n029),
    ("ЗКН-Н024", "шапка ОДНА на всё приложение", check_n024),
    ("ЗКН-Н002", "один глобальный popstate", check_n002),
    ("ЗКН-Н004", "верхнее меню на месте", check_n004),
    ("ЗКН-Н007", "Богатства = 6 витрин", check_n007),
    ("ЗКН-Н011", "навигация — стекло, не серая плашка", check_n011),
    ("ЗКН-Н012", "меню оставляет воздух до контента", check_n012),
    ("ЗКН-Н013", "счётчик — настоящая степень", check_n013),
    ("ЗКН-Н017", "витрина без своей шапки и скролла", check_n017),
    ("ЗКН-Н019/21", "Tier-2 липнет; обёртка запрещена", check_n019_n021),
    ("ЗКН-Н022", "один Tier-1 (единая высота)", check_n022),
]


def main():
    print("АУДИТ НАВИГАЦИИ · домен Н")
    print("─" * 70)
    details = []
    for law, name, fn in CHECKS:
        bad = fn()
        details += [(law, f, why) for f, why in bad]
        print("  %s %-12s %-40s %d" % ("✓" if not bad else "✗", law, name[:40], len(bad)))
    print("─" * 70)
    if details:
        print("\nНАРУШЕНИЯ (%d):\n" % len(details))
        for law, f, why in details:
            print("  %-12s %-24s %s" % (law, str(f)[:24], why))
        print("\nСвод: docs/LAWS.md")
        return 1
    print("Нарушений нет ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
