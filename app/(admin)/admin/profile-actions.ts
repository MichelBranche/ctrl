"use server";

import { revalidatePath } from "next/cache";
import { guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { getAdminCopy } from "@/lib/admin-locale";

export async function saveProfilePhoto(photo: string | null): Promise<{ error?: string; ok?: boolean }> {
  const { t } = await getAdminCopy();
  const me = await guardSection("settings");
  if (photo !== null) {
    if (typeof photo !== "string" || photo.length > 140_000 || !/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) return { error: t.auth.photoInvalid };
    const bytes = Buffer.from(photo.split(",")[1], "base64");
    const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (bytes.length > 100_000 || (photo.startsWith("data:image/webp") ? !webp : !jpeg)) return { error: t.auth.photoFormat };
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
  if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) return { error: t.auth.nameInvalid };
  if (lastName.length > 100 || /[\x00-\x1f\x7f]/.test(lastName)) return { error: t.auth.lastNameInvalid };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: t.auth.contactEmailInvalid };
  if (phone && (phone.length > 40 || !/^[+0-9().\s-]{3,40}$/.test(phone))) return { error: t.auth.phoneInvalid };
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
