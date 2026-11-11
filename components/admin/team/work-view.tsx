import Link from "next/link";
import type { Route } from "next";
import { normEmail } from "@/lib/crm-core";
import { parseRecipients } from "@/lib/mail/recipients";
import { TEAM_PERIODS, type EmailContact, type MemberKpi, type TeamDayPoint, type TeamPeriodDays } from "@/lib/team-stats";

const count = new Intl.NumberFormat("it-IT");
const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "short" });

export const formatCount = (n: number) => count.format(n);
export const formatEur = (n: number) => eur.format(n);
export const formatCents = (cents: number) => eur.format(cents / 100);
export const unconfirmedLabel = (n: number) => `${formatCount(n)} ${n === 1 ? "non confermata" : "non confermate"}`;

export function PeriodNav({ days, hrefFor }: { days: TeamPeriodDays; hrefFor: (days: TeamPeriodDays) => string }) {
  return (
    <nav className="adm-seg" aria-label="Periodo">
      {TEAM_PERIODS.map((d) => (
        <Link key={d} href={hrefFor(d) as Route} className="adm-seg-item" aria-current={days === d ? "page" : undefined} scroll={false}>
          {d} giorni
        </Link>
      ))}
    </nav>
  );
}

/** The five workload numbers. Won value and registered income stay in separate cells. */
export function KpiGrid({ kpi, id }: { kpi: MemberKpi; id?: string }) {
  return (
    <dl className="adm-user-kpis" id={id}>
      <div className="adm-user-kpi">
        <dt>Email inviate</dt>
        <dd>
          {formatCount(kpi.emailsSent)}
          <small>{unconfirmedLabel(kpi.emailsUnconfirmed)}</small>
        </dd>
      </div>
      <div className="adm-user-kpi">
        <dt>Contatti di cui è responsabile</dt>
        <dd>{formatCount(kpi.contacts)}</dd>
      </div>
      <div className="adm-user-kpi">
        <dt>Attività completate</dt>
        <dd>
          {formatCount(kpi.activitiesDone)}
          <small>{formatCount(kpi.activitiesOverdue)} in ritardo</small>
        </dd>
      </div>
      <div className="adm-user-kpi">
        <dt>Valore vinto</dt>
        <dd>
          {formatEur(kpi.wonEur)}
          {kpi.wonEur === 0 ? <small>Nessun deal chiuso</small> : null}
        </dd>
      </div>
      <div className="adm-user-kpi">
        <dt>Introiti registrati</dt>
        <dd>
          {formatCents(kpi.incomeCents)}
          {kpi.incomeCents === 0 ? <small>Nessun introito</small> : null}
        </dd>
      </div>
    </dl>
  );
}

export function EmailRecipients({ raw, contacts }: { raw: string; contacts: Map<string, EmailContact> }) {
  const parts = parseRecipients(raw);
  if (!parts.length) return <span className="adm-muted">Nessun destinatario</span>;
  return (
    <>
      {parts.map((part, i) => {
        const email = normEmail(part);
        const hit = contacts.get(email);
        return (
          <span key={`${email}-${i}`}>
            {i > 0 ? ", " : null}
            {hit ? <Link className="adm-link" href={`/admin/crm/${hit.id}` as Route} title={hit.name}>{email}</Link> : email}
          </span>
        );
      })}
    </>
  );
}

const SERIES = [
  { key: "emails", label: "Email inviate", series: "email" },
  { key: "activities", label: "Attività completate", series: "activity" },
  { key: "won", label: "Deal vinti", series: "won" },
  { key: "income", label: "Introiti registrati", series: "income" },
] as const;

/** One independent bar row per signal. A day with nothing is a flat baseline, not a missing column. */
export function TrendChart({ points }: { points: TeamDayPoint[] }) {
  if (!points.length) return <p className="adm-muted adm-empty">Nessun giorno nel periodo.</p>;
  const first = points[0]?.day ?? "";
  const mid = points[Math.floor((points.length - 1) / 2)]?.day ?? first;
  const last = points[points.length - 1]?.day ?? first;
  return (
    <div className="adm-team-trend">
      {SERIES.map((series) => {
        const values = points.map((p) => series.key === "income" ? p.incomeCents : p[series.key]);
        const max = Math.max(...values, 0);
        const total = values.reduce((sum, n) => sum + n, 0);
        const totalLabel = series.key === "income" ? formatCents(total) : formatCount(total);
        return (
          <div className="adm-team-trend-row" key={series.key}>
            <div className="adm-team-trend-head">
              <span>{series.label}</span>
              <strong>{totalLabel}</strong>
            </div>
            <div className="adm-team-trend-bars" data-series={series.series} role="img" aria-label={`${series.label}: ${totalLabel}`}>
              {points.map((p, i) => {
                const value = values[i] ?? 0;
                const label = series.key === "income" ? formatCents(value) : formatCount(value);
                return <span key={p.day} style={{ height: max > 0 ? `${(value / max) * 100}%` : "0%" }} title={`${dayLabel(p.day)}: ${label}`} />;
              })}
            </div>
          </div>
        );
      })}
      <div className="adm-team-trend-axis">
        <span>{dayLabel(first)}</span>
        <span>{dayLabel(mid)}</span>
        <span>{dayLabel(last)}</span>
      </div>
    </div>
  );
}
