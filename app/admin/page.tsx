import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";
import { CATEGORY_LABEL, formatPostDate, type Post } from "@/lib/journal-types";

export default function AdminHome() {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true" />}>
      <PostList />
    </Suspense>
  );
}

async function PostList() {
  const { supabase, email } = await requireAdmin();
  const { data, error } = await supabase
    .from("posts")
    .select("id, slug, lang, title, category, status, published_at")
    .order("published_at", { ascending: false });
  const posts = (data ?? []) as Pick<Post, "id" | "slug" | "lang" | "title" | "category" | "status" | "published_at">[];

  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <p className="adm-kicker">CTRL® Journal</p>
          <h1 className="adm-h1">Articoli</h1>
        </div>
        <div className="adm-top-actions">
          <span className="adm-muted">{email}</span>
          <form action={signOut}>
            <button className="adm-btn">Esci</button>
          </form>
          <Link href="/admin/posts/new" className="adm-btn adm-btn-primary">
            Nuovo articolo
          </Link>
        </div>
      </header>
      {error ? <p className="adm-error">Errore: {error.message}</p> : null}
      {posts.length === 0 ? (
        <p className="adm-note">Nessun articolo. Crea il primo con “Nuovo articolo”.</p>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Titolo</th>
              <th>Lingua</th>
              <th>Categoria</th>
              <th>Data</th>
              <th>Stato</th>
              <th aria-label="Azioni" />
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/edit?id=${p.id}`} className="adm-link">
                    {p.title}
                  </Link>
                  <span className="adm-muted adm-slug">/{p.slug}</span>
                </td>
                <td>{p.lang.toUpperCase()}</td>
                <td>{CATEGORY_LABEL.it[p.category]}</td>
                <td>{formatPostDate(p.published_at, "it")}</td>
                <td>
                  <span className={`adm-badge is-${p.status}`}>{p.status === "published" ? "Pubblicato" : "Bozza"}</span>
                </td>
                <td>
                  {p.status === "published" ? (
                    <a href={`${p.lang === "en" ? "/en" : ""}/journal/${p.slug}`} target="_blank" rel="noopener noreferrer" className="adm-link">
                      Apri
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
