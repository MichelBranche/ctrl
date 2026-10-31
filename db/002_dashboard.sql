-- Admin dashboard: contact requests, newsletter, settings, rate limits. Idempotent.
CREATE TABLE IF NOT EXISTS contact_requests (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL,
  lang       TEXT NOT NULL DEFAULT 'it' CHECK (lang IN ('it', 'en')),
  status     TEXT NOT NULL DEFAULT 'nuovo' CHECK (status IN ('nuovo', 'risposto', 'chiuso')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS contact_requests_status ON contact_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS subscribers (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL COLLATE NOCASE UNIQUE,
  lang            TEXT NOT NULL DEFAULT 'it' CHECK (lang IN ('it', 'en')),
  token           TEXT NOT NULL UNIQUE,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unsubscribed_at TEXT
);

-- Key/value settings edited from the dashboard (social URLs, admin password hash override).
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Fixed-window rate limits for public forms. key = form + salted daily hash of the IP (never the IP itself).
CREATE TABLE IF NOT EXISTS rate_limits (
  key        TEXT PRIMARY KEY,
  hits       INTEGER NOT NULL DEFAULT 0,
  window_at  INTEGER NOT NULL
);
