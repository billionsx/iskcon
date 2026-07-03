-- 0019_devotee_profile.sql
-- Ц1 «Модель преданного»: профиль духовной ступени на таблице users.
-- Позволяет приложению адаптироваться под уровень (гость→гуру): онбординг,
-- экран «Сегодня», путь ученика, «мой гуру». Норму кругов НЕ дублируем —
-- она живёт в user_prefs.data.sadhanaGoal (единый источник цели джапы).
--
-- Уже применено на prod через D1 напрямую (users = 0 строк, риск нулевой);
-- этот файл — для паритета и чистых установок. SQLite не поддерживает
-- ADD COLUMN IF NOT EXISTS — на уже мигрированной базе применять выборочно.
--
--   level            ступень практики (самоопределение), словарь:
--                    guest · neophyte · practicing · initiated · guru
--   initiation       факт инициации: none · harinama · brahmin
--   diksha_guru      имя (или entity-id) дикша-гуру
--   siksha_guru      имя (или entity-id) шикша-гуру
--   principles_since  дата принятия 4 рег. принципов (YYYY-MM-DD)

ALTER TABLE users ADD COLUMN level TEXT;
ALTER TABLE users ADD COLUMN initiation TEXT;
ALTER TABLE users ADD COLUMN diksha_guru TEXT;
ALTER TABLE users ADD COLUMN siksha_guru TEXT;
ALTER TABLE users ADD COLUMN principles_since TEXT;
