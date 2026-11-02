"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath, updateTag } from "next/cache";
import { changePassword, getAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { SETTINGS_TAG, SOCIAL_HOSTS, SOCIAL_KEYS, writeSettings } from "@/lib/settings";
import { ensureShopSchema, SHOP_PRODUCT_TAG } from "@/lib/shop";

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

/** Activate (clear unsubscribed_at) or deactivate (stamp it) a subscriber. Admin session required. */
export async function setSubscriberActive(id: string, active: boolean): Promise<{ ok: boolean }> {
  await guard();
  if (!ID.test(id)) return { ok: false };
  const res = await db().execute({
    sql: active
      ? "UPDATE subscribers SET unsubscribed_at = NULL WHERE id = ?"
      : "UPDATE subscribers SET unsubscribed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND unsubscribed_at IS NULL",
    args: [id],
  });
  revalidatePath("/admin/newsletter");
  return { ok: res.rowsAffected > 0 || active };
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

export async function uploadShopImage(form: FormData): Promise<{ url?: string; error?: string }> {
  await guard();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Seleziona un’immagine." };
  const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
  const ext = types[file.type];
  if (!ext) return { error: "Formato non supportato. Usa JPG, PNG, WebP o AVIF." };
  if (file.size > 5 * 1024 * 1024) return { error: "L’immagine supera i 5 MB." };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { error: "Storage immagini non configurato." };
  try {
    const blob = await put(`shop/${crypto.randomUUID()}.${ext}`, file, { access: "public", contentType: file.type, addRandomSuffix: false });
    return { url: blob.url };
  } catch (error) {
    console.error("[admin] shop image upload failed:", error instanceof Error ? error.message : error);
    return { error: "Caricamento immagine non riuscito." };
  }
}

// Must match next.config.ts images.remotePatterns, otherwise next/image throws and the product page crashes.
function isShopImageUrl(url: string) {
  if (/^\/images\/shop\/[\w.-]+$/.test(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith("/shop/");
  } catch { return false; }
}

const shopSlug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || crypto.randomUUID().slice(0, 8);

export async function saveShopProduct(_: ActionState, form: FormData): Promise<ActionState> {
  await guard();
  await ensureShopSchema();
  const id = String(form.get("id") ?? "").trim();
  const slug = shopSlug(String(form.get("slug") || form.get("titleIt") || ""));
  const titleIt = String(form.get("titleIt") ?? "").trim();
  const titleEn = String(form.get("titleEn") ?? "").trim();
  const descriptionIt = String(form.get("descriptionIt") ?? "").trim();
  const descriptionEn = String(form.get("descriptionEn") ?? "").trim();
  const price = Number(String(form.get("price") ?? "").trim().replace(",", "."));
  if (!titleIt || !titleEn || !descriptionIt || !descriptionEn) return { error: "Completa titolo e descrizione in italiano e inglese." };
  if (titleIt.length > 100 || titleEn.length > 100 || descriptionIt.length > 1000 || descriptionEn.length > 1000) return { error: "Titoli o descrizioni troppo lunghi." };
  if (!Number.isFinite(price) || price < 0.01 || price > 99999) return { error: "Inserisci un prezzo valido." };
  let images: unknown;
  try { images = JSON.parse(String(form.get("images") ?? "[]")); } catch { return { error: "Elenco immagini non valido." }; }
  if (!Array.isArray(images) || images.length < 1 || images.length > 6 || images.some((url) => typeof url !== "string" || !isShopImageUrl(url))) return { error: "Carica almeno un’immagine valida (massimo 6)." };
  const args = [slug, titleIt, titleEn, descriptionIt, descriptionEn, price.toFixed(2), JSON.stringify(images), form.get("published") === "on" ? 1 : 0];
  try {
    if (id) {
      await db().execute({ sql: "UPDATE shop_products SET slug = ?, title_it = ?, title_en = ?, description_it = ?, description_en = ?, price = ?, images_json = ?, published = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [...args, id] });
    } else {
      const count = await db().execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM shop_products");
      await db().execute({ sql: "INSERT INTO shop_products (id, slug, title_it, title_en, description_it, description_en, price, images_json, published, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [crypto.randomUUID(), ...args, Number(count.rows[0]?.next_order ?? 0)] });
    }
  } catch (error) {
    if (/UNIQUE/i.test(error instanceof Error ? error.message : "")) return { error: "Esiste già un prodotto con questo URL." };
    return { error: "Non è stato possibile salvare il prodotto." };
  }
  updateTag(SHOP_PRODUCT_TAG);
  revalidatePath("/shop");
  revalidatePath("/en/shop");
  revalidatePath(`/shop/${slug}`);
  revalidatePath(`/en/shop/${slug}`);
  revalidatePath("/admin/shop");
  return { ok: "Prodotto aggiornato." };
}

export async function deleteShopProduct(id: string): Promise<ActionState> {
  await guard();
  if (!id || id.length > 64) return { error: "Prodotto non valido." };
  await ensureShopSchema();
  await db().execute({ sql: "DELETE FROM shop_products WHERE id = ?", args: [id] });
  updateTag(SHOP_PRODUCT_TAG);
  revalidatePath("/shop");
  revalidatePath("/en/shop");
  revalidatePath("/admin/shop");
  return { ok: "Prodotto eliminato." };
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
