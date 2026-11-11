-- Team accounts + paid jobs. Applied automatically at runtime by ensureTeamSchema() in lib/migrate.ts;
-- this file documents the schema and can be applied by hand (idempotent).
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, last_name TEXT,
  role TEXT NOT NULL DEFAULT 'member', area TEXT, password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1, session_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  avatar_url TEXT, contact_email TEXT, phone TEXT, website TEXT,
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS team_jobs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  client TEXT NOT NULL, description TEXT NOT NULL, amount_cents INTEGER NOT NULL, date TEXT NOT NULL,
  area TEXT NOT NULL, created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS team_jobs_user_date ON team_jobs (user_id, date);
CREATE INDEX IF NOT EXISTS team_jobs_date ON team_jobs (date);
-- The founder account is seeded on first login/page load from ADMIN_EMAIL + the current password hash.
