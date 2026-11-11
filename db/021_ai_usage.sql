-- Per-user daily count of admin AI requests. A number only: never a prompt, an email body, or a contact field.
-- Rollback: DROP TABLE ai_usage.
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
