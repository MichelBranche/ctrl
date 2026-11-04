-- Multi-role team + email invites. Applied automatically at runtime by ensureTeamSchema() in lib/migrate.ts
-- (ALTERs guarded there); documented here, idempotent parts can be applied by hand.
CREATE TABLE IF NOT EXISTS admin_user_roles (
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,              -- see TEAM_ROLES in lib/team-types.ts; permissions = union of the roles
  PRIMARY KEY (user_id, role)
);
-- admin_users gains (via addColumn): invite_state ('pending' | 'revoked' | NULL = no open invite),
-- invite_hash (SHA-256 base64url of the single-use token, cleared on accept/revoke), invite_expires_at (ms, 48h),
-- invite_sent_at, invite_window_at, invite_window_count (resend rate limit), invited_by.
-- admin_users.role is kept in sync as 'founder' / 'member' for older queries; admin_user_roles is the source of truth.
-- Backfill: INSERT OR IGNORE INTO admin_user_roles SELECT id, <role from legacy role/area> ... (see backfillRoles()).
