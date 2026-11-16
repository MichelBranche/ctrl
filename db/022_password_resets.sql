-- "Password dimenticata?" links. Only the SHA-256 of the token is stored; 30 minutes, single use,
-- a new request deletes the unused older ones. Additive. Rollback: DROP TABLE admin_password_resets.
CREATE TABLE IF NOT EXISTS admin_password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS admin_password_resets_user ON admin_password_resets (user_id);
