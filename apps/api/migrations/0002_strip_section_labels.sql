-- 0002_strip_section_labels.sql
-- Защита от дублирования заголовков секций в книжном слое (Cloudflare D1 / SQLite).
--
-- Проблема: разные источники загрузки (CRM-загрузчик в apps/web, GH Actions
--   iskcone-parse / iskcone-textparse / iskcone-verse-split / bg-structure-import и пр.)
--   при парсинге vedabase/iskcone иногда приклеивают ВЕДУЩУЮ МЕТКУ секции к содержимому
--   поля, например: "ПереводВерховный Господь…", "Деванагари…अर्जुन", "Текст стиха…",
--   "КомментарийВ этом стихе…", "Пословный переводш́рӣ-бхагава̄н…".
--
-- Решение: нормализация на уровне БД. Триггеры AFTER INSERT/UPDATE срезают ведущую метку
--   независимо от того, какой источник пишет данные. Идемпотентно (WHEN-условие гасит
--   повторное срабатывание) и безопасно для уже чистых строк (LIKE-префикс не совпадёт).
--
-- Карта «поле → срезаемая метка»:
--   verses.devanagari          → "Деванагари"
--   verses.translit            → "Текст стиха"
--   verses.uvaca               → "Текст стиха"
--   verse_texts.translation    → "Перевод"
--   verse_texts.purport        → "Комментарий"
--   verse_tokens.term          → "Пословный перевод"

-- 1) Разовая нормализация уже загруженных строк (трогает только строки с префиксом).
UPDATE verses       SET devanagari  = SUBSTR(devanagari,  LENGTH('Деванагари')+1)       WHERE devanagari  LIKE 'Деванагари%';
UPDATE verses       SET translit    = SUBSTR(translit,    LENGTH('Текст стиха')+1)       WHERE translit    LIKE 'Текст стиха%';
UPDATE verses       SET uvaca       = SUBSTR(uvaca,       LENGTH('Текст стиха')+1)       WHERE uvaca       LIKE 'Текст стиха%';
UPDATE verse_texts  SET translation = SUBSTR(translation, LENGTH('Перевод')+1)           WHERE translation LIKE 'Перевод%';
UPDATE verse_texts  SET purport     = SUBSTR(purport,     LENGTH('Комментарий')+1)       WHERE purport     LIKE 'Комментарий%';
UPDATE verse_tokens SET term        = SUBSTR(term,        LENGTH('Пословный перевод')+1) WHERE term        LIKE 'Пословный перевод%';

-- 2) Триггеры-сторожа: нормализация при записи из ЛЮБОГО источника.

DROP TRIGGER IF EXISTS trg_verses_strip_ins;
CREATE TRIGGER trg_verses_strip_ins AFTER INSERT ON verses
WHEN NEW.devanagari LIKE 'Деванагари%' OR NEW.translit LIKE 'Текст стиха%' OR NEW.uvaca LIKE 'Текст стиха%'
BEGIN
  UPDATE verses SET
    devanagari = CASE WHEN devanagari LIKE 'Деванагари%'  THEN SUBSTR(devanagari, LENGTH('Деванагари')+1)  ELSE devanagari END,
    translit   = CASE WHEN translit   LIKE 'Текст стиха%' THEN SUBSTR(translit,   LENGTH('Текст стиха')+1) ELSE translit   END,
    uvaca      = CASE WHEN uvaca       LIKE 'Текст стиха%' THEN SUBSTR(uvaca,      LENGTH('Текст стиха')+1) ELSE uvaca      END
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_verses_strip_upd;
CREATE TRIGGER trg_verses_strip_upd AFTER UPDATE ON verses
WHEN NEW.devanagari LIKE 'Деванагари%' OR NEW.translit LIKE 'Текст стиха%' OR NEW.uvaca LIKE 'Текст стиха%'
BEGIN
  UPDATE verses SET
    devanagari = CASE WHEN devanagari LIKE 'Деванагари%'  THEN SUBSTR(devanagari, LENGTH('Деванагари')+1)  ELSE devanagari END,
    translit   = CASE WHEN translit   LIKE 'Текст стиха%' THEN SUBSTR(translit,   LENGTH('Текст стиха')+1) ELSE translit   END,
    uvaca      = CASE WHEN uvaca       LIKE 'Текст стиха%' THEN SUBSTR(uvaca,      LENGTH('Текст стиха')+1) ELSE uvaca      END
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_verse_texts_strip_ins;
CREATE TRIGGER trg_verse_texts_strip_ins AFTER INSERT ON verse_texts
WHEN NEW.translation LIKE 'Перевод%' OR NEW.purport LIKE 'Комментарий%'
BEGIN
  UPDATE verse_texts SET
    translation = CASE WHEN translation LIKE 'Перевод%'     THEN SUBSTR(translation, LENGTH('Перевод')+1)     ELSE translation END,
    purport     = CASE WHEN purport     LIKE 'Комментарий%' THEN SUBSTR(purport,     LENGTH('Комментарий')+1) ELSE purport     END
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_verse_texts_strip_upd;
CREATE TRIGGER trg_verse_texts_strip_upd AFTER UPDATE ON verse_texts
WHEN NEW.translation LIKE 'Перевод%' OR NEW.purport LIKE 'Комментарий%'
BEGIN
  UPDATE verse_texts SET
    translation = CASE WHEN translation LIKE 'Перевод%'     THEN SUBSTR(translation, LENGTH('Перевод')+1)     ELSE translation END,
    purport     = CASE WHEN purport     LIKE 'Комментарий%' THEN SUBSTR(purport,     LENGTH('Комментарий')+1) ELSE purport     END
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_verse_tokens_strip_ins;
CREATE TRIGGER trg_verse_tokens_strip_ins AFTER INSERT ON verse_tokens
WHEN NEW.term LIKE 'Пословный перевод%'
BEGIN
  UPDATE verse_tokens SET term = SUBSTR(term, LENGTH('Пословный перевод')+1) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_verse_tokens_strip_upd;
CREATE TRIGGER trg_verse_tokens_strip_upd AFTER UPDATE ON verse_tokens
WHEN NEW.term LIKE 'Пословный перевод%'
BEGIN
  UPDATE verse_tokens SET term = SUBSTR(term, LENGTH('Пословный перевод')+1) WHERE id = NEW.id;
END;
