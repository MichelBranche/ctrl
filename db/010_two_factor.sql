-- Optional TOTP 2FA per admin user (RFC 6238). Secrets are AES-256-GCM encrypted (key from SESSION_SECRET via HKDF,
-- info "ctrl-totp-v1"); recovery codes are stored only as HMAC-SHA256 hashes, each usable once.
CREATE TABLE IF NOT EXISTS admin_2fa (
  user_id TEXT PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  secret_enc TEXT,            -- active secret, NULL while disabled
  pending_enc TEXT,           -- secret shown during setup, waiting for the first valid code
  pending_at INTEGER,
  last_step INTEGER NOT NULL DEFAULT 0, -- last accepted 30s step: a code can never be used twice
  enabled_at TEXT
);
CREATE TABLE IF NOT EXISTS admin_2fa_recovery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS admin_2fa_recovery_user ON admin_2fa_recovery (user_id);
