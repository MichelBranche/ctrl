import Link from "next/link";
import { Suspense } from "react";
import { deleteRequest, setRequestStatus } from "@/app/admin/dashboard-actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const STATUS = { nuovo: "Nuovo", risposto: "Risposto", chiuso: "Chiuso" } as const;
type Status = keyof typeof STATUS;

export default function RequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Caricamento…</p></main>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

type Row = { id: string; name: string; email: string; subject: string; message: string; lang: string; status: Status; created_at: string };

async function Body({ searchParams }: { searchParams: PageProps<"/admin/requests">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = typeof sp.status === "string" && sp.status in STATUS ? (sp.status as Status) : null;
  const open = typeof sp.open === "string" ? sp.open : "";
  let rows: Row[] = [];
  let error = false;
  try {
    const res = await db().execute({
      sql: `SELECT id, name, email, subject, message, lang, status, created_at FROM contact_requests ${filter ? "WHERE status = ?" : ""} ORDER BY created_at DESC LIMIT 500`,
      args: filter ? [filter] : [],
    });
    rows = res.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      subject: String(r.subject),
      message: String(r.message),
      lang: String(r.lang),
      status: String(r.status) as Status,
      created_at: String(r.created_at),
    }));
  } catch {
    error = true;
  }

  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Richieste</h1>
          <p className="adm-muted">Messaggi dal modulo contatti. Rispondi via email, poi segna lo stato.</p>
        </div>
      </header>
      <nav className="adm-tabs" aria-label="Filtra per stato">
        <Link href="/admin/requests" className="adm-tab" aria-current={!filter ? "page" : undefined}>
          Tutte
        </Link>
        {(Object.keys(STATUS) as Status[]).map((s) => (
          <Link key={s} href={`/admin/requests?status=${s}`} className="adm-tab" aria-current={filter === s ? "page" : undefined}>
            {STATUS[s]}
          </Link>
        ))}
      </nav>
      {error ? (
        <p className="adm-error" role="alert">Impossibile leggere le richieste.</p>
      ) : rows.length === 0 ? (
        <p className="adm-note">{filter ? `Nessuna richiesta con stato “${STATUS[filter]}”.` : "Nessuna richiesta ricevuta finora."}</p>
      ) : (
        <ul className="adm-list">
          {rows.map((r) => (
            <li key={r.id} className="adm-req">
              <details open={r.id === open || undefined}>
                <summary>
                  <span className={`adm-badge is-${r.status}`}>{STATUS[r.status]}</span>
                  <strong>{r.name}</strong>
                  <span className="adm-muted">{r.subject}</span>
                  <time className="adm-muted adm-num" dateTime={r.created_at}>
                    {new Date(r.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" })}
                  </time>
                </summary>
                <div className="adm-req-body">
                  <p className="adm-muted">
                    {r.email} · {r.lang.toUpperCase()}
                  </p>
                  <p className="adm-req-msg">{r.message}</p>
                  <div className="adm-row-actions">
                    <a
                      className="adm-btn adm-btn-primary adm-btn-sm"
                      href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.subject}`)}&body=${encodeURIComponent(`\n\n---\n${r.message}`)}`}
                    >
                      Rispondi
                    </a>
                    {(Object.keys(STATUS) as Status[])
                      .filter((s) => s !== r.status)
                      .map((s) => (
                        <form key={s} action={setRequestStatus}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="status" value={s} />
                          <button className="adm-btn adm-btn-sm">Segna {STATUS[s].toLowerCase()}</button>
                        </form>
                      ))}
                    <ConfirmButton action={deleteRequest} id={r.id} message="Eliminare definitivamente questa richiesta?">
                      Elimina
                    </ConfirmButton>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
