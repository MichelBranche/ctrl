-- Founder requests that ask Iris to search for leads. Additive.
-- Rollback: DROP TABLE crm_iris_requests; then ALTER TABLE crm_contacts DROP COLUMN iris_request_id
-- (SQLite cannot drop a column on older builds: the app ignores the column if this code is rolled back).
CREATE TABLE IF NOT EXISTS crm_iris_requests (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL, -- admin user id
  day_rome TEXT NOT NULL, -- Europe/Rome day the credit was taken, YYYY-MM-DD
  params TEXT NOT NULL, -- JSON: zone, sectors, count, siteCriteria, notes
  status TEXT NOT NULL CHECK (status IN ('queued', 'working', 'ready', 'error')),
  inserted INTEGER,
  duplicates INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS crm_iris_requests_day ON crm_iris_requests (requested_by, day_rome);
CREATE INDEX IF NOT EXISTS crm_iris_requests_status ON crm_iris_requests (status, created_at);
