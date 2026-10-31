"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { deletePost, savePost, uploadCover, type FormState } from "@/app/admin/actions";
import { PostBody } from "@/components/journal/markdown";
import { CATEGORIES, CATEGORY_LABEL, slugify, type Post } from "@/lib/journal-types";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/** Downscale to 2400px and re-encode as WebP in the browser, so uploads stay well under Vercel's 4.5 MB request cap. */
async function compress(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

export function PostEditor({ post }: { post: Post | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePost, {});
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [body, setBody] = useState(post?.body_md ?? "");
  const [cover, setCover] = useState(post?.cover_url ?? "");
  const [published, setPublished] = useState(post?.status === "published");
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, startUpload] = useTransition();
  const [date, setDate] = useState(() => toLocalInput(post?.published_at ?? new Date().toISOString()));
  const isoDate = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setUploadMsg("Caricamento…");
    startUpload(async () => {
      const fd = new FormData();
      fd.set("file", await compress(file));
      const res = await uploadCover(fd);
      if (res.url) {
        setCover(res.url);
        setUploadMsg("Copertina caricata.");
      } else setUploadMsg(res.error ?? "Errore.");
    });
  };

  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <Link href="/admin" className="adm-link adm-back">← Articoli</Link>
          <h1 className="adm-h1">{post ? "Modifica articolo" : "Nuovo articolo"}</h1>
        </div>
        {post ? (
          <form
            action={deletePost}
            onSubmit={(e) => {
              if (!confirm("Eliminare definitivamente questo articolo?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={post.id} />
            <button className="adm-btn adm-btn-danger">Elimina</button>
          </form>
        ) : null}
      </header>

      <form action={action} className="adm-editor" onSubmit={() => isoDate.current && (isoDate.current.value = new Date(date).toISOString())}>
        {post ? <input type="hidden" name="id" value={post.id} /> : null}
        <input type="hidden" name="published_at" ref={isoDate} defaultValue={post?.published_at ?? ""} />
        <input type="hidden" name="cover_url" value={cover} />
        <input type="hidden" name="status" value={published ? "published" : "draft"} />

        <div className="adm-grid">
          <label className="adm-field adm-span">
            <span>Titolo</span>
            <input
              name="title"
              value={title}
              maxLength={200}
              required
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </label>
          <label className="adm-field">
            <span>Slug (URL)</span>
            <input
              name="slug"
              value={slug}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </label>
          <label className="adm-field">
            <span>Lingua</span>
            <select name="lang" defaultValue={post?.lang ?? "it"}>
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="adm-field">
            <span>Categoria</span>
            <select name="category" defaultValue={post?.category ?? "design"}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL.it[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="adm-field">
            <span>Data di pubblicazione</span>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="adm-field adm-span">
            <span>Estratto</span>
            <textarea name="excerpt" rows={2} maxLength={400} defaultValue={post?.excerpt ?? ""} />
          </label>
          <div className="adm-field adm-span">
            <span>Copertina</span>
            <div className="adm-cover">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded file
                <img src={cover} alt="" />
              ) : (
                <div className="adm-cover-ph">Nessuna immagine</div>
              )}
              <div className="adm-cover-ctl">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => onFile(e.target.files?.[0])} disabled={uploading} aria-label="Carica copertina" />
                {cover ? (
                  <button type="button" className="adm-btn" onClick={() => setCover("")}>
                    Rimuovi
                  </button>
                ) : null}
                <input name="cover_alt" placeholder="Testo alternativo (descrizione immagine)" defaultValue={post?.cover_alt ?? ""} maxLength={200} aria-label="Testo alternativo copertina" />
                {uploadMsg ? <p className="adm-muted" role="status">{uploadMsg}</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="adm-md">
          <label className="adm-field">
            <span>Testo (Markdown)</span>
            <textarea name="body_md" value={body} onChange={(e) => setBody(e.target.value)} rows={24} spellCheck />
          </label>
          <div className="adm-field">
            <span>Anteprima</span>
            <div className="adm-preview j-root">
              <PostBody source={body || "_L'anteprima appare qui._"} />
            </div>
          </div>
        </div>

        <footer className="adm-bar">
          <label className="adm-toggle">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            <span>{published ? "Pubblicato" : "Bozza"}</span>
          </label>
          {state.error ? <p className="adm-error" role="alert">{state.error}</p> : null}
          {state.ok ? <p className="adm-ok" role="status">{state.ok}</p> : null}
          <button className="adm-btn adm-btn-primary" disabled={pending || uploading}>
            {pending ? "Salvataggio…" : "Salva"}
          </button>
        </footer>
      </form>
    </main>
  );
}
