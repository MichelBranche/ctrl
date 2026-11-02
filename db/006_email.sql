-- Shared agency inbox: collaboration metadata only (bodies stay in Gmail). Applied at runtime by ensureEmailSchema().
ALTER TABLE admin_users ADD COLUMN email_access INTEGER NOT NULL DEFAULT 0; -- via addColumn, tolerates re-runs
CREATE TABLE IF NOT EXISTS email_reads (message_key TEXT NOT NULL, user_id TEXT NOT NULL, read_at TEXT NOT NULL, PRIMARY KEY (message_key, user_id));
CREATE TABLE IF NOT EXISTS email_claims (message_key TEXT PRIMARY KEY, user_id TEXT NOT NULL, claimed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_send_log (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, recipients TEXT NOT NULL, subject TEXT NOT NULL, in_reply_to TEXT, message_id TEXT, ok INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS email_send_log_user_time ON email_send_log (user_id, created_at);
