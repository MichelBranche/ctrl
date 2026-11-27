import "server-only";
import { cacheLife, cacheTag, revalidatePath, updateTag } from "next/cache";
import type { InValue, Row } from "@libsql/client";
import { team as staticTeam, type TeamMember } from "@/lib/content";
import { db, dbConfigured } from "@/lib/db";
import { locales, localize } from "@/lib/i18n";
import { ensureSiteTeamSchema } from "@/lib/migrate";
import {
  isTeamGroup,
  parseSkills,
  TEAM_LIMITS,
  SITE_TEAM_ADMIN,
  SITE_TEAM_TAG,
  teamPhotoPath,
  toPublicMember,
  type SiteTeamInput,
  type SiteTeamMember,
  type SiteTeamSocials,
} from "@/lib/site-team-core";

export {
  FIELD_ERROR_EN,
  FIELD_ERROR_IT,
  SITE_TEAM_ADMIN,
  SITE_TEAM_TAG,
  TEAM_GROUPS,
  TEAM_LIMITS,
  emptyInput,
  isTeamGroup,
  parseInput,
  parseSkills,
  slugifyName,
  teamPhotoPath,
  toPublicMember,
} from "@/lib/site-team-core";
export type { SiteTeamFieldError, SiteTeamInput, SiteTeamMember, SiteTeamSocials, TeamGroup } from "@/lib/site-team-core";

const DATA_URL = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

export function parsePhotoDataUrl(photo: string): { mime: "image/webp" | "image/jpeg"; bytes: Uint8Array } | { error: "photoInvalid" | "photoFormat" } {
  if (typeof photo !== "string" || photo.length > TEAM_LIMITS.photoDataUrl || !DATA_URL.test(photo)) return { error: "photoInvalid" };
  const match = DATA_URL.exec(photo);
  if (!match) return { error: "photoInvalid" };
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > TEAM_LIMITS.photoBytes) return { error: "photoFormat" };
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (match[1] === "webp" ? !webp : !jpeg) return { error: "photoFormat" };
  return { mime: match[1] === "webp" ? "image/webp" : "image/jpeg", bytes: new Uint8Array(bytes) };
}

const COLUMNS = `id, slug, name, role_it, role_en, bio_it, bio_en, skills_json, photo, photo_focus, group_key,
  linkedin, email, website, github, sort_order, is_active, has_photo_blob, created_at, updated_at`;

const FOUNDERS = new Set(["michel-branche", "kallebe-gallo"]);
const PHOTO_FOCUS: Record<string, string> = {
  "michel-branche": "50% 30%",
  "kallebe-gallo": "50% 28%",
  "matteo-riva": "50% 32%",
  "giulia-moretti": "50% 30%",
  "jacopo-manzalini": "50% 30%",
  "katia-micello": "50% 30%",
};

function socialsOf(row: Row): SiteTeamSocials {
  return {
    linkedin: String(row.linkedin ?? ""),
    email: String(row.email ?? ""),
    website: String(row.website ?? ""),
    github: String(row.github ?? ""),
  };
}

function parseJsonSkills(value: unknown): string[] {
  if (!value) return [];
  try {
    return parseSkills(JSON.parse(String(value)));
  } catch {
    return [];
  }
}

function displayPhoto(row: Row): string | null {
  if (Number(row.has_photo_blob) === 1) return teamPhotoPath(String(row.id), String(row.updated_at ?? ""));
  const photo = String(row.photo ?? "").trim();
  return photo || null;
}

function toMember(row: Row): SiteTeamMember {
  const slug = String(row.slug);
  const hasPhotoBlob = Number(row.has_photo_blob) === 1;
  return {
    id: String(row.id),
    slug,
    name: String(row.name),
    roleIt: String(row.role_it ?? ""),
    roleEn: String(row.role_en ?? ""),
    bioIt: String(row.bio_it ?? ""),
    bioEn: String(row.bio_en ?? ""),
    skills: parseJsonSkills(row.skills_json),
    photo: displayPhoto(row),
    photoUrl: hasPhotoBlob ? "" : String(row.photo ?? ""),
    photoFocus: String(row.photo_focus ?? "").trim() || PHOTO_FOCUS[slug] || "50% 30%",
    hasPhotoBlob,
    group: isTeamGroup(row.group_key) ? row.group_key : FOUNDERS.has(slug) ? "founder" : "team",
    socials: socialsOf(row),
    sortOrder: Number(row.sort_order) || 0,
    isActive: Number(row.is_active) === 1,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

const SEED_SQL = `INSERT OR IGNORE INTO site_team_members (
  id, slug, name, role_it, role_en, bio_it, bio_en, skills_json, photo, photo_focus, group_key,
  linkedin, email, website, github, sort_order, is_active
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`;

function seedArgs(member: TeamMember, index: number): InValue[] {
  return [
    member.slug,
    member.slug,
    member.name,
    member.role.it ?? "",
    member.role.en ?? "",
    member.bio.it ?? "",
    member.bio.en ?? "",
    JSON.stringify(member.skills ?? []),
    member.photo ?? null,
    member.photoFocus ?? PHOTO_FOCUS[member.slug] ?? "50% 30%",
    member.group ?? (FOUNDERS.has(member.slug) ? "founder" : "team"),
    member.socials.linkedin ?? null,
    member.socials.email ?? null,
    member.socials.website ?? null,
    member.socials.github ?? null,
    index,
  ];
}

/** Idempotent: inserts the current catalogue only when the table is still empty. */
export async function seedSiteTeamIfEmpty(): Promise<void> {
  const existing = await db().execute("SELECT COUNT(*) AS n FROM site_team_members");
  if (Number(existing.rows[0]?.n ?? 0) > 0) return;
  try {
    await db().batch(staticTeam.map((member, index) => ({ sql: SEED_SQL, args: seedArgs(member, index) })), "write");
  } catch (error) {
    const again = await db().execute("SELECT COUNT(*) AS n FROM site_team_members");
    if (Number(again.rows[0]?.n ?? 0) > 0) return;
    throw error;
  }
}

async function ready(): Promise<void> {
  await ensureSiteTeamSchema();
  await seedSiteTeamIfEmpty();
}

async function queryPublicTeam(): Promise<TeamMember[]> {
  "use cache";
  cacheTag(SITE_TEAM_TAG);
  cacheLife({ stale: 30, revalidate: 3600, expire: 86400 * 7 });
  await ready();
  const result = await db().execute(
    `SELECT ${COLUMNS} FROM site_team_members WHERE is_active = 1 ORDER BY sort_order, name`,
  );
  return result.rows.map((row) => toPublicMember(toMember(row)));
}

/** Public team as shown on the site. Falls back to the static catalogue if Turso is missing or errors. */
export async function getPublicTeam(): Promise<TeamMember[]> {
  if (!dbConfigured) return staticTeam;
  try {
    return await queryPublicTeam();
  } catch {
    return staticTeam;
  }
}

/** Admin list (uncached), including hidden members. */
export async function getSiteTeamAdmin(): Promise<SiteTeamMember[]> {
  await ready();
  const result = await db().execute(`SELECT ${COLUMNS} FROM site_team_members ORDER BY sort_order, name`);
  return result.rows.map(toMember);
}

export async function getSiteTeamMember(id: string): Promise<SiteTeamMember | null> {
  await ready();
  const result = await db().execute({ sql: `SELECT ${COLUMNS} FROM site_team_members WHERE id = ?`, args: [id] });
  return result.rows[0] ? toMember(result.rows[0]) : null;
}

export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const result = exceptId
    ? await db().execute({ sql: "SELECT id FROM site_team_members WHERE slug = ? AND id != ? LIMIT 1", args: [slug, exceptId] })
    : await db().execute({ sql: "SELECT id FROM site_team_members WHERE slug = ? LIMIT 1", args: [slug] });
  return result.rows.length > 0;
}

const WRITE_SQL_FIELDS = `slug = ?, name = ?, role_it = ?, role_en = ?, bio_it = ?, bio_en = ?, skills_json = ?,
  photo = ?, photo_focus = ?, group_key = ?, linkedin = ?, email = ?, website = ?, github = ?, is_active = ?,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

function writeValues(input: SiteTeamInput, photo: string | null): InValue[] {
  return [
    input.slug,
    input.name,
    input.roleIt,
    input.roleEn,
    input.bioIt,
    input.bioEn,
    JSON.stringify(input.skills),
    photo,
    input.photoFocus,
    input.group,
    input.socials.linkedin || null,
    input.socials.email || null,
    input.socials.website || null,
    input.socials.github || null,
    input.isActive ? 1 : 0,
  ];
}

export async function createSiteTeamMember(input: SiteTeamInput): Promise<SiteTeamMember> {
  await ready();
  const id = crypto.randomUUID();
  const next = await db().execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM site_team_members");
  const sortOrder = Number(next.rows[0]?.n ?? 0);
  await db().execute({
    sql: `INSERT INTO site_team_members (
      id, slug, name, role_it, role_en, bio_it, bio_en, skills_json, photo, photo_focus, group_key,
      linkedin, email, website, github, is_active, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, ...writeValues(input, input.photoUrl || null), sortOrder],
  });
  const created = await getSiteTeamMember(id);
  if (!created) throw new Error("create failed");
  return created;
}

export async function updateSiteTeamMember(id: string, input: SiteTeamInput, opts?: { keepBlob?: boolean }): Promise<SiteTeamMember | null> {
  await ready();
  const current = await getSiteTeamMember(id);
  if (!current) return null;
  const keepBlob = opts?.keepBlob !== false && current.hasPhotoBlob && !input.photoUrl;
  const photo = keepBlob ? current.photoUrl || null : (input.photoUrl || null);
  const statements = [
    { sql: `UPDATE site_team_members SET ${WRITE_SQL_FIELDS}${keepBlob ? "" : ", has_photo_blob = 0"} WHERE id = ?`, args: [...writeValues(input, photo), id] },
  ];
  if (!keepBlob && current.hasPhotoBlob) {
    statements.push({ sql: "DELETE FROM site_team_photos WHERE member_id = ?", args: [id] });
  }
  await db().batch(statements, "write");
  return getSiteTeamMember(id);
}

export async function setSiteTeamActive(id: string, isActive: boolean): Promise<SiteTeamMember | null> {
  await ready();
  const result = await db().execute({
    sql: `UPDATE site_team_members SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? RETURNING ${COLUMNS}`,
    args: [isActive ? 1 : 0, id],
  });
  return result.rows[0] ? toMember(result.rows[0]) : null;
}

export async function reorderSiteTeam(ids: string[]): Promise<boolean> {
  await ready();
  const current = await db().execute("SELECT id FROM site_team_members");
  const known = new Set(current.rows.map((row) => String(row.id)));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) return false;
  await db().batch(
    ids.map((id, index) => ({
      sql: `UPDATE site_team_members SET sort_order = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
      args: [index, id],
    })),
    "write",
  );
  return true;
}

export async function deleteSiteTeamMember(id: string): Promise<boolean> {
  await ready();
  await db().batch(
    [
      { sql: "DELETE FROM site_team_photos WHERE member_id = ?", args: [id] },
      { sql: "DELETE FROM site_team_members WHERE id = ?", args: [id] },
    ],
    "write",
  );
  const leftover = await db().execute({ sql: "SELECT id FROM site_team_members WHERE id = ?", args: [id] });
  return leftover.rows.length === 0;
}

export async function saveSiteTeamPhoto(id: string, mime: "image/webp" | "image/jpeg", bytes: Uint8Array): Promise<SiteTeamMember | null> {
  await ready();
  const exists = await db().execute({ sql: "SELECT id FROM site_team_members WHERE id = ?", args: [id] });
  if (!exists.rows[0]) return null;
  await db().batch(
    [
      {
        sql: `INSERT INTO site_team_photos (member_id, mime, bytes, updated_at)
              VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
              ON CONFLICT(member_id) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
        args: [id, mime, bytes],
      },
      {
        sql: `UPDATE site_team_members SET has_photo_blob = 1, photo = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
        args: [id],
      },
    ],
    "write",
  );
  return getSiteTeamMember(id);
}

export async function clearSiteTeamPhoto(id: string): Promise<SiteTeamMember | null> {
  await ready();
  await db().batch(
    [
      { sql: "DELETE FROM site_team_photos WHERE member_id = ?", args: [id] },
      { sql: `UPDATE site_team_members SET has_photo_blob = 0, photo = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, args: [id] },
    ],
    "write",
  );
  return getSiteTeamMember(id);
}

export function asPhotoBytes(value: unknown): Uint8Array | null {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === "string") return new Uint8Array(Buffer.from(value, "base64"));
  if (Array.isArray(value) && value.every((n) => typeof n === "number")) return Uint8Array.from(value);
  return null;
}

export async function getSiteTeamPhoto(id: string): Promise<{ mime: string; bytes: Uint8Array; updatedAt: string } | null> {
  if (!dbConfigured) return null;
  try {
    await ensureSiteTeamSchema();
    const result = await db().execute({
      sql: "SELECT mime, bytes, updated_at FROM site_team_photos WHERE member_id = ?",
      args: [id],
    });
    const row = result.rows[0];
    if (!row) return null;
    const bytes = asPhotoBytes(row.bytes);
    if (!bytes?.length) return null;
    const mime = String(row.mime);
    if (mime !== "image/webp" && mime !== "image/jpeg") return null;
    return { mime, bytes, updatedAt: String(row.updated_at ?? "") };
  } catch {
    return null;
  }
}

/** Bust the public team cache and the pages that show it. */
export function revalidateSiteTeam(): void {
  updateTag(SITE_TEAM_TAG);
  for (const lang of locales) {
    revalidatePath(localize("/team", lang));
    revalidatePath(localize("/", lang), "layout");
  }
  revalidatePath(SITE_TEAM_ADMIN);
}
