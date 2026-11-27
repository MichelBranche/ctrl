-- Public site team, edited live from /admin/sito/contenuti. Additive only.
-- Rollback: DROP TABLE site_team_photos; DROP TABLE site_team_members;
CREATE TABLE IF NOT EXISTS site_team_members (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role_it TEXT NOT NULL DEFAULT '',
  role_en TEXT NOT NULL DEFAULT '',
  bio_it TEXT NOT NULL DEFAULT '',
  bio_en TEXT NOT NULL DEFAULT '',
  skills_json TEXT NOT NULL DEFAULT '[]',
  photo TEXT,
  photo_focus TEXT,
  group_key TEXT NOT NULL DEFAULT 'team' CHECK (group_key IN ('founder', 'team')),
  linkedin TEXT,
  email TEXT,
  website TEXT,
  github TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  has_photo_blob INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS site_team_members_order ON site_team_members (sort_order, name);

CREATE TABLE IF NOT EXISTS site_team_photos (
  member_id TEXT PRIMARY KEY REFERENCES site_team_members(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  bytes BLOB NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
