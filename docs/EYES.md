# BILLIONS X EYES — департамент вынесен из монорепо

С 27.07.2026 департамент стандартов Apple живёт в **своём репозитории**:
**https://github.com/billionsx/eyes** — автономно, не принадлежит ни одному
проекту. Эфир: **https://vrajs.com**.

Каталог `bxad/` и воркфлоу `bxad-*.yml` удалены отсюда (история сохранена в
git и в ветке `eyes-standalone` до её очистки). Перенос: `iskcon@ad77d7215`
→ `eyes@fc49b846b`, первый зелёный прогон в своём доме — `eyes@a2905d225`.

Этот проект подключён к департаменту паспортом
[`adapters/iskcon.json`](https://github.com/billionsx/eyes/blob/main/adapters/iskcon.json):
департамент сам забирает код, проходит советником, держит храповик долга,
снимает живой взгляд с brajs.com, выдаёт пиксель-сертификат и гоняет по
App Review Guidelines.

Живые числа — по адресу, а не переписанные сюда (иначе разойдутся):

| что | где смотреть |
|---|---|
| сертификат проекта | [`certificates/iskcon/latest.html`](https://github.com/billionsx/eyes/blob/main/certificates/iskcon/latest.html) · бейдж `certificates/iskcon/badge.json` |
| отчёт советника (находки AE) | [`registry/state/report-iskcon.md`](https://github.com/billionsx/eyes/blob/main/registry/state/report-iskcon.md) |
| храповик долга | [`registry/state/ae-baseline.json`](https://github.com/billionsx/eyes/blob/main/registry/state/ae-baseline.json) |
| эфир департамента | [vrajs.com](https://vrajs.com) · машинам [vrajs.com/data.json](https://vrajs.com/data.json) |

Со стороны этого репозитория работают два файла:
- `.github/workflows/eyes.yml` — ревью каждого PR по apps/web;
- `.github/workflows/ping-eyes.yml` — пинг монитора после деплоя
  (нужен секрет `EYES_DISPATCH_TOKEN`, без него монитор ходит по расписанию).

Связь с департаментом охраняется гейтом `tools/eyes-link-lint.py` (шаг в
`laws-lint.yml`): пустые глобы, пропавший вызов reusable или возрождённый
каталог `bxad/` валят сборку.

Законы департамента — в его конституции; закон ЗКН-Д030 в `docs/LAWS.md`
остаётся в силе и указывает теперь на новый дом.
