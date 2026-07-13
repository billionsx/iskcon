"""
РЕЕСТР ПРОИЗВЕДЕНИЙ И ПРАВ — единственный источник истины конвейера «Библиотека».

Требование docs/LEGAL.md §2.3: «Статус прав по каждому произведению должен быть
зафиксирован». Этот файл и есть тот реестр. Ничто не входит в библиотеку и ничто
не публикуется пользователю в обход него (законы Б001–Б003).

КЛАССЫ ПРАВ
-----------
PD        Общественное достояние. Оригинал старше срока охраны (санскрит/бенгали
          XVI–XVIII вв.) либо перевод, срок охраны которого истёк (до 1929 г.).
          → Можно грузить и публиковать.

OWN       Наш собственный перевод, сделанный конвейером с PD-оригинала.
          Авторские права — наши. Это путь, прямо названный в LEGAL.md §2.3.
          → Можно публиковать ПОСЛЕ ревью человеком (Б002).

LICENSED  Есть письменное разрешение правообладателя. Поле `evidence` обязано
          указывать на документ в docs/library/licenses/.
          → Можно публиковать.

PENDING   Права НЕ установлены. Текст третьей стороны без разрешения.
          → В БД лежать может (Р002: массовое удаление запрещено), но
            ПУБЛИКОВАТЬСЯ НЕ МОЖЕТ. Гейт считает это долгом.

FORBIDDEN Известный чужой копирайт, разрешения нет и не запрашивалось.
          → Конвейер отказывается загружать. Совсем.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

PD, OWN, LICENSED, PENDING, FORBIDDEN = (
    "public-domain", "own-translation", "licensed", "pending", "forbidden",
)

PUBLISHABLE = {PD, OWN, LICENSED}


@dataclass
class Source:
    """Открытый источник оригинала. Только то, что реально можно брать."""
    id: str
    url: str
    kind: str           # sanskrit | bengali | translation-pd | repo-local
    rights: str
    note: str = ""


@dataclass
class Work:
    id: str                       # = works.id в D1
    title_ru: str
    iast: str
    author_entity: Optional[str]  # = entities.id  (связь книга → личность)
    century: str
    orig_lang: str                # sa | bn | sa+bn
    rights: str                   # класс прав ТЕКУЩЕГО русского издания в БД
    evidence: str = ""            # чем подтверждён LICENSED
    sources: list[Source] = field(default_factory=list)   # PD-оригиналы
    scheme: str = "chapter.verse"
    note: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# 1. ЧТО УЖЕ ЛЕЖИТ В БД (68 816 стихов). Классификация по факту, без иллюзий.
#    source='vedabase.io' → это официальный сайт BBT. Переводы Прабхупады
#    охраняются BBT. Без письменной лицензии это PENDING, как бы ни хотелось.
# ─────────────────────────────────────────────────────────────────────────────

BBT_WORKS = [
    # id,  title,                          iast,                       author entity,     верcий в БД
    ("sb", "Шримад-Бхагаватам", "Śrīmad-Bhāgavatam", "vyasadeva", 13000),
    ("cc", "Шри Чайтанья-чаритамрита", "Śrī Caitanya-caritāmṛta", "krishnadasa-kaviraja", 11359),
    ("spl", "Шрила Прабхупада-лиламрита", "Prabhupāda-līlāmṛta", "satsvarupa-das-goswami", 8585),
    ("brs", "Нектар преданности", "Bhakti-rasāmṛta-sindhu", "rupa-goswami", 1682),
    ("tqk", "Молитвы царицы Кунти", "Teachings of Queen Kuntī", "prabhupada", 740),
    ("sc", "Ещё один шанс", "Second Chance", "prabhupada", 686),
    ("bg", "Бхагавад-гита как она есть", "Bhagavad-gītā As It Is", "vyasadeva", 657),
    ("pop", "Путь к совершенству", "Path of Perfection", "prabhupada", 538),
    ("rv", "Раджа-видья. Царь знания", "Rāja-vidyā", "prabhupada", 305),
    ("owk", "На пути к Кришне", "On the Way to Kṛṣṇa", "prabhupada", 221),
    ("lob", "Свет Бхагаваты", "Light of the Bhāgavata", "prabhupada", 213),
    ("bbd", "По ту сторону рождения и смерти", "Beyond Birth and Death", "prabhupada", 167),
    ("poy", "Совершенство йоги", "Perfection of Yoga", "prabhupada", 131),
    ("bs", "Брахма-самхита", "Brahma-saṁhitā", "brahma", 62),
    ("iso", "Шри Ишопанишад", "Śrī Īśopaniṣad", "vyasadeva", 19),
    ("noi", "Нектар наставлений", "Upadeśāmṛta", "rupa-goswami", 11),
]

# ─────────────────────────────────────────────────────────────────────────────
# 2. ПОЛНЫЙ РЕЕСТР
# ─────────────────────────────────────────────────────────────────────────────

WORKS: dict[str, Work] = {}


def _w(**kw) -> None:
    w = Work(**kw)
    WORKS[w.id] = w


# ── Прабхупада / BBT: перевод под охраной. Оригинал (санскрит) — PD. ─────────
for wid, title, iast, author, _n in BBT_WORKS:
    _w(
        id=wid, title_ru=title, iast=iast, author_entity=author,
        century="XX (перевод) / оригинал древний",
        orig_lang="sa",
        rights=PENDING,
        evidence="",
        note=(
            "Русский перевод — А.Ч. Бхактиведанта Свами Прабхупада, © Bhaktivedanta "
            "Book Trust. В БД занесён из vedabase.io. Публикация требует письменной "
            "лицензии BBT (LEGAL.md §2.3). До неё — не публикуется. "
            "Санскритский оригинал — PD, его можно держать и переводить самим."
        ),
    )

# spl — не санскрит, это биография XX века. Оригинала в PD нет вообще.
WORKS["spl"].orig_lang = "en"
WORKS["spl"].note = (
    "«Прабхупада-лиламрита» — Сатсварупа Дас Госвами, 1980–83, © BBT. "
    "PD-оригинала НЕ существует: это современное произведение. Собственный перевод "
    "невозможен — переводить нечего, кроме охраняемого текста. Только лицензия."
)

# ── Гаудия-классика: ОРИГИНАЛ В ОБЩЕСТВЕННОМ ДОСТОЯНИИ ───────────────────────
# Здесь и живёт весь потенциал. Мы берём оригинал и делаем СВОЙ перевод.

_w(
    id="ggd", title_ru="Шри Гаура-ганоддеша-дипика",
    iast="Śrī Gaura-gaṇoddeśa-dīpikā",
    author_entity="kavi-karnapura", century="XVI (1576)",
    orig_lang="sa", rights=OWN, scheme="verse",
    sources=[
        Source("jiva-grantha", "https://grantha.jiva.org/", "sanskrit", PD,
               "Грантха Мандира, Jiva Institute — научный архив оригиналов"),
        Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html", "sanskrit", PD,
               "GRETIL, Göttingen — эталонный корпус санскритских e-текстов"),
    ],
    note=(
        "КЛЮЧЕВОЙ ТЕКСТ ПРОЕКТА. Кави Карнапура называет, кем каждый спутник Гауранги "
        "был в Кришна Лиле. Это первоисточник тех самых 200 связей "
        "`gauranga-lila-identity`, которые УЖЕ лежат в БД без единой ссылки на стих. "
        "Санскритский оригинал 1576 г. — PD. Перевод Кушакратхи (1987) — НЕ PD, "
        "его не берём. Делаем свой. 0 стихов в БД → приоритет №1."
    ),
)

_w(
    id="hbv", title_ru="Шри Хари-бхакти-виласа", iast="Śrī Hari-bhakti-vilāsa",
    author_entity="gopala-bhatta-goswami", century="XVI",
    orig_lang="sa", rights=OWN, scheme="vilasa.verse",
    sources=[Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html",
                    "sanskrit", PD, "санскритский оригинал")],
    note="Оригинал PD. Перевод Бхану Свами (совр.) — под охраной, не берём.",
)

_w(
    id="vedanta-sutra", title_ru="Веданта-сутра", iast="Vedānta-sūtra",
    author_entity="vyasadeva", century="древн.",
    orig_lang="sa", rights=OWN, scheme="adhyaya.pada.sutra",
    sources=[Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html",
                    "sanskrit", PD, "Брахма-сутра + Говинда-бхашья Баладевы (PD)")],
    note="Оригинал и комментарий Баладевы Видьябхушаны (XVIII в.) — PD.",
)

_w(
    id="mahabharata", title_ru="Махабхарата", iast="Mahābhārata",
    author_entity="vyasadeva", century="древн.",
    orig_lang="sa", rights=OWN, scheme="parva.chapter.verse",
    sources=[
        Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html", "sanskrit", PD,
               "критическое издание BORI, санскрит"),
        Source("ganguli", "https://archive.org/", "translation-pd", PD,
               "K.M. Ganguli, 1883–1896 — срок охраны истёк, PD"),
    ],
    note="~75 000 стихов. Крупнейший объект. Идёт последним, по частям (парвам).",
)

_w(
    id="ramayana", title_ru="Рамаяна", iast="Rāmāyaṇa",
    author_entity="valmiki", century="древн.",
    orig_lang="sa", rights=OWN, scheme="kanda.sarga.verse",
    sources=[
        Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html", "sanskrit", PD, ""),
        Source("griffith", "https://archive.org/", "translation-pd", PD,
               "R.T.H. Griffith, 1870–74 — PD"),
    ],
)

_w(
    id="upanishads", title_ru="Упанишады", iast="Upaniṣad",
    author_entity="vyasadeva", century="древн.",
    orig_lang="sa", rights=OWN, scheme="upanishad.chapter.verse",
    sources=[
        Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html", "sanskrit", PD, ""),
        Source("muller", "https://archive.org/", "translation-pd", PD,
               "Max Müller, Sacred Books of the East, 1879–84 — PD"),
    ],
    note="Начинаем с 11 главных (мукхья), затем Гопала-тапани.",
)

_w(
    id="vedas", title_ru="Веды", iast="Veda",
    author_entity="vyasadeva", century="древн.",
    orig_lang="sa", rights=OWN, scheme="mandala.sukta.verse",
    sources=[
        Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html", "sanskrit", PD, ""),
        Source("griffith-rv", "https://archive.org/", "translation-pd", PD,
               "R.T.H. Griffith, Rig Veda, 1896 — PD"),
    ],
)

_w(
    id="puranas", title_ru="Пураны", iast="Purāṇa",
    author_entity="vyasadeva", century="древн.",
    orig_lang="sa", rights=OWN, scheme="purana.chapter.verse",
    sources=[Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html",
                    "sanskrit", PD, "")],
    note="Приоритет вайшнавских: Вишну, Падма, Брахма-вайварта, Гаруда.",
)

# ── Уже в БД, но права не установлены ────────────────────────────────────────

_w(
    id="cb", title_ru="Шри Чайтанья-бхагавата", iast="Śrī Caitanya-bhāgavata",
    author_entity="vrindavana-dasa-thakura", century="XVI",
    orig_lang="bn", rights=PENDING, scheme="khanda.chapter.verse",
    sources=[Source("repo", "docs/sources/chaitanya-lila/VrindavanaDasa_Chaitanya-Bhagavata.RU.txt",
                    "repo-local", PENDING, "9.6 МБ русского текста уже в репозитории")],
    note=(
        "11 441 стих в БД. Бенгальский оригинал (XVI в.) — PD. Но русский текст в БД "
        "из издания «Шри Гаурамрита» — чей это перевод, не зафиксировано. Требует "
        "либо подтверждения прав, либо своего перевода с бенгальского оригинала."
    ),
)

_w(
    id="cm", title_ru="Шри Чайтанья-мангала", iast="Śrī Caitanya-maṅgala",
    author_entity="lochana-dasa-thakura", century="XVI",
    orig_lang="bn", rights=PENDING, scheme="khanda.chapter.verse",
    sources=[Source("repo", "docs/sources/chaitanya-lila/LochanaDasa_Chaitanya-Mangala.RU.txt",
                    "repo-local", PENDING, "")],
    note="1 927 стихов. Перевод — Субхаг Свами. Нужно письменное разрешение либо свой перевод.",
)

_w(
    id="ndm", title_ru="Шри Навадвипа-дхама-махатмья",
    iast="Śrī Navadvīpa-dhāma-māhātmya",
    author_entity="bhaktivinoda-thakura", century="XIX",
    orig_lang="bn", rights=PENDING, scheme="chapter.verse",
    sources=[Source("repo", "docs/sources/dhama-lila/Bhaktivinoda_Navadvipa-Dhama-Mahatmya.txt",
                    "repo-local", PENDING, "")],
    note="6 796 стихов. Оригинал Бхактивиноды (XIX в.) — PD. Русский перевод — чей?",
)

_w(
    id="br", title_ru="Бхакти-ратнакара", iast="Bhakti-ratnākara",
    author_entity="narahari-chakravarti", century="XVIII",
    orig_lang="bn", rights=PENDING, scheme="taranga.verse",
    sources=[
        # ОРИГИНАЛ (PD) — дорога, названная ПР007 и LEGAL.md §2.3.
        # Бенгальский, Ramdeb Mishra, Муршидабад; 622 с.; archive.org помечает
        # dc.rights = "In Public Domain". Второе изд. — Радхараман-пресс, 1913.
        Source("archive.org", "https://archive.org/details/in.ernet.dli.2015.356261",
               "bn-1888", PD, "Digital Library of India · Bangiya Sahitya Parishad"),
        Source("archive.org", "https://archive.org/details/BhaktiRatnakar",
               "bn-1913", PD, "2-е изд., ред. Расабихари Санкхья Тиртха"),
        # ПОСРЕДНИК — НЕ ГОДИТСЯ (ПР009 п.3): переводчик АНОНИМЕН, права
        # неустановимы. Посредником может быть только PUBLISHABLE-издание.
        # Оставляем как справочный материал для человека-редактора, не как базу.
        Source("repo", "docs/sources/bhakti-ratnakara/Bhakti-Ratnakara.EN.txt",
               "repo-local", PENDING, "англ. переложение, переводчик неизвестен"),
    ],
    note="СТАТУС 13.07.2026. Оригинал (бенгали, PD) скачан — И НЕ ГОДЕН: "
         "(1) OCR от IA развалил слова: каноническое «ভক্তিরত্নাকর» 0 раз из 492 "
         "близких форм; гейт ПР010 роняет. (2) Том покрывает ТОЛЬКО таранги 1-9 "
         "(колофон: «নাম নবমস্তরঙ্গঃ ॥ ৯ ॥»); волн 10-15 в нём НЕТ. "
         "Нужно: переOCR скана 600ppi современной моделью ЛИБО набранный e-text "
         "ЛИБО второй том. Англ. переложение анонимно (PENDING) — по ПР009 "
         "посредником быть не может. В D1 4 669 блоков EN, 1 590 рефов "
         "досочинены загрузчиком (долг ПР008).",
)

_w(
    id="rkgd", title_ru="Окружение Радхи и Кришны",
    iast="Rādhā-kṛṣṇa-gaṇoddeśa-dīpikā",
    author_entity="rupa-goswami", century="XVI",
    orig_lang="sa", rights=PENDING, scheme="verse",
    sources=[Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html",
                    "sanskrit", PD, "")],
    note=(
        "216 стихов. Перевод Лакшман даса с hari-katha.org — чужой. "
        "Оригинал Рупы Госвами — PD. Парная книга к ГГД: та описывает Гауранга Лилу, "
        "эта — Кришна Лилу. Вместе они замыкают обе линии личностей."
    ),
)

_w(
    id="gl", title_ru="Говинда-лиламрита", iast="Govinda-līlāmṛta",
    author_entity="krishnadasa-kaviraja", century="XVI",
    orig_lang="sa", rights=OWN, scheme="sarga.verse",
    sources=[Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html",
                    "sanskrit", PD, "")],
    note="1 стих в БД. Оригинал PD.",
)

_w(
    id="ks", title_ru="Кришна-сандарбха", iast="Kṛṣṇa-sandarbha",
    author_entity="jiva-goswami", century="XVI",
    orig_lang="sa", rights=OWN, scheme="anuccheda",
    sources=[Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html",
                    "sanskrit", PD, "")],
    note="1 стих в БД. Оригинал PD. Часть Шат-сандарбхи — все шесть должны быть.",
)

_w(
    id="vp", title_ru="Вишну-пурана", iast="Viṣṇu-purāṇa",
    author_entity="parashara", century="древн.",
    orig_lang="sa", rights=OWN, scheme="amsa.chapter.verse",
    sources=[Source("gretil", "https://gretil.sub.uni-goettingen.de/gretil.html",
                    "sanskrit", PD, "")],
    note="2 стиха в БД. Оригинал PD. H.H. Wilson (1840) — PD.",
)

# ── УЖЕ ПЕРЕВЕДЕНО НАМИ. Прецедент, найденный в БД: кто-то в проекте уже сделал
#    ровно то, что делает конвейер — свой перевод с открытого оригинала.
#    Помечено было «© ISKCON ONE LOVE», теперь класс own-translation.
#    Это и есть путь Шрилы Прабхупады: он переводил с санскрита, а не
#    перепечатывал чужие переводы.

_w(
    id="siksastaka", title_ru="Шри Шикшаштака", iast="Śrī Śikṣāṣṭaka",
    author_entity="chaitanya", century="XVI",
    orig_lang="sa", rights=OWN, scheme="verse",
    sources=[Source("gaurangers", "docs/sources/", "sanskrit", PD,
                    "Оригинал Гауранги Махапрабху — общественное достояние")],
    note="8 стихов. Наш перевод. Единственное, что Махапрабху записал Сам.",
)

_w(
    id="manah-siksa", title_ru="Манах-шикша", iast="Manaḥ-śikṣā",
    author_entity="raghunatha-das-goswami", century="XVI",
    orig_lang="sa", rights=OWN, scheme="verse",
    sources=[Source("gaurangers", "docs/sources/", "sanskrit", PD, "")],
    note="11 стихов. Наш перевод.",
)

_w(
    id="mukunda-mala-stotra", title_ru="Мукунда-мала-стотра",
    iast="Mukunda-mālā-stotra",
    author_entity="kulashekhara", century="IX",
    orig_lang="sa", rights=OWN, scheme="verse",
    sources=[Source("gaurangers", "docs/sources/", "sanskrit", PD, "")],
    note="40 стихов. Наш перевод. Махараджа Кулашекхара.",
)

_w(
    id="prabhupada-shikshamrita", title_ru="Прабхупада-шикшамрита",
    iast="Prabhupāda-śikṣāmṛta",
    author_entity="prabhupada", century="XX",
    orig_lang="en", rights=PENDING, scheme="section.item",
    sources=[Source("repo", "docs/sources/prabhupada-shikshamrita/Prabhupada-Shikshamrita.RU.txt",
                    "repo-local", PENDING, "7.7 МБ в репозитории")],
    note=(
        "5 328 записей — и до 13.07.2026 этой работы НЕ БЫЛО в таблице `works` "
        "вообще. Стихи лежали, работа отсутствовала: они были невидимы для любого "
        "запроса через works. Дыра закрыта, проверка добавлена в гейт (ПР001)."
    ),
)


# ── Только по лицензии. Оригинала в PD не существует. ────────────────────────

_w(
    id="krishna-book", title_ru="Кришна. Верховная Личность Бога",
    iast="Kṛṣṇa, the Supreme Personality of Godhead",
    author_entity="prabhupada", century="XX",
    orig_lang="en", rights=PENDING,
    note=(
        "© BBT. Это авторское изложение Прабхупады по 10-й песни Бхагаватам, "
        "а не перевод санскритского текста. Своего перевода сделать НЕЛЬЗЯ — "
        "переводить нечего, кроме охраняемого произведения. ТОЛЬКО ЛИЦЕНЗИЯ BBT."
    ),
)

_w(
    id="tlc", title_ru="Учение Господа Чайтаньи",
    iast="Teachings of Lord Caitanya",
    author_entity="prabhupada", century="XX",
    orig_lang="en", rights=PENDING,
    note="© BBT. Авторское изложение. ТОЛЬКО ЛИЦЕНЗИЯ BBT.",
)

_w(
    id="prabhupada-lilamrita", title_ru="Шрила Прабхупада-лиламрита",
    iast="Śrīla Prabhupāda-līlāmṛta",
    author_entity="satsvarupa-das-goswami", century="XX",
    orig_lang="en", rights=PENDING,
    note="© BBT / Сатсварупа Дас Госвами, 1980–83. ТОЛЬКО ЛИЦЕНЗИЯ.",
)


# ─────────────────────────────────────────────────────────────────────────────
# 3. ОЧЕРЕДЬ КОНВЕЙЕРА
#    Порядок — не по объёму, а по ценности для миссии «библиотека личностей».
# ─────────────────────────────────────────────────────────────────────────────

QUEUE = [
    "ggd",            # 1. позвоночник личностей. 0 стихов. PD-оригинал. → ПИЛОТ
    "rkgd",           # 2. парная к ГГД: Кришна Лила
    "ks",             # 3. Шат-сандарбха (Джива)
    "gl",             # 4. Говинда-лиламрита
    "hbv",            # 5. Хари-бхакти-виласа
    "vedanta-sutra",  # 6.
    "upanishads",     # 7.
    "vp",             # 8.
    "puranas",        # 9.
    "vedas",          # 10.
    "ramayana",       # 11.
    "mahabharata",    # 12. последний — 75 000 стихов
]

# Книги, которые конвейер НЕ ТРОГАЕТ без файла лицензии в docs/library/licenses/
LICENSE_ONLY = ["krishna-book", "tlc", "prabhupada-lilamrita"] + [w[0] for w in BBT_WORKS]


def publishable(work_id: str) -> bool:
    w = WORKS.get(work_id)
    return bool(w and w.rights in PUBLISHABLE)


def needs_license(work_id: str) -> bool:
    return work_id in LICENSE_ONLY and WORKS.get(work_id, Work(
        "", "", "", None, "", "", PENDING)).rights != LICENSED
