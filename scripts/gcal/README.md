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
