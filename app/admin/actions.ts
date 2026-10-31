"use server";

import { put } from "@vercel/blob";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getAdmin, login, logout } from "@/lib/admin";
import { db } from "@/lib/db";
import { POSTS_TAG } from "@/lib/journal";
import { CATEGORIES, slugify, type Category } from "@/lib/journal-types";

export type FormState = { error?: string; ok?: string };

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 500);
  if (!email || !password) return { error: "Inserisci email e password." };
  const result = await login(email, password);
  if (result === "unconfigured") return { error: "Accesso non configurato sul server." };
  if (result === "locked") return { error: "Troppi tentativi. Riprova tra 15 minuti." };
  if (result === "invalid") return { error: "Credenziali non valide." };
  redirect("/admin");
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
  if (!admin) return { error: "Sessione scaduta o non autorizzata. Accedi di nuovo." };

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
    if (id) {
      const res = await db().execute({
        sql: `UPDATE posts SET title = :title, slug = :slug, lang = :lang, category = :category, published = :published,
              excerpt = :excerpt, body_md = :body_md, cover_url = :cover_url, cover_alt = :cover_alt, published_at = :published_at,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = :id`,
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
  updateTag(POSTS_TAG);
  if (!id) redirect(`/admin/edit?id=${newId}`);
  return { ok: status === "published" ? "Salvato e pubblicato." : "Bozza salvata." };
}

export async function deletePost(form: FormData) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  const id = String(form.get("id") ?? "").slice(0, 64);
  if (id) {
    await db().execute({ sql: "DELETE FROM posts WHERE id = ?", args: [id] });
    updateTag(POSTS_TAG);
  }
  redirect("/admin");
}

const MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export async function uploadCover(form: FormData): Promise<{ url?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin) return { error: "Non autorizzato." };
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
