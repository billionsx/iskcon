# Vaisnava Calendar (GCal / Gaurabda) — data pipeline

Authoritative dated Vaisnava (Gaudiya) calendar for gaurangers.com.

## Source of truth — not recomputed

Dates are produced by the **GCAL (Gaurabda Calendar)** algorithm via
[`gopa810/gaurabda-calendar`](https://github.com/gopa810/gaurabda-calendar) (MIT),
the Python port of GCAL by **Gopalapriya das**, © **ISKCON GBC Vaishnava Calendar
Committee** — the standard used by ISKCON temples worldwide.

We deliberately do **not** hand-roll tithi / Ekadashi / parana rules. Those rules
(Shuddha-Ekadashi, Dasami-before-Arunodaya, Mahadvadasi shifts, parana windows,
adhika masa) are subtle and even established programs diverge at the edges, so we
take the canonical algorithm and ingest its output.

## Location standard — Vrindavan

Fixed standard: **Vrindavan** (lat `27.583`, lng `77.73`, `Asia/Kolkata`). All
observance dates and parana times are resolved for this location.

## Validation

Generated output was cross-checked against **iskconvrindavan.com**'s official temple
calendar and matched exactly — festival dates **and** parana (break-fast) times to
the minute (e.g. Parama Ekadasi fast 2026-06-11, parana 2026-06-12 05:23–10:00;
Pandava Nirjala fast 2026-06-25, parana 2026-06-26 05:25–10:03), plus appearance /
disappearance days. Mahadvadasi-prevails-over-Ekadashi behaviour is preserved
(fast code `519`).

## Regenerate

```bash
pip install -r requirements.txt
python generate_vrindavan.py \
    --start "1 jan 2026" --count 765 \
    --out ../../apps/api/data/vaisnava-calendar-vrindavan.json
```

Output: flat typed event list with provenance header. Event kinds:
`ekadashi_fast`, `mahadvadasi_fast`, `ekadashi_paran`, `festival`, `appearance`,
`disappearance`, `caturmasya`, `sankranti`. Current dataset spans Gaurabda 539–541
(2026-01-01 → 2028-02-04), 481 events.

## Ingest into D1

1. Schema: `apps/api/migrations/0005_gcal_calendar.sql` (tables `gcal_days`,
   `gcal_meta`). Apply with the project's `db:migrate:prod` step (migrations are
   not auto-applied by CI).
2. Load: dataset at `apps/api/data/vaisnava-calendar-vrindavan.json` is loaded into
   `gcal_days` (loader workflow — see `gcal-ingest.yml`, pending).
3. Serve: `GET /v1/calendar/days?from=&to=&kind=` (route — pending).

## Localization

`name_en` is the canonical English name. The Russian layer (`name_i18n.ru`,
BBT transliteration standard) is filled separately — names only; dates never change.

## Прошлое: архив 2016–2025

Живой фид (`/data/gcal/<slug>.json`) считает **2026-01-01 → 2028-02-04**. Прошлого в
приложении не было вообще. `generate_past_archive.py` закрывает **2016-01-01 →
2025-12-31** по каждому городу, у которого есть живой фид. Стык без дыры и без
нахлёста: архив кончается там, где начинается живой фид.

Тот же движок GCAL — он астрономический и считает любой год. Ничего не
пересчитывается вручную (ЗКН-БТ001).

**Пояс — главная ловушка.** 4403 живых фида построены тремя пайплайнами, и часовой
пояс лежит только у 272 curated:

| источник | городов | slug | где пояс |
|---|---|---|---|
| curated (`vaisnava-locations.json`) | 272 | `slug(key)` | в самом фиде (`location.tz`) |
| БД движка (`gaurabda/res/locations.json`) | 2379 | `slug("<city> <country>")` | родная запись (`tzid`/`offset`) |
| GeoNames (`cities500.txt`) | 1963 | `slug("<asciiname> <CC>")` | колонка 17 TSV → `resolve()` |

Приоритет тот же, что при сборке живых фидов: curated → движок → GeoNames.
Ошибиться поясом = молча сдвинуть прошлое на день, поэтому в генераторе стоит
**гейт паритета**: восстановленная локация обязана воспроизвести живой фид 2026
года *до минуты*, иначе город не пишется.

**Формат — компактный.** 10 лет сырым JSON = 165 КБ × 4403 = 700 МБ. Словарь +
база-36 смещения дают ~28 КБ на город (~125 МБ). Строки, которые воркер и так не
показывает (`Ksaya`/`Vrddhi tithi`, DST), выброшены.

```json
{"slug":"…","location":{…},"from":"2016-01-01","to":"2025-12-31",
 "t":["Fasting for Saphala Ekadasi", …],
 "e":"4.0 4.1 5.2 …"}
```

Воркер (`apps/web/workerCalendar.ts`, ветка `?past=1`) разворачивает архив обратно
в `{date, summary}` и гонит через **тот же** `buildEvents()`, что и живой фид, —
русификация едина по построению.

### Запуск

Воркфлоу `gcal-past-archive.yml` (`workflow_dispatch`): 12 шардов × Pool(4),
~25 минут на шард. Локально:

```bash
pip install tzdata "gaurabda @ git+https://github.com/gopa810/gaurabda-calendar.git"
curl -sSL -o geo.zip https://download.geonames.org/export/dump/cities500.zip && unzip -oq geo.zip
python3 scripts/gcal/generate_past_archive.py --shard 0 --of 12 --jobs 4 --geonames cities500.txt
```
