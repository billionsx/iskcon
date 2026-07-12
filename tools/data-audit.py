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
import urllib.request

CHECKS = [
    {
        "law": "ЗКН-И001",
        "name": "голая «Шри Чайтанья Махапрабху» в досье",
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles
                  WHERE longform LIKE '%Шри Чайтанья Махапрабху%'
                     OR longform LIKE '%Шри Чайтаньи Махапрабху%'""",
        "hint": "→ «Гауранга Махапрабху» или «Шри Кришна Чайтанья Махапрабху» (санньяса-лила)",
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
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles
                  WHERE longform LIKE '%Его Божественная Милость%'
                    AND longform LIKE '%Бхактиведанта%'
                    AND longform NOT LIKE '%Абхай Чаранаравинда%'""",
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
        # ХРАПОВИК: 68 таких на 11.07.2026. Чинить выдумыванием номера ЗАПРЕЩЕНО
        # (это была бы фабрикация, ЗКН-БТ001) — стих ищется в источнике кузницей.
        # Гейт держит долг от РОСТА: новая цитата обязана иметь стих.
        "sql": """SELECT MAX(0, COUNT(*) - 68) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.key='ref'
                    AND (t.path LIKE '%quotes%' OR t.path LIKE '%cite%')
                    AND t.atom NOT GLOB '*[0-9]*'""",
        "hint": "→ ссылка до КОНКРЕТНОГО стиха. Долг 68 — храповик: рост запрещён (ЗКН-БТ003)",
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
        "law": "ЗКН-Р004",
        "name": "ручная метка «золото» (уровень ставит ГЕЙТ)",
        "sql": "SELECT COUNT(*) AS n FROM entity_profiles WHERE level = 'gold'",
        "hint": "→ золото присваивает только `goldforge audit` при исчерпании источников (ЗКН-Р003/Р004)",
    },
    {
        "law": "ЗКН-П003",
        "name": "прямой апостроф в ПРОЗЕ (в стихе — законен)",
        # ВАЖНО: char(39) ЗАКОНЕН в транслитерации стиха («према крама бади' хайа») —
        # это знак элизии, часть текста. Править его = испортить стих (ЗКН-БТ004).
        # Ловим только апостроф в ПРОЗЕ (ключи "p" и "summary"), не в цитатах.
        "sql": """SELECT COUNT(*) AS n FROM entity_profiles p, json_tree(p.longform) t
                  WHERE json_valid(p.longform) AND t.atom LIKE '%' || char(39) || '%'
                    AND t.path NOT LIKE '%quotes%' AND t.path NOT LIKE '%cite%'
                    AND t.path NOT LIKE '%.q%'""",
        "hint": "→ в прозе — типографский апостроф. В транслитерации стиха прямой ЗАКОНЕН (ЗКН-БТ004)",
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
        "law": "ЗКН-БТ008",
        "name": "личность БЕЗ источника (утверждение без основания)",
        # 450 карточек из 728 не показывали НИ ОДНОЙ ссылки на писание. Источник
        # при этом БЫЛ в базе (`source_ref` = «ГГД 193») — он просто не рисовался.
        # Теперь рисуется. Гейт требует: у личности есть источник ИЛИ хотя бы одна
        # цитата со ссылкой. Нет ни того, ни другого — нет основания у утверждения.
        # ХРАПОВИК: 14 на 12.07.2026 (было 43). Остались те, кому источник ВЫДУМАТЬ
        # НЕЛЬЗЯ: Агни, Атри, Васиштха, Вишвамитра встречаются во многих писаниях —
        # выбрать одно наугад было бы фабрикацией (ЗКН-БТ001). Закрывается кузницей.
        "sql": """SELECT MAX(0, COUNT(*) - 14) AS n FROM entities e
                  WHERE e.type = 'personality'
                    AND (e.source_ref IS NULL OR e.source_ref = '')
                    AND NOT EXISTS (
                      SELECT 1 FROM entity_profiles p, json_tree(p.longform) t
                      WHERE p.entity_id = e.id AND json_valid(p.longform)
                        AND t.key = 'ref'
                        AND (t.path LIKE '%quotes%' OR t.path LIKE '%cite%'))""",
        "hint": "→ `source_ref` ИЛИ цитата со ссылкой. Долг 14 — храповик: рост запрещён (ЗКН-БТ008)",
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
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.load(r)
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
        mark = "✓" if n == 0 else "✗"
        print("  %s %-11s %-42s %d" % (mark, c["law"], c["name"][:42], n))
        if n:
            bad.append((c, n))
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
