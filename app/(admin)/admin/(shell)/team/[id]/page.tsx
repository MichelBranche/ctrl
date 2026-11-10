import { CallButton } from "@/components/admin/meet/meet-forms";
import { connection as googleConnection, googleConfigured } from "@/lib/google-meet";
import { UserAvatar } from "@/components/admin/user-avatar";
import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { EditUserForm } from "@/components/admin/team/team-forms";
import { EmailRecipients, KpiGrid, PeriodNav, TrendChart, formatCents, formatCount, formatEur, unconfirmedLabel } from "@/components/admin/team/work-view";
import { requireSection } from "@/lib/admin";
import { listActivities, type Activity } from "@/lib/crm-activity";
import { ACTIVITY_KIND_LABEL, STAGE_LABEL } from "@/lib/crm-core";
import { listOpportunities, opportunityTotals, type DealTotals, type Opportunity } from "@/lib/crm-opportunity";
import { listContacts, type Contact } from "@/lib/crm";
import { getEarnings, getUser, type Earnings, type EarningsSpan } from "@/lib/team";
import { INVITE_STATUS_LABEL } from "@/lib/team-invite-core";
import {
  ZERO_KPI, memberTrend, listMemberEmails, parseEmailLimit, parseTeamPeriod, periodWindow, romeToday, teamMemberKpisFor, teamQuery,
  type TeamDayPoint, type TeamEmail, type TeamPeriodDays,
} from "@/lib/team-stats";
import { AREA_LABEL, isFounder, ROLE_COLOR, ROLE_LABEL } from "@/lib/team-types";

type SP = Record<string, string | string[] | undefined>;

/** Build-time placeholder only (an invalid id renders notFound inside Suspense); real ids render on request. */
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function TeamMemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  return (
    <main className="adm-main">
      <Suspense fallback={<p className="adm-muted" aria-busy="true">Caricamento del profilo…</p>}>
        <Body params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const STATUS_CLASS = { attivo: "is-published", invitato: "is-scheduled", scaduto: "is-draft", revocato: "is-draft", disattivato: "is-draft", rimosso: "is-draft" } as const;

function earnSpan(days: TeamPeriodDays): EarningsSpan {
  switch (days) {
    case 7: return "7";
    case 30: return "30";
    case 90: return "90";
    default: {
      const neverDays: never = days;
      return neverDays;
    }
  }
}

const when = (iso: string | null) => {
  if (!iso) return "Nessuna";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", dateStyle: "medium" });
  return new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" });
};

async function Body({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const me = await requireSection("team");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[\w-]{1,64}$/.test(id)) notFound();
  const days = parseTeamPeriod(sp.giorni);
  const emailLimit = parseEmailLimit(sp.altre);
  const now = new Date();
  const window = periodWindow(days, now);
  const today = romeToday(now);
  const viewer = { id: me.id, founder: true as const };
  let user: Awaited<ReturnType<typeof getUser>> = null;
  let kpis = new Map<string, typeof ZERO_KPI>();
  let emails: { rows: TeamEmail[]; more: boolean; contacts: Map<string, { id: string; name: string }> } = { rows: [], more: false, contacts: new Map() };
  let trend: TeamDayPoint[] = [];
  let contacts: Contact[] = [];
  let deals: Opportunity[] = [];
  let totals: DealTotals = { open: 0, byStage: { nuovo: 0, contattato: 0, call: 0, preventivo: 0, vinto: 0, perso: 0 }, won: 0, lost: 0, wonValue: 0, openValue: 0 };
  let earnings: Earnings | null = null;
  let openActivities: Activity[] = [];
  let doneActivities: Activity[] = [];
  let googleLive = false;
  try {
    googleLive = googleConfigured() && Boolean(await googleConnection().catch(() => null));
    user = await getUser(id);
  } catch {
    return <p className="adm-error">Database non raggiungibile.</p>;
  }
  if (!user) notFound();
  try {
    [kpis, emails, trend, contacts, deals, totals, earnings, openActivities, doneActivities] = await Promise.all([
      teamMemberKpisFor(days, now),
      listMemberEmails(id, window, emailLimit),
      memberTrend(id, window),
      listContacts({ owner: id, sort: "nome", dir: "asc", limit: 200 }),
      listOpportunities({ ownerId: id }),
      opportunityTotals({ ownerId: id }),
      getEarnings(me, earnSpan(days), id, now),
      listActivities({ scope: "team", resp: id, stato: "aperte" }, viewer),
      listActivities({ scope: "team", resp: id, stato: "fatte" }, viewer),
    ]);
  } catch (error) {
    const digest = error && typeof error === "object" && "digest" in error ? String(error.digest) : "";
    if (digest.startsWith("NEXT_")) throw error;
    return <p className="adm-error">Database non raggiungibile.</p>;
  }
  if (!user) notFound();
  const kpi = kpis.get(id) ?? ZERO_KPI;
  const overdue = openActivities.filter((a) => a.dueDate < today);
  const upcoming = openActivities.filter((a) => a.dueDate >= today);
  const doneInPeriod = doneActivities.filter((a) => a.doneAt !== null && a.doneAt >= window.fromIso && a.doneAt < window.toIso);
  const removed = user.status === "rimosso";
  const hrefFor = (d: TeamPeriodDays) => `/admin/team/${id}${teamQuery(d)}`;
  return (
    <>
      <header className="adm-top">
        <div>
          <p className="adm-muted"><Link className="adm-link" href={`/admin/team${teamQuery(days)}` as Route}>Torna al team</Link></p>
          <h1 className="adm-h1">{user.name}{user.id === me.id ? <em className="adm-muted"> · tu</em> : null}</h1>
          <p className="adm-muted">{user.email}</p>
        </div>
        <div className="adm-top-actions">
          <PeriodNav days={days} hrefFor={hrefFor} />
          {user.status === "attivo" && user.id !== me.id ? <CallButton memberId={user.id} name={user.name} connected={googleLive} /> : null}
        </div>
      </header>

      <section className="adm-panel" aria-labelledby="team-profile">
        <h2 id="team-profile" className="adm-h2">Profilo</h2>
        <div className="adm-user-head">
          <UserAvatar name={user.name} src={user.avatarUrl} />
          <div className="adm-user-id">
            <strong>{user.name}</strong>
            <span className="adm-muted">{user.email}</span>
          </div>
          <span className="adm-chips adm-chips-static">
            {user.roles.map((r) => (
              <span key={r} className="adm-chip" data-on style={{ "--chip": ROLE_COLOR[r] } as React.CSSProperties}><span className="adm-chip-dot" aria-hidden />{ROLE_LABEL[r]}</span>
            ))}
          </span>
          <span className="adm-muted">{user.area ? AREA_LABEL[user.area] : isFounder(user.roles) ? "Tutte le aree" : "Nessuna area"}{user.emailAccess ? " · Email" : ""}</span>
          <p className="adm-user-seen">
            <span className={`adm-badge ${STATUS_CLASS[user.status]}`}>{INVITE_STATUS_LABEL[user.status]}</span>{" "}
            <span className="adm-muted">{user.status === "attivo" ? `Ultimo accesso: ${user.lastLoginAt ? when(user.lastLoginAt) : "mai"}` : user.status === "rimosso" ? `Rimosso il ${when(user.removedAt)}` : ""}</span>
          </p>
        </div>
        <KpiGrid kpi={kpi} />
        <p className="adm-muted">Email, attività completate, valore vinto e introiti seguono i {days} giorni. I contatti e le attività in ritardo sono lo stock di adesso. Il valore vinto non include gli introiti registrati.</p>
      </section>

      <section className="adm-panel" aria-labelledby="team-mail">
        <div className="adm-panel-head">
          <h2 id="team-mail" className="adm-h2">Email inviate</h2>
          <span className="adm-muted">{formatCount(kpi.emailsSent)} inviate, {unconfirmedLabel(kpi.emailsUnconfirmed)}</span>
        </div>
        {emails.rows.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Destinatari</th><th>Oggetto</th><th>Data</th><th>Stato</th></tr>
              </thead>
              <tbody>
                {emails.rows.map((row) => (
                  <tr key={row.id}>
                    <td><EmailRecipients raw={row.recipients} contacts={emails.contacts} /></td>
                    <td>{row.subject || <span className="adm-muted">Senza oggetto</span>}</td>
                    <td>{when(row.createdAt)}</td>
                    <td>{row.ok ? "Inviata" : "Non confermata"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="adm-muted adm-empty">Nessuna email nel periodo.</p>}
        {emails.more && emailLimit < 200 ? <p><Link className="adm-link" href={`/admin/team/${id}${teamQuery(days, { altre: emailLimit + 20 })}` as Route}>Mostra altre</Link></p> : null}
        {emails.more && emailLimit >= 200 ? <p className="adm-muted">Mostro le 200 email più recenti del periodo.</p> : null}
      </section>

      <section className="adm-panel" aria-labelledby="team-contacts">
        <div className="adm-panel-head">
          <h2 id="team-contacts" className="adm-h2">Contatti assegnati</h2>
          <span className="adm-muted">{formatCount(contacts.length)} in rubrica</span>
        </div>
        {contacts.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Nome</th><th>Fase</th><th>Città</th><th>Prossima azione</th></tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td><Link className="adm-link" href={`/admin/crm/${c.id}` as Route}>{c.businessName}</Link></td>
                    <td>{STAGE_LABEL[c.stage]}</td>
                    <td>{c.city ?? <span className="adm-muted">Nessuna città</span>}</td>
                    <td>{c.nextActionAt ? when(c.nextActionAt) : "Nessuna"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="adm-muted adm-empty">Nessun contatto assegnato.</p>}
        {contacts.length === 200 ? <p className="adm-muted">Mostro i primi 200 contatti.</p> : null}
      </section>

      <section className="adm-panel" aria-labelledby="team-deals">
        <div className="adm-panel-head">
          <h2 id="team-deals" className="adm-h2">Deal</h2>
          <span className="adm-muted">Pipeline, tutti i periodi</span>
        </div>
        <div className="adm-stats adm-team-deal-stats">
          <div className="adm-stat"><span className="adm-muted">Aperte</span><span className="adm-stat-num">{formatCount(totals.open)}</span></div>
          <div className="adm-stat"><span className="adm-muted">Vinte</span><span className="adm-stat-num">{formatCount(totals.won)}</span></div>
          <div className="adm-stat"><span className="adm-muted">Perse</span><span className="adm-stat-num">{formatCount(totals.lost)}</span></div>
          <div className="adm-stat"><span className="adm-muted">Valore aperto</span><span className="adm-stat-num">{formatEur(totals.openValue)}</span></div>
          <div className="adm-stat"><span className="adm-muted">Valore vinto</span><span className="adm-stat-num">{formatEur(totals.wonValue)}</span><span className="adm-muted">Nel periodo: {formatEur(kpi.wonEur)}</span></div>
        </div>
        <p className="adm-muted">Il valore vinto del periodo è la somma dei deal chiusi come vinti in questi {days} giorni. Non si somma agli introiti registrati.</p>
        {deals.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Titolo</th><th>Contatto</th><th>Fase</th><th className="adm-num">Valore</th><th>Chiusura</th></tr>
              </thead>
              <tbody>
                {[...deals].sort((a, b) => Number(Boolean(a.closedAt)) - Number(Boolean(b.closedAt)) || String(b.closedAt ?? "").localeCompare(String(a.closedAt ?? ""))).map((d) => (
                  <tr key={d.id}>
                    <td>{d.title}</td>
                    <td><Link className="adm-link" href={`/admin/crm/${d.contactId}` as Route}>{d.contactName}</Link></td>
                    <td>{STAGE_LABEL[d.stage]}</td>
                    <td className="adm-num">{d.valueEur === null ? <span className="adm-muted">Nessun valore</span> : formatEur(d.valueEur)}</td>
                    <td>{d.closedAt ? when(d.closedAt) : "Aperta"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="adm-muted adm-empty">Nessun deal.</p>}
      </section>

      <section className="adm-panel" aria-labelledby="team-income">
        <div className="adm-panel-head">
          <h2 id="team-income" className="adm-h2">Introiti</h2>
          <span className="adm-muted">{earnings ? `${formatCents(earnings.totalCents)} · ${formatCount(earnings.jobs)} lavori` : ""}</span>
        </div>
        <p className="adm-muted">Lavori registrati su questa persona. Restano fuori dal valore vinto dei deal.</p>
        {earnings && earnings.list.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Data</th><th>Cliente</th><th>Descrizione</th><th>Area</th><th className="adm-num">Importo</th></tr>
              </thead>
              <tbody>
                {earnings.list.map((job) => (
                  <tr key={job.id}>
                    <td>{when(job.date)}</td>
                    <td>{job.client}</td>
                    <td>{job.description}</td>
                    <td>{job.area ? AREA_LABEL[job.area] : <span className="adm-muted">Nessuna area</span>}</td>
                    <td className="adm-num">{formatCents(job.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="adm-muted adm-empty">Nessun introito registrato nel periodo.</p>}
        {earnings && earnings.list.length === 200 ? <p className="adm-muted">Mostro i 200 lavori più recenti. Il totale qui sopra li include tutti.</p> : null}
      </section>

      <section className="adm-panel" aria-labelledby="team-activities">
        <div className="adm-panel-head">
          <h2 id="team-activities" className="adm-h2">Attività</h2>
          <span className="adm-muted">{formatCount(overdue.length)} in ritardo, {formatCount(upcoming.length)} aperte, {formatCount(doneInPeriod.length)} completate nel periodo</span>
        </div>
        {doneActivities.length === 200 ? <p className="adm-muted">L&apos;elenco completate mostra al massimo 200 attività. Il conteggio in alto include tutte quelle chiuse nel periodo.</p> : null}
        <ActivityBlock title="In ritardo" rows={overdue} empty="Nessuna attività in ritardo." />
        <ActivityBlock title="Aperte" rows={upcoming} empty="Nessuna attività aperta." />
        <ActivityBlock title="Completate nel periodo" rows={doneInPeriod} empty="Nessuna attività completata nel periodo." done />
      </section>

      <section className="adm-panel" aria-labelledby="team-trend">
        <div className="adm-panel-head">
          <h2 id="team-trend" className="adm-h2">Trend giornaliero</h2>
          <span className="adm-muted">{days} giorni</span>
        </div>
        <p className="adm-muted">Ogni riga ha la sua scala. I deal vinti sono il numero di chiusure, gli introiti sono importi. Non si sommano.</p>
        <TrendChart points={trend} />
      </section>

      {removed ? (
        <section className="adm-panel">
          <h2 className="adm-h2">Modifica</h2>
          <p className="adm-muted">Profilo rimosso. Lo riattivi dalla lista Ex membri, poi puoi gestirlo di nuovo da qui.</p>
        </section>
      ) : (
        <section className="adm-panel adm-edit-panel" aria-labelledby="team-edit">
          <h2 id="team-edit" className="adm-h2">Modifica</h2>
          <details>
            <summary>Gestisci ruoli, invito, password, verifica in due passaggi e rimozione</summary>
            <EditUserForm user={user} self={user.id === me.id} />
          </details>
        </section>
      )}
    </>
  );
}

function ActivityBlock({ title, rows, empty, done = false }: { title: string; rows: Activity[]; empty: string; done?: boolean }) {
  return (
    <div className="adm-team-activity">
      <h3 className="adm-h3">{title}</h3>
      {rows.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table adm-table-tight">
            <thead>
              <tr><th>Attività</th><th>Tipo</th><th>Scadenza</th><th>Contatto</th>{done ? <th>Completata</th> : null}</tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{ACTIVITY_KIND_LABEL[a.kind]}</td>
                  <td>{when(a.dueDate)}{a.dueTime ? ` ${a.dueTime}` : ""}</td>
                  <td>{a.contactId && a.contactName ? <Link className="adm-link" href={`/admin/crm/${a.contactId}` as Route}>{a.contactName}</Link> : <span className="adm-muted">Nessun contatto</span>}</td>
                  {done ? <td>{when(a.doneAt)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="adm-muted">{empty}</p>}
    </div>
  );
}
