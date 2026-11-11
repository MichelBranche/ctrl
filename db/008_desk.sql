CREATE TABLE IF NOT EXISTS desk_items (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('task','note')),
 title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', due TEXT, done INTEGER NOT NULL DEFAULT 0,
 pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS desk_items_owner ON desk_items(user_id,kind,done);
CREATE TABLE IF NOT EXISTS email_references (
 message_key TEXT PRIMARY KEY, folder TEXT NOT NULL, uid INTEGER NOT NULL, subject TEXT NOT NULL,
 sender TEXT NOT NULL, message_id TEXT
);
