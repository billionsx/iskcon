-- Перф-индексы для оглавления больших книг (ШБ: 335 глав, ~18 000 стихов).
-- Без них /toc и /chapters считали стихи коррелированным COUNT(*) по всей таблице
-- verses на КАЖДУЮ главу (~347 полных сканов для ШБ) → многосекундная загрузка
-- оглавления. Идемпотентно (IF NOT EXISTS), применяется на каждом деплое API.

-- Счёт/выборка стихов по разделу: /toc, /chapters (COUNT), /read, /verses (JOIN).
CREATE INDEX IF NOT EXISTS idx_verses_division ON verses(division_id);

-- Оглавление: фильтр по книге + сортировка по порядку (/toc).
CREATE INDEX IF NOT EXISTS idx_divisions_work_ordinal ON divisions(work_id, ordinal);

-- Поиск главы по номеру внутри книги (/verses, /read: d.number = ?).
CREATE INDEX IF NOT EXISTS idx_divisions_work_number ON divisions(work_id, number);

-- EXISTS(перевод стиха) и выборка текстовых слоёв (/verses, /read).
CREATE INDEX IF NOT EXISTS idx_verse_texts_verse ON verse_texts(verse_id);
