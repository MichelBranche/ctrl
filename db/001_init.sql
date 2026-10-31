-- CTRL Journal schema (Turso / libSQL). Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS posts (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL,
  lang         TEXT NOT NULL DEFAULT 'it' CHECK (lang IN ('it', 'en')),
  title        TEXT NOT NULL,
  excerpt      TEXT NOT NULL DEFAULT '',
  body_md      TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL,
  cover_url    TEXT,
  cover_alt    TEXT NOT NULL DEFAULT '',
  published    INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  published_at TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- One slug per language, so an article and its translation can share a slug.
CREATE UNIQUE INDEX IF NOT EXISTS posts_lang_slug ON posts (lang, slug);
CREATE INDEX IF NOT EXISTS posts_public ON posts (lang, published, published_at DESC);

-- Failed admin logins, used to slow down and lock out brute force attempts.
CREATE TABLE IF NOT EXISTS login_attempts (
  key        TEXT PRIMARY KEY,
  failures   INTEGER NOT NULL DEFAULT 0,
  first_at   INTEGER NOT NULL,
  locked_til INTEGER NOT NULL DEFAULT 0
);
