-- Deals, separate from the contact's relationship stage. Applied at runtime by ensureCrmSchema
-- (CREATE IF NOT EXISTS). No backfill: a contact in Call is not an opportunity until someone opens one.
-- Rollback: DROP TABLE crm_opportunities. Contacts are untouched.

CREATE TABLE IF NOT EXISTS crm_opportunities (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('nuovo','contattato','call','preventivo','vinto','perso')),
  value_eur REAL,
  owner_user_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('sito','manuale','radar')),
  priority TEXT CHECK (priority IN ('alta','media','bassa')),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS crm_opportunities_stage ON crm_opportunities (closed_at, stage);
CREATE INDEX IF NOT EXISTS crm_opportunities_owner ON crm_opportunities (owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS crm_opportunities_one_open ON crm_opportunities (contact_id) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_opportunities_key ON crm_opportunities (idempotency_key) WHERE idempotency_key IS NOT NULL;
