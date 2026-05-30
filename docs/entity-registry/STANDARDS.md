# Стандарты и состояние — индекс (entry point)

Точка входа для дальнейшей работы. Здесь — все документы-стандарты, слои данных,
воспроизводимый пайплайн и текущее состояние БД.

## Документы-стандарты
| документ | о чём |
|---|---|
| `README.md` | Реестр сущностей: принцип «id ≠ имя», единый источник правды, схема CSV. |
| `GOLD_STANDARD_PROFILE.md` | Золотой стандарт профиля личности: 9 разделов, уровни stub→bronze→silver→gold, таблицы `entity_profiles`/`entity_citations`, порядок работ. |
| `BOOK_STANDARD.md` | Книжный стандарт мирового уровня: витрина+подробная карточки, сервисы, навигация, 5 слоёв стиха, QR/диплинки, конкорданс «слово→личность», права/синхрон BBT. |

## Слои данных (Cloudflare D1) и где схемы
1. **Реестр** — `schema.sql`: `entities` · `entity_names` · `entity_categories` · `entity_relations`.
   Идемпотентно (drop+create), грузится из `entities_all.csv`/`relations_all.csv`.
2. **Профили** — раздел 3 `GOLD_STANDARD_PROFILE.md`: `entity_profiles` · `entity_citations`.
   Недеструктивно (CREATE IF NOT EXISTS) — курируемая проза переживает перезагрузки реестра.
3. **Библиотека** — `library_schema.sql`: `works` · `editions` · `divisions` · `verses` · `verse_texts`
   · `verse_tokens` · `lemmas` · `user_favorites` · `book_orders`. Недеструктивно.
   `works.id` = `entities.id` книги; `verse_tokens.entity_id` → `entities.id` (единый граф).

## Воспроизводимый пайплайн
**Источники → CSV (build-скрипты):**
- `build_ggd.py`, `build_ggd_krishna_side.py` — Гаура-ганоддеша-дипика (Гаура/Кришна-лила).
- `build_iskcon_gurus.py` — список GBC (инициирующие гуру + граф disciple-of).
- `build_prabhupada_lilamrita.py` — действующие лица лиламриты.
- `build_epics.py` — основной состав Махабхараты и Рамаяны.
- `build_book_relations.py` — `appears-in`/`author-of` (книга ↔ герой), многие-ко-многим.
- `transliterate.py` → `iast_verify.py` — заполнение и выверка имён (IAST 600/600 verified).
- `fix_notes.py` — определения кириллицей.
- `build_glossary_xlsx.py` — мастер-сводки `entities_all.csv`/`relations_all.csv` + `ISKCON_Glossary.xlsx`.
- `profile_render.py` — bronze-профили в `profiles/` + индекс.

**CSV → D1:** `registry_load.py` (через D1 HTTP API) + workflow `.github/workflows/registry-load.yml`
(запуск на пуш CSV/схемы или вручную; идемпотентно; засевает bronze-профили).
Библиотека: `library_schema.sql` + `library_seed.sql` (применены к D1).

**Принцип:** правишь источник → пуш → D1 пересобирается; имена и связи — атрибуты `id`, правка в одном месте видна везде.

## Текущее состояние D1 (snapshot)
- Реестр: **657 сущностей · 2193 имени · 1294 категории · 1957 связей**; IAST verified 600/600 (ядро+ГГД+эпосы), заметки — кириллица.
- Профили: **657 строк уровня bronze** (`entity_profiles`).
- Библиотека: **20 книг** (`works`, id = реестр) с авторами и схемой нумерации; демо-стихи **БГ 1.1** и
  **Ишопанишад (мангалачарана)** со всеми слоями; конкорданс «слово→личность» работает
  (`sañjaya`→Санджая, `dhṛtarāṣṭra`→Дхритараштра).
- Книги-источники как сущности: ГГД, Прабхупада-лиламрита, Чайтанья-мангала (+ авторы).

## Что дальше (roadmap)
- Профили: bronze → silver/gold по мере подключения библиотеки и курирования (см. `GOLD_STANDARD_PROFILE.md` §2,4).
- Библиотека: M3.1 каркас (готов) → M3.2 ингест-турбина (vedabase: деванагари/IAST/пословный + леммы) →
  M3.3 сервисы (избранное, заказ, аудио, стих дня) → M3.4 лицензия/синхрон BBT (см. `BOOK_STANDARD.md` §9).
- UI: витринная и подробная карточки книги + ридер стиха (5 слоёв) с QR и поповером конкорданса.
- Миграция контента сайта (14 личностей + цитаты/молитвы) на канонические `id` реестра.
