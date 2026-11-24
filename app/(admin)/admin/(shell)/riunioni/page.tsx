import "@/components/ds/admin-ui.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/meetings.css";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { type CalView, calRange, MeetCalendar } from "@/components/admin/meet/meet-calendar";
import { DisconnectGoogle, MEET_NEW } from "@/components/admin/meet/meet-forms";
import { Icon, MI } from "@/components/admin/meet/meet-icons";
import { MeetRow } from "@/components/admin/meet/meet-row";
import { requireSection } from "@/lib/admin";
import { connection, googleConfigured, MEET_TZ, nowLocal, redirectUri } from "@/lib/google-meet";
import { type AgendaItem, agendaBetween, pastAgenda } from "@/lib/meet-agenda";
import { addDays, DAY_RE, dayNum, monthShort, weekday } from "@/lib/meet-dates";
import { isFounder } from "@/lib/team-types";

type SP = Record<string, string | string[] | undefined>;

export default function MeetingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<main className="ds-page rb mt" aria-busy="true"><div className="mt-skel" style={{ height: "8rem" }} /><div className="mt-skel" style={{ height: "24rem" }} /><div className="mt-skel" style={{ height: "10rem" }} /></main>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

const NOTICE: Record<string, ["ok" | "error" | "warn", string]> = {
  ok: ["ok", "Account Google collegato. Ora puoi creare riunioni con link Meet."],
  denied: ["error", "Collegamento annullato su Google."],
  state: ["error", "Collegamento scaduto o non valido. Riprova da questa pagina."],
  error: ["error", "Google non ha completato il collegamento. Riprova."],
  config: ["error", "Mancano le credenziali OAuth di Google nelle variabili di Vercel."],
};
const CANCELLED: Record<string, ["ok" | "warn", string]> = {
  "1": ["ok", "Riunione annullata."],
  mail: ["warn", "Riunione annullata, ma l'email al cliente non è partita. Avvisalo dalla casella Email."],
};

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const dayLabel = (day: string, today: string) =>
  day === today ? "Oggi" : day === addDays(today, 1) ? "Domani" : day === addDays(today, -1) ? "Ieri" : `${weekday(day)} ${dayNum(day)} ${monthShort(day)}`;

function grouped(items: AgendaItem[]) {
  const out: [string, AgendaItem[]][] = [];
  for (const it of items) {
    const d = it.start.slice(0, 10);
    const g = out.at(-1);
    if (g && g[0] === d) g[1].push(it); else out.push([d, [it]]);
  }
  return out;
}

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("meetings");
  const sp = await searchParams;
  // Old links (CRM card, contact list) opened the form on this page: they now open the guided creation.
  if (one(sp.cliente) || one(sp.titolo) || one(sp.ospite)) {
    const q = new URLSearchParams({ tipo: one(sp.cliente) ? "cliente" : "team" });
    for (const k of ["cliente", "titolo", "ospite"]) { const v = one(sp[k]); if (v) q.set(k, v); }
    redirect(`/admin/riunioni/nuova?${q}`);
  }
  const founder = isFounder(me);
  const notice = one(sp.g) ? NOTICE[one(sp.g)!] : one(sp.annullata) ? CANCELLED[one(sp.annullata)!] : undefined;
  const configured = googleConfigured();
  const conn = configured ? await connection().catch(() => null) : null;
  let live = Boolean(conn);

  const now = nowLocal();
  const today = now.slice(0, 10);
  const view: CalView = one(sp.vista) === "mese" ? "mese" : "settimana";
  const anchor = DAY_RE.test(one(sp.data) ?? "") ? one(sp.data)! : today;
  const list = one(sp.elenco) === "passate" ? "passate" : "prossime";
  const tipo = one(sp.tipo) === "team" ? "team" : one(sp.tipo) === "clienti" ? "clienti" : "tutte";

  const [from, to] = calRange(view, anchor);
  const [cal, upcoming, past] = await Promise.all([
    agendaBetween(`${from}T00:00`, `${to}T00:00`, live),
    list === "prossime" ? agendaBetween(nowLocal(new Date(new Date().getTime() - 3 * 3600_000)), `${addDays(today, 90)}T00:00`, live) : null,
    list === "passate" ? pastAgenda(live) : null,
  ]);
  if (cal.disconnected) live = false;
  const rows = (list === "prossime" ? (upcoming?.items ?? []).filter((x) => x.end > now) : past ?? [])
    .filter((x) => tipo === "tutte" || (tipo === "team" ? x.kind === "team" : x.kind === "cliente"));
  const keep = { vista: view, data: anchor, elenco: list, tipo };
  const listHref = (patch: Partial<typeof keep>) => `/admin/riunioni?${new URLSearchParams({ ...keep, ...patch })}#elenco`;
  const calQuery = { elenco: list, tipo };
  const nextUp = (upcoming?.items ?? []).filter((x) => x.end > now).length;

  return (
    <main className="ds-page rb mt">
      <header className="rb-head mt-head">
        <div className="rb-head-row">
          <div className="rb-head-title">
            <p className="rb-kicker">Team · Google Meet</p>
            <h1>Riunioni {list === "prossime" ? <span className="rb-count">{nextUp} in programma</span> : null}</h1>
            <p className="mt-lead">Il calendario delle videochiamate dell&apos;agenzia: con il team e con i clienti.</p>
          </div>
          <div className="rb-head-actions">
            <span className="mt-google" data-on={live || undefined}><i aria-hidden="true" />{live ? "Google collegato" : "Google non collegato"}</span>
            <a className="rb-btn mt-quick" href={MEET_NEW} target="_blank" rel="noopener noreferrer"><Icon d={MI.bolt} /><span>Meet veloce</span><Icon d={MI.ext} size={13} /></a>
            <a className="rb-cta" href="#nuova"><Icon d={MI.plus} />Nuova riunione</a>
          </div>
        </div>
      </header>

      {notice ? <p className="mt-notice" data-tone={notice[0]} role="status"><Icon d={notice[0] === "ok" ? MI.check : MI.alert} />{notice[1]}</p> : null}
      {cal.googleError && !cal.disconnected ? <p className="mt-notice" data-tone="warn" role="status"><Icon d={MI.alert} />{cal.googleError} Le riunioni team non sono visibili, quelle con i clienti sì.</p> : null}

      <MeetCalendar items={cal.items} view={view} anchor={anchor} today={today} now={now} query={calQuery} />

      <section id="nuova" className="mt-choose" aria-labelledby="mt-choose-h">
        <h2 id="mt-choose-h" className="mt-sec-h"><Icon d={MI.plus} size={16} />Crea una riunione</h2>
        <div className="mt-choices">
          <a className="mt-choice" data-kind="team" href="/admin/riunioni/nuova?tipo=team">
            <span className="mt-choice-icon"><Icon d={MI.users} size={22} /></span>
            <span className="mt-choice-body">
              <strong>Riunione team</strong>
              <span>Videochiamata con i colleghi ed eventuali ospiti. Google manda l&apos;invito a tutti.</span>
              <span className="mt-choice-steps">Argomento · Data e ora · Partecipanti · Note · Riepilogo</span>
              {!live ? <span className="mt-choice-warn"><Icon d={MI.alert} size={13} />Serve Google Calendar collegato</span> : null}
            </span>
            <span className="mt-choice-go"><Icon d={MI.arrow} /></span>
          </a>
          <a className="mt-choice" data-kind="cliente" href="/admin/riunioni/nuova?tipo=cliente">
            <span className="mt-choice-icon"><Icon d={MI.client} size={22} /></span>
            <span className="mt-choice-body">
              <strong>Riunione cliente</strong>
              <span>Invito con email intestata Ctrl Agency, file per il calendario e nota nella scheda CRM.</span>
              <span className="mt-choice-steps">Cliente · Argomento · Data e ora · Dettagli · Riepilogo</span>
            </span>
            <span className="mt-choice-go"><Icon d={MI.arrow} /></span>
          </a>
        </div>
      </section>

      <section id="elenco" className="mt-card mt-listcard" aria-labelledby="mt-list-h">
        <div className="mt-list-head">
          <h2 id="mt-list-h" className="mt-sec-h"><Icon d={list === "prossime" ? MI.video : MI.history} size={16} />{list === "prossime" ? "Prossime riunioni" : "Riunioni passate"}</h2>
          <div className="mt-filters">
            <div className="rb-segs" role="group" aria-label="Periodo">
              <a href={listHref({ elenco: "prossime" })} aria-current={list === "prossime" ? "page" : undefined}>Prossime</a>
              <a href={listHref({ elenco: "passate" })} aria-current={list === "passate" ? "page" : undefined}>Passate</a>
            </div>
            <div className="rb-segs" role="group" aria-label="Tipo">
              <a href={listHref({ tipo: "tutte" })} aria-current={tipo === "tutte" ? "page" : undefined}>Tutte</a>
              <a href={listHref({ tipo: "team" })} aria-current={tipo === "team" ? "page" : undefined}>Team</a>
              <a href={listHref({ tipo: "clienti" })} aria-current={tipo === "clienti" ? "page" : undefined}>Clienti</a>
            </div>
          </div>
        </div>
        {!rows.length ? (
          <p className="mt-empty"><Icon d={MI.cal} />{list === "prossime" ? "Nessuna riunione in programma." : "Nessuna riunione negli ultimi 60 giorni."}{list === "prossime" ? <> <a href="#nuova">Creane una</a>.</> : null}</p>
        ) : grouped(rows).map(([day, items]) => (
          <div key={day} className="mt-group">
            <h3 className="mt-group-h" data-today={day === today || undefined}>{dayLabel(day, today)}<span>{items.length}</span></h3>
            <ul className="mt-list">{items.map((it, i) => <MeetRow key={`${it.kind}${it.id}`} it={it} now={now} i={i} past={list === "passate"} />)}</ul>
          </div>
        ))}
        {!live && list === "passate" ? <p className="mt-hint mt-pad-b">Le riunioni team passate compaiono quando Google Calendar è collegato.</p> : null}
      </section>

      <section className="mt-card mt-gcard" aria-labelledby="mt-g-h">
        <div className="mt-card-head">
          <span className="mt-head-icon" data-kind={live ? "ok" : "google"}><Icon d={MI.plug} /></span>
          <div>
            <h2 id="mt-g-h">Google Calendar</h2>
            <p>{live ? <>Collegato{conn?.connectedBy ? ` da ${conn.connectedBy}` : ""}{conn ? ` il ${new Date(conn.connectedAt).toLocaleDateString("it-IT", { timeZone: MEET_TZ })}` : ""}. Le riunioni team e i link Meet arrivano dal calendario dell&apos;agenzia.</> : "Non collegato: il calendario mostra le riunioni con i clienti salvate nel pannello. Collegando Google arrivano anche le riunioni team e i link Meet automatici."}</p>
          </div>
          {live && founder ? <DisconnectGoogle /> : null}
        </div>
        {!live ? (
          <div className="mt-card-body">
            {!configured ? (
              <details className="mt-setup-d">
                <summary>Come si collega (una volta sola, gratis)</summary>
                <ol className="mt-steps">
                  <li>Un founder crea un progetto gratuito su Google Cloud Console e attiva Google Calendar API.</li>
                  <li>Crea un client OAuth di tipo &quot;Applicazione web&quot; con questo URI di reindirizzamento: <code>{redirectUri()}</code></li>
                  <li>Aggiunge su Vercel le variabili <code>GOOGLE_OAUTH_CLIENT_ID</code> e <code>GOOGLE_OAUTH_CLIENT_SECRET</code> e rifà il deploy.</li>
                  <li>Torna qui e preme &quot;Collega Google&quot;.</li>
                </ol>
              </details>
            ) : founder ? (
              <>
                <p className="mt-text">Accedi con l&apos;account Google dell&apos;agenzia e consenti l&apos;accesso agli eventi del calendario. Chiediamo solo il permesso per creare e gestire eventi, nient&apos;altro.</p>
                <p><a className="rb-btn" href="/admin/riunioni/connect"><Icon d={MI.plug} />Collega Google</a></p>
              </>
            ) : (
              <p className="mt-text">Un founder deve collegare una volta l&apos;account Google dell&apos;agenzia.</p>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
