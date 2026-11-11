-- Admin audit log (founders only). Retention: 12 months, purged by the daily cron (app/api/purge).
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT, user_name TEXT, user_email TEXT,
  action TEXT NOT NULL, target_type TEXT, target_id TEXT, details TEXT,
  ip TEXT, user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS audit_log_created ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS audit_log_user ON audit_log (user_id, created_at);
