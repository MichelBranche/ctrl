import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db, dbConfigured } from "@/lib/db";

export const SETTINGS_TAG = "settings";

export { SOCIAL_KEYS, SOCIAL_LABEL, SOCIAL_HOSTS, type SocialKey, type SocialLink } from "@/lib/settings-types";
import { SOCIAL_KEYS, SOCIAL_LABEL, type SocialLink } from "@/lib/settings-types";

export async function readSettings(keys: string[]): Promise<Record<string, string>> {
  if (!dbConfigured || !keys.length) return {};
  const res = await db().execute({
    sql: `SELECT key, value FROM settings WHERE key IN (${keys.map(() => "?").join(",")})`,
    args: keys,
  });
  return Object.fromEntries(res.rows.map((r) => [String(r.key), String(r.value)]));
}

export async function writeSettings(values: Record<string, string>) {
  const stmts = Object.entries(values).map(([key, value]) =>
    value
      ? {
          sql: `INSERT INTO settings (key, value) VALUES (?1, ?2)
                ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
          args: [key, value],
        }
      : { sql: "DELETE FROM settings WHERE key = ?", args: [key] },
  );
  if (stmts.length) await db().batch(stmts, "write");
}

/** Social profiles shown in the site footer and contact page. Cached; the dashboard calls updateTag(SETTINGS_TAG). Empty ones are left out. */
export async function getSocialLinks(): Promise<SocialLink[]> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 * 7 });
  try {
    const s = await readSettings(SOCIAL_KEYS.map((k) => `social.${k}`));
    return SOCIAL_KEYS.filter((k) => s[`social.${k}`]).map((k) => ({ key: k, label: SOCIAL_LABEL[k], url: s[`social.${k}`] }));
  } catch (error) {
    console.error("[settings] socials failed:", error instanceof Error ? error.message : error);
    return [];
  }
}
