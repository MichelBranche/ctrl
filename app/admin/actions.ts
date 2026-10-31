"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { adminEmails, getAdmin } from "@/lib/admin";
import { POSTS_TAG } from "@/lib/journal";
import { CATEGORIES, slugify, type Category } from "@/lib/journal-types";
import { COVERS_BUCKET, supabaseConfigured } from "@/lib/supabase/config";
import { sessionClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: "Supabase non configurato (variabili d'ambiente mancanti)." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Inserisci email e password." };
  const supabase = await sessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Credenziali non valide." };
  if (!adminEmails().includes(email)) {
    await supabase.auth.signOut();
    return { error: "Questo account non è abilitato all'area admin." };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await sessionClient();
  await supabase.auth.signOut();
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
  if (coverUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(coverUrl) && !coverUrl.startsWith("/images/")) {
    return { error: "URL della copertina non valido." };
  }

  const row = {
    title,
    slug,
    lang,
    category,
    status,
    excerpt: str(form, "excerpt", 400),
    body_md: String(form.get("body_md") ?? "").slice(0, 200_000),
    cover_url: coverUrl || null,
    cover_alt: str(form, "cover_alt", 200),
    published_at: date.toISOString(),
  };

  const q = id ? admin.supabase.from("posts").update(row).eq("id", id).select("id").single() : admin.supabase.from("posts").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) {
    if (error.code === "23505") return { error: "Esiste già un articolo con questo slug in questa lingua." };
    return { error: `Salvataggio non riuscito: ${error.message}` };
  }
  updateTag(POSTS_TAG);
  if (!id) redirect(`/admin/edit?id=${data.id}`);
  return { ok: status === "published" ? "Salvato e pubblicato." : "Bozza salvata." };
}

export async function deletePost(form: FormData) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  const id = String(form.get("id") ?? "");
  if (id) {
    await admin.supabase.from("posts").delete().eq("id", id);
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
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.supabase.storage.from(COVERS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: `Upload non riuscito: ${error.message}` };
  return { url: admin.supabase.storage.from(COVERS_BUCKET).getPublicUrl(path).data.publicUrl };
}
