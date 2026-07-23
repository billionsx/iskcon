# APPLE EYES · Apple Eyes Development Team Department

Автономный департамент стандартов Apple: **разведка** официальных
источников (без ИИ) · **реестр** измеренной базы iOS 26 (каждое число
с адресом замера) · **исполнение** (линт AE1–AE6) · **суд** (selftest на
живых нарушениях) · **дозор iOS 27** с протоколом смены базы.

Устав — `CONSTITUTION.md` (ЗКН-Д030). Мандат — `registry/standards/MANDATE.md`.

## Команды

```
python3 apple-eyes/bin/apple_eyes.py status      # сводка департамента
python3 apple-eyes/bin/apple_eyes.py selftest    # суд: ломаю→красный, чиню→зелёный
python3 apple-eyes/bin/apple_eyes.py crawl       # разведка (живая сеть)
python3 apple-eyes/bin/apple_eyes.py ios27       # дозор iOS 27
python3 apple-eyes/bin/apple_eyes.py lint --adapter iskcon --mode report
```

Только stdlib Python 3 — никаких зависимостей.

## Подключить к любому проекту (3 шага)

1. Перенести каталог `apple-eyes/` (копия · git subtree · submodule).
2. `python3 apple-eyes/bin/apple_eyes.py attach --project имя \
      --report-glob "src/**/*.css" --report-glob "src/**/*.tsx"`
3. Скопировать `.github/workflows/apple-eyes.yml` — разведка, дозор и
   суд поедут по расписанию сами; хроника ляжет в
   `apple-eyes/registry/state/CHANGELOG.md`.

Порядок принуждения: новый проект начинает с `report`; правило
переводится в `strict`, когда его долг в проекте равен нулю (устав §4).
