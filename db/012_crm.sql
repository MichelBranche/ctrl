-- CRM: contacts (rubrica + pipeline), notes timeline, outreach drafts (Radar). Idempotent; mirrored in lib/migrate.ts ensureCrmSchema.
CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  type TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  source TEXT NOT NULL DEFAULT 'manuale' CHECK (source IN ('sito','manuale','radar')),
  score INTEGER,
  score_reasons TEXT,
  stage TEXT NOT NULL DEFAULT 'nuovo' CHECK (stage IN ('nuovo','contattato','call','preventivo','vinto','perso')),
  value_eur REAL,
  next_action TEXT,
  next_action_at TEXT,
  owner_user_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  archived INTEGER NOT NULL DEFAULT 0,
  email_norm TEXT NOT NULL DEFAULT '',
  phone_norm TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  request_id TEXT,
  stage_changed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 -- optimistic lock; existing databases get it from ensureCrmSchema (addColumn), never from this file
);
CREATE INDEX IF NOT EXISTS crm_contacts_stage ON crm_contacts (archived, stage);
CREATE INDEX IF NOT EXISTS crm_contacts_email ON crm_contacts (email_norm);
CREATE INDEX IF NOT EXISTS crm_contacts_phone ON crm_contacts (phone_norm);
CREATE INDEX IF NOT EXISTS crm_contacts_domain ON crm_contacts (domain);
CREATE INDEX IF NOT EXISTS crm_contacts_next ON crm_contacts (archived, next_action_at);
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_request ON crm_contacts (request_id) WHERE request_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS crm_notes (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  user_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS crm_notes_contact ON crm_notes (contact_id, created_at);
CREATE TABLE IF NOT EXISTS crm_drafts (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'bozza' CHECK (status IN ('bozza','inviata','scartata')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sent_at TEXT,
  sent_by TEXT
);
CREATE INDEX IF NOT EXISTS crm_drafts_contact ON crm_drafts (contact_id, created_at);
CREATE INDEX IF NOT EXISTS crm_contacts_owner ON crm_contacts (archived, owner_user_id);
