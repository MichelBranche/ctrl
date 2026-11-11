-- Client meetings (Riunioni > Clienti): one row per Meet invite sent to an external client. Idempotent; mirrored in lib/migrate.ts ensureClientMeetSchema.
CREATE TABLE IF NOT EXISTS client_meetings (
  id TEXT PRIMARY KEY, contact_id TEXT, client_name TEXT NOT NULL, client_email TEXT NOT NULL, title TEXT NOT NULL, agenda TEXT,
  start_local TEXT NOT NULL, minutes INTEGER NOT NULL, meet_url TEXT NOT NULL, event_id TEXT, created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), cancelled_at TEXT
);
CREATE INDEX IF NOT EXISTS client_meetings_start ON client_meetings (cancelled_at, start_local);
CREATE INDEX IF NOT EXISTS client_meetings_contact ON client_meetings (contact_id);
