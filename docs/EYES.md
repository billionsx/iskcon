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

Бейдж соответствия (обновляется выдачей сам):

![BXE](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/billionsx/eyes/main/certificates/iskcon/badge.json)

Копии сертификата в этом репозитории нет намеренно: выданный документ неизменен
и живёт в реестре органа выдачи, а копия отстала бы от следующей выдачи.
Подлинность проверяется отпечатком sha256 из реестра.

Живые числа — по адресу, а не переписанные сюда (иначе разойдутся):

| что | где смотреть |
|---|---|
| сертификат проекта | [последний](https://github.com/billionsx/eyes/blob/main/certificates/iskcon/latest.html) · [реестр выдачи с отпечатками](https://github.com/billionsx/eyes/blob/main/certificates/iskcon/REGISTER.md) |
| отчёт советника (находки AE) | [`registry/state/report-iskcon.md`](https://github.com/billionsx/eyes/blob/main/registry/state/report-iskcon.md) |
| храповик долга | [`registry/state/ae-baseline.json`](https://github.com/billionsx/eyes/blob/main/registry/state/ae-baseline.json) |
| эфир департамента | [vrajs.com](https://vrajs.com) · машинам [vrajs.com/data.json](https://vrajs.com/data.json) |

Со стороны этого репозитория работают три файла:
- `.github/workflows/eyes.yml` — ревью каждого PR по apps/web;
- `.github/workflows/eyes-watch.yml` — надзор на КАЖДЫЙ коммит в main.
  Здесь пишут прямо в ветку: за всё время один PR при тысяче с лишним
  деплоев, и PR-ревью не срабатывало ни разу. Департамент берётся только
  на чтение (разреженный клон `bin`, `adapters`, `registry/standards`),
  храповик долга читается у него же — база одна на всех, копии здесь нет
  намеренно. Рост долга по правилу — красный на коммите; деплой гейт не
  роняет, перевод правил в строгий режим — решением основателя;
- `.github/workflows/ping-eyes.yml` — пинг монитора после деплоя
  (нужен секрет `EYES_DISPATCH_TOKEN`, без него монитор ходит по расписанию).

Связь с департаментом охраняется гейтом `tools/eyes-link-lint.py` (шаг в
`laws-lint.yml`): пустые глобы, пропавший вызов reusable или возрождённый
каталог `bxad/` валят сборку.

Законы департамента — в его конституции; закон ЗКН-Д030 в `docs/LAWS.md`
остаётся в силе и указывает теперь на новый дом.
