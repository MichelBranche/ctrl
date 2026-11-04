"use server";

import { revalidatePath } from "next/cache";
import { guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";

export async function saveProfilePhoto(photo: string | null): Promise<{ error?: string; ok?: boolean }> {
  const me = await guardSection("settings");
  if (photo !== null) {
    if (typeof photo !== "string" || photo.length > 90_000 || !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) return { error: "Foto non valida." };
    const bytes = Buffer.from(photo.split(",")[1], "base64");
    if (bytes.length > 64_000 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return { error: "Formato della foto non valido." };
  }
  await db().execute({ sql: "UPDATE admin_users SET avatar_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [photo, me.id] });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/email");
  return { ok: true };
}

export async function saveProfile(_previous: { error?: string; ok?: string }, form: FormData): Promise<{ error?: string; ok?: string }> {
  const me = await guardSection("settings");
  const read = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const name = read("name"), email = read("contactEmail"), phone = read("phone"), website = read("website");
  if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) return { error: "Inserisci un nome valido, fino a 100 caratteri." };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "Inserisci un’email di contatto valida." };
  if (phone && (phone.length > 40 || !/^[+0-9().\s-]{3,40}$/.test(phone))) return { error: "Inserisci un numero di telefono valido." };
  if (website) {
    try {
      const url = new URL(website);
      if (website.length > 500 || !["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch { return { error: "Inserisci un link completo, che inizi con https:// o http://." }; }
  }
  try {
    await db().execute({ sql: "UPDATE admin_users SET name = ?, contact_email = ?, phone = ?, website = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [name, email || null, phone || null, website || null, me.id] });
  } catch { return { error: "Impossibile salvare il profilo. Riprova." }; }
  await logAction("settings.profile", { type: "user", id: me.id }, undefined, me);
  revalidatePath("/admin", "layout");
  return { ok: "Profilo aggiornato." };
}
