import { UserAvatar } from "@/components/admin/user-avatar";
import { Suspense } from "react";
import { PanelSkeleton } from "@/components/admin/dashboard";
import Link from "next/link";
import type { Route } from "next";
import { LeaderboardSwitch, NewUserForm, ReactivateUser } from "@/components/admin/team/team-forms";
import { KpiGrid, PeriodNav, formatCents } from "@/components/admin/team/work-view";
import { requireSection } from "@/lib/admin";
import { leaderboardVisible, listUsers, type TeamUser } from "@/lib/team";
import { INVITE_STATUS_LABEL } from "@/lib/team-invite-core";
import { ZERO_KPI, parseTeamPeriod, teamMemberKpisFor, teamQuery, type TeamPeriodDays } from "@/lib/team-stats";
import { AREA_LABEL, isFounder, ROLE_COLOR, ROLE_LABEL, ROLE_SECTIONS, SECTION_LABEL, TEAM_ROLES } from "@/lib/team-types";

type SP = Record<string, string | string[] | undefined>;

export default function TeamPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <main className="adm-main">
      <Suspense fallback={<PanelSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" }) : "mai";
const until = (ms: number | null) => (ms ? new Date(ms).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" }) : "");
const STATUS_CLASS = { attivo: "is-published", invitato: "is-scheduled", scaduto: "is-draft", revocato: "is-draft", disattivato: "is-draft", rimosso: "is-draft" } as const;
const listHref = (days: TeamPeriodDays) => `/admin/team${teamQuery(days)}`;

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("team");
  const sp = await searchParams;
  const days = parseTeamPeriod(sp.giorni);
  let users: TeamUser[];
  let board = false;
  let kpis = new Map<string, typeof ZERO_KPI>();
  try {
    [users, board, kpis] = await Promise.all([listUsers(), leaderboardVisible(), teamMemberKpisFor(days)]);
  } catch {
    return <p className="adm-error">Database non raggiungibile.</p>;
  }
  const former = users.filter((u) => u.status === "rimosso");
  const active = users.filter((u) => u.status !== "rimosso");
  return (
    <>
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Team</h1>
          <p className="adm-muted">Profili, ruoli e inviti. Solo il founder vede e modifica questa pagina.</p>
        </div>
      </header>

      <div className="adm-grid2">
        <section className="adm-panel adm-rise" style={{ "--i": 0 } as React.CSSProperties}>
          <h2 className="adm-h2">Impostazioni team</h2>
          <LeaderboardSwitch visible={board} />
        </section>
        <section className="adm-panel adm-rise" style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className="adm-h2">Cosa può aprire ogni ruolo</h2>
          <dl className="adm-dl">
            {TEAM_ROLES.map((r) => (
              <div key={r} style={{ display: "contents" }}>
                <dt><span className="adm-chip-dot" style={{ "--chip": ROLE_COLOR[r] } as React.CSSProperties} aria-hidden /> {ROLE_LABEL[r]}</dt>
                <dd>{r === "founder" ? "Tutto, compresi Team e Registro" : ROLE_SECTIONS[r].length ? ROLE_SECTIONS[r].map((x) => SECTION_LABEL[x]).join(", ") : "Solo le sezioni di base"}</dd>
              </div>
            ))}
          </dl>
          <p className="adm-muted">Chi ha più ruoli somma i permessi. Tutti vedono Panoramica, Desk, Introiti (solo i propri lavori) e Impostazioni. La casella Email si concede a persona. I founder hanno accesso completo e la verifica in due passaggi obbligatoria.</p>
        </section>
      </div>

      <section className="adm-panel adm-rise" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="adm-panel-head">
          <h2 className="adm-h2">Profili</h2>
          <PeriodNav days={days} hrefFor={listHref} />
        </div>
        <p className="adm-muted">Il periodo vale per email inviate, attività completate, valore vinto e introiti registrati. I contatti assegnati e le attività in ritardo sono lo stock di adesso. Valore vinto e introiti restano separati.</p>
        <p className="adm-muted">{active.length} {active.length === 1 ? "utente" : "utenti"}</p>
        <ul className="adm-users">
          {active.map((u, i) => {
            const kpiId = `kpi-${u.id}`;
            const off = u.status !== "attivo" && u.status !== "invitato";
            return (
              <li key={u.id} className="adm-rise" style={{ "--i": i } as React.CSSProperties}>
                <article className="adm-user" data-off={off || undefined}>
                  <header className="adm-user-head">
                    <UserAvatar name={u.name} src={u.avatarUrl} />
                    <div className="adm-user-id">
                      <h3>
                        <Link className="adm-user-card-link" href={`/admin/team/${u.id}${teamQuery(days)}` as Route} aria-describedby={kpiId}>
                          {u.name}{u.id === me.id ? <em className="adm-muted"> · tu</em> : null}
                        </Link>
                      </h3>
                      <span className="adm-muted">{u.email}</span>
                    </div>
                    <span className="adm-chips adm-chips-static">
                      {u.roles.map((r) => (
                        <span key={r} className="adm-chip" data-on style={{ "--chip": ROLE_COLOR[r] } as React.CSSProperties}><span className="adm-chip-dot" aria-hidden />{ROLE_LABEL[r]}</span>
                      ))}
                    </span>
                    <span className="adm-muted">{u.area ? AREA_LABEL[u.area] : isFounder(u.roles) ? "Tutte le aree" : "Nessuna area"}{u.emailAccess ? " · Email" : ""}</span>
                    <p className="adm-user-seen">
                      <span className={`adm-badge ${STATUS_CLASS[u.status]}`}>{INVITE_STATUS_LABEL[u.status]}</span>{" "}
                      <span className="adm-muted">
                        {u.status === "attivo" ? `Ultimo accesso: ${when(u.lastLoginAt)}` : u.status === "invitato" ? `Scade: ${until(u.inviteExpiresAt)}` : u.status === "scaduto" ? "Reinvia per un nuovo link" : ""}
                      </span>
                    </p>
                  </header>
                  <KpiGrid id={kpiId} kpi={kpis.get(u.id) ?? ZERO_KPI} />
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      {former.length ? (
        <section className="adm-panel adm-rise" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="adm-panel-head">
            <h2 className="adm-h2">Ex membri</h2>
            <span className="adm-muted">Non possono accedere. Nome e storico restano su registro, introiti, email e desk.</span>
          </div>
          <ul className="adm-users">
            {former.map((u) => (
              <li key={u.id} className="adm-user" data-off>
                <div className="adm-user-former">
                  <UserAvatar name={u.name} src={u.avatarUrl} />
                  <span className="adm-user-id">
                    <strong><Link className="adm-link" href={`/admin/team/${u.id}${teamQuery(days)}` as Route}>{u.name}</Link></strong>
                    <span className="adm-muted">{u.email}</span>
                  </span>
                  <span className="adm-badge is-draft">Rimosso il {when(u.removedAt)}{u.removedBy ? ` da ${u.removedBy}` : ""}</span>
                  <span className="adm-num">{formatCents(u.totalCents)} <span className="adm-muted">· {u.jobs} lavori</span></span>
                  <span className="adm-row-actions">
                    <Link className="adm-link" href={`/admin/audit?utente=${encodeURIComponent(u.id)}`}>Attività</Link>
                    <Link className="adm-link" href={`/admin/introiti?u=${encodeURIComponent(u.id)}&range=all`}>Introiti</Link>
                    <ReactivateUser id={u.id} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="adm-panel adm-rise" style={{ "--i": 4 } as React.CSSProperties}>
        <h2 className="adm-h2">Invita nel team</h2>
        <NewUserForm />
      </section>
    </>
  );
}
