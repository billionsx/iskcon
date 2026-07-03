-- 0021_ekadashi.sql
-- Ц5 «Экадаши-практика»: отметка соблюдения поста в дневнике садханы.
-- Соблюдение хранится локально (iol:ekadashi:v1) и зеркалится на сервер для
-- вошедших — чтобы попадало в реальную историю практики (sadhana_day).
-- Для чистых установок колонка уже в CREATE TABLE sadhana_day (ensureSchema);
-- этот файл добавляет её на уже существующую таблицу.

ALTER TABLE sadhana_day ADD COLUMN ekadashi INTEGER NOT NULL DEFAULT 0;
