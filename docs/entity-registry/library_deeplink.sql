-- Deep-link (link-not-copy): store canonical vedabase URL per chapter/verse.
-- Translation & purport are NOT stored — they open at the source via this URL.
ALTER TABLE divisions ADD COLUMN source_url TEXT;
ALTER TABLE verses    ADD COLUMN source_url TEXT;
