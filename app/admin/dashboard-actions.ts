"use server";

import { del } from "@vercel/blob";
import { revalidatePath, updateTag } from "next/cache";
import { changePassword, getAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { SETTINGS_TAG, SOCIAL_HOSTS, SOCIAL_KEYS, writeSettings } from "@/lib/settings";

export type ActionState = { ok?: string; error?: string };

const ID = /^[0-9a-f-]{36}$/i;
const idOf = (form: FormData) => {
  const id = String(form.get("id") ?? "");
  return ID.test(id) ? id : null;
};

async function guard() {
  if (!(await getAdmin())) throw new Error("unauthorized");
}

const STATUSES = ["nuovo", "risposto", "chiuso"] as const;

export async function setRequestStatus(form: FormData) {
  await guard();
  const id = idOf(form);
  const status = String(form.get("status"));
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) return;
  await db().execute({ sql: "UPDATE contact_requests SET status = ?, updated_at = ? WHERE id = ?", args: [status, new Date().toISOString(), id] });
  revalidatePath("/admin/requests");
}

export async function deleteRequest(form: FormData) {
  await guard();
  const id = idOf(form);
  if (!id) return;
  await db().execute({ sql: "DELETE FROM contact_requests WHERE id = ?", args: [id] });
  revalidatePath("/admin/requests");
}

export async function removeSubscriber(form: FormData) {
  await guard();
  const id = idOf(form);
  if (!id) return;
  await db().execute({ sql: "DELETE FROM subscribers WHERE id = ?", args: [id] });
  revalidatePath("/admin/newsletter");
}

/** Deletes a cover from Vercel Blob. Only URLs under our covers/ prefix on the Blob host are accepted. */
export async function deleteMedia(form: FormData): Promise<ActionState> {
  await guard();
  const url = String(form.get("url") ?? "");
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { error: "URL non valido." };
  }
  if (!u.hostname.endsWith(".public.blob.vercel-storage.com") || !u.pathname.startsWith("/covers/")) return { error: "URL non valido." };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { error: "Storage non configurato." };
  try {
    await del(url);
  } catch {
    return { error: "Eliminazione non riuscita." };
  }
  revalidatePath("/admin/media");
  return { ok: "Immagine eliminata." };
}

export async function saveSocial(_: ActionState, form: FormData): Promise<ActionState> {
  await guard();
  const values: Record<string, string> = {};
  for (const key of SOCIAL_KEYS) {
    const raw = String(form.get(key) ?? "").trim();
    if (!raw) {
      values[`social.${key}`] = "";
      continue;
    }
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return { error: `URL non valido per ${key}.` };
    }
    const host = u.hostname.replace(/^www\./, "");
    if (u.protocol !== "https:" || !SOCIAL_HOSTS[key].some((h) => host === h || host.endsWith(`.${h}`))) {
      return { error: `L'URL di ${key} deve essere https su ${SOCIAL_HOSTS[key].join(" o ")}.` };
    }
    values[`social.${key}`] = u.toString();
  }
  await writeSettings(values);
  updateTag(SETTINGS_TAG);
  return { ok: "Profili salvati. Il footer del sito è aggiornato." };
}

const PW_MSG = {
  ok: "Password aggiornata. Vale dal prossimo accesso.",
  wrong: "La password attuale non è corretta.",
  weak: "La nuova password deve avere almeno 12 caratteri.",
  mismatch: "Le due password nuove non coincidono.",
  locked: "Troppi tentativi. Riprova tra 15 minuti.",
} as const;

export async function updatePassword(_: ActionState, form: FormData): Promise<ActionState> {
  await guard();
  const r = await changePassword(String(form.get("current") ?? ""), String(form.get("next") ?? ""), String(form.get("confirm") ?? ""));
  return r === "ok" ? { ok: PW_MSG.ok } : { error: PW_MSG[r] };
}

export type SearchHit = { label: string; hint: string; href: string };

/** Cmd-K server search across posts, requests and subscribers. */
export async function adminSearch(q: string): Promise<SearchHit[]> {
  await guard();
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  const like = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const [posts, reqs, subs] = await db().batch(
    [
      { sql: "SELECT id, title, lang FROM posts WHERE title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 6", args: [like, like] },
      { sql: "SELECT id, name, email FROM contact_requests WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR subject LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 5", args: [like, like, like] },
      { sql: "SELECT id, email FROM subscribers WHERE email LIKE ? ESCAPE '\\' LIMIT 5", args: [like] },
    ],
    "read",
  );
  return [
    ...posts.rows.map((r) => ({ label: String(r.title), hint: `Articolo ${String(r.lang).toUpperCase()}`, href: `/admin/edit?id=${r.id}` })),
    ...reqs.rows.map((r) => ({ label: String(r.name), hint: `Richiesta · ${r.email}`, href: `/admin/requests?open=${r.id}` })),
    ...subs.rows.map((r) => ({ label: String(r.email), hint: "Iscritto newsletter", href: `/admin/newsletter?q=${encodeURIComponent(String(r.email))}` })),
  ];
}
