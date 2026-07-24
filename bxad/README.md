# BXAD · Billions X Apple Developer

Автономный департамент стандартов Apple: **разведка** официальных
источников (без ИИ) · **реестр** измеренной базы iOS 26 (каждое число
с адресом замера) · **исполнение** (линт AE1–AE6) · **суд** (selftest на
живых нарушениях) · **дозор iOS 27** с протоколом смены базы.

Устав — `CONSTITUTION.md` (ЗКН-Д030). Мандат — `registry/standards/MANDATE.md`.

## Команды

```
python3 bxad/bin/bxad.py status      # сводка департамента
python3 bxad/bin/bxad.py selftest    # суд: ломаю→красный, чиню→зелёный
python3 bxad/bin/bxad.py crawl       # разведка (живая сеть)
python3 bxad/bin/bxad.py ios27       # дозор iOS 27
python3 bxad/bin/bxad.py lint --adapter iskcon --mode report
```

Только stdlib Python 3 — никаких зависимостей.

## Подключить к любому проекту (3 шага)

1. Перенести каталог `bxad/` (копия · git subtree · submodule).
2. `python3 bxad/bin/bxad.py attach --project имя \
      --report-glob "src/**/*.css" --report-glob "src/**/*.tsx"`
3. Скопировать `.github/workflows/bxad.yml` — разведка, дозор и
   суд поедут по расписанию сами; хроника ляжет в
   `bxad/registry/state/CHANGELOG.md`.

Порядок принуждения: новый проект начинает с `report`; правило
переводится в `strict`, когда его долг в проекте равен нулю (устав §4).

## Дополнительные органы

    bxad.py digest                 # знание: нормативная выжимка из снимков
    bxad.py probe                  # пробы iOS 27: вербовка оживших страниц
    bxad.py lint --adapter X --mode report \
        --ratchet registry/state/ae-baseline.json   # храповик: долг только падает

Правила: AE1–AE11. Знание: `registry/knowledge/`. Продукты: `registry/standards/products/`.
