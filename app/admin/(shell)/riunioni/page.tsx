import { Suspense } from "react";
import { DisconnectGoogle, MEET_NEW, MeetingActions, NewMeetingForm } from "@/components/admin/meet/meet-forms";
import { CAN_SIGN_IN_SQL, requireSection } from "@/lib/admin";
import { db } from "@/lib/db";
import { connection, googleConfigured, GoogleError, MEET_TZ, nowLocal, redirectUri, upcomingMeetings, type Meeting } from "@/lib/google-meet";
import { isFounder } from "@/lib/team-types";

export default function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Caricamento…</p></main>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

const NOTICE: Record<string, [string, string]> = {
  ok: ["adm-ok", "Account Google collegato. Ora puoi creare riunioni con link Meet."],
  denied: ["adm-error", "Collegamento annullato su Google."],
  state: ["adm-error", "Collegamento scaduto o non valido. Riprova da questa pagina."],
  error: ["adm-error", "Google non ha completato il collegamento. Riprova."],
  config: ["adm-error", "Mancano le credenziali OAuth di Google nelle variabili di Vercel."],
};

/** Next quarter hour, at least 15 minutes away, as Rome local time. */
function nextSlot() {
  const t = new Date().getTime() + 15 * 60_000;
  return nowLocal(new Date(t - (t % (15 * 60_000))));
}

const fmt = (iso: string) => new Date(iso).toLocaleString("it-IT", { timeZone: MEET_TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function Body({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireSection("meetings");
  const founder = isFounder(me);
  const sp = await searchParams;
  const notice = typeof sp.g === "string" ? NOTICE[sp.g] : undefined;
  const configured = googleConfigured();
  const conn = configured ? await connection().catch(() => null) : null;
  let meetings: Meeting[] = [];
  let apiError: string | null = null;
  let live = Boolean(conn);
  if (conn) {
    try { meetings = await upcomingMeetings(); } catch (e) {
      apiError = e instanceof GoogleError ? e.message : "Google Calendar non risponde.";
      if (e instanceof GoogleError && e.kind === "disconnected") live = false;
    }
  }
  const members = live
    ? (await db().execute({ sql: `SELECT id, name, email FROM admin_users WHERE ${CAN_SIGN_IN_SQL} AND id <> ? ORDER BY name`, args: [me.id] })).rows.map((r) => ({ id: String(r.id), name: String(r.name), email: String(r.email) }))
    : [];
  const [today, time] = nextSlot().split("T");

  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Riunioni</h1>
          <p className="adm-muted">Videochiamate Google Meet create dal calendario dell&apos;agenzia, con invito automatico agli ospiti.</p>
        </div>
        <a className="adm-btn" href={MEET_NEW} target="_blank" rel="noopener noreferrer">Meet veloce</a>
      </header>
      {notice ? <p className={notice[0]} role="status">{notice[1]}</p> : null}

      {!live ? (
        <section className="adm-panel adm-meet-setup adm-rise">
          <h2 className="adm-h2">Collega Google Calendar</h2>
          {!configured ? (
            <>
              <p>Per creare riunioni con link Meet e inviti automatici serve un collegamento gratuito con Google. Si fa una volta sola.</p>
              <ol className="adm-steps">
                <li>Un founder crea un progetto gratuito su Google Cloud Console e attiva Google Calendar API.</li>
                <li>Crea un client OAuth di tipo &quot;Applicazione web&quot; con questo URI di reindirizzamento: <code>{redirectUri()}</code></li>
                <li>Aggiunge su Vercel le variabili <code>GOOGLE_OAUTH_CLIENT_ID</code> e <code>GOOGLE_OAUTH_CLIENT_SECRET</code> e rifà il deploy.</li>
                <li>Torna qui e preme &quot;Collega Google&quot;.</li>
              </ol>
            </>
          ) : founder ? (
            <>
              <p>Accedi con l&apos;account Google dell&apos;agenzia e consenti l&apos;accesso agli eventi del calendario. Chiediamo solo il permesso per creare e gestire eventi, nient&apos;altro.</p>
              <p><a className="adm-btn adm-btn-primary" href="/admin/riunioni/connect">Collega Google</a></p>
            </>
          ) : (
            <p>Un founder deve collegare una volta l&apos;account Google dell&apos;agenzia.</p>
          )}
          <p className="adm-muted">Nel frattempo puoi aprire una riunione al volo: <a href={MEET_NEW} target="_blank" rel="noopener noreferrer">meet.new</a> crea un link Meet da condividere a mano.</p>
          {apiError ? <p className="adm-error">{apiError}</p> : null}
        </section>
      ) : (
        <div className="adm-grid2">
          <section className="adm-panel adm-rise" style={{ "--i": 0 } as React.CSSProperties}>
            <h2 className="adm-h2">Nuova riunione</h2>
            <NewMeetingForm members={members} today={today} time={time} />
          </section>
          <section className="adm-panel adm-rise" style={{ "--i": 1 } as React.CSSProperties}>
            <div className="adm-panel-head">
              <h2 className="adm-h2">Prossime riunioni</h2>
              <span className="adm-muted">{meetings.length}</span>
            </div>
            {apiError ? <p className="adm-error">{apiError}</p> : null}
            {!meetings.length && !apiError ? <p className="adm-muted">Nessuna riunione in programma.</p> : null}
            <ul className="adm-meet-list">
              {meetings.map((m) => (
                <li key={m.id} className="adm-meet-item">
                  <div>
                    <strong>{m.title}</strong>
                    <span className="adm-muted">{fmt(m.start)} · {Math.round((new Date(m.end).getTime() - new Date(m.start).getTime()) / 60000)} min · {m.attendees.length} {m.attendees.length === 1 ? "invitato" : "invitati"}</span>
                  </div>
                  <MeetingActions id={m.id} url={m.meetUrl} />
                </li>
              ))}
            </ul>
            {conn ? (
              <p className="adm-muted adm-meet-conn">
                Google collegato{conn.connectedBy ? ` da ${conn.connectedBy}` : ""} il {new Date(conn.connectedAt).toLocaleDateString("it-IT", { timeZone: MEET_TZ })}.{" "}
                {founder ? <DisconnectGoogle /> : null}
              </p>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
