-- Daily Oggi figures. Additive. Rollback: DROP TABLE crm_kpi_daily.
-- A missing column on a past day means that figure could not be reconstructed. Nothing here is interpolated.
CREATE TABLE IF NOT EXISTS crm_kpi_daily (
  day TEXT PRIMARY KEY, -- Europe/Rome calendar day, YYYY-MM-DD
  contacts_total INTEGER, -- non-archived contacts
  assigned INTEGER, -- non-archived contacts with a responsible person; null when the day was only backfilled
  opportunities_active INTEGER, -- open deals on non-archived contacts
  todo_due INTEGER, -- follow-ups and open activities due through tomorrow; null when the day was only backfilled
  overdue INTEGER, -- follow-ups and open activities due before today; null when the day was only backfilled
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
