-- ────────────────────────────────────────────────────────────────────────────
-- ПОЧЕМУ ЭТА ПРАВКА
--
-- Замер 2026-08-25: 7 706 577 890 прочитанных строк за сутки — 98,7% всего
-- расхода базы — приходятся на ОДИН запрос:
--
--   INSERT INTO katha_tracks (…) VALUES (…) ON CONFLICT(id) DO UPDATE SET title=…
--   вызовов 101 389 · прочитано строк на вызов 76 010
--
-- В пачке 11 строк, в katha_tracks 6 908 строк. 11 × 6 908 = 76 010. То есть
-- на КАЖДУЮ записанную строку движок проходил всю таблицу поиска целиком.
--
-- Виноват триггер. katha_fts объявлена как
--     fts5(tid UNINDEXED, title, …)
-- а UNINDEXED означает ровно то, что написано: по столбцу tid индекса НЕТ.
-- Триггер на обновление заголовка делает
--     DELETE FROM katha_fts WHERE tid = old.id;
-- и, не имея индекса, ищет эту строку перебором всей таблицы поиска.
--
-- ЧТО ДЕЛАЕТСЯ ВЗАМЕН. FTS5 умеет жить «внешним содержимым»: тогда её ключ —
-- это rowid исходной таблицы, а rowid у FTS5 индексирован всегда. Удаление
-- становится обращением по ключу вместо перебора, и правка одной строки стоит
-- одной строки. Заодно исчезает дублирование заголовков: они перестают лежать
-- во второй копии (katha_fts_content) и читаются из katha_tracks.
--
-- ЧТО МЕНЯЕТСЯ СНАРУЖИ. Ничего для человека: поиск ищет ровно так же, тот же
-- токенизатор unicode61, тот же регистронезависимый разбор кириллицы. Меняется
-- один связующий столбец в запросе воркера:
--     было   t.id    IN (SELECT tid   FROM katha_fts WHERE katha_fts MATCH ?1)
--     стало  t.rowid IN (SELECT rowid FROM katha_fts WHERE katha_fts MATCH ?1)
-- Правка воркера идёт тем же коммитом (apps/web/worker.ts, kathaFindParts).
--
-- ЦЕНА. Пересборка индекса — разовые ~6 908 записанных строк. Против 3,2 млн
-- записей в сутки, которые мы тратим сейчас, это меньше суточного шума.
-- ────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS katha_fts_ai;
DROP TRIGGER IF EXISTS katha_fts_ad;
DROP TRIGGER IF EXISTS katha_fts_au;
DROP TABLE IF EXISTS katha_fts;

CREATE VIRTUAL TABLE katha_fts USING fts5(
  title,
  content='katha_tracks',
  content_rowid='rowid',
  tokenize='unicode61'
);

INSERT INTO katha_fts(rowid, title) SELECT rowid, title FROM katha_tracks;

-- У внешнего содержимого удаление записывается особой командой: строка
-- вычёркивается по rowid, а не разыскивается перебором.
CREATE TRIGGER katha_fts_ai AFTER INSERT ON katha_tracks BEGIN
  INSERT INTO katha_fts(rowid, title) VALUES (new.rowid, new.title);
END;

CREATE TRIGGER katha_fts_ad AFTER DELETE ON katha_tracks BEGIN
  INSERT INTO katha_fts(katha_fts, rowid, title) VALUES ('delete', old.rowid, old.title);
END;

CREATE TRIGGER katha_fts_au AFTER UPDATE OF title ON katha_tracks BEGIN
  INSERT INTO katha_fts(katha_fts, rowid, title) VALUES ('delete', old.rowid, old.title);
  INSERT INTO katha_fts(rowid, title) VALUES (new.rowid, new.title);
END;

-- Снимок дорожек рассказчика (tools/goswami/ingest.py::snap_tracks) читается
-- на каждом прогоне заливки. Без индекса это SCAN всей таблицы; с индексом —
-- SEARCH по speaker_slug. Индекс стоит одной лишней записанной строки на
-- вставку дорожки — вставки после правки редки, а чтение идёт постоянно.
CREATE INDEX IF NOT EXISTS katha_tracks_speaker ON katha_tracks(speaker_slug);
