"use server";

import { put } from "@vercel/blob";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { confirmForcedSetup, finishForcedSetup, getAdmin, login, logout, startForcedSetup, verifySecondStep } from "@/lib/admin";
import { canAccess } from "@/lib/team-types";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { POSTS_TAG } from "@/lib/journal";
import { ensureTranslationSchema } from "@/lib/migrate";
import { translatePost, translationConfigured } from "@/lib/translate";
import { CATEGORIES, slugify, type Category } from "@/lib/journal-types";

export type FormState = { error?: string; ok?: string; warning?: string; twoFactor?: boolean; setup?: boolean };

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 500);
  if (!email || !password) return { error: "Inserisci email e password." };
  const result = await login(email, password);
  if (result === "unconfigured") return { error: "Accesso non configurato sul server." };
  if (result === "locked") return { error: "Troppi tentativi. Riprova tra 15 minuti." };
  if (result === "invalid") return { error: "Credenziali non valide." };
  // Same card switches to the code step; /admin/login/verifica serves a reload during those 5 minutes.
  if (result === "2fa") return { twoFactor: true };
  if (result === "setup") return { setup: true };
  redirect("/admin");
}

const SETUP_EXPIRED = "Configurazione scaduta (15 minuti). Torna all’accesso e inserisci di nuovo la password.";

/** Mandatory founder setup, step QR: needs the setup ticket set by signIn, never a session. */
export async function beginRequiredSetup(): Promise<{ error?: string; setup?: { secret: string; qrSvg: string } }> {
  const r = await startForcedSetup();
  return r === "expired" ? { error: SETUP_EXPIRED } : { setup: r };
}

export type RequiredSetupState = { error?: string; ok?: string; codes?: string[] };
export async function confirmRequiredSetup(_: RequiredSetupState, form: FormData): Promise<RequiredSetupState> {
  const r = await confirmForcedSetup(String(form.get("code") ?? ""));
  if (r === "expired") return { error: SETUP_EXPIRED };
  if (r === "locked") return { error: "Troppi tentativi. Riprova tra 15 minuti." };
  if (r === "invalid") return { error: "Codice non valido. Controlla che l’ora del telefono sia automatica e riprova." };
  return { codes: r.codes, ok: "Verifica attiva." };
}

export async function finishRequiredSetup(): Promise<{ error?: string; ok?: string }> {
  const r = await finishForcedSetup();
  if (r === "expired") return { error: SETUP_EXPIRED };
  if (r === "incomplete") return { error: "Prima conferma il codice dell’app." };
  return { ok: "Account protetto." };
}

export async function signInSecondStep(_: FormState, form: FormData): Promise<FormState> {
  const code = String(form.get("code") ?? "").trim().slice(0, 40);
  if (!code) return { error: "Inserisci il codice." };
  const result = await verifySecondStep(code);
  if (result === "expired") return { error: "Verifica scaduta (5 minuti). Torna all’accesso e inserisci di nuovo la password." };
  if (result === "locked") return { error: "Troppi tentativi. Riprova tra 15 minuti." };
  if (result === "invalid") return { error: "Codice non valido o già usato." };
  // The session cookie is set; the client shows the success animation and then opens /admin.
  return { ok: "Accesso verificato." };
}

export async function signOut() {
  await logout();
  redirect("/admin/login");
}

function str(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

export async function savePost(_: FormState, form: FormData): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin || !canAccess(admin, "journal")) return { error: "Sessione scaduta o non autorizzata. Accedi di nuovo." };

  const id = str(form, "id", 64);
  const title = str(form, "title", 200);
  const slug = slugify(str(form, "slug", 120) || title);
  const lang = str(form, "lang", 2) === "en" ? "en" : "it";
  const category = str(form, "category", 32) as Category;
  const status = str(form, "status", 16) === "published" ? "published" : "draft";
  const dateRaw = str(form, "published_at", 40);
  const date = dateRaw ? new Date(dateRaw) : new Date();

  if (!title) return { error: "Il titolo è obbligatorio." };
  if (!slug) return { error: "Lo slug non è valido." };
  if (!CATEGORIES.includes(category)) return { error: "Categoria non valida." };
  if (Number.isNaN(date.getTime())) return { error: "Data non valida." };

  const coverUrl = str(form, "cover_url", 500);
  if (coverUrl && !/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/covers\//i.test(coverUrl) && !coverUrl.startsWith("/images/")) {
    return { error: "URL della copertina non valido." };
  }

  const args = {
    title,
    slug,
    lang,
    category,
    published: status === "published" ? 1 : 0,
    excerpt: str(form, "excerpt", 400),
    body_md: String(form.get("body_md") ?? "").slice(0, 200_000),
    cover_url: coverUrl || null,
    cover_alt: str(form, "cover_alt", 200),
    published_at: date.toISOString(),
  };

  const newId = id || crypto.randomUUID();
  try {
    await ensureTranslationSchema();
    if (id) {
      const res = await db().execute({
        sql: `UPDATE posts SET title = :title, slug = :slug, lang = :lang, category = :category, published = :published,
              excerpt = :excerpt, body_md = :body_md, cover_url = :cover_url, cover_alt = :cover_alt, published_at = :published_at,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')${lang === "en" ? ", auto_translated = 0" : ""} WHERE id = :id`,
        args: { ...args, id },
      });
      if (!res.rowsAffected) return { error: "Articolo non trovato." };
    } else {
      await db().execute({
        sql: `INSERT INTO posts (id, title, slug, lang, category, published, excerpt, body_md, cover_url, cover_alt, published_at)
              VALUES (:id, :title, :slug, :lang, :category, :published, :excerpt, :body_md, :cover_url, :cover_alt, :published_at)`,
        args: { ...args, id: newId },
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/UNIQUE/i.test(msg)) return { error: "Esiste già un articolo con questo slug in questa lingua." };
    console.error("[admin] save failed:", msg);
    return { error: "Salvataggio non riuscito." };
  }
  await logAction("journal.post_save", { type: "post", id: newId }, { lang, status, created: !id });
  const warning = lang === "it" ? await syncEnglish(newId, args, form.get("retranslate") === "1") : undefined;
  updateTag(POSTS_TAG);
  if (!id) redirect(`/admin/edit?id=${newId}${warning ? `&tw=${encodeURIComponent(warning)}` : ""}`);
  return { ok: status === "published" ? "Salvato e pubblicato." : "Bozza salvata.", warning };
}

type SavedPost = { title: string; slug: string; category: string; published: number; excerpt: string; body_md: string; cover_url: string | null; cover_alt: string; published_at: string };

/**
 * Creates or refreshes the English twin of an Italian post (same slug, same status, linked by translation_of).
 * A twin edited by hand (auto_translated = 0) is left alone unless `force`. Returns a warning; never blocks the IT save.
 */
async function syncEnglish(itId: string, it: SavedPost, force: boolean): Promise<string | undefined> {
  try {
    const found = await db().execute({ sql: "SELECT id, auto_translated FROM posts WHERE lang = 'en' AND translation_of = ?", args: [itId] });
    const twin = found.rows[0];
    if (twin && Number(twin.auto_translated) !== 1 && !force) {
      // Hand-edited English: keep its text, only mirror the publish status.
      await db().execute({ sql: "UPDATE posts SET published = ? WHERE id = ?", args: [it.published, String(twin.id)] });
      return undefined;
    }
    if (!translationConfigured()) return "Traduzione inglese non creata: DEEPL_API_KEY non configurata.";
    const en = await translatePost(it);
    const row = { ...it, ...en, title: en.title.slice(0, 200), excerpt: en.excerpt.slice(0, 400), cover_alt: en.cover_alt.slice(0, 200) };
    if (twin) {
      await db().execute({
        sql: `UPDATE posts SET title = :title, slug = :slug, category = :category, published = :published, excerpt = :excerpt,
              body_md = :body_md, cover_url = :cover_url, cover_alt = :cover_alt, published_at = :published_at, auto_translated = 1,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = :id`,
        args: { ...row, id: String(twin.id) },
      });
    } else {
      await db().execute({
        sql: `INSERT INTO posts (id, title, slug, lang, category, published, excerpt, body_md, cover_url, cover_alt, published_at, translation_of, auto_translated)
              VALUES (:id, :title, :slug, 'en', :category, :published, :excerpt, :body_md, :cover_url, :cover_alt, :published_at, :of, 1)`,
        args: { ...row, id: crypto.randomUUID(), of: itId },
      });
    }
    return undefined;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[admin] translation failed:", msg.replace(/DeepL-Auth-Key\s+\S+/g, "[key]"));
    if (/UNIQUE/i.test(msg)) return "Traduzione inglese non salvata: esiste già un articolo inglese con questo slug, non collegato.";
    return "Articolo salvato, ma la traduzione inglese non è riuscita. Riprova con \"Ritraduci in inglese\".";
  }
}

export async function deletePost(form: FormData) {
  const admin = await getAdmin();
  if (!admin || !canAccess(admin, "journal")) redirect("/admin/login");
  const id = String(form.get("id") ?? "").slice(0, 64);
  if (id) {
    await db().execute({ sql: "DELETE FROM posts WHERE id = ?", args: [id] });
    // Auto-made English twins go with their source; hand-edited ones stay as standalone posts.
    await ensureTranslationSchema().then(() =>
      db().batch([
        { sql: "DELETE FROM posts WHERE translation_of = ? AND auto_translated = 1", args: [id] },
        { sql: "UPDATE posts SET translation_of = NULL WHERE translation_of = ?", args: [id] },
      ]),
    ).catch(() => {});
    await logAction("journal.post_delete", { type: "post", id });
    updateTag(POSTS_TAG);
  }
  redirect("/admin/journal");
}

const MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export async function uploadCover(form: FormData): Promise<{ url?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !canAccess(admin, "journal")) return { error: "Non autorizzato." };
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Nessun file." };
  const ext = MIME[file.type];
  if (!ext) return { error: "Formato non supportato (JPG, PNG, WebP, AVIF)." };
  if (file.size > 5 * 1024 * 1024) return { error: "Immagine oltre 5 MB." };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { error: "Storage immagini non configurato." };
  const path = `covers/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  try {
    const blob = await put(path, file, { access: "public", contentType: file.type, addRandomSuffix: false });
    return { url: blob.url };
  } catch (error) {
    console.error("[admin] upload failed:", error instanceof Error ? error.message : error);
    return { error: "Upload non riuscito." };
  }
}
