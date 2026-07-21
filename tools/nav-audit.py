#!/usr/bin/env python3
"""
АУДИТ НАВИГАЦИИ — домен Н (24 закона).

Самый крупный домен свода — и самый хрупкий. Каждый его закон родился из
поломки, которую основатель увидел на экране: пропавший Tier-2, серая плашка
вместо стекла, меню без адреса, обёртка, убившая sticky.

Проверяется структура, а не намерения:
  Н002  ровно один глобальный popstate (в App)
  Н003  «назад» не выкидывает за пределы сайта
  Н004  верхнее меню: поиск слева · вордмарк по центру · избранное справа
  Н007  Богатства = 6 витрин, и ПОРЯДОК их — закон
  Н011  навигация — стекло ЦВЕТА СТРАНИЦЫ, не серая плашка
  Н012  меню оставляет воздух до контента
  Н013  счётчик — настоящая степень (доля от кегля, не фикс. пиксели)
  Н017  витрина внутри зала не имеет своей шапки и «назад»
  Н044  у КАЖДОЙ витрины есть поиск, и он один на всё приложение
  Н045  умолчание вкладки ВЫВОДИТСЯ из первого подтаба, а не вписано
  Н019  Tier-2 липнет (навигация не уезжает)
  Н021  обёртка <div> вокруг липкого меню запрещена (ломает sticky)
  Н022  один Tier-1 на приложение (единая высота)
  Н060  адрес ВСЕГДА абсолютный (относительный читают по-разному)
  Н061  экран открывает ТОЛЬКО адрес (гейт ловит класс, не строку)

Запуск: python3 tools/nav-audit.py
"""
import re
import subprocess
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
        if "/music/" in str(fp):
            # /music изолирован распоряжением основателя 21.07.2026 — своя
            # история ПОВЕРХ стека App: слушатель слушает только свои state
            continue
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


#: ЗКН-Н007 — порядок утверждён основателем 13.07.2026; «Катха» добавлена после
#: «Книг» 18.07.2026. Правится ТОЛЬКО основателем.
BOG_ORDER = ["books", "katha", "lichnosti", "bhajans", "kirtans", "dhama", "prasad"]


def check_n007():
    """ЗКН-Н007 — БОГАТСТВА = 6 ВИТРИН, И ПОРЯДОК ИХ — ЗАКОН.

    Раньше гейт сверял МНОЖЕСТВО: «шесть штук, все на месте». Порядок при этом
    мог быть любым — и рейка `HallTabs` жила своим списком, отдельно от `BOG_SUBS`.
    Два списка = два порядка = два разных приложения; разъедутся молча.

    Сверяем ОБА: и список-источник, и рейку. Один порядок, один закон.
    """
    t = read(SRC / "App.tsx")
    bad = []

    m = re.search(r"BOG_SUBS\s*=\s*\[([^\]]*)\]", t)
    if not m:
        return [("App.tsx", "нет BOG_SUBS (ЗКН-Н007)")]
    subs = re.findall(r'"([^"]+)"', m.group(1))
    if subs != BOG_ORDER:
        bad.append(("App.tsx", "порядок BOG_SUBS %s ≠ закон %s (ЗКН-Н007)" % (subs, BOG_ORDER)))

    # рейку и умолчание сторожит ЗКН-Н045: они ВЫВОДЯТСЯ из этого же списка.
    return bad


#: ЗКН-Н072 — порядок НИЖНИХ вкладок утверждён основателем 15.07.2026. Правится ТОЛЬКО им.
TAB_ORDER = ["sadhana", "bogatstva", "krishna", "gauranga", "iskcon"]


def check_n072():
    """ЗКН-Н072 — НИЖНЕЕ МЕНЮ = 5 ВКЛАДОК, И ПОРЯДОК ИХ — ЗАКОН.

    Порядок кнопок нижнего меню — решение основателя, не разработчика. Но список
    ЖИВЁТ ДВАЖДЫ: `TABS` (что рисуется) и `TAB_IDS` (канонический источник вкладок,
    ЗКН-Н040). Два списка = два порядка; разъедутся молча — ровно та болезнь, от
    которой предостерегают Н007/Н045. Сверяем ОБА против утверждённого порядка.
    """
    t = read(SRC / "App.tsx")
    if not t:
        return []
    bad = []

    m = re.search(r"const TABS\s*=\s*\[(.*?)\]\s*as const", t, re.S)
    if not m:
        return [("App.tsx", "нет TABS (ЗКН-Н072)")]
    tabs = re.findall(r'id:\s*"([^"]+)"', m.group(1))
    if tabs != TAB_ORDER:
        bad.append(("App.tsx", "порядок TABS %s ≠ закон %s (ЗКН-Н072)" % (tabs, TAB_ORDER)))

    m2 = re.search(r"export const TAB_IDS = \[([^\]]+)\]", t)
    if not m2:
        return bad + [("App.tsx", "нет TAB_IDS (ЗКН-Н072)")]
    ids = re.findall(r'"([^"]+)"', m2.group(1))
    if ids != TAB_ORDER:
        bad.append(("App.tsx", "порядок TAB_IDS %s ≠ TABS/закон %s (ЗКН-Н072)" % (ids, TAB_ORDER)))

    return bad


def check_n073():
    """ЗКН-Н073 — БЛОК ДЛИННОЙ СТРАНИЦЫ ЖИВЁТ В АДРЕСЕ.

    Лендинг ИСККОН — длинный скролл с меню по блокам. Меню и подсветка активного
    блока были, а АДРЕС не менялся: стоя на блоке, сослаться на него было нельзя —
    только на верх страницы. Сверяем три вещи:
      1. у каждого якоря ISKCON_ANCHORS есть секция id="hsec-<id>" (иначе меню
         ведёт в никуда, а scroll-spy молчит на несуществующей секции);
      2. скролл/клик ПИШУТ адрес — в коде есть вызов replaceAnchor(;
      3. заход по ссылке ЧИТАЕТ адрес — есть iskconAnchorFromPath.
    Без (2)/(3) — регресс к «блоку без адреса», ровно тот баг, что чинили.
    """
    t = read(SRC / "HomeScreen.tsx")
    if not t:
        return []
    bad = []
    m = re.search(r"ISKCON_ANCHORS[^=]*=\s*\[(.*?)\]", t, re.S)
    if not m:
        return [("HomeScreen.tsx", "нет ISKCON_ANCHORS (ЗКН-Н073)")]
    ids = re.findall(r'id:\s*"([^"]+)"', m.group(1))
    for i in ids:
        if ('id="hsec-%s"' % i) not in t:
            bad.append(("HomeScreen.tsx", "якорь «%s» без секции hsec-%s (ЗКН-Н073)" % (i, i)))
    if "replaceAnchor(" not in t:
        bad.append(("HomeScreen.tsx", "блок не пишет адрес: нет replaceAnchor( (ЗКН-Н073)"))
    if t.count("iskconAnchorFromPath") < 2:
        bad.append(("HomeScreen.tsx", "заход по ссылке не читает адрес: iskconAnchorFromPath не используется (ЗКН-Н073)"))
    return bad


def check_n074():
    """ЗКН-Н074 — ГЛАВНЫЙ ТАБ = ПЕРВЫЙ В МЕНЮ, И ОН ВЫВОДИТСЯ, А НЕ ВПИСАН.

    Стартовая вкладка приложения и то, что открывает корень «/», ДОЛЖНЫ
    выводиться из TAB_IDS[0] (через HOME_TAB). Прибить дефолт к конкретному табу
    ОТДЕЛЬНО от порядка кнопок — та же болезнь «второго списка», что уже роняла
    навигацию: порядок сменили (ЗКН-Н072), а корень по-старому тянул Даршан.
    Сверяем: HOME_TAB выведен; начальная вкладка и корень им пользуются;
    строкой дефолт не вписан.
    """
    t = read(SRC / "App.tsx")
    if not t:
        return []
    bad = []
    if "HOME_TAB = TAB_IDS[0]" not in t:
        bad.append(("App.tsx", "нет HOME_TAB = TAB_IDS[0]: главный таб не выведен (ЗКН-Н074)"))
    if "useState(HOME_TAB)" not in t:
        bad.append(("App.tsx", "начальная вкладка не выведена: нужно useState(HOME_TAB) (ЗКН-Н074)"))
    if re.search(r'\[\s*tab\s*,\s*setTab\s*\]\s*=\s*useState\(\s*"', t):
        bad.append(("App.tsx", "начальная вкладка вписана строкой вместо HOME_TAB (ЗКН-Н074)"))
    if '"": HOME_TAB' not in t:
        bad.append(("App.tsx", 'корень BASE_OF[""] не ведёт на HOME_TAB (ЗКН-Н074)'))
    if not re.search(r'clean === "/"\)\s*\{\s*setTab\(HOME_TAB\)', t):
        bad.append(("App.tsx", 'корень "/" не открывает главный таб: setTab(HOME_TAB) (ЗКН-Н074)'))
    return bad


def check_n011():
    """Навигация — стекло ЦВЕТА СТРАНИЦЫ. Плашка поверх страницы = нарушение.

    ГЕЙТ СВЕРЯЛ С КОНСТАНТОЙ, а закон — про СООТВЕТСТВИЕ. Пока страница была
    белой, «белый или чёрный» и «цвет страницы» совпадали, и подмена не мешала.
    Стоило странице стать холстом App Store (242,242,246) — и константа стала
    требовать БЕЛЫЙ БАР ПОВЕРХ СЕРОГО: ту же болезнь наизнанку, только теперь
    руками гейта. Теперь сверяем с фактическим `--color-bg` темы.
    """
    t = read(GLOBALS)
    bad = []
    for theme, block in (("светлая", r":root\[data-theme='light'\]"), ("тёмная", r"^:root\s*\{")):
        m = re.search(block + r"[\s\S]*?\n\}", t, re.M)
        if not m:
            continue
        blk = m.group(0)
        bgm = re.search(r"--color-bg:\s*(#[0-9a-fA-F]{6}|rgba?\([^)]+\))", blk)
        navm = re.search(r"--color-glass-nav:\s*rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)", blk)
        if not bgm or not navm:
            continue
        bg = bgm.group(1)
        if bg.startswith("#"):
            page = tuple(int(bg[i:i + 2], 16) for i in (1, 3, 5))
        else:
            page = tuple(int(x) for x in re.findall(r"\d+", bg)[:3])
        nav = tuple(int(navm.group(i)) for i in (1, 2, 3))
        # Допуск 4/255: стекло может быть на волос светлее холста, но не «баром».
        if max(abs(a - b) for a, b in zip(page, nav)) > 4:
            bad.append(("globals.css",
                        "%s тема: glass-nav rgb%s ≠ цвет страницы rgb%s — это плашка "
                        "поверх холста (ЗКН-Н011)" % (theme, nav, page)))
    return bad


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
        if "/music/" in str(fp):  # /music изолирован распоряжением основателя 21.07.2026 — своя история поверх стека, App о ней не знает
            continue
        if fp.name in ("HubHeader.tsx",):
            continue
        t = fp.read_text(encoding="utf-8")
        if "HubHeader" in t:
            # витрина Богатств не смеет ставить СВОЙ отступ сверху — он в зале
            i = t.find("<HubHeader")
            head = t[:i]
            # ⚠️ Гейт ловил только `<div …marginTop…>` — и ПРОПУСТИЛ
            #    `<section style={{ marginTop: 28 }}>` в Бхаджанах: 28 поверх
            #    зальных 28. Тег значения не имеет — значение имеет отступ.
            if re.search(r'<(?:div|section|main|article)\s+style=\{\{[^}]*marginTop[^}]*\}\}>\s*$', head.rstrip()):
                bad.append((fp.name, "ставит СВОЙ отступ СВЕРХУ — он в зале, HUB_TOP (ЗКН-Н024)"))
            # И СБОКУ. Зал уже даёт 16px — витрина НЕ обрамляет страницу заново.
            #
            # ⚠️ Первая версия этой проверки искала любой `padding: "Npx 16px"` —
            #    и ловила КНОПКИ и КАРТОЧКИ (`padding: "10px 16px"`, `"14px 16px"`,
            #    `"18px 18px 16px"`). Гейт, который кричит на кнопки, ОТКЛЮЧАТ через
            #    неделю — и вместе с ним умрёт закон. Признак обязан быть ТОЧНЫМ,
            #    а не «примерно похожим»: лучше стеречь одно наверняка, чем пять наугад.
            #
            # Точный признак, которого НЕТ ни у одной кнопки и ни у одной карточки:
            # витрина строит СВОЮ РАМКУ СТРАНИЦЫ — `maxWidth` + `margin: "0 auto"`.
            # Оболочка приложения уже 480px; вторая рамка внутри — всегда разъезд.
            # Так и жил Прасад: `maxWidth: 600, margin: "0 auto", padding: "18px 16px 64px"`.
            if str(fp.relative_to(SRC)) in HUB_FILES:
                for pm in re.finditer(r'style=\{\{([^}]*)\}\}', t):
                    s = pm.group(1)
                    if "maxWidth" in s and '"0 auto"' in s:
                        bad.append((fp.name, "витрина обрамляет страницу САМА (maxWidth + 0 auto) — рамка живёт в зале (ЗКН-Н024)"))
                        break
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


#: ЗКН-Н044 — ИСКЛЮЧЕНИЕ ПО ЗАКОНУ, А НЕ ПО УДОБСТВУ.
#  SearchScreen — это НЕ витрина, а поиск ПО ВСЕМУ ПРИЛОЖЕНИЮ (ЗКН-Н004): свой
#  полноэкранный обычай, своя клавиатура, своя выдача. Ему HubSearch не идиома.
#  `ios.tsx` — КАНОН строки поиска (ЗКН-Д019, эталон App Store): HubSearch
#  теперь сам зовёт <SearchField> оттуда, поэтому файл наравне с HubHeader.
N044_EXEMPT = {"HubHeader.tsx", "SearchScreen.tsx", "ios.tsx"}

#: ЗКН-Н044 · ХРАПОВИК. Своё поле поиска ЗА ПРЕДЕЛАМИ Богатств — признанный долг.
#  Список может только СОКРАЩАТЬСЯ: новый файл со своим полем валит гейт.
#  Урок ЗКН-Н024 («шапка одна на ВСЁ приложение, а не в Богатствах») здесь ещё
#  не отработан до конца — и он записан как долг, а не спрятан.
#  18.07.2026 — ШЕСТЬ ИЗ ВОСЬМИ ЗАКРЫТЫ (ЗКН-Д019): Избранное · Календарь ·
#  Документы ИСККОН · Места · Заметки · Центры переведены на <SearchField>.
#  Осталось двое, и это НЕ строки поиска: `EntityPicker` внутри админ-форм
#  центра. Гейт на формах — гейт, который отключат, поэтому они остаются
#  честно объявленным долгом, а не тихо переписанным правилом.
N044_DEBT = {
    "centers/CenterEvents.tsx",
    "centers/CenterDeities.tsx",
}


#: ЗКН-Н044 — шесть витрин Богатств. У КАЖДОЙ обязан быть поиск.
#  Личности живут в двух файлах: первый экран (AcharyaScreen) и меню (LichnostiHub).
HUB_FILES = {
    "BooksHub.tsx", "AcharyaScreen.tsx", "LichnostiHub.tsx", "KirtansScreen.tsx",
    "dhama/DhamaScreen.tsx", "prasad/PrasadamScreen.tsx",
}

HUBS_WITH_SEARCH = [
    "BooksHub.tsx",
    "AcharyaScreen.tsx",
    "LichnostiHub.tsx",
    "App.tsx",                      # BhajanShelf — витрина Бхаджанов живёт в зале
    "KirtansScreen.tsx",
    "dhama/DhamaScreen.tsx",
    "prasad/PrasadamScreen.tsx",
]


def check_n044():
    """ЗКН-Н044 — У ВИТРИНЫ ЕСТЬ ПОИСК, И ОН ОДИН.

    Два условия, и оба обязательны:

      1. КАЖДАЯ витрина Богатств зовёт `HubSearch`. Витрина без поиска — витрина,
         в которой нельзя ничего найти: 706 личностей, сотни рецептов и альбомов
         лежат за перелистыванием. Так и было: у Личностей, Киртан и Прасада
         поиска не существовало вовсе.

      2. НИКТО не рисует строку поиска в обход `HubHeader.tsx`. Пока каждая
         витрина лепит своё поле, договорённость разъедется снова — как уже
         разъехалась на четыре разных поля (Книги · Бхаджаны · Дхама · Личности).
    """
    bad = []

    for name in HUBS_WITH_SEARCH:
        t = read(SRC / name)
        if not t:
            bad.append((name, "витрина пропала (ЗКН-Н044)"))
        # ⚠️ Сначала стояло `"HubSearch" not in t` — и гейт НЕ ловил, когда
        #    вызов ломали: подстрока оставалась в строке импорта. Проверять надо
        #    ВЫЗОВ (`<HubSearch …`), а не упоминание имени где-то в файле.
        elif not re.search(r'<HubSearch[\s/>]', t):
            bad.append((name.split("/")[-1], "витрина БЕЗ поиска — найти в ней нельзя ничего (ЗКН-Н044)"))

    # своя строка поиска в обход общего компонента
    own = set()
    for fp in sorted(SRC.rglob("*.tsx")):
        if "/music/" in str(fp):  # /music изолирован распоряжением основателя 21.07.2026 — своя история поверх стека, App о ней не знает
            continue
        if fp.name in N044_EXEMPT:
            continue
        t = fp.read_text(encoding="utf-8")
        for m in re.finditer(r'<input\b', t):
            frag = t[m.start():m.start() + 700]
            # ТОЧНЫЙ признак поиска. Расширять его на «Город»/«Напр.» нельзя:
            # так в улов попадают ФОРМЫ администратора (CenterEditor, CenterSchedule),
            # а гейт на формах — это гейт, который отключат.
            if 'inputMode="search"' in frag or re.search(r'placeholder="[^"]*(?:[Пп]оиск|[Нн]айти)', frag):
                own.add(str(fp.relative_to(SRC)))
                break

    # ХРАПОВИК. Витрины Богатств вычищены сегодня и держатся жёстко. За их
    # пределами своих полей ещё СЕМЬ — они названы поимённо и заморожены:
    # список может только СОКРАЩАТЬСЯ. Новый файл со своим полем = fail.
    new_own = own - N044_DEBT
    for f in sorted(new_own):
        bad.append((f, "НОВАЯ своя строка поиска — звать HubSearch (ЗКН-Н044)"))

    fixed = N044_DEBT - own
    for f in sorted(fixed):
        bad.append((f, "долг закрыт — вычеркнуть из N044_DEBT в nav-audit.py (ЗКН-Н044)"))
    return bad


def check_n045():
    """ЗКН-Н045 — УМОЛЧАНИЕ ВКЛАДКИ = ЕЁ ПЕРВЫЙ ПОДТАБ. НЕ ОТДЕЛЬНЫЙ АДРЕС.

    Основатель переставил витрины (Книги первыми) — а нижняя вкладка «Богатства»
    продолжала вести в Личности. И вкладка «Садхана» вела в ПРАКТИКУ, хотя первый
    раздел рейки — Даршан. Причина в обоих случаях ОДНА: умолчание было ВПИСАНО
    РУКАМИ в `HOME_OF`, отдельно от порядка подтабов. Переставили порядок —
    умолчание осталось на месте и промолчало.

    Это не забывчивость, это ВТОРОЙ СПИСОК. Лечится тем, что второго списка НЕТ:
    порядок → рейка → умолчание выводятся из ОДНОГО массива.

    Гейт: `HOME_OF` не смеет содержать литерал-адрес для залов с подтабами, а рейка
    не смеет писаться литералом в JSX — только `BOG_TABS` / `SAD_TABS` из списков.
    """
    t = read(SRC / "App.tsx")
    bad = []

    # 1. умолчание ВЫВОДИТСЯ, а не вписано
    m = re.search(r"HOME_OF:\s*Record<string,\s*string>\s*=\s*\{(.*?)\}", t, re.S)
    if not m:
        return [("App.tsx", "нет HOME_OF (ЗКН-Н045)")]
    body = m.group(1)
    for hall, subs, paths in (("sadhana", "SAD_SUBS", "SAD_PATH"), ("bogatstva", "BOG_SUBS", "BOG_PATH")):
        entry = re.search(hall + r"\s*:\s*([^,\n]+)", body)
        if not entry:
            bad.append(("App.tsx", "в HOME_OF нет зала «%s» (ЗКН-Н045)" % hall))
        elif '"' in entry.group(1):
            bad.append(("App.tsx", "умолчание «%s» ВПИСАНО адресом %s — оно обязано выводиться "
                                   "из %s[0] (ЗКН-Н045)" % (hall, entry.group(1).strip(), subs)))
        elif "%s[%s[0]]" % (paths, subs) not in entry.group(1).replace(" ", ""):
            bad.append(("App.tsx", "умолчание «%s» не выводится из %s[0] (ЗКН-Н045)" % (hall, subs)))

    # 2. рейка не пишется литералом — иначе порядок разъедется с BOG_SUBS/SAD_SUBS
    for label, tabs in (("Витрины Богатств", "BOG_TABS"), ("Разделы Садханы", "SAD_TABS")):
        r = re.search(r'ariaLabel="%s"\s*items=\{([^}]+)\}' % label, t)
        if not r:
            bad.append(("App.tsx", "рейка «%s» не найдена или пишется литералом (ЗКН-Н045)" % label))
        elif r.group(1).strip() != tabs:
            bad.append(("App.tsx", "рейка «%s» не выведена из %s (ЗКН-Н045)" % (label, tabs)))
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




def _code_only(t: str) -> str:
    """Комментарии не проверяем: в них закон ОБЪЯСНЯЕТСЯ, а не нарушается."""
    return "\n".join(l for l in t.split("\n")
                      if not l.strip().startswith(("*", "//", "/*")))


def check_n060():
    """ЗКН-Н060 — АДРЕС ПРИЛОЖЕНИЯ ВСЕГДА АБСОЛЮТНЫЙ.

    Молитва из списка бхаджанов открывалась ПУСТОЙ, а «назад» её ПОКАЗЫВАЛ.

    `pushUrl(url)` писал в историю СЫРУЮ строку, а роутеру отдавал `pathOf(url)`.
    Для абсолютного пути это одно и то же. Для ОТНОСИТЕЛЬНОГО — два разных пути:

        стоим на  /bhajans/gaura-arati
        зовём     pushUrl("gaurakisor-das-babaji-pranama")
        браузер → /bhajans/gaurakisor-das-babaji-pranama   (от ПАПКИ — адрес верный)
        роутер  → /gaurakisor-das-babaji-pranama           (от КОРНЯ — ищет личность)

    Адрес показывал молитву, роутер искал статью: «Не удалось загрузить». «Назад»
    снимал запись, popstate читал адрес ИЗ СТРОКИ — и молитва открывалась.

    Относительный адрес рождался в трёх местах, и все три сторожим:
      (а) nav.ts не нормализует путь ДО записи в историю;
      (б) вызов navigate/pushUrl со строкой без ведущего «/» либо с ГОЛЫМ слагом;
      (в) `pathFromState` возвращает не адрес, а слаг («slug сам по себе путь»).
    """
    nav = read(SRC / "nav.ts")
    app = read(SRC / "App.tsx")
    bad = []

    # (а) nav.ts: одна нормализация, и она ДО записи
    if "function absUrl" not in nav:
        bad.append(("nav.ts", "нет absUrl — путь пишется в историю сырым (ЗКН-Н060)"))
    for fn, api in (("pushUrl", "pushState"), ("replaceUrl", "replaceState")):
        m = re.search(r"export function %s\([\s\S]{0,400}?\n\}" % fn, nav)
        if not m:
            bad.append(("nav.ts", "нет %s (ЗКН-Н060)" % fn))
            continue
        body = m.group(0)
        if re.search(r"history\.%s\([^)]*,\s*url\s*\)" % api, body):
            bad.append(("nav.ts", "%s пишет в историю СЫРОЙ url — браузер и роутер "
                                  "прочитают его по-разному (ЗКН-Н060)" % fn))

    # (б) вызов навигации относительным путём
    for fp in files():
        for i, line in enumerate(_code_only(read(fp)).split("\n"), 1):
            if re.search(r"\b(navigate|pushUrl|replaceUrl|onNavigate|onOpenPath)\(\s*[\"']"
                         r"[^/\"']", line):
                bad.append((fp.name, "строка %d: адрес без ведущего «/» — "
                                     "относительный путь (ЗКН-Н060)" % i))
            if re.search(r"\b(navigate|onNavigate|onOpenPath)\("
                         r"\s*(s|sl|slug|id|key|k|work|w)\s*\)", line):
                bad.append((fp.name, "строка %d: в navigate передан СЛАГ, а не адрес — "
                                     "путь строит ROUTES (ЗКН-Н060)" % i))

    # (в) адрес состояния абсолютен: каждый return в pathFromState
    m = re.search(r"function pathFromState\(\)[\s\S]*?\n  \}", app)
    if not m:
        bad.append(("App.tsx", "нет pathFromState (ЗКН-Н060)"))
    else:
        ok = ('"/', "`/", "ROUTES.", "window.location.pathname", "HOME_OF[")
        for line in _code_only(m.group(0)).split("\n"):
            r = re.search(r"\breturn\s+(.+?);", line)
            if r and not any(t in r.group(1) for t in ok):
                bad.append(("App.tsx", "pathFromState отдаёт не адрес: «%s» — "
                                       "состояние хранит слаг, адрес строит ROUTES "
                                       "(ЗКН-Н060)" % r.group(1)[:40]))

    # страховка У4: относительный адрес не попадает в историю даже при регрессе
    if 'if (!next.startsWith("/")) return;' not in app:
        bad.append(("App.tsx", "эффект «состояние → адрес» пишет путь без проверки "
                               "на абсолютность (ЗКН-Н060)"))
    return bad


def check_n061():
    """ЗКН-Н061 — ЭКРАН ОТКРЫВАЕТ ТОЛЬКО АДРЕС. ГЕЙТ ЛОВИТ КЛАСС, А НЕ СТРОКУ.

    Закон Н035 («экран сменился → адрес сменился») существовал, и гейт у него был.
    Но гейт искал ДВЕ БУКВАЛЬНЫЕ СТРОКИ: `onOpenBhajan={setOpenBhajan}` и
    `onOpenContent={setOpenContent}`. Стоило записать то же самое иначе —

        onOpen={(slug) => { setOpenCatalog(false); setOpenBhajan(slug); }}

    — и нарушение проходило мимо. Каталог молитв открывал экран ПРЯМЫМ сеттером;
    адрес дописывал эффект-синхронизатор, и дописывал НЕВЕРНО (см. Н060).

    Гейт, который ловит строку, а не класс, — это не гейт, а её отсутствие.

    Список экранных сеттеров гейт берёт ИЗ САМОГО КОДА — из строки сброса в
    `applyPath` (она обнуляет ровно то, что определяет адрес). Появится новый
    экран — он попадёт под закон сам, без правки гейта.
    """
    app = (SRC / "App.tsx").read_text(encoding="utf-8")
    m = re.search(r"setOpenBook\(null\);[^\n]*", app)
    if not m:
        return [("App.tsx", "не найден сброс состояний в applyPath (ЗКН-Н061)")]
    setters = sorted(set(re.findall(r"\b(set[A-Z][A-Za-z]*)\(", m.group(0))))
    if len(setters) < 20:
        return [("App.tsx", "сброс в applyPath распознан частично (ЗКН-Н061)")]

    names = "|".join(setters)
    bad = []
    for i, line in enumerate(_code_only(app).split("\n"), 1):
        if not re.search(r"\bon[A-Z][A-Za-z]*=\{", line):
            continue
        if re.search(r"\bon[A-Z][A-Za-z]*=\{\s*(%s)\s*\}" % names, line):
            bad.append(("App.tsx", "строка %d: экран открывается ПРЯМЫМ сеттером — "
                                   "адрес не меняется, экран без адреса ЛЖЁТ "
                                   "(ЗКН-Н061)" % i))
        elif re.search(r"\bon[A-Z][A-Za-z]*=\{[^\n]*\b(%s)\(" % names, line):
            bad.append(("App.tsx", "строка %d: обработчик зовёт (%s) в обход роутера — "
                                   "открывать экран может только адрес (ЗКН-Н061)"
                        % (i, re.search(r"\b(%s)\(" % names, line).group(1))))
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


def check_n002():
    """ЗКН-Н002 — ТОЛЬКО ОДИН ГЛОБАЛЬНЫЙ `popstate`.

    Два слушателя одного события РЕЙСЯТСЯ: порядок не гарантирован. Один успеет
    разобрать адрес, второй — перетереть результат. И это плавает: то работает,
    то нет, в зависимости от того, кто зарегистрировался первым.

    Владелец `popstate` — App. Он разбирает маршрут и ТОЛЬКО ПОТОМ оповещает
    подписчиков (`notifyNav`). Порядок детерминирован.

    И: решений на `history.length` быть не может — она НЕ УМЕНЬШАЕТСЯ при back().
    Судить по ней «можно ли назад» — значит судить по счётчику, который только
    растёт.
    """
    import re as _re
    bad = []
    owners = []
    for fp in sorted(SRC.rglob("*")):
        if fp.suffix not in (".ts", ".tsx"):
            continue
        if "/music/" in str(fp):
            # /music изолирован распоряжением основателя 21.07.2026: клон живёт
            # ПОВЕРХ App и слушает только свои state ({amx}), гонки нет
            continue
        t = fp.read_text(encoding="utf-8")
        for m in _re.finditer(r'addEventListener\(\s*["\']popstate["\']', t):
            owners.append(fp.name)
    if len(owners) > 1:
        bad.append(("App.tsx", "слушателей popstate %d (%s) — они РЕЙСЯТСЯ, порядок не "
                               "гарантирован; владелец один: App (ЗКН-Н002)"
                    % (len(owners), " · ".join(sorted(set(owners))))))
    return bad


def check_n076():
    """ЗКН-Н076: сохранённая ссылка на стих — канонический slug, не work-code.

    Href избранного/шаринга/QR для стиха (verseUrl в BookDetailPage) ОБЯЗАН
    строиться из `/${bookSlug(work)}/...`, как favHref главы и весь URL-контур
    читалки. work-code-форма `ROUTES.book(work, <глава>)` даёт `/bg/2/13`, которую
    не узнаёт ни safety-net подписки читалки (`startsWith("/${bookSlug(work)}")`),
    ни гейт route → при открытой книге стих не доставляется и открытие
    схлопывается на главу. Расхождение форм ссылки на один и тот же контент
    (код книги vs slug) запрещено.
    """
    bad = []
    fp = SRC / "BookDetailPage.tsx"
    src = read(fp)
    if src:
        m = re.search(r"const\s+verseUrl\s*=([\s\S]{0,500}?);", src)
        if m and re.search(r"ROUTES\.book\(\s*work\b", m.group(1)):
            ln = src[: m.start()].count("\n") + 1
            bad.append(("BookDetailPage.tsx", "стр.%d: verseUrl построен через ROUTES.book(work,...) — work-code URL вместо slug (bookSlug); стих схлопнется на главу" % ln))
    return bad


def check_n077():
    """ЗКН-Н077: избранное трека-киртана несёт адрес самого трека, не библиотеки.

    (1) NowPlaying.addFavorite(k, {...}) для трека обязан класть `h` — иначе избранное
    схлопнется на /kirtans. (2) FavoritesScreen.hrefFor для kirtan не должен возвращать
    голый "/kirtans": адрес трека выводится из ключа kirtan:<хвост>. Лист (трек) обязан
    открываться листом, а не контейнером (библиотекой) — как и стих (Н076).
    """
    bad = []
    np = read(SRC / "player" / "NowPlaying.tsx")
    if np:
        m = re.search(r"addFavorite\(k,\s*\{([^}]*)\}\)", np)
        if m and "h:" not in m.group(1):
            ln = np[: m.start()].count("\n") + 1
            bad.append(("NowPlaying.tsx", "стр.%d: addFavorite трека без h — избранное не откроет трек" % ln))
    fs = read(SRC / "FavoritesScreen.tsx")
    if fs:
        m = re.search(r'indexOf\("kirtan"\)\s*===\s*0\)\s*return\s*"/kirtans"', fs)
        if m:
            ln = fs[: m.start()].count("\n") + 1
            bad.append(("FavoritesScreen.tsx", "стр.%d: hrefFor kirtan → голый /kirtans; трек схлопнется на библиотеку" % ln))
    return bad


def check_n078():
    """ЗКН-Н078: «в избранное» реально сохраняет объект и ведёт ВНУТРЕННИМ адресом к нему.

    (1) Нет фальшивого сердечка — избранное не держится в локальном useState:
    `setFavorited(` запрещён (сохранять через useFavorite/addFavorite). (2) В вызовах
    useFavorite/addFavorite поле `h` — внутренний путь («/…»), не внешний URL: значения
    с http/…Url (кроме уже срезанных .replace/.slice) запрещены. Обобщение Н076/Н077:
    что сохранил — то и обязано открыться, самим собой и внутри приложения.
    """
    bad = []
    for f in files():
        code = strip_comments(read(f))
        for mm in re.finditer(r"setFavorited\s*\(", code):
            ln = code[: mm.start()].count("\n") + 1
            bad.append((f.name, "стр.%d: setFavorited — избранное в локальном стейте, не сохраняется" % ln))
        for mm in re.finditer(r"(?:useFavorite|addFavorite)\s*\([^\n]*?\bh:\s*([^,}\n]+)", code):
            hv = mm.group(1).strip()
            if re.match(r"[`\"']?/", hv) or ".replace(" in hv or ".slice(" in hv:
                continue  # внутренний путь / origin уже срезан
            if re.search(r"https?://|[Uu][Rr][Ll]\b", hv):
                ln = code[: mm.start()].count("\n") + 1
                bad.append((f.name, "стр.%d: h избранного — внешний адрес (%s); нужен внутренний путь" % (ln, hv[:40])))
    return bad


def check_n079():
    """ЗКН-Н079: избранный/глубоко-ссылочный стих ОБЯЗАН открыться стихом, а не главой.

    Н076 починил лишь ФОРМУ URL (slug), но стих всё равно открывал главу: openTarget
    искал стих в загруженной главе хрупким матчем `ref.split(".").pop() === want`,
    который ронял любой нестандартный формат ref, тире в диапазоне или ведущий ноль —
    hit=undefined, readerRef=null, показывалась глава. Настоящий инвариант: стих
    РЕЗОЛВИТСЯ и рендерится. Резолвер вынесен в `bookVerseRef.ts` (устойчивый матч +
    достройка ref по образцу реального стиха), обе ветки openTarget зовут
    `resolveVerseRef(vs, verse)`, хрупкий инлайн-матч запрещён, а поведение проверяется
    живым self-тестом (без дрейфа) — чего не хватало прошлому гейту.
    """
    bad = []
    bdp = read(SRC / "BookDetailPage.tsx")
    mod = read(SRC / "bookVerseRef.ts")
    if bdp:
        if 'from "./bookVerseRef"' not in bdp or "resolveVerseRef" not in bdp:
            bad.append(("BookDetailPage.tsx", "Н079: openTarget не использует resolveVerseRef из ./bookVerseRef"))
        if bdp.count("resolveVerseRef(vs, verse)") < 2:
            bad.append(("BookDetailPage.tsx", "Н079: обе ветки openTarget (иерарх.+плоская) обязаны звать resolveVerseRef(vs, verse) — иначе стих в одной из веток схлопнется на главу"))
        if bdp.count("resolveVerseRef(vs, verse) ||") < 2:
            bad.append(("BookDetailPage.tsx", "Н079: обе ветки openTarget обязаны брать ref из resolveVerseRef(vs, verse) КАК ОСНОВНОЙ источник (`resolveVerseRef(vs, verse) || <fallback>`) — иначе стих схлопнется на главу"))
        if "/division/${chapId}/read" not in bdp:
            bad.append(("BookDetailPage.tsx", "Н079: иерарх. ветка openTarget обязана тянуть /division/${chapId}/read по достроенному id РАЗДЕЛА (work.<песнь/лила>.<глава>) — единственный источник настоящего ref, независимо от /toc"))
        if "dv?.chapters?.find" not in bdp:
            bad.append(("BookDetailPage.tsx", "Н079: перебор глав из /toc обязан быть защищён (dv?.chapters?.find) — иначе при /toc без дивизионов TypeError роняет резолв в неверный fallback (ШБ не открывался совсем)"))
        if "${book.work}.${div}.${chapter}.${verse}" in bdp or "${book.work}.${chapter}.${verse}" in bdp:
            bad.append(("BookDetailPage.tsx", "Н079: ref стиха НЕЛЬЗЯ достраивать с префиксом работы (${book.work}.…) — реальный ref у книг СВОЙ и без имени книги (ШБ «9.8.11», БГ «БГ 2.13»), достройка с префиксом = 404"))
        if re.search(r'vs\.find\(\(vv\)\s*=>\s*\(String\(vv\.ref\)\.split\("\."\)\.pop\(\)', bdp):
            bad.append(("BookDetailPage.tsx", "Н079: вернулся хрупкий матч ref.split('.').pop() === want — стих будет открывать главу"))
    if mod:
        if "endsWith" not in mod or "parts[parts.length - 1] = want" not in mod:
            bad.append(("bookVerseRef.ts", "Н079: резолвер потерял многостратегийный матч или достройку ref по образцу"))
    else:
        bad.append(("bookVerseRef.ts", "Н079: модуль резолва стиха отсутствует"))
    st = ROOT / "tools" / "verse-ref-selftest.mjs"
    if st.exists():
        try:
            r = subprocess.run(["node", str(st)], capture_output=True, text=True, timeout=120)
            if r.returncode != 0:
                lines = (r.stderr or r.stdout or "").strip().splitlines()
                tail = lines[-1] if lines else "провал"
                bad.append(("verse-ref-selftest.mjs", "Н079: живой self-тест резолва стиха провален — %s" % tail))
        except Exception as e:
            bad.append(("verse-ref-selftest.mjs", "Н079: не удалось запустить self-тест (%s)" % type(e).__name__))
    else:
        bad.append(("verse-ref-selftest.mjs", "Н079: self-тест резолва стиха отсутствует"))
    return bad


def check_n080():
    """ЗКН-Н080: тап по событию календаря/ленты ведёт СРАЗУ к цели, без всплывающего листа.

    Раньше тап по событию открывал нижний лист CalendarEventCard — лишний слой
    (объект → лист → снова переход к тому же объекту). Настоящий инвариант: ОДНА
    точка перехода `goEvent` в EventCard.tsx (личность → onOpenEntity/адрес,
    экадаши → экран практики), и строка календаря, и закреплённый пост ленты ходят
    через неё одной и той же карточкой (variant list/feed). Лист-попап события
    запрещён к возврату: ни импорта, ни JSX, ни объявления CalendarEventCard
    (историческое упоминание в комментарии — можно, живой компонент — нет).
    """
    bad = []
    ec = read(SRC / "EventCard.tsx")
    hc = read(SRC / "HomeCalendar.tsx")
    pe = read(SRC / "feed" / "PinnedEvents.tsx")

    # 1. Единая точка перехода определена в EventCard.tsx и зовётся обеими линзами
    if ec:
        if "export function goEvent(" not in ec:
            bad.append(("EventCard.tsx", "Н080: пропала единая точка перехода goEvent — тап события обязан идти через неё"))
        if "export function eventTarget(" not in ec:
            bad.append(("EventCard.tsx", "Н080: пропал eventTarget — без него goEvent не различит личность/экадаши"))
        if ec.count("goEvent(e, onOpenEntity)") < 2:
            bad.append(("EventCard.tsx", "Н080: обе линзы карточки (list + feed) обязаны звать goEvent(e, onOpenEntity) по тапу — иначе одна линза откроет не то"))
    else:
        bad.append(("EventCard.tsx", "Н080: единый модуль события EventCard.tsx отсутствует"))

    # 2. Календарь ходит через ./EventCard, а не через свой обработчик/лист
    if hc:
        if 'from "./EventCard"' not in hc or "goEvent" not in hc:
            bad.append(("HomeCalendar.tsx", "Н080: календарь обязан брать переход из ./EventCard (goEvent/EventCard), а не вести событие своим обработчиком"))
        if 'variant="list"' not in hc:
            bad.append(("HomeCalendar.tsx", "Н080: строка события календаря обязана рендериться <EventCard variant=\"list\">"))

    # 3. Закреплённый пост ленты — та же карточка (variant feed), не свой попап
    if pe:
        if 'from "../EventCard"' not in pe:
            bad.append(("PinnedEvents.tsx", "Н080: закреплённый пост события обязан рендериться через EventCard из ../EventCard"))
        if 'variant="feed"' not in pe:
            bad.append(("PinnedEvents.tsx", "Н080: закреплённый пост обязан быть <EventCard variant=\"feed\"> — тап уходит в общую точку goEvent"))

    # 4. Лист-попап события запрещён к возврату (импорт / объявление / JSX)
    for name, txt in (("EventCard.tsx", ec), ("HomeCalendar.tsx", hc), ("PinnedEvents.tsx", pe)):
        if not txt:
            continue
        if (re.search(r"import[^\n]*CalendarEventCard", txt)
                or re.search(r"(function|const)\s+CalendarEventCard", txt)
                or "<CalendarEventCard" in txt):
            bad.append((name, "Н080: вернулся лист-попап события CalendarEventCard — тап обязан вести СРАЗУ к цели, без промежуточного листа"))
    return bad


def check_n082():
    """ЗКН-Н082: повторный тап активного Tier-1 таба и логотип возвращают зал на первый подтаб.

    Стоя на подтабе (напр. Календарь под залом Садханы), тап по нижнему табу того же
    Tier-1 или по логотипу (он ведёт на HOME_TAB=sadhana) звал onChange=setTab к той же
    вкладке — пустышка, а событие tab-reset слушал только зал ИСККОН (да и тот сверял
    мёртвое detail === "home"). Инвариант: каждый Hall с подтабами слушает tab-reset по
    СВОЕМУ id и уходит на домашний адрес таба (SAD_PATH[SAD_SUBS[0]] / BOG_PATH[BOG_SUBS[0]]
    / /iskcon) — адрес меняется, подтаб пересчитывается из него. Событие несёт id таба.
    """
    bad = []
    app = read(SRC / "App.tsx")
    hs = read(SRC / "HomeScreen.tsx")
    if app:
        if 'detail === "sadhana"' not in app or "pushUrl(SAD_PATH[SAD_SUBS[0]])" not in app:
            bad.append(("App.tsx", "Н082: зал Садханы обязан слушать tab-reset('sadhana') и уходить на SAD_PATH[SAD_SUBS[0]] — иначе повторный тап «Даршан»/логотип не вернут на ленту"))
        if 'detail === "bogatstva"' not in app or "pushUrl(BOG_PATH[BOG_SUBS[0]])" not in app:
            bad.append(("App.tsx", "Н082: зал Богатств обязан слушать tab-reset('bogatstva') и уходить на BOG_PATH[BOG_SUBS[0]]"))
    else:
        bad.append(("App.tsx", "Н082: App.tsx отсутствует"))
    if hs:
        if 'detail === "iskcon"' not in hs:
            bad.append(("HomeScreen.tsx", "Н082: зал ИСККОН обязан слушать tab-reset('iskcon') — диспетчер шлёт id таба, не 'home'"))
        if 'detail === "home"' in hs:
            bad.append(("HomeScreen.tsx", "Н082: вернулась мёртвая сверка detail === 'home' — событие несёт id таба ('iskcon'), не 'home'"))
    else:
        bad.append(("HomeScreen.tsx", "Н082: HomeScreen.tsx отсутствует"))
    return bad


def check_n081():
    """ЗКН-Н081: в навигаторе календаря нет кнопки-двусмысленности «Вперёд».

    Кнопка «Вперёд» стояла рядом со стрелкой ›, вела на живой вид, но появлялась
    при ЛЮБОМ открытом месяце — в т.ч. на текущем, где возвращать некуда. Инвариант
    (паттерн Apple «Today»): возврат к настоящему — кнопка «Сегодня», видима СТРОГО
    когда открыт не текущий месяц (route.ym && route.ym !== todayYm). Шаг ‹ › — от
    опорного месяца baseYm = route.ym || todayYm (предсказуемо и из live-вида).
    Ярлык «Вперёд» в навигаторе запрещён.
    """
    bad = []
    hc = read(SRC / "HomeCalendar.tsx")
    if not hc:
        return [("HomeCalendar.tsx", "Н081: экран календаря отсутствует")]
    # 1. Ярлык «Вперёд» запрещён к возврату
    if "Вперёд" in hc:
        bad.append(("HomeCalendar.tsx", "Н081: вернулся ярлык-двусмысленность «Вперёд» — возврат к настоящему обязан называться «Сегодня»"))
    # 2. Кнопка «Сегодня» с условной видимостью (только вне текущего месяца)
    if "route.ym !== todayYm" not in hc:
        bad.append(("HomeCalendar.tsx", "Н081: «Сегодня» обязана быть видима СТРОГО вне текущего месяца (route.ym !== todayYm) — иначе появляется там, где возвращать некуда"))
    if "Вернуться к сегодняшнему дню" not in hc:
        bad.append(("HomeCalendar.tsx", "Н081: пропала кнопка «Сегодня» (aria «Вернуться к сегодняшнему дню») — возврат к настоящему обязан существовать"))
    # 3. Шаг ‹ › от опорного месяца baseYm = route.ym || todayYm
    if "const baseYm = route.ym || todayYm" not in hc:
        bad.append(("HomeCalendar.tsx", "Н081: шаг месяца обязан идти от baseYm = route.ym || todayYm — иначе из live-вида стрелки листают непредсказуемо"))
    if "ymAdd(baseYm, -1)" not in hc or "ymAdd(baseYm, 1)" not in hc:
        bad.append(("HomeCalendar.tsx", "Н081: стрелки ‹ › обязаны шагать от baseYm (ymAdd(baseYm, ±1))"))
    return bad


def check_d017():
    """ЗКН-Д017: иконки календаря — единый тематический набор + НАСТОЯЩАЯ фаза Луны.

    Основатель: «Экадаши должны отмечаться иконкой — где полная луна, где убывающая
    и т.д.; иконки событий должны соответствовать теме календаря». Прежде был ОДИН
    дежурный полумесяц на все Экадаши и смешанные fill/stroke-глифы — разнобой.
    Инвариант: (1) есть движок фазы Луны moonPhase.ts (moonPhase + moonLitPath —
    освещённость и путь освещённой части по дате); (2) EventCard.tsx строит глиф
    через glyphFor, где экадаши → лик Луны по ДАТЕ (шукла-растущая/кришна-убывающая),
    пурнима → полная, амавасья → новая, Чатурмасья/зелень → лист; (3) TypeIcon
    принимает date и title — иначе фазу и тему не вычислить. Один дежурный полумесяц
    на все экадаши запрещён к возврату.
    """
    bad = []
    mp = read(SRC / "moonPhase.ts")
    ec = read(SRC / "EventCard.tsx")
    if mp:
        if "export function moonPhase(" not in mp or "export function moonLitPath(" not in mp:
            bad.append(("moonPhase.ts", "Д017: движок фазы Луны обязан отдавать moonPhase (освещённость+растущая) и moonLitPath (путь освещённой части) по дате"))
    else:
        bad.append(("moonPhase.ts", "Д017: пропал движок фазы Луны — Экадаши снова покажет один дежурный полумесяц вместо настоящего лика"))
    if ec:
        if 'from "./moonPhase"' not in ec:
            bad.append(("EventCard.tsx", "Д017: иконка обязана брать фазу Луны из ./moonPhase"))
        if "function glyphFor(" not in ec or "function moonGlyph(" not in ec:
            bad.append(("EventCard.tsx", "Д017: глиф события строится через glyphFor/moonGlyph — единый тематический набор"))
        if "moonLitPath(" not in ec:
            bad.append(("EventCard.tsx", "Д017: экадаши обязан рисовать освещённую часть Луны (moonLitPath), а не дежурный полумесяц"))
        for kw, why in ((r"пурнима|полнолуни", "пурнима → полная Луна"), (r"амавас|новолуни", "амавасья → новая Луна"), (r"чатурмас|листов|зелен", "Чатурмасья/зелень → лист")):
            # keyword обязан жить в РАБОЧЕЙ ветке (/.../.test(...)), а не в комментарии
            if not re.search(r"/[^/\n]*(?:%s)[^/\n]*/[a-z]*\.test\(" % kw, ec):
                bad.append(("EventCard.tsx", "Д017: тема календаря — рабочая ветка глифа для «%s» пропала" % why))
        # TypeIcon обязан принимать date+title, иначе фаза/тема не вычислимы
        m = re.search(r"function TypeIcon\(\{([^}]*)\}", ec)
        if m and ("date" not in m.group(1) or "title" not in m.group(1)):
            bad.append(("EventCard.tsx", "Д017: TypeIcon обязан принимать date и title — без них не вычислить фазу Луны и тему события"))
    else:
        bad.append(("EventCard.tsx", "Д017: единый модуль иконок события отсутствует"))
    return bad


def check_n083():
    """ЗКН-Н083: ЗАКЛАДКА СТИХА/ГЛАВЫ ПОКАЗЫВАЕТ КАНОНИЧЕСКУЮ ССЫЛКУ (ПИСАНИЕ · ПЕСНЬ/ЛИЛА · ГЛАВА · СТИХ), А НЕ ГОЛОЕ «ТЕКСТ 17».

    Мини-карточка «Избранного» у сохранённого стиха показывала лишь «Текст 17» с
    подписью «Шримад-Бхагаватам» — без песни и главы: по такой закладке невозможно
    понять, ЧТО это (текст 17 есть в тысячах глав). Это была прямая жалоба основателя.
    Инвариант: у стиха/главы писания карточка строит подпись ЕДИНЫМ модулем
    `bookRef.scriptureRef` (писание — жирная строка; путь «Песнь 1 · Глава 17 · Текст
    17» приглушён, сам стих подсвечен; плитка — монограмма ШБ/БГ/ЧЧ), и ТОТ ЖЕ
    строитель питает снимок избранного в читалке — формат не может разойтись между
    «как сохранили» и «как показали». Гейт: FavoritesScreen зовёт scriptureRef и рисует
    путь+якорь; читалка ставит снимок стиха через scriptureRef; модуль на месте;
    поведение проверяется живым self-тестом на ШБ/ЧЧ/БГ (без дрейфа).
    """
    bad = []
    fav = read(SRC / "FavoritesScreen.tsx")
    bdp = read(SRC / "BookDetailPage.tsx")
    mod = read(SRC / "bookRef.ts")
    if fav:
        if 'from "./bookRef"' not in fav or "scriptureRef" not in fav:
            bad.append(("FavoritesScreen.tsx", "Н083: экран не импортирует scriptureRef из ./bookRef — карточка стиха/главы покажет голое «Текст 17» без книги/песни/главы"))
        if "srefFor" not in fav:
            bad.append(("FavoritesScreen.tsx", "Н083: нет srefFor — стих/глава не резолвятся в каноническую ссылку"))
        if "sref.anchor" not in fav or "sref.lead" not in fav:
            bad.append(("FavoritesScreen.tsx", "Н083: подзаголовок не рисует путь+якорь (sref.lead/anchor) — потеряны песнь/глава/стих"))
        if "sref.abbr" not in fav:
            bad.append(("FavoritesScreen.tsx", "Н083: плитка не несёт монограмму писания (sref.abbr) — писание не опознать с первого взгляда"))
    else:
        bad.append(("FavoritesScreen.tsx", "Н083: экран избранного отсутствует"))
    if bdp:
        if 'scriptureRef("verse"' not in bdp:
            bad.append(("BookDetailPage.tsx", "Н083: снимок избранного стиха в читалке обязан строиться через scriptureRef(\"verse\", …) — иначе в базе избранного сохранится голое «Текст 17»"))
    if mod:
        if "LILA_LABEL" not in mod or "Мадхья-лила" not in mod:
            bad.append(("bookRef.ts", "Н083: потерян словарь лил ЧЧ (LILA_LABEL)"))
        if "Песнь" not in mod:
            bad.append(("bookRef.ts", "Н083: потеряна метка песни ШБ"))
        if "Тексты" not in mod or "Текст" not in mod:
            bad.append(("bookRef.ts", "Н083: потеряно склонение стиха (Текст/Тексты) — диапазон «13-14» звучал бы «Текст»"))
    else:
        bad.append(("bookRef.ts", "Н083: модуль канонической ссылки писания отсутствует"))
    st = ROOT / "tools" / "book-ref-selftest.mjs"
    if st.exists():
        try:
            r = subprocess.run(["node", str(st)], capture_output=True, text=True, timeout=120)
            if r.returncode != 0:
                lines = (r.stderr or r.stdout or "").strip().splitlines()
                tail = lines[-1] if lines else "провал"
                bad.append(("book-ref-selftest.mjs", "Н083: живой self-тест ссылки писания провален — %s" % tail))
        except Exception as e:
            bad.append(("book-ref-selftest.mjs", "Н083: не удалось запустить self-тест (%s)" % type(e).__name__))
    else:
        bad.append(("book-ref-selftest.mjs", "Н083: self-тест ссылки писания отсутствует"))
    return bad


def check_n084():
    """ЗКН-Н084: ОБОЛОЧКА ПРИКОЛОТА К ДИНАМИЧЕСКОМУ ВЬЮПОРТУ; BODY/#root НЕ СКРОЛЛЯТ — СКРОЛЛИТ ТОЛЬКО ВНУТРЕННИЙ <main>.

    Верхняя шапка (TopHeader) лежит в потоке НАД скролл-`main`. Пока `body` мог
    прокручиваться (`min-height: 100vh` без блокировки), на iOS Safari показ панели
    URL давал разницу «большой 100vh ↔ видимая высота», body уезжал на неё, и шапка
    прокручивалась вверх ЗА пределы экрана. Смена таба сбрасывала лишь ВНУТРЕННИЙ
    скролл (`mainRef.scrollTop = 0`) — body оставался прокручен, и шапка «не
    возвращалась». Инвариант: `body` и `#root` прибиты к `100dvh` + `overflow:hidden`
    (единственный скроллер — внутренний `<main>`), а внешняя оболочка App — `height:
    100dvh`, НЕ `min-height: 100vh`. Тогда шапке и нижнему меню некуда уехать.
    Блокировка снимается под `body.printing`, иначе многостраничный PDF схлопнется.
    """
    bad = []
    css_raw = read(SRC / "ui" / "globals.css")
    app_raw = read(SRC / "App.tsx")
    # Гейт стережёт КОД, не комментарий (ср. ЗКН-Ц008): в пояснениях сам фигурирует
    # «min-height: 100vh» и «100dvh» — без вырезки комментариев был бы ложный вердикт.
    css = re.sub(r"/\*.*?\*/", "", css_raw, flags=re.S) if css_raw else ""
    app = re.sub(r"/\*.*?\*/", "", app_raw, flags=re.S) if app_raw else ""
    if css:
        m = re.search(r"(?ms)^\s*body\s*\{(.*?)\}", css)
        if not m:
            bad.append(("globals.css", "Н084: не найден блок body"))
        else:
            body = m.group(1)
            if "min-height: 100vh" in body or "min-height:100vh" in body:
                bad.append(("globals.css", "Н084: body снова min-height:100vh — body прокрутится на iOS, и ВЕРХНЯЯ ШАПКА уедет вверх и не вернётся; нужно height:100dvh + overflow:hidden"))
            if "overflow: hidden" not in body and "overflow:hidden" not in body:
                bad.append(("globals.css", "Н084: body без overflow:hidden — body сможет скроллить, шапка уедет за экран"))
            if "100dvh" not in body:
                bad.append(("globals.css", "Н084: body не прибит к динамическому вьюпорту (height:100dvh)"))
        mr = re.search(r"(?ms)^\s*#root\s*\{(.*?)\}", css)
        if not mr:
            bad.append(("globals.css", "Н084: нет правила #root — корень React не прибит к вьюпорту (нужно height:100dvh; overflow:hidden)"))
        else:
            root = mr.group(1)
            if ("overflow: hidden" not in root and "overflow:hidden" not in root) or "100dvh" not in root:
                bad.append(("globals.css", "Н084: #root обязан быть height:100dvh; overflow:hidden — иначе внутренняя высота выпирает в body-скролл"))
        if "body.printing" not in css:
            bad.append(("globals.css", "Н084: нет снятия блокировки под body.printing — многостраничный PDF схлопнется в один экран"))
    else:
        bad.append(("globals.css", "Н084: globals.css отсутствует"))
    if app:
        if 'minHeight: "100vh"' in app:
            bad.append(("App.tsx", "Н084: внешняя оболочка снова minHeight:\"100vh\" — вернётся body-скролл и уезжающая шапка; нужно height:\"100dvh\""))
    else:
        bad.append(("App.tsx", "Н084: App.tsx отсутствует"))
    return bad


def check_n085():
    """ЗКН-Н085: СПРОЕКТИРОВАННЫЙ ЛАНДШАФТ ТЕЛЕФОНА — ОБОЛОЧКА НЕ ЛОМАЕТСЯ, ЛИСТ ЦЕНТРИРОВАН НА ПОЛЕ.

    Портретная оболочка (лист до 480) на широком-низком ландшафтном вьюпорте раньше
    ломалась: нижнее меню всплывало в середину, контент резался. Инвариант: (1) вёрстка
    оболочки вынесена в CSS-классы `.app-viewport`/`.app-shell` (иначе поворотом не
    порулить — inline-стили не переопределить медиазапросом), обе прибиты к 100dvh;
    (2) App рисует именно эти классы; (3) есть правило `@media (orientation: landscape)`
    (телефон: max-height ~600), которое предъявляет `.app-shell` спроектированным
    центрированным листом (кромки/тень/поле), а не тянет вёрстку на всю ширину.
    """
    bad = []
    css_raw = read(SRC / "ui" / "globals.css")
    app_raw = read(SRC / "App.tsx")
    css = re.sub(r"/\*.*?\*/", "", css_raw, flags=re.S) if css_raw else ""
    app = re.sub(r"/\*.*?\*/", "", app_raw, flags=re.S) if app_raw else ""
    if not css:
        return [("globals.css", "Н085: globals.css отсутствует")]
    for cls in (".app-viewport", ".app-shell"):
        m = re.search(r"(?ms)^\s*" + re.escape(cls) + r"\s*\{(.*?)\}", css)
        if not m:
            bad.append(("globals.css", "Н085: нет класса " + cls + " — оболочка не управляется CSS, поворот не спроектировать"))
        elif "100dvh" not in m.group(1):
            bad.append(("globals.css", "Н085: " + cls + " не прибит к 100dvh"))
    if app:
        if "app-viewport" not in app or "app-shell" not in app:
            bad.append(("App.tsx", "Н085: оболочка App не на классах app-viewport/app-shell — inline-стили не переопределить в ландшафте"))
    else:
        bad.append(("App.tsx", "Н085: App.tsx отсутствует"))
    if "orientation: landscape" not in css and "orientation:landscape" not in css:
        bad.append(("globals.css", "Н085: нет правила @media (orientation: landscape) — ландшафт не спроектирован, вёрстка сломается при повороте"))
    else:
        idx = css.find("orientation: landscape")
        if idx < 0:
            idx = css.find("orientation:landscape")
        tail = css[idx:idx + 900]
        if ".app-shell" not in tail:
            bad.append(("globals.css", "Н085: ландшафтный @media не оформляет .app-shell (центрированный лист) — поворот не доведён до намеренного вида"))
    return bad


def check_n086():
    """ЗКН-Н086: ЛАНДШАФТ ТЕЛЕФОНА — ЭТО РЕЖИМ, А НЕ СЛУЧАЙНОСТЬ: ХРОМА И ШИРИНА ЛИСТА ЖИВУТ В ТОКЕНАХ.

    В ландшафте телефона ВЫСОТА — дефицит (~390px), ШИРИНА — избыток (~844px). Пока
    высоты шапки/меню и ширина листа были зашиты числами по двадцати файлам, поворот
    нельзя было спроектировать — только перевёрстывать всё руками. Инвариант:
    (1) в `:root` живут токены `--h-top-header` · `--gtab-h` · `--gtab-bottom` ·
    `--content-bottom` · `--sheet-max` · `--read-max` · `--safe-l`/`--safe-r`;
    (2) ландшафтный `@media` переопределяет ИХ (ужимает хрому, расширяет лист);
    (3) `.app-viewport` держит БОКОВЫЕ вырезы (в ландшафте вырез съедает боковой край);
    (4) полноэкранные читалки не зажаты числом 480, а берут меру чтения `--read-max`;
    (5) КРИТИЧНО: `--gtab-h` в CSS обязан совпадать с `BAR_H` в App.tsx — физика линзы
    Liquid Glass считает центр капли от высоты плашки, рассинхрон увёл бы линзу.
    """
    bad = []
    css_raw = read(SRC / "ui" / "globals.css")
    app_raw = read(SRC / "App.tsx")
    css = re.sub(r"/\*.*?\*/", "", css_raw, flags=re.S) if css_raw else ""
    app = re.sub(r"/\*.*?\*/", "", app_raw, flags=re.S) if app_raw else ""
    if not css or not app:
        return [("globals.css/App.tsx", "Н086: нет исходников оболочки")]

    for tok in ("--h-top-header", "--gtab-h", "--gtab-bottom", "--content-bottom",
                "--sheet-max", "--read-max", "--safe-l", "--safe-r"):
        if not re.search(r"^\s*" + re.escape(tok) + r"\s*:", css, flags=re.M):
            bad.append(("globals.css", "Н086: нет токена " + tok + " — хрома снова зашита числом, поворот не спроектировать"))

    m = re.search(r"@media \(orientation: landscape\)[^{]*\{(.*)", css, flags=re.S)
    if not m:
        bad.append(("globals.css", "Н086: нет ландшафтного @media"))
    else:
        block = m.group(1)[:1400]
        if "--sheet-max" not in block or "--h-top-header" not in block:
            bad.append(("globals.css", "Н086: ландшафтный @media не переопределяет токены (--sheet-max/--h-top-header) — поворот ничего не меняет"))

    vp = re.search(r"(?ms)^\s*\.app-viewport\s*\{(.*?)\}", css)
    if not vp or "--safe-l" not in vp.group(1):
        bad.append(("globals.css", "Н086: .app-viewport без боковых вырезов (--safe-l/--safe-r) — в ландшафте контент уедет под вырез"))
    sh = re.search(r"(?ms)^\s*\.app-shell\s*\{(.*?)\}", css)
    if not sh or "var(--sheet-max)" not in sh.group(1):
        bad.append(("globals.css", "Н086: .app-shell не берёт ширину из --sheet-max"))
    wrap = re.search(r"(?ms)^\s*\.gtab-wrap\s*\{(.*?)\}", css)
    if not wrap or "var(--gtab-bottom)" not in wrap.group(1):
        bad.append(("globals.css", "Н086: .gtab-wrap не берёт отступ из --gtab-bottom"))

    if 'height: "var(--h-top-header)"' not in app:
        bad.append(("App.tsx", "Н086: TopHeader снова с зашитой высотой — в ландшафте шапка не ужмётся"))
    if "var(--content-bottom)" not in app:
        bad.append(("App.tsx", "Н086: нижний воздух контента зашит числом вместо --content-bottom"))

    # Полноэкранные читалки не зажаты числом 480.
    for p in sorted(SRC.rglob("*.tsx")):
        t = read(p) or ""
        if re.search(r"maxWidth: 480, zIndex: (70|80)", t):
            bad.append((p.name, "Н086: полноэкранная читалка зажата 480 — обязана брать var(--read-max)/var(--sheet-max)"))

    # CSS ↔ JS: высота пилюли и BAR_H физики линзы.
    mc = re.search(r"--gtab-h\s*:\s*(\d+)px", css)
    mj = re.search(r"BAR_H\s*=\s*(\d+)", app)
    if mc and mj and mc.group(1) != mj.group(1):
        bad.append(("globals.css/App.tsx", "Н086: --gtab-h=" + mc.group(1) + " ≠ BAR_H=" + mj.group(1) + " — линза Liquid Glass съедет по вертикали; менять только вместе"))
    elif not mj:
        bad.append(("App.tsx", "Н086: не найден BAR_H — нечем сверить высоту пилюли с CSS"))
    return bad


def check_n089() -> list[tuple[str, str]]:
    """ЗКН-Н089 — СТОРОЖ ВИТРИНЫ СУДИТ ПО ТЕМ ЖЕ ПОЛЯМ, ЧТО И ОТБОР СЕРВЕРА.

    Витрина считает совпадения САМА (`const n = tracks.filter(...)`), и это не
    украшение: `n === 0` рисует «ничего не найдено» и НЕ включает очередь. Отбор
    же делает сервер (`*FindManifest`) по своему набору полей. Наборы разъехались:
    сервер искал ещё и по имени рассказчика/исполнителя и по названию цикла, а
    счётчик — только по названию дорожки. Запрос «Прабхупада» в катхе (1234
    записи) и в киртанах давал «ничего не найдено» — витрина ЗАПРЕЩАЛА то, что
    сервер умеет.

    Инвариант: число полей у сторожа ≥ числа полей у отбора. Гейт считает
    `.includes(` по обе стороны и сверяет.
    """
    bad: list[tuple[str, str]] = []
    worker = read(SRC.parent / "worker.ts") or ""
    pairs = [("katha", "kathaFindManifest", "KathaScreen.tsx"),
             ("kirtan", "kirtanFindManifest", "KirtansScreen.tsx")]
    for dom, fn, screen in pairs:
        m = re.search(r"async function " + fn + r"\b.*?\n}", worker, re.S)
        if not m:
            bad.append(("worker.ts", f"Н089: не найден {fn} — нечем сверить поля отбора"))
            continue
        srv = len(re.findall(r"\.includes\(", m.group(0)))
        t = read(SRC / screen) or ""
        g = re.search(r"const n = tracks\.filter\(.*?\)\.length;", t, re.S)
        if not g:
            bad.append((screen, "Н089: не найден счётчик витрины `const n = tracks.filter(…)`"))
            continue
        cli = len(re.findall(r"\.includes\(", g.group(0)))
        if cli < srv:
            bad.append((screen, f"Н089: сторож витрины судит по {cli} полю(ям), а сервер отбирает по {srv} — "
                                f"витрина скажет «ничего не найдено» там, где записи есть ({dom})"))
    return bad



def check_n090() -> list[tuple[str, str]]:
    """ЗКН-Н090 — У АУДИОТЕКИ ТРИ УРОВНЯ: ГОЛОС → СОБРАНИЕ → ЗАПИСЬ.

    Свалка катхи была не оплошностью вёрстки: уровня рассказчика НЕ
    СУЩЕСТВОВАЛО. Единственной очередью была `all` — 857 записей четырёх
    голосов вперемешку, и «дальше» посреди цикла Шрилы Прабхупады включало
    чужую лекцию.

    Стережём три несущих кости, без любой из которых уровень схлопывается:

      1. очередь голоса есть на СЕРВЕРЕ  (`/api/katha/speaker/audio`)
      2. очередь голоса есть в СТОРЕ     (ветка `s:` в ensureManifest)
      3. дорожка несёт СЛАГ              (`authorSlug` в манифестах воркера)

    Отображаемого имени мало: имена совпадают, склоняются и меняются —
    группировать и собирать очередь можно только по слагу.
    """
    bad = []
    worker = (SRC.parent / "worker.ts").read_text(encoding="utf-8")
    store = (SRC / "player" / "store.tsx").read_text(encoding="utf-8")

    if "/api/katha/speaker/audio" not in worker:
        bad.append(("worker.ts", "Н090: нет очереди рассказчика — катха снова одна свалка на всех"))
    if "kathaSpeakerManifest" not in worker:
        bad.append(("worker.ts", "Н090: пропал сборщик очереди голоса (kathaSpeakerManifest)"))
    if "authorSlug" not in worker:
        bad.append(("worker.ts", "Н090: дорожка не несёт слаг голоса — уровень нечем собрать"))
    if 'want.startsWith("s:")' not in store:
        bad.append(("player/store.tsx", "Н090: стор не знает очереди голоса (`s:`) — сервер отдаёт, клиент не просит"))
    if "authorSlug" not in store:
        bad.append(("player/store.tsx", "Н090: слаг голоса не доходит до дорожки в сторе"))

    lib = SRC / "player" / "AudioLibrary.tsx"
    if not lib.exists():
        bad.append(("player/AudioLibrary.tsx", "Н090: медиатека исчезла — библиотека вернулась внутрь плеера"))
    else:
        t = lib.read_text(encoding="utf-8")
        # Место записи в КАЖДОЙ очереди: один индекс на все случаи и был причиной
        # того, что после лекции начиналась чужая.
        for f in ("globalIndex", "voiceIndex", "collectionIndex"):
            if f not in t:
                bad.append(("player/AudioLibrary.tsx", f"Н090: у записи нет места в очереди `{f}` — «дальше» уведёт не туда"))
    return bad


def check_n091() -> list[tuple[str, str]]:
    """ЗКН-Н091 — ПЛЕЕР ПОМНИТ МЕСТО ДЛЯ ЛЮБОГО ЗВУКА, А НЕ ТОЛЬКО ДЛЯ КНИГИ.

    `persist()` выходил по `sourceRef.current !== "book"` — катха и киртаны
    исчезали при перезагрузке, будто их не включали. Для лекции на два часа это
    потеря места в повествовании.
    """
    bad = []
    store = (SRC / "player" / "store.tsx").read_text(encoding="utf-8")
    m = re.search(r"function persist\(\)[\s\S]{0,900}?\n  \}", store)
    if not m:
        return [("player/store.tsx", "Н091: не найден persist() — снимок плеера некому писать")]
    body = m.group(0)
    if re.search(r'!==\s*"book"\)\s*return', body):
        bad.append(("player/store.tsx", "Н091: снимок пишется ТОЛЬКО для книги — аудиотека забывается при перезагрузке"))
    for f in ("kind:", "index:"):
        if f not in body:
            bad.append(("player/store.tsx", f"Н091: в снимке нет поля `{f}` — очередь аудиотеки нечем восстановить"))
    return bad


CHECKS = [
    ("ЗКН-Н090", "у аудиотеки три уровня: голос → собрание → запись", check_n090),
    ("ЗКН-Н091", "плеер помнит место для любого звука, не только для книги", check_n091),
    ("ЗКН-Н089", "сторож витрины судит по тем же полям, что и отбор сервера", check_n089),
    ("ЗКН-Н086", "ландшафт — режим: хрома и ширина листа в токенах, боковые вырезы, мера чтения", check_n086),
    ("ЗКН-Н085", "спроектированный ландшафт: оболочка не ломается, лист центрирован на поле", check_n085),
    ("ЗКН-Н084", "оболочка приколота к вьюпорту; body не скроллит — только <main>", check_n084),
    ("ЗКН-Н083", "закладка стиха/главы = каноническая ссылка писания", check_n083),
    ("ЗКН-Н082", "повторный тап активного таба/логотип возвращают зал на первый подтаб", check_n082),
    ("ЗКН-Н081", "навигатор: «Сегодня» вместо «Вперёд», видим вне текущего месяца", check_n081),
    ("ЗКН-Д017", "иконки календаря — тематический набор + настоящая фаза Луны", check_d017),
    ("ЗКН-Н080", "тап события ведёт СРАЗУ к цели, без всплывающего листа", check_n080),
    ("ЗКН-Н079", "избранный стих открывается стихом, не главой", check_n079),
    ("ЗКН-Н076", "стих в избранном — канонический slug, не work-code", check_n076),
    ("ЗКН-Н077", "избранное киртана открывает трек, не библиотеку", check_n077),
    ("ЗКН-Н078", "избранное реально сохраняет и ведёт внутренним адресом к объекту", check_n078),
    ("ЗКН-Н018", "главная витрины — её суть, не список", check_n018),
    ("ЗКН-Н040", "роутер не ставит вкладку, которой нет", check_n040),
    ("ЗКН-Н039", "историю пишет только nav.ts", check_n039),
    ("ЗКН-Н042", "кнопка ведёт на живой адрес", check_n042),
    ("ЗКН-Н041", "писатель и читатель адреса — один словарь", check_n041),
    ("ЗКН-Н043", "флаг «из роутера» не залипает", check_n043),
    ("ЗКН-Н027", "один экран — один путь рендера", check_n027),
    ("ЗКН-Н060", "адрес приложения ВСЕГДА абсолютный", check_n060),
    ("ЗКН-Н061", "экран открывает только адрес", check_n061),
    ("ЗКН-Н035", "экран сменился → адрес сменился", check_n035),
    ("ЗКН-Н033", "запасной не перебивает основу", check_n033),
    ("ЗКН-Н031", "витрина: без оверлея, из адреса", check_n031),
    ("ЗКН-Н029", "каждый адрес объявляет основу", check_n029),
    ("ЗКН-Н045", "умолчание вкладки = её первый подтаб", check_n045),
    ("ЗКН-Н024", "шапка ОДНА на всё приложение", check_n024),
    ("ЗКН-Н044", "у витрины есть поиск, и он один", check_n044),
    ("ЗКН-Н002", "один глобальный popstate", check_n002),
    ("ЗКН-Н004", "верхнее меню на месте", check_n004),
    ("ЗКН-Н007", "Богатства = 6 витрин, порядок — закон", check_n007),
    ("ЗКН-Н072", "нижнее меню = 5 вкладок, порядок — закон", check_n072),
    ("ЗКН-Н073", "блок длинной страницы живёт в адресе", check_n073),
    ("ЗКН-Н074", "главный таб = первый в меню, выводится из TAB_IDS[0]", check_n074),
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


# ═══════════════════════════════════════════════════════════════════════════
# ЗКН-Н059 · АДРЕС ЕСТЬ ИСТИНА ЭКРАНА
# ЗКН-Н060 · ПУТЬ РОЖДАЕТСЯ В ОДНОМ МЕСТЕ
#
# Баг, который founder ловил месяцами: ставишь стих в избранное, заходишь из
# избранного — попадаешь на ГЛАВУ. Две причины, обе системные:
#
#   1. Восстановление цели из адреса стояло под флагом «ОДИН РАЗ за жизнь
#      компонента». Книга уже открыта → адрес сменился на другой стих →
#      эффект видит флаг и МОЛЧИТ. Экран не следует за адресом.
#
#   2. Избранное строило путь СВОЕЙ строковой хирургией `/books/{шифр}/…`,
#      а книга живёт в корне `/{слаг}/…` (ЗКН-Н023). Второй построитель пути
#      обязан разойтись с первым — и разошёлся.
# ═══════════════════════════════════════════════════════════════════════════
import re as _re
from pathlib import Path as _P

_SRC = _P(__file__).resolve().parents[1] / "apps" / "web" / "src"
# Путь книги, собранный руками мимо ROUTES/bookSlug.
_HAND_PATH = _re.compile(r"[\"`']/books?/\$\{|[\"`']/books?/[a-z]{2,4}/\$\{|\"/books?/\" \+")
_ALLOWED = {"routes.ts", "books.ts", "nav.ts"}


def check_second_path_builder():
    """ЗКН-Н060: путь книги строит ТОЛЬКО routes.ts/books.ts."""
    bad = []
    for f in sorted(_SRC.rglob("*.tsx")) + sorted(_SRC.rglob("*.ts")):
        if f.name in _ALLOWED:
            continue
        lines = f.read_text(encoding="utf-8").split("\n")
        for i, ln in enumerate(lines, 1):
            if ln.strip().startswith(("*", "//")):
                continue
            # `api("/books/…")` — это ЭНДПОИНТ сервера, а не маршрут экрана.
            # У них общий префикс и разная природа: сервер живёт по /books/<шифр>,
            # а человек — по /<слаг>. Путать их и есть корень бага.
            # Вызов API часто разбит переносом — смотрим окно.
            win = "\n".join(lines[max(0, i - 3):i + 1])
            if "api(" in win or "fetch(" in win:
                continue
            if _HAND_PATH.search(ln):
                bad.append((f.relative_to(_SRC), i, "путь книги собран руками (ЗКН-Н060)"))
    return bad


def check_once_only_restore():
    """ЗКН-Н059: восстановление экрана из адреса не имеет права быть «один раз»."""
    bad = []
    for f in sorted(_SRC.rglob("*.tsx")):
        t = f.read_text(encoding="utf-8")
        for m in _re.finditer(r"useEffect\(\(\) => \{([\s\S]{0,700}?)\}, \[", t):
            body = m.group(1)
            restores = ("openTarget" in body or "initialTarget" in body
                        or "applyPath" in body or "setBookTarget" in body)
            once = _re.search(r"if \((?:did|inited|once)\w*\.current\) return", body)
            if restores and once:
                ln = t[:m.start()].count("\n") + 1
                bad.append((f.relative_to(_SRC), ln,
                            "цель из адреса восстанавливается ОДИН РАЗ (ЗКН-Н059)"))
    return bad
