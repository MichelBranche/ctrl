-- Automatic IT -> EN journal translations (DeepL). Applied idempotently at runtime by lib/migrate.ts;
-- running it by hand is also fine (SQLite has no ADD COLUMN IF NOT EXISTS, so skip a line that errors with "duplicate column").
ALTER TABLE posts ADD COLUMN translation_of TEXT;
ALTER TABLE posts ADD COLUMN auto_translated INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS posts_translation_of ON posts (translation_of);
