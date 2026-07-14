#!/usr/bin/env python3
"""
АУДИТ ДАННЫХ — законы, живущие в D1, а не в коде (ЗКН-Р004, БТ, И, Сд, П).

Линтер стережёт КОД. Но половина конституции живёт в ДАННЫХ: канон имён в досье,
ссылки до стиха, уровни профилей, суррогатные обложки. Их линтер не видит —
и именно там нарушения жили месяцами (649 ложных меток «золото», 339 битых
обложек в `prayers`).

Этот аудит закрывает дыру: гоняет SQL по боевой базе и роняет CI при нарушении.

Запуск: python3 tools/data-audit.py
Нужны: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1_DATABASE_ID
"""
import json
import os
import sys
import urllib.error
import urllib.request

CHECKS = [
    {
        "law": "ЗКН-П019",
        "name": "таб «Источники» в боевой карточке (провенанс)",
        # ⚠️ ЗКН-Ц012 — ГЕЙТ СМОТРИТ НА РЕЗУЛЬТАТ, А НЕ НА НАМЕРЕНИЕ ИНСТРУМЕНТА.
        #
        # ЗАКОН БЫЛ, МЕХАНИЗМА НЕ БЫЛО — И ОН ЖИЛ В ПРОДЕ.
        #
        # П019 («карточка — не провенанс») объявлен У5, а гейта у него не было:
        # проверка жила «в инструменте» compose.py, то есть В НАМЕРЕНИИ автора.
        # Скрипт-компоновщик вписал в 15 боевых карточек таб «Источники» с
        # заголовками вида «Prabhupada Shikshamrita.RU», ссылками
        # `docs/sources/hagiography/Lives-of-the-Saints.EN.txt` и пометками
        # «Пассажей с именем героя: 159, упоминаний: 345».
        #
        # Строительные леса остались внутри здания — и человек их видел.
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p
                  WHERE json_valid(p.longform)
                    AND EXISTS (SELECT 1 FROM json_each(json_extract(p.longform,'$.tabs')) t
                                WHERE t.value ->> '$.id' IN ('istochniki','sources','biblioteka'))""",
        "hint": "→ провенанс живёт в кузнице и в свидетельстве, а не в карточке (ЗКН-П019)",
    },
    {
        "law": "ЗКН-П020",
        "name": "служебная проза в боевой карточке",
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.atom IS NOT NULL
                    AND (instr(t.atom, 'Пассажей с именем героя') > 0
                      OR instr(t.atom, 'будет внесена в приложение') > 0
                      OR instr(t.atom, 'Что даёт этот раздел') > 0
                      OR instr(t.atom, 'Первоисточник даёт факты') > 0)""",
        "hint": "→ рабочие пометки кузницы не печатаются человеку (ЗКН-П020)",
    },
    {
        "law": "ЗКН-БТ006b",
        "name": "путь к файлу репозитория вместо источника",
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.atom IS NOT NULL
                    AND (t.key IN ('ref','to','h')
                         AND (instr(t.atom, 'docs/sources/') > 0
                              OR instr(t.atom, '.txt') > 0))""",
        "hint": "→ человек читает ИМЯ КНИГИ, а не путь в git (ЗКН-БТ006)",
    },
    {
        "law": "ЗКН-И001",
        "name": "голая «Шри Чайтанья Махапрабху» в ПРОЗЕ досье",
        # ⚠️ ЗКН-Ц007 — ГЕЙТ, ТРЕБУЮЩИЙ НАРУШИТЬ ДРУГОЙ ЗАКОН, — НЕ ГЕЙТ.
        #
        # Здесь стояло `longform LIKE '%Шри Чайтанья Махапрабху%'` — проверка по
        # ВСЕМУ досье, ВКЛЮЧАЯ ТЕКСТЫ ЦИТАТ. Все 472 вхождения лежали в цитатах;
        # в прозе не было НИ ОДНОГО. А ЗКН-БТ004 прямо запрещает править чужой
        # голос. Гейт был красным ВЕЧНО: «починить» его можно было, только
        # переписав слова Прабхупады и Кришнадаса Кавираджи.
        #
        # Красный гейт, который нельзя закрыть по закону, ХУЖЕ отсутствующего:
        # он красит CI в красное, и настоящий регресс тонет в этом шуме.
        #
        # Канон имён — закон ПРОЗЫ (её правит cleanCardText, ЗКН-Т002).
        # Цитата — чужой голос: приводится как есть.
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.atom IS NOT NULL
                    AND (t.atom LIKE '%Шри Чайтанья Махапрабху%'
                      OR t.atom LIKE '%Шри Чайтаньи Махапрабху%'
                      OR t.atom LIKE '%Шри Чайтанье Махапрабху%'
                      OR t.atom LIKE '%Шри Чайтаньей Махапрабху%')
                    AND NOT (t.key IN ('t','translit','verse','sanskrit','word_by_word')
                             AND (t.path LIKE '%quote%' OR t.path LIKE '%cite%'
                                  OR t.path LIKE '%verse%'))""",
        "hint": "→ «Гауранга Махапрабху» или «Шри Кришна Чайтанья Махапрабху» (санньяса-лила). Цитаты НЕ трогать (ЗКН-БТ004)",
    },
    {
        "law": "ЗКН-Сд006",
        "name": "ОДНА ВЕЧНАЯ ФОРМА — ОДИН ЧЕЛОВЕК",
        # `gauranga-lila-identity` говорит: «в Кришна Лиле этот спутник Гауранги —
        # вот кто». Вечная форма ЛИЧНА. Двое не могут быть одним и тем же.
        #
        # Гейт нашёл живые противоречия:
        #   • Санатана Госвами И Шивананда Чакраварти → оба Лаванга-манджари
        #     (канон: Лаванга-манджари = Санатана; у Шивананды досье МОЛЧИТ)
        #   • Пундарика Видьянидхи И Мадхава Мишра → оба Вришабхану
        #     (у Пундарики целая вкладка «отец Радхи»; у Мадхавы — ничего)
        #   • ТРОЕ → «Чайтанья» как форма в Кришна Лиле. Это НЕВОЗМОЖНО:
        #     Чайтанья И ЕСТЬ Кришна в Гауранга Лиле, Он не чья-то форма.
        #     Накула Брахмачари — СОСУД (шактьявеша), а не тождество.
        #
        # Собирательные (`collective`) — законное исключение: «одна из сакхи
        # Радхарани», «один из восьми сиддхи». Там многие — и это верно.
        #
        # ПРИЗНАННЫЙ ДОЛГ: 4. Источник тождеств — «Гаура-ганоддеша-дипика», в
        # приложении она ЗАГЛУШКА (0 стихов). Досье этих личностей — тоже
        # заглушки и о форме МОЛЧАТ. Решается только загрузкой ГГД, не догадкой
        # (ЗКН-Пл006 — источник важнее метода).
        "baseline": 4,
        "sql": """SELECT COUNT(*) AS n FROM (
                    SELECT r.to_id
                    FROM entity_relations r
                    WHERE r.relation = 'gauranga-lila-identity'
                      AND NOT EXISTS (SELECT 1 FROM entity_categories c
                                      WHERE c.entity_id = r.to_id
                                        AND c.category = 'collective')
                    GROUP BY r.to_id
                    HAVING COUNT(*) > 1)""",
        "hint": "→ ДВОЕ на одну вечную форму. Форма лична; собирательные "
                "(`collective`) — исключение. Решается загрузкой ГГД (ЗКН-Сд006)",
    },
    {
        "law": "ЗКН-Р013",
        "name": "СВЯЗЬ ОБЪЯВЛЕНА В ДОСЬЕ → ОНА ЕСТЬ В ГРАФЕ",
        # Досье личности содержит поле `see` — «смотри также». Это ОБЪЯВЛЕННАЯ
        # связь: автор карточки уже сказал, с кем эта личность связана.
        #
        # Но в графе её не было. 1807 связей лежали в досье и НЕ БЫЛИ рёбрами:
        # 62 личности висели СИРОТАМИ — с богатыми досье, но без родства. Открыв
        # такую карточку, человек не видел, чей это ученик и чей спутник.
        #
        # Материализация закрыла 59 из 62. Тип связи — `see-also`: досье говорит
        # «смотри также», но НЕ говорит, КЕМ приходится. Достроить до `disciple-of`
        # без источника — соврать.
        "sql": """SELECT COUNT(*) AS n FROM (
                    SELECT DISTINCT p.entity_id AS ot,
                           json_extract(el.value, '$.id') AS k
                    FROM entity_profiles p,
                         json_tree(p.longform) j,
                         json_each(j.value) el
                    WHERE j.key = 'see' AND j.type = 'array'
                      AND json_extract(el.value, '$.id') IS NOT NULL) x
                  WHERE x.ot <> x.k
                    AND EXISTS (SELECT 1 FROM entities e
                                WHERE e.id = x.k AND e.type = 'personality')
                    AND NOT EXISTS (SELECT 1 FROM entity_relations r
                                    WHERE (r.from_id = x.ot AND r.to_id = x.k)
                                       OR (r.from_id = x.k AND r.to_id = x.ot))""",
        "hint": "→ связь объявлена в досье (`see`), но не стала ребром графа: "
                "личность висит без родства (ЗКН-Р013)",
    },
    {
        "law": "ЗКН-Б009",
        "name": "ТЕКСТ БЕЗ СКЕЛЕТА — МОЛЧАЛИВАЯ ПОЛОВИНЧАТОСТЬ",
        # Книга живёт в ДВУХ таблицах: `verses` — скелет (id, раздел, порядок),
        # `verse_texts` — сам текст.
        #
        # Тексты льются своим ключом и проходят ВСЕГДА. Скелеты могут затереть
        # друг друга — так и вышло: `ref` был «Живопись · 67-12», а ДВА письма
        # одной темы в один месяц дают ОДИН И ТОТ ЖЕ ref. `INSERT OR REPLACE`
        # затирал предыдущее. Потерялось 1547 наставлений.
        #
        # И это МОЛЧИТ: ни ошибки, ни падения. Текст в базе ЕСТЬ, а в книге его
        # НЕТ — потому что книга читается через скелет.
        "sql": """SELECT COUNT(*) AS n FROM verse_texts t
                  WHERE NOT EXISTS (SELECT 1 FROM verses v WHERE v.id = t.verse_id)""",
        "hint": "→ текст есть, скелета нет: наставление в базе, но в книге его "
                "не видно. `ref` обязан быть уникальным (ЗКН-Б009)",
    },
    {
        "law": "ЗКН-Пл014",
        "name": "ОЗВУЧКА СВЯЗЫВАЕТСЯ ПО КЛЮЧУ, А НЕ ПО ПОРЯДКУ",
        # Привязка «N-й файл = N-й стих» — ложь, и ложь ТИХАЯ.
        #
        # В «Шримад-Бхагаватам» 770 стихов СЛИТЫ («текст 21-22»), есть введения к
        # главам и передняя материя. Порядковый счёт съезжает — и человек слушает
        # ОДИН стих, читая ДРУГОЙ. Он этого не поймёт: и то, и другое звучит
        # осмысленно.
        #
        # Файл несёт `ref` («ШБ 10.14.21-22»), и он же ключ в `verses`. Связывать
        # надо по нему.
        #
        # Передняя материя (`ref IS NULL`, глава 0) — законно: у вступления стиха
        # и нет.
        "sql": """SELECT COUNT(*) AS n FROM sb_audio a
                  WHERE a.ref IS NOT NULL AND a.ref <> ''
                    AND NOT EXISTS (SELECT 1 FROM verses v
                                    WHERE v.work_id = 'sb' AND v.ref = a.ref)""",
        "hint": "→ файл озвучки не нашёл свой стих по ключу. Порядковая привязка "
                "ЛЖЁТ: 770 стихов слиты, счёт съедет (ЗКН-Пл014)",
    },
    {
        "law": "ЗКН-Б008",
        "name": "у КАЖДОГО бхаджана есть стихи",
        # Разделы каталога (`is_catalog` / `is_section`) — НЕ бхаджаны. Это
        # навигационные строки. Считать их за молитвы — врать себе о размере
        # долга: «178 бхаджанов без перевода» оказалось ДВУМЯ.
        #
        # Обе — поэмы самого Прабхупады, написанные на борту «Джаладуты».
        # Текст был, просто лежал единым куском.
        "sql": """SELECT COUNT(*) AS n FROM prayers p
                  WHERE COALESCE(p.is_catalog, 0) = 0
                    AND COALESCE(p.is_section, 0) = 0
                    AND NOT EXISTS (SELECT 1 FROM prayer_verses pv WHERE pv.slug = p.slug)""",
        "hint": "→ бхаджан без стихов открывается ПУСТЫМ. Разделы каталога "
                "(is_catalog/is_section) — не бхаджаны, их не считать (ЗКН-Б008)",
    },
    {
        "law": "ЗКН-Р012",
        "name": "ПЕРЕИМЕНОВАЛ КЛЮЧ — ПЕРЕИМЕНУЙ ВЕЗДЕ, ГДЕ ОН ССЫЛКА",
        # Я вычистил слаги в `prayers` (были чужие пути `/ru/gaura-arati` с
        # исходного сайта) — и НЕ ТРОНУЛ `prayer_verses`, где тот же слаг лежит
        # ССЫЛКОЙ.
        #
        # Связь порвалась ПОЛНОСТЬЮ: 1961 строка стихов, 158 бхаджанов — все
        # отвязаны. Тексты в базе ЕСТЬ, а приложение их НЕ НАХОДИТ.
        #
        # И это молчит: ни ошибки, ни падения. Бхаджан просто открывается пустым,
        # будто текста никогда и не было. Ровно тот же почерк, что и ЗКН-Н025
        # («адрес переехал — читатель остался»), только в ДАННЫХ.
        #
        # Ключ — не строка. Ключ — это СВЯЗЬ. Меняешь его в одном месте —
        # ищи все, кто на него ссылается.
        "sql": """SELECT (SELECT COUNT(*) FROM prayer_verses pv
                          WHERE NOT EXISTS (SELECT 1 FROM prayers p WHERE p.slug = pv.slug))
                       + (SELECT COUNT(*) FROM prayer_verses WHERE slug LIKE '/%')
                       AS n""",
        "hint": "→ стихи отвязались от бхаджанов: текст в базе ЕСТЬ, приложение "
                "его НЕ НАХОДИТ, и это МОЛЧИТ. Ключ — это связь (ЗКН-Р012)",
    },
    {
        "law": "ЗКН-БТ005",
        "name": "вербатим-цитата ведёт в ЖИВУЮ книгу",
        # Дословная цитата — обещание: «вот точные слова, вот где их проверить».
        # Если ссылка ведёт в книгу, которой в приложении НЕТ, обещание пустое:
        # человек нажимает — и упирается в ничто.
        #
        # Хуже: он не может проверить нас. А раз не может проверить — вынужден
        # ВЕРИТЬ на слово. Мы для того и приводим источник, чтобы верить было не
        # нужно.
        #
        # Поле `to` у цитаты обязано указывать на книгу из `book_catalog`.
        "sql": """SELECT COUNT(*) AS n FROM (
                    SELECT DISTINCT json_extract(q.value, '$.to') AS src
                    FROM entity_profiles p,
                         json_each(json_extract(p.longform, '$.tabs')) t,
                         json_each(json_extract(t.value, '$.sections')) s,
                         json_each(COALESCE(json_extract(s.value, '$.quotes'), '[]')) q
                    WHERE json_extract(q.value, '$.to') IS NOT NULL
                      AND json_extract(q.value, '$.to') <> '')
                  WHERE src NOT IN (SELECT id FROM book_catalog)
                    AND src NOT LIKE 'book:%'
                    AND src NOT LIKE '/%'""",
        "hint": "→ цитата ведёт в книгу, которой в приложении НЕТ. Человек нажмёт — "
                "и упрётся в ничто; проверить нас он не сможет (ЗКН-БТ005)",
    },
    {
        "law": "ЗКН-И003",
        "name": "дефисная «Гауранга-лила» / «Кришна-лила»",
        # «Кришна-лиламрита» — НАЗВАНИЕ КНИГИ, не нарушение (ложное срабатывание).
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles
                  WHERE (longform LIKE '%Гауранга-лила%' AND longform NOT LIKE '%Гауранга-лиламрит%')
                     OR (longform LIKE '%Кришна-лила%'  AND longform NOT LIKE '%Кришна-лиламрит%')""",
        "hint": "→ «Гауранга Лила» / «Кришна Лила» (оба слова с заглавной, без дефиса)",
    },
    {
        "law": "ЗКН-И004",
        "name": "полусокращённый титул Прабхупады",
        # Полный титул даётся ПРОПИСЬЮ: «Его Божественная Милость Абхай Чаранаравинда
        # Бхактиведанта Свами Шрила Прабхупада…». Краткие формы («Шрила Прабхупада»)
        # допустимы. Запрещена середина: «Его Божественная Милость А.Ч. …».
        # Цитаты (комментарии ШБ) не редактируются — ЗКН-БТ004.
        # ⚠️ ЗКН-Ц007: проверка шла по ВСЕМУ досье и ловила ЦИТАТЫ — то есть требовала
        # переписать чужой голос (ЗКН-БТ004). Считаем ПРОЗУ.
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.atom IS NOT NULL
                    AND t.atom LIKE '%Его Божественная Милость%'
                    AND t.atom LIKE '%Бхактиведанта%'
                    AND t.atom NOT LIKE '%Абхай Чаранаравинда%'
                    AND NOT (t.key IN ('t','translit','verse','sanskrit','word_by_word')
                             AND (t.path LIKE '%quote%' OR t.path LIKE '%cite%'
                                  OR t.path LIKE '%verse%'))""",
        "hint": "→ «Его Божественная Милость Абхай Чаранаравинда Бхактиведанта Свами Шрила Прабхупада»",
    },
    {
        "law": "ЗКН-П003",
        "name": "битый JSON досье (карточка не отрисуется)",
        "sql": "SELECT COUNT(*) AS n FROM entity_profiles WHERE longform IS NOT NULL AND json_valid(longform) = 0",
        "hint": "→ audit-to-zero перед записью (ЗКН-П003)",
    },
    {
        "law": "ЗКН-Р004",
        "name": "ручная метка «золото» (уровень ставится ГЕЙТОМ)",
        # Золото присваивает только goldforge audit при исчерпании источников.
        "sql": "SELECT COUNT(*) AS n FROM entity_profiles WHERE level = 'gold' AND length(longform) < 70000",
        "hint": "→ уровень вычисляется `goldforge audit`, вручную не ставится (ЗКН-Р003/Р004)",
    },
    {
        "law": "ЗКН-Д007",
        "name": "суррогатная обложка в ДАННЫХ",
        "sql": """SELECT (SELECT COUNT(*) FROM prayers
                          WHERE hero_image LIKE '%audio-cover%'
                             OR hero_image LIKE '%services/img%'
                             OR hero_image LIKE '%-ia.jpg%') AS n""",
        "hint": "→ NULL (тогда рисуется фирменная заглушка) — ЗКН-Д005/Д007",
    },
    {
        "law": "ЗКН-БТ001",
        "name": "цитата БЕЗ источника (фабрикация)",
        # Жёсткий инвариант: нет источника → нет утверждения. Ноль. Всегда.
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.key='t'
                    AND (t.path LIKE '%quotes%' OR t.path LIKE '%cite%')
                    AND NOT EXISTS (SELECT 1 FROM json_tree(p.longform) r
                                    WHERE r.key='ref' AND r.path = t.path)""",
        "hint": "→ нет источника — нет утверждения (ЗКН-БТ001)",
    },
    {
        "law": "ЗКН-БТ003",
        "name": "цитата не до стиха (только книга/глава)",
        # ХРАПОВИК ДОЛГА. Чинить выдумыванием номера ЗАПРЕЩЕНО (фабрикация, ЗКН-БТ001).
        #
        # Долг был СПРЯТАН В SQL (`COUNT(*) - 68`) — и потому не виден: сколько его
        # на самом деле, знала только формула. Теперь SQL считает ЧЕСТНОЕ ЧИСЛО, а
        # признанный долг стоит в `baseline` — его видно в отчёте каждой сборки.
        #
        # 14.07.2026: было 314. Из них 148 закрыто ТОЧНО — номер куплета вычислен
        # сверкой текста цитаты со стихом бхаджана в `prayer_verses` (совпадение
        # ОДНОЗНАЧНОЕ; где совпало несколько стихов — не тронуто, догадка запрещена).
        # Остаток 166: 99 — источник не внесён в приложение (номер взять негде),
        # 43 — живая книга без координаты, 24 — бхаджан с неоднозначным совпадением.
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.key='ref'
                    AND (t.path LIKE '%quotes%' OR t.path LIKE '%cite%')
                    AND t.atom NOT GLOB '*[0-9]*'""",
        "baseline": 166,
        "hint": "→ ссылка до КОНКРЕТНОГО стиха. Долг 166 заперт храповиком: рост запрещён (ЗКН-БТ003)",
    },
    {
        "law": "ЗКН-БТ006",
        "name": "ссылка-огрызок (код вместо человеческой формы)",
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.key='ref'
                    AND (t.path LIKE '%quotes%' OR t.path LIKE '%cite%')
                    AND t.atom NOT GLOB '*[А-Яа-я]*'""",
        "hint": "→ «Шри Чайтанья-чаритамрита, Ади-лила, глава 15, стих 135» (ЗКН-БТ006)",
    },
    {
        "law": "ЗКН-Сд002",
        "name": "Гауранга ≠ Чайтанья (разрыв тождества)",
        # Гауранга Махапрабху = Шри Кришна Чайтанья Махапрабху — ОДНА Личность.
        # Значит у неё один id и рабочий алиас (ЗКН-Н015).
        "sql": "SELECT CASE WHEN EXISTS (SELECT 1 FROM entities WHERE id='chaitanya') THEN 0 ELSE 1 END AS n",
        "hint": "→ сущность `chaitanya` обязана существовать; /gauranga — алиас (ЗКН-Сд002/Н015)",
    },
    {
        "law": "ЗКН-Р001",
        "name": "сущность без имени в реестре (id вместо имени)",
        # id ≠ имя. Без записи в entity_names карточка покажет голый id.
        "sql": """SELECT COUNT(*) AS n FROM entities e
                  WHERE NOT EXISTS (SELECT 1 FROM entity_names n WHERE n.entity_id = e.id)""",
        "hint": "→ занести имя в entity_names (ЗКН-Р001: правка в одном месте видна везде)",
    },
    {
        "law": "ЗКН-П006",
        "name": "повествование без NARRATOR источника",
        # ЧЧ → krishnadasa-kaviraja · ШБ → shukadeva · ЧБ → vrindavana-dasa-thakura
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.key='by'
                    AND t.atom IN ('chaitanya-charitamrita','srimad-bhagavatam','chaitanya-bhagavata')""",
        "hint": "→ `by` = ЛИЧНОСТЬ-рассказчик, не книга (ЗКН-П006)",
    },
    {
        "law": "ЗКН-Пр007",
        "name": "СЛОМАННОЕ ОБЕЩАНИЕ: «читать» — а текста нет",
        # Самая злая пустота: гейты её пропускают (структура валидна), а человек
        # жмёт «Читать» и упирается в белый экран. Пустое обещание ХУЖЕ, чем
        # честное «скоро»: оно тратит доверие. Было 14 таких книг.
        "sql": """SELECT COUNT(*) AS n FROM book_catalog b
                  WHERE b.readable = 1
                    AND NOT EXISTS (SELECT 1 FROM verses v WHERE v.work_id = b.id)""",
        "hint": "→ readable=0, пока текст не внесён. Кнопка обещает только то, что ЕСТЬ (ЗКН-Пр007)",
    },
    {
        "law": "ЗКН-Р007",
        "name": "ДУБЛЬ места в одном кластере (человек видит дважды)",
        # Каталог дхамы грузился из разных источников без сверки транслитерации:
        # «Вишрама-гхат» и «Вишрам-гхат», «Кусум-саровара» и «Кусума-саровара»,
        # «Чир-гхат» ТРИЖДЫ. Человек видит одно место несколько раз, счёт врёт.
        #
        # ВАЖНО: одинаковое имя в РАЗНЫХ кластерах — НЕ дубль. Во Врадже реально
        # есть Говинда-гхат в трёх местах и Дауджи-мандир в трёх. Поэтому сверяем
        # ТОЛЬКО внутри кластера.
        #
        # ДОЛГ ЗАКРЫТ 12.07.2026: все 12 дублей слиты (курируемая запись выжила,
        # скрейп отдал ей свой текст и был удалён). Храповик снят — теперь НОЛЬ.
        "sql": """SELECT COUNT(*) AS n FROM tirthas a JOIN tirthas b
                  ON a.cluster = b.cluster AND a.dhama_id = b.dhama_id AND a.id < b.id
                  AND lower(replace(replace(replace(a.name,'-',''),' ',''),'а','')) =
                      lower(replace(replace(replace(b.name,'-',''),' ',''),'а',''))""",
        "hint": "→ одно место — одна запись (ЗКН-Р007). Долг закрыт: было 12 дублей, стало 0",
    },
    {
        "law": "ЗКН-БТ007",
        "name": "СЫРОЙ СКРЕЙП в боевом тексте (сущности/теги/заметки)",
        # Каталог дхамы грузился скрейпером, и в боевой текст утекло:
        #   • 407 описаний, где вместо рассказа стояла СТРОКА ИСТОЧНИКА
        #     («Бхактиведанта Нараяна Госвами Из книги …»)
        #   • 403 описания, ОБРЕЗАННЫХ по лимиту знаков посреди слова
        #     («…каменная горка, на ко»)
        #   • неразобранные HTML-сущности (`&#8212;` вместо тире)
        #   • ЗАМЕТКИ РЕДАКТОРА («Надо поехать отфоткать»)
        # Всё это человек читал как описание святого места.
        "sql": """SELECT COUNT(*) AS n FROM tirthas
                  WHERE instr(COALESCE(blurb,'') || COALESCE(about,''), '&#') > 0
                     OR instr(COALESCE(blurb,'') || COALESCE(about,''), '&nbsp;') > 0
                     OR instr(COALESCE(blurb,''), 'Из книги') > 0
                     OR instr(COALESCE(blurb,'') || COALESCE(about,''), 'отфоткать') > 0
                     OR instr(COALESCE(blurb,'') || COALESCE(about,''), 'Надо перепроверить') > 0""",
        "hint": "→ описание — это ОПИСАНИЕ. Источник в поле source, заметки редактора — не в проде (ЗКН-БТ007)",
    },
    {
        "law": "ЗКН-Р008",
        "name": "МУСОРНЫЙ id (он попадает в адрес)",
        # Из CMS-импорта утекли: `trashed` (артефакт корзины!), `gokula-7264`,
        # `akrura-bhavan-6002` — числовые хвосты. Человек видел /dhama/vrindavan/trashed.
        "sql": """SELECT COUNT(*) AS n FROM tirthas
                  WHERE id GLOB '*-[0-9][0-9][0-9]*'
                     OR id IN ('trashed','draft','untitled','new','test','revision')
                     OR id GLOB '[0-9]*'""",
        "hint": "→ слаг отражает СМЫСЛ: «Джугал-кунда» → jugal-kunda, а не trashed (ЗКН-Н008/Р008)",
    },
    {
        "law": "ЗКН-П007",
        "name": "КАНОН РОСТЕРА МАНДЖАРИ (приоритетнее ГГД/Роузена)",
        # Проектный КАНОН, а не пересказ источников. Ключевое расхождение:
        # Рагхунатха Бхатта = **РАСА**-манджари (не Рага, как у части источников).
        # Ростер — тождества в графе, а не текст в прозе: их можно проверить.
        # ⚠️ Цепочка UNION ALL из 10 звеньев превышает лимит D1
        # («too many terms in compound SELECT»). Берём CTE с VALUES.
        "sql": """WITH kanon(g, m) AS (VALUES
                    ('rupa-goswami','rupa-manjari'),
                    ('sanatana-goswami','lavanga-manjari'),
                    ('jiva-goswami','vilasa-manjari'),
                    ('raghunatha-bhatta-goswami','rasa-manjari'),
                    ('raghunatha-das-goswami','tulasi-manjari'),
                    ('gopala-bhatta-goswami','guna-manjari'),
                    ('lokanatha-goswami','manjulali-manjari'),
                    ('krishnadasa-kaviraja','kasturi-manjari'),
                    ('bhugarbha-goswami','prema-manjari'),
                    ('narottama-dasa-thakura','champaka-manjari'))
                  SELECT COUNT(*) AS n FROM kanon k
                  WHERE NOT EXISTS (SELECT 1 FROM entity_relations r
                                    WHERE r.from_id = k.g
                                      AND r.relation = 'gauranga-lila-identity'
                                      AND r.to_id = k.m)""",
        "hint": "→ канонический ростер манджари — тождества в графе. "
                "Рагхунатха Бхатта = РАСА-манджари, не Рага (ЗКН-П007)",
    },
    {
        "law": "ЗКН-П004",
        "name": "дословная цитата из НЕВНЕСЁННОЙ книги",
        # Вербатим-цитата разрешена ТОЛЬКО если источник есть в приложении и на него
        # можно перейти. Иначе — факты русской прозой со ссылкой (`cite`), а не `q`.
        # Внесены: ЧЧ · ЧБ · ЧМ · БР · НДМ · ШБ · БГ и др. (book_catalog.readable=1).
        # ЧТО СЧИТАЕТСЯ «ИСТОЧНИК В ПРИЛОЖЕНИИ»:
        #   • книга с readable=1 (ЧЧ · ЧБ · ЧМ · БР · НДМ · ШБ · БГ …)
        #   • БХАДЖАН из `prayers` (339 молитв — они в приложении, их можно цитировать)
        #   • ЛИЧНОСТЬ-рассказчик (цитата, приписанная человеку, а не книге)
        #
        # ХРАПОВИК 21: главный долг — «Гаура-ганоддеша-дипика» (27 дословных цитат,
        # текста книги у нас нет). Либо внести книгу, либо перевести цитаты в прозу
        # со ссылкой `cite`. Выдумывать текст ЗАПРЕЩЕНО (ЗКН-БТ001).
        "sql": """SELECT MAX(0, COUNT(*) - 21) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.key = 'ref'
                    AND t.path LIKE '%quotes%'
                    AND NOT EXISTS (
                      SELECT 1 FROM book_catalog b
                      WHERE b.readable = 1 AND instr(t.atom, substr(b.title, 1, 12)) > 0)
                    AND NOT EXISTS (
                      SELECT 1 FROM prayers pr
                      WHERE pr.name IS NOT NULL AND length(pr.name) > 8
                        AND instr(t.atom, substr(pr.name, 1, 10)) > 0)
                    AND NOT EXISTS (
                      SELECT 1 FROM entity_names n
                      WHERE length(n.value) > 8 AND instr(t.atom, n.value) > 0)""",
        "hint": "→ дословно цитировать можно ТОЛЬКО то, что ЕСТЬ в приложении: книгу, "
                "бхаджан или личность. Долг 21 — храповик: рост запрещён (ЗКН-П004)",
    },
    {
        "law": "ЗКН-Пр002",
        "name": "ЦЕНТР ПРОСЛАВЛЕНИЯ — Прабхупада и ИСККОН в Гауранга Лиле",
        # Не «один из ачарьев», а Ачарья-основатель, явивший беспрецедентную волну.
        # Инвариант: `prabhupada` — узел Гауранга Лилы, связанный с сампрадаей.
        # Смешение сампрадай ЗАПРЕЩЕНО: у Прабхупады нет `disciple-of` вне гаудия-линии.
        "sql": """SELECT CASE
                    WHEN NOT EXISTS (SELECT 1 FROM entity_categories
                                     WHERE entity_id='prabhupada' AND category='lila-gauranga') THEN 1
                    WHEN NOT EXISTS (SELECT 1 FROM entity_relations
                                     WHERE from_id='prabhupada' AND relation='disciple-of') THEN 1
                    ELSE 0 END AS n""",
        "hint": "→ `prabhupada` — узел Гауранга Лилы с линией ученической преемственности (ЗКН-Пр002)",
    },
    {
        "law": "ЗКН-Н023b",
        "name": "АДРЕС КНИГИ: полное имя, без шифра и лишней папки",
        # Основатель поймал: `gaurangers.com/book/bs`. Двойное нарушение —
        # лишняя папка `/book/` И ШИФР «bs» вместо имени. Человек не прочтёт «bs».
        #
        # Стало: `/brahma-samhita`. Внутренний ключ (`id`) остаётся коротким —
        # на нём висят стихи и разделы; наружу идёт СЛАГ.
        #
        # Гейт: у каждой книги есть слаг, он не шифр, уникален и не сталкивается
        # ни с личностью, ни с корнем раздела.
        "sql": """SELECT (SELECT COUNT(*) FROM book_catalog
                          WHERE slug IS NULL OR slug = '' OR length(slug) <= 4)
                       + (SELECT COUNT(*) FROM book_catalog b
                          WHERE EXISTS (SELECT 1 FROM entities e
                                        WHERE e.id = b.slug AND e.type = 'personality'))
                       + (SELECT COUNT(*) FROM book_catalog
                          WHERE slug IN ('sadhana','japa','story','verse','promise','progress',
                                         'darshan','calendar','ekadashi','id','hero','books',
                                         'bhajans','kirtans','prasad','dhama','iskcon',
                                         'gauranga-lila','krishna-lila','pancha-tattva','avatars',
                                         'search','favorites','notes','cart','donate'))
                       + (SELECT COUNT(*) - COUNT(DISTINCT slug) FROM book_catalog) AS n""",
        "hint": "→ адрес книги — ПОЛНОЕ имя: /brahma-samhita, а не /book/bs (ЗКН-Н023)",
    },
    {
        "law": "ЗКН-БТ006c",
        "name": "СОКРАЩЕНИЕ В ССЫЛКЕ (человек видит «РКГД, 14»)",
        # Основатель поймал на карточке Ангады: под текстом стояло «РКГД, 14».
        # Это НЕ ссылка — это шифр. Читатель не знает, что такое РКГД, и перейти
        # некуда. Ссылка пишется ПОЛНОСТЬЮ: название · раздел · глава · стих.
        #
        # Было 132: НП (63) · РКГД (45) · ПЛ (16) · БРС (8).
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.key = 'ref' AND t.atom IS NOT NULL
                    AND (t.atom GLOB 'РКГД*' OR t.atom GLOB 'НП [0-9]*'
                         OR t.atom GLOB 'ПЛ [0-9]*' OR t.atom GLOB 'БРС*'
                         OR t.atom GLOB 'ГГД [0-9]*' OR t.atom GLOB 'ЧЧ [0-9]*'
                         OR t.atom GLOB 'ШБ [0-9]*' OR t.atom GLOB 'БГ [0-9]*'
                         OR t.atom GLOB 'ЧБ [0-9]*')""",
        "hint": "→ ссылка пишется ПОЛНОСТЬЮ: «Нектар преданности», глава 41 — "
                "а не «НП 41» (ЗКН-БТ006)",
    },
    {
        "law": "ЗКН-Пл008",
        "name": "СОВПАДЕНИЕ ПРОВЕРЯЕТСЯ, А НЕ ПРИНИМАЕТСЯ",
        # Геосервис на запрос «Сурья-кунда» вернул координаты **Радха-кунды** —
        # и молча. Ответ пришёл, поле заполнилось, гейт бы сказал «координата есть».
        #
        # Машина не говорит «не знаю». Она отдаёт БЛИЖАЙШЕЕ и уверенно. Принять её
        # ответ без проверки — значит поставить паломника не туда, куда он шёл.
        #
        # След такой ошибки: ДВА разных места стоят в ОДНОЙ точке. Храм внутри
        # места — законно (родитель и ребёнок). Два НЕЗАВИСИМЫХ места — нет.
        # Законно: храм ВНУТРИ места — имена вложены («Пунчари» ⊂ «Пунчарика
        # Лаута Баба Мандир»). Нарушение: имена НЕ ПЕРЕСЕКАЮТСЯ вовсе — тогда это
        # два разных места, и геосервис одному из них дал чужую точку.
        "sql": """SELECT COUNT(*) AS n FROM tirthas a
                  JOIN tirthas b
                    ON a.lat = b.lat AND a.lng = b.lng AND a.id < b.id
                  WHERE a.lat IS NOT NULL
                    AND instr(a.name, substr(b.name, 1, 5)) = 0
                    AND instr(b.name, substr(a.name, 1, 5)) = 0""",
        "hint": "→ два НЕЗАВИСИМЫХ места в одной точке = геосервис вернул чужое. "
                "Совпадение проверяется, а не принимается (ЗКН-Пл008)",
    },
    {
        "law": "ЗКН-Д008",
        "name": "СУРРОГАТ-ЗАГЛУШКА НЕ ЛЕЖИТ В ДАННЫХ",
        # Заглушка — это то, что рисуют ВМЕСТО картинки, когда её НЕТ. Она живёт
        # в КОДЕ. Записать её в БАЗУ — значит соврать: поле «есть картинка»
        # заполнено, а картинки нет.
        #
        # Так уже было: 339 бхаджанов хранили hero_image='/audio-cover.png'.
        # Файл удалили — и вместо заглушки показывались БИТЫЕ картинки, потому что
        # код думал «картинка есть, рисовать заглушку не надо».
        #
        # Пустое поле — честно. Суррогат в поле — ложь, которая ломается молча.
        "sql": """SELECT (SELECT COUNT(*) FROM tirthas
                          WHERE COALESCE(hero_image,'') <> ''
                            AND (hero_image LIKE '%fallback%' OR hero_image LIKE '%audio-cover%'
                                 OR hero_image LIKE '%placeholder%' OR hero_image LIKE '%no-image%'))
                       + (SELECT COUNT(*) FROM content_items
                          WHERE COALESCE(hero_image,'') <> ''
                            AND (hero_image LIKE '%fallback%' OR hero_image LIKE '%audio-cover%'
                                 OR hero_image LIKE '%placeholder%' OR hero_image LIKE '%no-image%'))
                       AS n""",
        "hint": "→ заглушка живёт в КОДЕ, не в базе. Пустое поле честно; "
                "суррогат в поле — ложь, которая ломается молча (ЗКН-Д008)",
    },
    {
        "law": "ЗКН-Р011",
        "name": "значение фильтра в КОДЕ должно существовать в БАЗЕ",
        # Фильтр книг искал `lineage === "iskcon"`, а в базе значение —
        # **"guru-iskcon"**. Счётчик показывал 0, хотя книги есть. Значение в коде
        # и в базе РАЗОШЛИСЬ, и никто не заметил: ноль выглядит как «книг нет»,
        # а не как «фильтр сломан». Молчаливая ложь.
        #
        # Гейт: каждое значение `lineage` в базе — из известного набора.
        "sql": """SELECT COUNT(*) AS n FROM book_catalog
                  WHERE lineage IS NOT NULL
                    AND lineage NOT IN ('prabhupada', 'acharya', 'guru-iskcon')""",
        "hint": "→ значения lineage: prabhupada · acharya · guru-iskcon. "
                "Новое значение = сломанный фильтр в коде (ЗКН-Р011)",
    },
    {
        "law": "ЗКН-Р010",
        "name": "ОДНА СТРАНА — ОДНО НАПИСАНИЕ (фильтр троится)",
        # В каталоге центров США жили под ТРЕМЯ написаниями:
        #   «United States Of America» (56) · «United States of America» (10)
        #   · «United States» (2)
        # Фильтр по странам строил ТРИ вкладки «США» — человек видел неразбериху
        # и не мог найти свой центр. Ср. ЗКН-Р009 (одно понятие — одна категория).
        "sql": """SELECT COUNT(*) AS n FROM (
                    SELECT lower(replace(replace(country, ' Of ', ' of '), '  ', ' ')) AS k
                    FROM places WHERE country IS NOT NULL AND country <> ''
                    GROUP BY k HAVING COUNT(DISTINCT country) > 1)""",
        "hint": "→ одна страна — одно написание. Фильтр иначе троится (ЗКН-Р010)",
    },
    {
        "law": "ЗКН-Н023",
        "name": "СЛАГ — ИМЯ, А НЕ ПУТЬ (чужой путь в базе)",
        # У ВСЕХ 339 бхаджанов слаг был `/ru/gaura-arati` — путь с сайта-источника
        # (iskcone.com), утёкший в нашу базу. Отсюда адреса вида
        # `gaurangers.com/ru/bhajans/tulasi`: языковой префикс ЧУЖОГО сайта в НАШЕМ
        # адресе. То же в `content_items` (170 записей).
        #
        # Слаг: `gaura-arati`. Без слэшей, без языка, без префиксов.
        # И §4: корень раздела не может быть занят ЛИЧНОСТЬЮ.
        # Так `advaita` и `nityananda` чуть не ушли в корень как кластеры — а это
        # Адвайта Ачарья и Нитьянанда Прабху, и корень принадлежит ИМ.
        "sql": """SELECT (SELECT COUNT(*) FROM prayers WHERE instr(slug, '/') > 0)
                       + (SELECT COUNT(*) FROM content_items WHERE instr(slug, '/') > 0)
                       + (SELECT COUNT(*) FROM entities WHERE type = 'personality'
                          AND id IN ('sadhana','japa','story','verse','promise','progress',
                                     'darshan','calendar','ekadashi','id','hero','books',
                                     'bhajans','kirtans','prasad','dhama','iskcon',
                                     'gauranga-lila','krishna-lila','pancha-tattva','avatars',
                                     'search','favorites','notes','cart','donate')) AS n""",
        "hint": "→ слаг — ИМЯ без слэшей; корень раздела не занят личностью (ЗКН-Н023)",
    },
    {
        "law": "ЗКН-Сд001",
        "name": "Кришна — свайам-бхагаван и ХАБ графа",
        # *kṛṣṇas tu bhagavān svayam* (ШБ 1.3.28). Это не украшение свода, а
        # ИНВАРИАНТ ДАННЫХ: Кришна — узел с категорией `svayam-bhagavan`, и на Нём
        # сходится граф. Потеряется категория или связи — рухнет ось таксономии.
        "sql": """SELECT CASE
                    WHEN NOT EXISTS (SELECT 1 FROM entity_categories
                                     WHERE entity_id='krishna' AND category='svayam-bhagavan') THEN 1
                    WHEN (SELECT COUNT(*) FROM entity_relations
                          WHERE from_id='krishna' OR to_id='krishna') < 20 THEN 1
                    ELSE 0 END AS n""",
        "hint": "→ у `krishna` категория `svayam-bhagavan` и ≥20 связей: Он хаб графа (ЗКН-Сд001)",
    },
    {
        "law": "ЗКН-Сд003",
        "name": "гуру ИСККОН — ВНУТРИ Гауранга Лилы, не отложены",
        # ИСККОН — беспрецедентная волна Гауранга Лилы, а не приложение к ней.
        # Гуру GBC классифицируются ВНУТРИ лилы как её герои.
        # ⚠️ В базе ДВЕ категории на одно понятие: `lila-gauranga` (448 — по ней
        # ФИЛЬТРУЕТ приложение) и `gauranga-lila` (394 — метка для чипа).
        # Первая версия гейта проверяла `gauranga-lila` и ВРАЛА: у Прабхупады её нет.
        # Проверяем ту, по которой приложение реально показывает личность.
        "sql": """SELECT COUNT(*) AS n FROM entities e
                  WHERE e.dataset = 'Гуру ИСККОН (GBC)'
                    AND NOT EXISTS (SELECT 1 FROM entity_categories c
                                    WHERE c.entity_id = e.id AND c.category = 'lila-gauranga')""",
        "hint": "→ гуру GBC — герои Гауранга Лилы, а не отдельный список (ЗКН-Сд003)",
    },
    {
        "law": "ЗКН-Пл011",
        "name": "ОЗВУЧКА СВЯЗЫВАЕТСЯ ПО КЛЮЧУ, А НЕ ПО ПОРЯДКУ",
        # Привязка «N-й файл = N-й стих» — ложь, и ложь ТИХАЯ.
        #
        # В «Шримад-Бхагаватам» 770 стихов СЛИТЫ («текст 21-22»), есть введения к
        # главам и передняя материя. Порядковый счёт съезжает — и человек слушает
        # ОДИН стих, читая ДРУГОЙ. Он этого не поймёт: и то, и другое звучит
        # осмысленно.
        #
        # Файл несёт `ref` («ШБ 10.14.21-22»), и он же ключ в `verses`.
        # Передняя материя (`ref IS NULL`, глава 0) — законно: у вступления
        # стиха и нет.
        "sql": """SELECT COUNT(*) AS n FROM sb_audio a
                  WHERE a.ref IS NOT NULL AND a.ref <> ''
                    AND NOT EXISTS (SELECT 1 FROM verses v
                                    WHERE v.work_id = 'sb' AND v.ref = a.ref)""",
        "hint": "→ файл озвучки не нашёл свой стих по ключу. Порядковая привязка "
                "ЛЖЁТ: 770 стихов слиты, счёт съедет (ЗКН-Пл011)",
    },
    {
        "law": "ЗКН-Б012",
        "name": "СТИХ БЕЗ ПЕРЕВОДА — НЕМОЙ СТИХ",
        # Читатель видит бенгальский стих и толкование к нему — но НЕ ПОНИМАЕТ,
        # что стих говорит. Толкование объясняет то, чего он не прочёл.
        #
        # Так было с 43 стихами «Чайтанья-бхагаваты». Переводы всё это время
        # ЛЕЖАЛИ В ИСТОЧНИКЕ: между стихом и переводом вклиниваются КОЛОНТИТУЛЫ
        # страницы («Стих 2», «Глава 5»), попавшие в текст при распознавании, и
        # первый разбор упирался в них и БРОСАЛ.
        #
        # Возвращено 30. Осталось 13:
        #   • 2 — слитые диапазоны («текст 2-14»), перевод в общей записи;
        #   • 11 — отпечаток НЕОДНОЗНАЧЕН: пять первых слов совпали, а стихи
        #     разные. Подставить любой — значит дать стиху ЧУЖОЙ перевод.
        #
        # Это ХУЖЕ пустого места. Пустое видно сразу. Подменённый перевод читается
        # как настоящий и живёт в книге, пока кто-нибудь не сверит с оригиналом —
        # а сверять никто не будет: он же выглядит правильно.
        #
        # Лучше немой стих, чем лживый (ЗКН-БТ002).
        "baseline": 13,
        "sql": """SELECT COUNT(*) AS n
                  FROM verses v
                  LEFT JOIN verse_texts t ON t.verse_id = v.id
                  JOIN book_catalog b ON b.id = v.work_id AND b.readable = 1
                  WHERE COALESCE(t.translation, '') = ''""",
        "hint": "→ стих без перевода НЕМОЙ: читатель видит толкование к тому, "
                "чего не прочёл. Искать в источнике, не переводить самому (ЗКН-Б012)",
    },
    {
        "law": "ЗКН-Сд005",
        "name": "ПЕРСОНАЛИЗМ: личность вне графа (сирота)",
        # Всё висит на графе Личностей (самбандха → абхидхея → прайоджана).
        # Личность без единой связи выпадает из персоналистской архитектуры.
        #
        # Было 66 сирот. Среди них — **Шачи Деви, мать Гауранги Махапрабху**,
        # не связанная с Ним (оказалась ДУБЛЕМ: `saci-devi` с богатым досье и
        # `shachidevi` — узлом графа; слиты). И четыре экспансии — Маха-Вишну,
        # Санкаршана, Васудева, Гарбходакашайи Вишну — висели без связи с Кришной.
        #
        # ХРАПОВИК 62: остальным связь надо УСТАНОВИТЬ по источнику, а не выдумать
        # (ЗКН-БТ001). Среди них ISKCON-преданные (нужен `disciple-of`) и гаудия-вайшнавы.
        "sql": """SELECT MAX(0, COUNT(*) - 62) AS n FROM entities e
                  WHERE e.type = 'personality'
                    AND NOT EXISTS (SELECT 1 FROM entity_relations r
                                    WHERE r.from_id = e.id OR r.to_id = e.id)""",
        "hint": "→ личность обязана висеть на графе. Долг 62 — храповик: рост запрещён (ЗКН-Сд005)",
    },
    {
        "law": "ЗКН-Б004",
        "name": "КАТАЛОГ КНИГ: канон имён",
        # Гейты стерегли код и досье, а каталог книг — НЕТ. Там жили: автор
        # «Шри Шикшаштаки» = «Шри Чайтанья Махапрабху» (голая форма, ЗКН-И001),
        # полусокращённый титул Прабхупады, точка с запятой в описании.
        "sql": """SELECT COUNT(*) AS n FROM book_catalog
                  WHERE instr(COALESCE(author_name,'') || COALESCE(title,'') || COALESCE(note,''),
                              'Шри Чайтанья Махапрабху') > 0
                     OR (instr(COALESCE(author_name,'') || COALESCE(note,''), 'Божественная Милость') > 0
                         AND instr(COALESCE(author_name,'') || COALESCE(note,''), 'Абхай Чаранаравинда') = 0)
                     OR instr(COALESCE(note,''), '; ') > 0""",
        "hint": "→ канон имён действует и в каталоге книг (ЗКН-И001 · И004 · Т001)",
    },
    {
        "law": "ЗКН-Б005",
        "name": "книга без автора-ЛИЧНОСТИ (граф разорван)",
        # От «Бхакти-расамрита-синдху» нельзя было пройти к Рупе Госвами: связи не было
        # у 18 книг. Двух авторов пришлось СОЗДАТЬ — их не было в реестре вовсе:
        # Парашара Муни и Махараджа Кулашекхара.
        # ХРАПОВИК 2: современные биографы — им карточка личности не нужна.
        "sql": """SELECT MAX(0, COUNT(*) - 2) AS n FROM book_catalog b
                  WHERE b.author_entity_id IS NULL
                    AND b.id NOT IN ('vedas','upanishads')
                    AND b.author_name IS NOT NULL AND b.author_name <> ''""",
        "hint": "→ связать книгу с личностью автора (ЗКН-Б005). Веды/Упанишады — исключение",
    },
    {
        "law": "ЗКН-Б006",
        "name": "книга-призрак: ссылка на несуществующую личность",
        "sql": """SELECT COUNT(*) AS n FROM book_catalog b
                  WHERE b.author_entity_id IS NOT NULL
                    AND NOT EXISTS (SELECT 1 FROM entities e WHERE e.id = b.author_entity_id)""",
        "hint": "→ ссылка ведёт в никуда: личности с таким id нет (ЗКН-Б006)",
    },
    {
        "law": "ЗКН-Н008",
        "name": "нечитаемый слаг суб-таба в адресе",
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p,
                       json_each(json_extract(p.longform,'$.tabs')) t,
                       json_each(json_extract(t.value,'$.subtabs')) s
                  WHERE json_valid(p.longform)
                    AND s.value ->> '$.id' IN ('obzor','g64','vrnd2','pobeg1','unique-4','prema-ladder')""",
        "hint": "→ слаг отражает смысл: «Пять рас» → pyat-ras (ЗКН-Н008)",
    },
]


ROOT = __import__("pathlib").Path(__file__).resolve().parents[1]


def ids_from_wrangler():
    """account_id и database_id — НЕ секреты, они лежат в wrangler.toml.
    Секрет только токен. Так аудит не зависит от того, заведены ли лишние секреты."""
    import re
    cfg = (ROOT / "apps" / "web" / "wrangler.toml")
    if not cfg.exists():
        return None, None
    t = cfg.read_text(encoding="utf-8")
    a = re.search(r'account_id\s*=\s*"([^"]+)"', t)
    d = re.search(r'database_id\s*=\s*"([^"]+)"', t)
    return (a.group(1) if a else None), (d.group(1) if d else None)


def d1(sql: str):
    wa, wd = ids_from_wrangler()
    acc = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or wa
    tok = os.environ.get("CLOUDFLARE_API_TOKEN")
    dbid = os.environ.get("D1_DATABASE_ID") or wd
    if not (acc and tok and dbid):
        return None
    url = "https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query" % (acc, dbid)
    req = urllib.request.Request(
        url, data=json.dumps({"sql": sql}).encode(),
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = json.load(r)
    except urllib.error.HTTPError as e:
        # ЗКН-Ф014: скрипт говорит, ЧТО именно сломалось. Без этого CI показывает
        # лишь «exit code 1», и настоящая ошибка (напр. «too many SQL variables»)
        # остаётся невидимой.
        raise SystemExit("::error title=D1::HTTP %s — %s\n  SQL: %s"
                         % (e.code, e.read().decode("utf-8", "replace")[:280], sql[:110]))
    for blk in body.get("result", []):
        rows = blk.get("results") or []
        if rows:
            return int(list(rows[0].values())[0])
    return 0


def main():
    if not os.environ.get("CLOUDFLARE_API_TOKEN"):
        print("АУДИТ ДАННЫХ: нет токена — пропуск (локальный прогон)")
        print("SQL проверок: %d" % len(CHECKS))
        return 0

    bad = []
    print("АУДИТ ДАННЫХ · %d законов, живущих в D1" % len(CHECKS))
    print("─" * 68)
    for c in CHECKS:
        try:
            n = d1(c["sql"])
        except Exception as e:
            print("  ? %-11s %-42s ошибка: %s" % (c["law"], c["name"][:42], str(e)[:30]))
            continue
        if n is None:
            print("  ? %-11s %-42s нет доступа к D1" % (c["law"], c["name"][:42]))
            continue
        # ХРАПОВИК ДОЛГА В ДАННЫХ.
        #
        # Иногда нарушение НЕЛЬЗЯ исправить сейчас: источник не загружен, и любое
        # «исправление» будет ДОГАДКОЙ. Тогда долг ПРИЗНАЁТСЯ числом и запирается:
        # уменьшать можно, увеличивать — нет.
        #
        # Это честнее двух плохих выходов: молча закрыть глаза (гейт зелёный, ложь
        # живёт) или удалить данные наугад (гейт зелёный, правда потеряна).
        base = c.get("baseline", 0)
        if n > base:
            mark = "✗"
            bad.append((c, n))
        elif n < base:
            mark = "↓"
        else:
            mark = "✓"
        note = "" if base == 0 else "  (признанный долг: %d)" % base
        print("  %s %-11s %-42s %d%s" % (mark, c["law"], c["name"][:42], n, note))
    print("─" * 68)

    if bad:
        print("\nНАРУШЕНИЯ В ДАННЫХ (%d закона):\n" % len(bad))
        for c, n in bad:
            print("  %s — %d\n     %s\n" % (c["law"], n, c["hint"]))
        print("Свод: docs/LAWS.md")
        return 1
    print("Нарушений в данных нет ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
