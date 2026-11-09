-- Rubrica: saved views. The contact kind column is added by ensureCrmSchema (addColumn ignores a duplicate).
-- Rollback: DROP TABLE crm_saved_views. The kind column can stay; the app ignores it if this code is rolled back.
-- SQLite on older builds cannot drop a column.
CREATE TABLE IF NOT EXISTS crm_saved_views (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  params TEXT NOT NULL,
  shared INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS crm_saved_views_owner ON crm_saved_views (owner_id, name);
CREATE INDEX IF NOT EXISTS crm_saved_views_shared ON crm_saved_views (shared);
