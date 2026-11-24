import "@/components/ds/admin-ui.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/meetings.css";
import { Suspense, type ReactNode } from "react";
import { ClientInviteForm, ClientMeetingActions, type ContactOption } from "@/components/admin/meet/client-invite";
import { DisconnectGoogle, MEET_NEW, MeetingActions, NewMeetingForm } from "@/components/admin/meet/meet-forms";
import { CAN_SIGN_IN_SQL, requireSection } from "@/lib/admin";
import { upcomingClientMeetings } from "@/lib/client-meet";
import { inviteContacts } from "@/lib/crm";
import { db } from "@/lib/db";
import { connection, googleConfigured, GoogleError, MEET_TZ, nowLocal, redirectUri, upcomingMeetings, type Meeting } from "@/lib/google-meet";
import { canAccess, isFounder } from "@/lib/team-types";

export default function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<main className="ds-page rb mt" aria-busy="true"><div className="mt-skel" style={{ height: "7rem" }} /><div className="mt-skel" style={{ height: "6rem" }} /><div className="mt-skel" style={{ height: "26rem" }} /></main>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

const NOTICE: Record<string, ["ok" | "error", string]> = {
  ok: ["ok", "Account Google collegato. Ora puoi creare riunioni con link Meet."],
  denied: ["error", "Collegamento annullato su Google."],
  state: ["error", "Collegamento scaduto o non valido. Riprova da questa pagina."],
  error: ["error", "Google non ha completato il collegamento. Riprova."],
  config: ["error", "Mancano le credenziali OAuth di Google nelle variabili di Vercel."],
};

/** Next quarter hour, at least 15 minutes away, as Rome local time. */
function nextSlot() {
  const t = new Date().getTime() + 15 * 60_000;
  return nowLocal(new Date(t - (t % (15 * 60_000))));
}

/** Rome local time one hour ago (meetings in progress stay listed). */
function hourAgo() {
  return nowLocal(new Date(new Date().getTime() - 3600_000));
}

const addMinutes = (local: string, min: number) => {
  const d = new Date(`${local}:00Z`);
  return new Date(d.getTime() + min * 60_000).toISOString().slice(0, 16);
};
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

type When = "live" | "today" | "tomorrow" | "later";
/** Where a meeting sits relative to now, all in Rome local "YYYY-MM-DDTHH:MM". */
function whenOf(start: string, end: string, now: string): When {
  if (start <= now && now < end) return "live";
  const day = start.slice(0, 10);
  if (day === now.slice(0, 10)) return "today";
  if (day === addDays(now.slice(0, 10), 1)) return "tomorrow";
  return "later";
}
const WHEN_LABEL: Record<When, string> = { live: "In corso", today: "Oggi", tomorrow: "Domani", later: "" };

const I = {
  video: "M3 7h12v10H3zM15 10l6-3v10l-6-3",
  plus: "M12 5v14M5 12h14",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  client: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  cal: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  ext: "M7 17L17 7M8 7h9v9",
  check: "M5 12l5 5L20 7",
  alert: "M12 8v5M12 16.5h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  plug: "M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5",
};
function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

const dayParts = (local: string) => {
  const d = new Date(`${local.slice(0, 10)}T12:00:00Z`);
  return {
    day: d.toLocaleDateString("it-IT", { timeZone: "UTC", day: "numeric" }),
    month: d.toLocaleDateString("it-IT", { timeZone: "UTC", month: "short" }).replace(".", ""),
    weekday: d.toLocaleDateString("it-IT", { timeZone: "UTC", weekday: "short" }).replace(".", ""),
  };
};

function Row({ kind, start, end, title, meta, actions, i }: { kind: "team" | "cliente"; start: string; end: string; title: string; meta: ReactNode; actions: ReactNode; i: number }) {
  const now = nowLocal();
  const when = whenOf(start, end, now);
  const p = dayParts(start);
  return (
    <li className="mt-row" data-kind={kind} data-when={when} style={{ ["--i" as string]: Math.min(i, 10) }}>
      <span className="mt-date"><small>{p.weekday}</small><b>{p.day}</b><small>{p.month}</small></span>
      <span className="mt-row-main">
        <span className="mt-row-title">
          <strong>{title}</strong>
          {when !== "later" ? <span className="mt-when-pill" data-when={when}><i aria-hidden="true" />{WHEN_LABEL[when]}</span> : null}
        </span>
        <span className="mt-row-meta">{meta}</span>
      </span>
      {actions}
    </li>
  );
}

async function Body({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireSection("meetings");
  const founder = isFounder(me);
  const sp = await searchParams;
  const notice = typeof sp.g === "string" ? NOTICE[sp.g] : undefined;
  // Prefill from the CRM contact card (?titolo=…&ospite=…); plain text into inputs, validated again on submit.
  const prefill = {
    title: typeof sp.titolo === "string" ? sp.titolo.slice(0, 120) : undefined,
    external: typeof sp.ospite === "string" && /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/.test(sp.ospite) ? sp.ospite.slice(0, 200) : undefined,
  };
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
  const crm = canAccess(me, "crm");
  const contacts: ContactOption[] = await inviteContacts(me).catch(() => []);
  const preset = typeof sp.cliente === "string" ? contacts.find((c) => c.id === sp.cliente) ?? null : null;
  const clientMeetings = await upcomingClientMeetings(hourAgo()).catch(() => []);

  // Everything in Rome local time, so team (ISO from Google) and client (local) meetings compare the same way.
  const now = nowLocal();
  const team = meetings.map((m) => ({ m, start: nowLocal(new Date(m.start)), end: nowLocal(new Date(m.end)), min: Math.round((new Date(m.end).getTime() - new Date(m.start).getTime()) / 60000) }));
  const clients = clientMeetings.map((m) => ({ m, start: m.start, end: addMinutes(m.start, m.minutes) }));
  const all = [...team.map((x) => ({ start: x.start, end: x.end })), ...clients.map((x) => ({ start: x.start, end: x.end }))];
  const week = addDays(now.slice(0, 10), 7);
  const stats = {
    live: all.filter((x) => whenOf(x.start, x.end, now) === "live").length,
    today: all.filter((x) => x.start.slice(0, 10) === now.slice(0, 10)).length,
    week: all.filter((x) => x.start.slice(0, 10) <= week).length,
    clients: clients.length,
  };
  const next = [...all].filter((x) => x.end > now).sort((a, b) => a.start.localeCompare(b.start))[0];

  return (
    <main className="ds-page rb mt">
      <header className="rb-head mt-head">
        <div className="rb-head-row">
          <div className="rb-head-title">
            <p className="rb-kicker">Team · Google Meet</p>
            <h1>Riunioni <span className="rb-count">{all.length} in agenda</span></h1>
            <p className="mt-lead">Videochiamate Google Meet create dal calendario dell&apos;agenzia, con invito automatico agli ospiti.</p>
          </div>
          <div className="rb-head-actions">
            <span className="mt-google" data-on={live || undefined} title={live ? "Google Calendar collegato" : "Google Calendar non collegato"}>
              <i aria-hidden="true" />{live ? "Google collegato" : "Google non collegato"}
            </span>
            <a className="rb-btn mt-quick" href={MEET_NEW} target="_blank" rel="noopener noreferrer"><Icon d={I.bolt} /><span>Meet veloce</span><Icon d={I.ext} size={13} /></a>
          </div>
        </div>
      </header>

      {notice ? <p className="mt-notice" data-tone={notice[0]} role="status"><Icon d={notice[0] === "ok" ? I.check : I.alert} />{notice[1]}</p> : null}

      <section className="mt-stats" aria-label="Riepilogo agenda">
        <div className="mt-stat" data-stat="live"><span className="mt-stat-icon"><Icon d={I.video} /></span><span><small>In corso</small><b>{stats.live}</b></span></div>
        <div className="mt-stat" data-stat="today"><span className="mt-stat-icon"><Icon d={I.clock} /></span><span><small>Oggi</small><b>{stats.today}</b></span></div>
        <div className="mt-stat" data-stat="week"><span className="mt-stat-icon"><Icon d={I.cal} /></span><span><small>Prossimi 7 giorni</small><b>{stats.week}</b></span></div>
        <a className="mt-stat" data-stat="clients" href="#clienti"><span className="mt-stat-icon"><Icon d={I.client} /></span><span><small>Con clienti</small><b>{stats.clients}</b></span></a>
        <p className="mt-next">
          {next ? <><Icon d={I.clock} size={14} />Prossima: <b>{dayParts(next.start).weekday} {dayParts(next.start).day} {dayParts(next.start).month}, {next.start.slice(11)}</b></> : <><Icon d={I.check} size={14} />Agenda libera</>}
        </p>
      </section>

      {!live ? (
        <section className="mt-card mt-setup">
          <div className="mt-card-head">
            <span className="mt-head-icon" data-kind="google"><Icon d={I.plug} /></span>
            <div><h2>Collega Google Calendar</h2><p>Si fa una volta sola.</p></div>
          </div>
          <div className="mt-card-body">
            {!configured ? (
              <>
                <p className="mt-text">Per creare riunioni con link Meet e inviti automatici serve un collegamento gratuito con Google.</p>
                <ol className="mt-steps">
                  <li>Un founder crea un progetto gratuito su Google Cloud Console e attiva Google Calendar API.</li>
                  <li>Crea un client OAuth di tipo &quot;Applicazione web&quot; con questo URI di reindirizzamento: <code>{redirectUri()}</code></li>
                  <li>Aggiunge su Vercel le variabili <code>GOOGLE_OAUTH_CLIENT_ID</code> e <code>GOOGLE_OAUTH_CLIENT_SECRET</code> e rifà il deploy.</li>
                  <li>Torna qui e preme &quot;Collega Google&quot;.</li>
                </ol>
              </>
            ) : founder ? (
              <>
                <p className="mt-text">Accedi con l&apos;account Google dell&apos;agenzia e consenti l&apos;accesso agli eventi del calendario. Chiediamo solo il permesso per creare e gestire eventi, nient&apos;altro.</p>
                <p><a className="rb-cta" href="/admin/riunioni/connect"><Icon d={I.plug} />Collega Google</a></p>
              </>
            ) : (
              <p className="mt-text">Un founder deve collegare una volta l&apos;account Google dell&apos;agenzia.</p>
            )}
            <p className="mt-hint">Nel frattempo puoi aprire una riunione al volo: <a href={MEET_NEW} target="_blank" rel="noopener noreferrer">meet.new</a> crea un link Meet da condividere a mano.</p>
            {apiError ? <p className="mt-msg" data-tone="error">{apiError}</p> : null}
          </div>
        </section>
      ) : (
        <div className="mt-grid">
          <section className="mt-card" data-kind="team" aria-labelledby="mt-new-h">
            <div className="mt-card-head">
              <span className="mt-head-icon" data-kind="team"><Icon d={I.plus} /></span>
              <div><h2 id="mt-new-h">Nuova riunione</h2><p>Con il team ed eventuali ospiti esterni.</p></div>
            </div>
            <div className="mt-card-body">
              <NewMeetingForm members={members} today={today} time={time} title={prefill.title} external={prefill.external} />
            </div>
          </section>
          <section className="mt-card" data-kind="team" aria-labelledby="mt-list-h">
            <div className="mt-card-head">
              <span className="mt-head-icon" data-kind="team"><Icon d={I.video} /></span>
              <div><h2 id="mt-list-h">Prossime riunioni</h2><p>Dal calendario dell&apos;agenzia.</p></div>
              <span className="rb-badge rb-badge-quiet mt-n">{meetings.length}</span>
            </div>
            {apiError ? <p className="mt-msg mt-pad" data-tone="error">{apiError}</p> : null}
            {!meetings.length && !apiError ? <p className="mt-empty"><Icon d={I.cal} />Nessuna riunione in programma.</p> : null}
            <ul className="mt-list">
              {team.map(({ m, start, end, min }, i) => (
                <Row key={m.id} kind="team" start={start} end={end} title={m.title} i={i}
                  meta={<><span><Icon d={I.clock} size={13} />{start.slice(11)} · {min} min</span><span><Icon d={I.users} size={13} />{m.attendees.length} {m.attendees.length === 1 ? "invitato" : "invitati"}</span></>}
                  actions={<MeetingActions id={m.id} url={m.meetUrl} />} />
              ))}
            </ul>
            {conn ? (
              <div className="mt-conn">
                <span><i aria-hidden="true" />Google collegato{conn.connectedBy ? ` da ${conn.connectedBy}` : ""} il {new Date(conn.connectedAt).toLocaleDateString("it-IT", { timeZone: MEET_TZ })}.</span>
                {founder ? <DisconnectGoogle /> : null}
              </div>
            ) : null}
          </section>
        </div>
      )}

      <section id="clienti" className="mt-card mt-clients" data-kind="cliente" aria-labelledby="mt-client-h">
        <div className="mt-card-head">
          <span className="mt-head-icon" data-kind="cliente"><Icon d={I.mail} /></span>
          <div><h2 id="mt-client-h">Invita un cliente</h2><p>Invito su Google Meet dedicato ai clienti: email con intestazione Ctrl Agency, data e ora italiane, link Meet e file per il calendario.</p></div>
        </div>
        <div className="mt-client-grid">
          <div className="mt-card-body"><ClientInviteForm contacts={contacts} today={today} time={time} live={live} preset={preset} /></div>
          <div className="mt-client-list">
            <div className="mt-sub-head">
              <h3><Icon d={I.client} size={15} />Prossime riunioni con clienti</h3>
              <span className="rb-badge rb-badge-quiet">{clientMeetings.length}</span>
            </div>
            {!clientMeetings.length ? <p className="mt-empty"><Icon d={I.cal} />Nessuna riunione con clienti in programma.</p> : null}
            <ul className="mt-list">
              {clients.map(({ m, start, end }, i) => (
                <Row key={m.id} kind="cliente" start={start} end={end} title={m.title} i={i}
                  meta={<>
                    <span><Icon d={I.client} size={13} />{m.clientName} · {m.clientEmail}{crm && m.contactId ? <> · <a href={`/admin/crm/${m.contactId}`}>scheda CRM</a></> : null}</span>
                    <span><Icon d={I.clock} size={13} />{start.slice(11)} · {m.minutes} min{m.eventId ? <> · <Icon d={I.cal} size={13} />in Google Calendar</> : null}</span>
                  </>}
                  actions={<ClientMeetingActions id={m.id} url={m.meetUrl} />} />
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
