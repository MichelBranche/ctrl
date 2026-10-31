import { Suspense } from "react";
import { removeSubscriber } from "@/app/admin/dashboard-actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export default function NewsletterPage({ searchParams }: PageProps<"/admin/newsletter">) {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Caricamento…</p></main>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin/newsletter">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  let rows: { id: string; email: string; lang: string; created_at: string; unsubscribed_at: string | null }[] = [];
  let active = 0;
  let error = false;
  try {
    const [list, count] = await db().batch(
      [
        { sql: `SELECT id, email, lang, created_at, unsubscribed_at FROM subscribers ${q ? "WHERE email LIKE ?" : ""} ORDER BY created_at DESC LIMIT 1000`, args: q ? [`%${q}%`] : [] },
        "SELECT COUNT(*) AS n FROM subscribers WHERE unsubscribed_at IS NULL",
      ],
      "read",
    );
    rows = list.rows.map((r) => ({
      id: String(r.id),
      email: String(r.email),
      lang: String(r.lang),
      created_at: String(r.created_at),
      unsubscribed_at: r.unsubscribed_at ? String(r.unsubscribed_at) : null,
    }));
    active = Number(count.rows[0]?.n ?? 0);
  } catch {
    error = true;
  }
  const d = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });

  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Newsletter</h1>
          <p className="adm-muted">{error ? "" : `${active} iscritti attivi`}</p>
        </div>
        <div className="adm-top-actions">
          <form className="adm-inline-search" role="search">
            <input name="q" defaultValue={q} placeholder="Cerca email" aria-label="Cerca email" className="adm-input" />
          </form>
          <a href="/admin/newsletter/export" className="adm-btn adm-btn-primary">
            Esporta CSV
          </a>
        </div>
      </header>
      {error ? (
        <p className="adm-error" role="alert">Impossibile leggere gli iscritti.</p>
      ) : rows.length === 0 ? (
        <p className="adm-note">{q ? "Nessun iscritto corrisponde alla ricerca." : "Ancora nessun iscritto. Il modulo è nella pagina Journal."}</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Lingua</th>
                <th>Iscritto il</th>
                <th>Stato</th>
                <th aria-label="Azioni" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{r.lang.toUpperCase()}</td>
                  <td className="adm-num">{d(r.created_at)}</td>
                  <td>{r.unsubscribed_at ? <span className="adm-muted">Disiscritto il {d(r.unsubscribed_at)}</span> : <span className="adm-badge is-published">Attivo</span>}</td>
                  <td className="adm-row-actions">
                    <ConfirmButton action={removeSubscriber} id={r.id} message={`Rimuovere ${r.email} dalla lista? Il dato viene cancellato.`}>
                      Rimuovi
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
