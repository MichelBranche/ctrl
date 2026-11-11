CREATE TABLE IF NOT EXISTS email_workflow (
  message_key TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'todo', updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS email_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, message_key TEXT NOT NULL, user_id TEXT NOT NULL, body TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS email_notes_message ON email_notes(message_key, id);
