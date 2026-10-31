import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatPostDate } from "@/lib/journal-types";
import { analytics, vercelConfigured } from "@/lib/vercel";

export default function Overview() {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Caricamento…</p></main>}>
      <Body />
    </Suspense>
  );
}

const n = (v: unknown) => Number(v ?? 0);

async function Body() {
  const { email } = await requireAdmin();
  let counts: { pub: number; draft: number; reqNew: number; reqAll: number; subs: number } | null = null;
  let last: { id: string; title: string; updated_at: string } | null = null;
  try {
    const [c, l] = await db().batch(
      [
        `SELECT (SELECT COUNT(*) FROM posts WHERE published = 1) AS pub, (SELECT COUNT(*) FROM posts WHERE published = 0) AS draft,
          (SELECT COUNT(*) FROM contact_requests WHERE status = 'nuovo') AS req_new, (SELECT COUNT(*) FROM contact_requests) AS req_all,
          (SELECT COUNT(*) FROM subscribers WHERE unsubscribed_at IS NULL) AS subs`,
        "SELECT id, title, updated_at FROM posts ORDER BY updated_at DESC LIMIT 1",
      ],
      "read",
    );
    const r = c.rows[0];
    counts = { pub: n(r.pub), draft: n(r.draft), reqNew: n(r.req_new), reqAll: n(r.req_all), subs: n(r.subs) };
    if (l.rows[0]) last = { id: String(l.rows[0].id), title: String(l.rows[0].title), updated_at: String(l.rows[0].updated_at) };
  } catch {
    counts = null;
  }

  let visits: { pageviews: number; visitors: number } | null = null;
  if (vercelConfigured()) {
    try {
      const days = (await analytics("day", 7, 31)) ?? [];
      visits = days.reduce((a, d) => ({ pageviews: a.pageviews + d.pageviews, visitors: a.visitors + d.visitors }), { pageviews: 0, visitors: 0 });
    } catch {
      visits = null;
    }
  }

  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Panoramica</h1>
          <p className="adm-muted">Accesso come {email}</p>
        </div>
        <div className="adm-top-actions">
          <Link href="/admin/posts/new" className="adm-btn adm-btn-primary">
            Nuovo articolo
          </Link>
        </div>
      </header>

      {counts === null ? <p className="adm-error" role="alert">Database non raggiungibile: i conteggi non sono disponibili.</p> : null}

      <section className="adm-stats" aria-label="Riepilogo">
        <Stat label="Articoli pubblicati" value={counts?.pub} href="/admin/journal" />
        <Stat label="Bozze" value={counts?.draft} href="/admin/journal" />
        <Stat label="Richieste nuove" value={counts?.reqNew} note={counts ? `${counts.reqAll} in totale` : undefined} href="/admin/requests" />
        <Stat label="Iscritti newsletter" value={counts?.subs} href="/admin/newsletter" />
        {visits ? (
          <Stat label="Visite, ultimi 7 giorni" value={visits.pageviews} note={`${visits.visitors} visitatori`} href="/admin/stats" />
        ) : (
          <div className="adm-stat">
            <span className="adm-muted">Visite</span>
            <Link href="/admin/stats" className="adm-link">
              {vercelConfigured() ? "Dati non disponibili" : "Configura le statistiche"}
            </Link>
          </div>
        )}
      </section>

      <div className="adm-grid2">
        <section className="adm-panel">
          <h2 className="adm-h2">Ultimo articolo modificato</h2>
          {last ? (
            <p>
              <Link href={`/admin/edit?id=${last.id}`} className="adm-link">
                {last.title}
              </Link>
              <span className="adm-muted"> · {formatPostDate(last.updated_at, "it")}</span>
            </p>
          ) : (
            <p className="adm-muted">Ancora nessun articolo.</p>
          )}
        </section>
        <section className="adm-panel">
          <h2 className="adm-h2">Azioni rapide</h2>
          <div className="adm-quick">
            <Link href="/admin/posts/new" className="adm-btn">Scrivi un articolo</Link>
            <Link href="/admin/requests?status=nuovo" className="adm-btn">Leggi le richieste</Link>
            <Link href="/admin/media" className="adm-btn">Gestisci immagini</Link>
            <a href="/admin/newsletter/export" className="adm-btn">Esporta iscritti</a>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, note, href }: { label: string; value: number | undefined; note?: string; href: string }) {
  return (
    <Link href={href} className="adm-stat">
      <span className="adm-muted">{label}</span>
      <span className="adm-stat-num">{value ?? "–"}</span>
      {note ? <span className="adm-muted">{note}</span> : null}
    </Link>
  );
}
