-- CRM activities. Additive and idempotent: safe to re-run.
-- An activity is not a contact follow-up and not a deal. Existing next_action rows are not copied.
-- Rollback: DROP TABLE crm_activities. Contacts, opportunities and desk_items stay as they are.
-- No prospect_id: Radar prospects are crm_contacts (source radar). No migration_batch: history is not converted.

CREATE TABLE IF NOT EXISTS crm_activities (
  id TEXT PRIMARY KEY, contact_id TEXT, opportunity_id TEXT, title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('followup','email','call','meeting','radar','altro')),
  due_date TEXT NOT NULL, due_time TEXT,
  priority TEXT CHECK (priority IN ('alta','media','bassa')),
  assignee_user_id TEXT, done_at TEXT, done_by TEXT,
  version INTEGER NOT NULL DEFAULT 1, idempotency_key TEXT, created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS crm_activities_assignee ON crm_activities (assignee_user_id, done_at, due_date);
CREATE INDEX IF NOT EXISTS crm_activities_contact ON crm_activities (contact_id, done_at);
CREATE UNIQUE INDEX IF NOT EXISTS crm_activities_key ON crm_activities (idempotency_key) WHERE idempotency_key IS NOT NULL;
