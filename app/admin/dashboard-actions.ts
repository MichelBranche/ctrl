"use server";

import { del } from "@vercel/blob";
import { revalidatePath, updateTag } from "next/cache";
import { changePassword, getAdmin, guardSection } from "@/lib/admin";
import { canAccess } from "@/lib/team-types";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { SETTINGS_TAG, SOCIAL_HOSTS, SOCIAL_KEYS, writeSettings } from "@/lib/settings";

export type ActionState = { ok?: string; error?: string };

const ID = /^[0-9a-f-]{36}$/i;
const idOf = (form: FormData) => {
  const id = String(form.get("id") ?? "");
  return ID.test(id) ? id : null;
};

const guard = guardSection;

const STATUSES = ["nuovo", "risposto", "chiuso"] as const;

export async function setRequestStatus(form: FormData) {
  await guard("requests");
  const id = idOf(form);
  const status = String(form.get("status"));
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) return;
  await db().execute({ sql: "UPDATE contact_requests SET status = ?, updated_at = ? WHERE id = ?", args: [status, new Date().toISOString(), id] });
  await logAction("requests.status", { type: "request", id }, { status });
  revalidatePath("/admin/requests");
}

export async function deleteRequest(form: FormData) {
  await guard("requests");
  const id = idOf(form);
  if (!id) return;
  await db().execute({ sql: "DELETE FROM contact_requests WHERE id = ?", args: [id] });
  await logAction("requests.delete", { type: "request", id });
  revalidatePath("/admin/requests");
}

/** Activate (clear unsubscribed_at) or deactivate (stamp it) a subscriber. Admin session required. */
export async function setSubscriberActive(id: string, active: boolean): Promise<{ ok: boolean }> {
  await guard("newsletter");
  if (!ID.test(id)) return { ok: false };
  const res = await db().execute({
    sql: active
      ? "UPDATE subscribers SET unsubscribed_at = NULL WHERE id = ?"
      : "UPDATE subscribers SET unsubscribed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND unsubscribed_at IS NULL",
    args: [id],
  });
  await logAction("newsletter.subscriber", { type: "subscriber", id }, { active });
  revalidatePath("/admin/newsletter");
  return { ok: res.rowsAffected > 0 || active };
}

export async function removeSubscriber(form: FormData) {
  await guard("newsletter");
  const id = idOf(form);
  if (!id) return;
  await db().execute({ sql: "DELETE FROM subscribers WHERE id = ?", args: [id] });
  await logAction("newsletter.subscriber_delete", { type: "subscriber", id });
  revalidatePath("/admin/newsletter");
}

/** Deletes a cover from Vercel Blob. Only URLs under our covers/ prefix on the Blob host are accepted. */
export async function deleteMedia(form: FormData): Promise<ActionState> {
  await guard("media");
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
  await logAction("media.delete", { type: "media", id: u.pathname });
  revalidatePath("/admin/media");
  return { ok: "Immagine eliminata." };
}

export async function saveSocial(_: ActionState, form: FormData): Promise<ActionState> {
  await guard("social");
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
  await logAction("settings.social");
  updateTag(SETTINGS_TAG);
  return { ok: "Profili salvati. Il footer del sito è aggiornato." };
}

const PW_MSG = {
  ok: "Password aggiornata. Le altre sessioni aperte sono state chiuse.",
  wrong: "La password attuale non è corretta.",
  weak: "La nuova password deve avere almeno 12 caratteri.",
  mismatch: "Le due password nuove non coincidono.",
  locked: "Troppi tentativi. Riprova tra 15 minuti.",
} as const;

export async function updatePassword(_: ActionState, form: FormData): Promise<ActionState> {
  await guard("settings");
  const r = await changePassword(String(form.get("current") ?? ""), String(form.get("next") ?? ""), String(form.get("confirm") ?? ""));
  return r === "ok" ? { ok: PW_MSG.ok } : { error: PW_MSG[r] };
}

export type SearchHit = { label: string; hint: string; href: string };

/** Cmd-K server search across posts, requests and subscribers. */
export async function adminSearch(q: string): Promise<SearchHit[]> {
  const me = await getAdmin();
  if (!me) throw new Error("unauthorized");
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
    ...(canAccess(me, "journal") ? posts.rows : []).map((r) => ({ label: String(r.title), hint: `Articolo ${String(r.lang).toUpperCase()}`, href: `/admin/edit?id=${r.id}` })),
    ...(canAccess(me, "requests") ? reqs.rows : []).map((r) => ({ label: String(r.name), hint: `Richiesta · ${r.email}`, href: `/admin/requests?open=${r.id}` })),
    ...(canAccess(me, "newsletter") ? subs.rows : []).map((r) => ({ label: String(r.email), hint: "Iscritto newsletter", href: `/admin/newsletter?q=${encodeURIComponent(String(r.email))}` })),
  ];
}
