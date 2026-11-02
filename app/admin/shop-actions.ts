"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath, updateTag } from "next/cache";
import { getAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { ensureShopSchema } from "@/lib/migrate";
import { SHOP_PRODUCT_TAG } from "@/lib/shop";
import { isOrderStatus, isShopCategory, parseDetails, textToBenefits, textToLines, type ShopDetails } from "@/lib/shop-data";
import { translateTexts, translationConfigured } from "@/lib/translate";

export type ShopActionState = { ok?: string; error?: string; warning?: string; slug?: string };

async function guard() {
  if (!(await getAdmin())) throw new Error("unauthorized");
}

// Must match next.config.ts images.remotePatterns, otherwise next/image throws and the product page crashes.
function isShopImageUrl(url: string) {
  if (/^\/images\/shop\/[\w.-]+$/.test(url)) return true;
  return isBlobShopUrl(url);
}
function isBlobShopUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith("/shop/");
  } catch { return false; }
}

/** Best effort: product images we uploaded to Blob; static /images/shop files are never touched. */
async function deleteBlobs(urls: string[]) {
  const blobs = urls.filter(isBlobShopUrl);
  if (!blobs.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try { await del(blobs); } catch (error) { console.error("[admin] shop blob delete failed:", error instanceof Error ? error.message : error); }
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

/** Removes an image uploaded in this editing session that was never saved (cancelled upload). Saved images are deleted on save. */
export async function discardShopImage(url: string): Promise<void> {
  await guard();
  if (!isBlobShopUrl(url)) return;
  await ensureShopSchema();
  const used = await db().execute({ sql: "SELECT 1 FROM shop_products WHERE images_json LIKE ? LIMIT 1", args: [`%${url.replace(/[%_]/g, "")}%`] });
  if (!used.rows.length) await deleteBlobs([url]);
}

const RESERVED = new Set(["_", "checkout", "cart", "new"]);
const shopSlug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function detailsFrom(form: FormData, lang: "it" | "en"): ShopDetails {
  // Round-trip through parseDetails to apply the same length/count limits as on read.
  return parseDetails(JSON.stringify({ [lang]: {
    label: text(form, `label_${lang}`), heading: text(form, `heading_${lang}`),
    benefits: textToBenefits(text(form, `benefits_${lang}`)), highlights: textToLines(text(form, `highlights_${lang}`)),
  } }))[lang];
}

type EnFields = { title: string; description: string; details: ShopDetails };
const sameEn = (a: EnFields, b: EnFields) => JSON.stringify(a) === JSON.stringify(b);

async function translateEnglish(it: { title: string; description: string; details: ShopDetails }): Promise<EnFields> {
  const d = it.details;
  const flat = [it.title, it.description, d.label, d.heading, ...d.benefits.flat(), ...d.highlights];
  const out = await translateTexts(flat);
  let i = 4;
  const benefits = d.benefits.map((): [string, string] => [out[i++], out[i++]]);
  const highlights = d.highlights.map(() => out[i++]);
  return { title: out[0], description: out[1], details: { label: out[2], heading: out[3], benefits, highlights } };
}

export async function saveShopProduct(_: ShopActionState, form: FormData): Promise<ShopActionState> {
  await guard();
  await ensureShopSchema();
  const id = text(form, "id");
  const existing = id ? (await db().execute({ sql: "SELECT * FROM shop_products WHERE id = ?", args: [id] })).rows[0] : undefined;
  if (id && !existing) return { error: "Prodotto non trovato. Ricarica la pagina." };

  const titleIt = text(form, "titleIt");
  const descriptionIt = text(form, "descriptionIt");
  const slug = shopSlug(text(form, "slug") || titleIt);
  const category = text(form, "category");
  const price = Number(text(form, "price").replace(",", "."));
  if (!titleIt || !descriptionIt) return { error: "Completa titolo e descrizione in italiano." };
  if (!slug || RESERVED.has(slug)) return { error: "Scegli un URL valido per il prodotto." };
  if (!isShopCategory(category)) return { error: "Categoria non valida." };
  const enInput: EnFields = { title: text(form, "titleEn"), description: text(form, "descriptionEn"), details: detailsFrom(form, "en") };
  const detailsIt = detailsFrom(form, "it");
  if ([titleIt, enInput.title].some((s) => s.length > 100) || [descriptionIt, enInput.description].some((s) => s.length > 1000)) return { error: "Titoli o descrizioni troppo lunghi." };
  if (!Number.isFinite(price) || price < 0.01 || price > 99999) return { error: "Inserisci un prezzo valido." };
  let images: unknown;
  try { images = JSON.parse(String(form.get("images") ?? "[]")); } catch { return { error: "Elenco immagini non valido." }; }
  if (!Array.isArray(images) || images.length < 1 || images.length > 6 || images.some((url) => typeof url !== "string" || !isShopImageUrl(url))) return { error: "Carica almeno un’immagine valida (massimo 6)." };
  const supplierName = text(form, "supplierName").slice(0, 120);
  const supplierSku = text(form, "supplierSku").slice(0, 120);
  const supplierProductUrl = text(form, "supplierProductUrl").slice(0, 500);
  const supplierCostRaw = text(form, "supplierCost").replace(",", ".");
  const supplierCost = supplierCostRaw ? Number(supplierCostRaw) : null;
  if (supplierCost !== null && (!Number.isFinite(supplierCost) || supplierCost < 0 || supplierCost > 99999)) return { error: "Costo fornitore non valido." };
  if (supplierProductUrl && !/^https?:\/\/\S+$/i.test(supplierProductUrl)) return { error: "Il link del fornitore deve iniziare con https://." };

  const clash = await db().execute({ sql: "SELECT 1 FROM shop_products WHERE slug = ? AND id <> ?", args: [slug, id] });
  if (clash.rows.length) return { error: "Esiste già un prodotto con questo URL." };

  // English: kept in sync by DeepL unless edited by hand (same rule as journal posts).
  const storedEn: EnFields | null = existing
    ? { title: String(existing.title_en), description: String(existing.description_en), details: parseDetails(existing.details_json).en }
    : null;
  const editedByHand = storedEn ? !sameEn(enInput, storedEn) : Boolean(enInput.title || enInput.description);
  const force = form.get("retranslate") === "1";
  let en = enInput;
  let enAuto = existing ? Number(existing.en_auto) === 1 : !editedByHand;
  let warning: string | undefined;
  const itChanged = !existing || titleIt !== String(existing.title_it) || descriptionIt !== String(existing.description_it)
    || JSON.stringify(detailsIt) !== JSON.stringify(parseDetails(existing.details_json).it);
  if (force || (!editedByHand && enAuto && itChanged)) {
    try {
      en = await translateEnglish({ title: titleIt, description: descriptionIt, details: detailsIt });
      enAuto = true;
    } catch (error) {
      console.error("[admin] shop translation failed:", error instanceof Error ? error.message : error);
      warning = translationConfigured() ? "Traduzione inglese non riuscita: riprova con “Ritraduci in inglese”." : "DeepL non configurato: l’inglese non è stato tradotto.";
    }
  } else if (editedByHand) enAuto = false;
  if (!en.title || !en.description) {
    if (warning) en = { title: en.title || titleIt, description: en.description || descriptionIt, details: en.details };
    else return { error: "Completa titolo e descrizione in inglese." };
  }

  const args = [slug, category, titleIt, en.title.slice(0, 100), descriptionIt, en.description.slice(0, 1000), price.toFixed(2), JSON.stringify(images),
    form.get("published") === "on" ? 1 : 0, JSON.stringify({ it: detailsIt, en: en.details }), enAuto ? 1 : 0,
    supplierName || null, supplierProductUrl || null, supplierSku || null, supplierCost === null ? null : supplierCost.toFixed(2)];
  try {
    if (existing) {
      await db().execute({ sql: `UPDATE shop_products SET slug = ?, category = ?, title_it = ?, title_en = ?, description_it = ?, description_en = ?, price = ?, images_json = ?,
        published = ?, details_json = ?, en_auto = ?, supplier_name = ?, supplier_product_url = ?, supplier_sku = ?, supplier_cost = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, args: [...args, id] });
    } else {
      const next = await db().execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM shop_products");
      await db().execute({ sql: `INSERT INTO shop_products (slug, category, title_it, title_en, description_it, description_en, price, images_json, published, details_json, en_auto,
        supplier_name, supplier_product_url, supplier_sku, supplier_cost, id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [...args, crypto.randomUUID(), Number(next.rows[0]?.next_order ?? 0)] });
    }
  } catch (error) {
    if (/UNIQUE/i.test(error instanceof Error ? error.message : "")) return { error: "Esiste già un prodotto con questo URL." };
    return { error: "Non è stato possibile salvare il prodotto." };
  }

  if (existing) {
    let before: unknown = [];
    try { before = JSON.parse(String(existing.images_json)); } catch { before = []; }
    if (Array.isArray(before)) await deleteBlobs(before.filter((u): u is string => typeof u === "string" && !(images as string[]).includes(u)));
  }
  const oldSlug = existing ? String(existing.slug) : slug;
  refresh([slug, oldSlug]);
  return { ok: existing ? "Prodotto aggiornato." : "Prodotto aggiunto.", warning, slug };
}

export async function deleteShopProduct(id: string): Promise<ShopActionState> {
  await guard();
  if (!id || id.length > 64) return { error: "Prodotto non valido." };
  await ensureShopSchema();
  const row = (await db().execute({ sql: "SELECT slug, images_json FROM shop_products WHERE id = ?", args: [id] })).rows[0];
  if (!row) return { error: "Prodotto non trovato." };
  await db().execute({ sql: "DELETE FROM shop_products WHERE id = ?", args: [id] });
  let images: unknown = [];
  try { images = JSON.parse(String(row.images_json)); } catch { images = []; }
  if (Array.isArray(images)) await deleteBlobs(images.filter((u): u is string => typeof u === "string"));
  refresh([String(row.slug)]);
  return { ok: "Prodotto eliminato." };
}

function refresh(slugs: string[]) {
  updateTag(SHOP_PRODUCT_TAG);
  for (const p of ["/shop", "/en/shop", "/admin/shop", "/sitemap.xml"]) revalidatePath(p);
  for (const s of new Set(slugs)) { revalidatePath(`/shop/${s}`); revalidatePath(`/en/shop/${s}`); }
}

/* Orders and quick product toggles. Every action re-checks the admin session; all SQL is parameterized. */

const STATUS_COLUMN: Record<string, string> = { confermata: "confirmed_at", ordinata: "ordered_at", spedita: "shipped_at", consegnata: "delivered_at", annullata: "cancelled_at" };

export async function setOrderStatus(id: string, status: string): Promise<{ ok: boolean; at?: string }> {
  await guard();
  if (typeof id !== "string" || id.length > 64 || !isOrderStatus(status)) return { ok: false };
  await ensureShopSchema();
  const at = new Date().toISOString();
  const col = STATUS_COLUMN[status];
  // The column name comes from the fixed map above, never from input. The first time a status is reached is kept.
  const res = await db().execute({
    sql: `UPDATE shop_orders SET status = ?, updated_at = ?${col ? `, ${col} = COALESCE(${col}, ?)` : ""} WHERE id = ?`,
    args: col ? [status, at, at, id] : [status, at, id],
  });
  revalidatePath("/admin/shop");
  return { ok: res.rowsAffected > 0, at };
}

export async function updateOrderFulfilment(id: string, input: { trackingNumber: string; trackingUrl: string; notes: string }): Promise<{ ok: boolean; error?: string }> {
  await guard();
  if (typeof id !== "string" || id.length > 64 || !input || typeof input !== "object") return { ok: false, error: "Ordine non valido." };
  const trackingNumber = String(input.trackingNumber ?? "").trim().slice(0, 120);
  const trackingUrl = String(input.trackingUrl ?? "").trim().slice(0, 500);
  const notes = String(input.notes ?? "").trim().slice(0, 4000);
  if (trackingUrl && !/^https?:\/\/\S+$/i.test(trackingUrl)) return { ok: false, error: "Il link di tracking deve iniziare con https://." };
  await ensureShopSchema();
  const res = await db().execute({
    sql: "UPDATE shop_orders SET tracking_number = ?, tracking_url = ?, notes = ?, updated_at = ? WHERE id = ?",
    args: [trackingNumber || null, trackingUrl || null, notes || null, new Date().toISOString(), id],
  });
  revalidatePath("/admin/shop");
  return res.rowsAffected > 0 ? { ok: true } : { ok: false, error: "Ordine non trovato." };
}

export async function setProductPublished(id: string, published: boolean): Promise<{ ok: boolean }> {
  await guard();
  if (typeof id !== "string" || id.length > 64) return { ok: false };
  await ensureShopSchema();
  const row = (await db().execute({ sql: "SELECT slug FROM shop_products WHERE id = ?", args: [id] })).rows[0];
  if (!row) return { ok: false };
  await db().execute({ sql: "UPDATE shop_products SET published = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [published ? 1 : 0, id] });
  refresh([String(row.slug)]);
  return { ok: true };
}
