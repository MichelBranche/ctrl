-- Outbox for the admin Discord webhook. Additive. One row per notice, sent at most once.
-- Rollback: DROP TABLE discord_outbox.
-- The row stores a type, a short title, a name and a CRM path. Never an address, a phone, a body or a note.
CREATE TABLE IF NOT EXISTS discord_outbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  event TEXT NOT NULL,
  title TEXT NOT NULL,
  actor TEXT,
  href TEXT NOT NULL,
  created_at TEXT NOT NULL,
  claim TEXT,
  claim_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS discord_outbox_pending ON discord_outbox (sent_at, created_at);
