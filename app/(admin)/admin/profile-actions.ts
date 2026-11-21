"use server";

import { revalidatePath } from "next/cache";
import { guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { getAdminCopy } from "@/lib/admin-locale";
import { photoError, profileFieldsError } from "@/lib/profile-validate";

export async function saveProfilePhoto(photo: string | null): Promise<{ error?: string; ok?: boolean }> {
  const { t } = await getAdminCopy();
  const me = await guardSection("settings");
  if (photo !== null) {
    const err = photoError(photo);
    if (err) return { error: t.auth[err] };
  }
  await db().execute({ sql: "UPDATE admin_users SET avatar_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [photo, me.id] });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/email");
  return { ok: true };
}

export async function saveProfile(_previous: { error?: string; ok?: string }, form: FormData): Promise<{ error?: string; ok?: string }> {
  const { t } = await getAdminCopy();
  const me = await guardSection("settings");
  const read = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const name = read("name"), lastName = read("lastName"), email = read("contactEmail"), phone = read("phone"), website = read("website");
  const fieldErr = profileFieldsError({ name, lastName, phone });
  if (fieldErr) return { error: t.auth[fieldErr] };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: t.auth.contactEmailInvalid };
  if (website) {
    try {
      const url = new URL(website);
      if (website.length > 500 || !["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch { return { error: t.auth.websiteInvalid }; }
  }
  try {
    await db().execute({ sql: "UPDATE admin_users SET name = ?, last_name = ?, contact_email = ?, phone = ?, website = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [name, lastName || null, email || null, phone || null, website || null, me.id] });
  } catch { return { error: t.auth.profileSaveFailed }; }
  await logAction("settings.profile", { type: "user", id: me.id }, undefined, me);
  revalidatePath("/admin", "layout");
  return { ok: t.auth.profileUpdated };
}
