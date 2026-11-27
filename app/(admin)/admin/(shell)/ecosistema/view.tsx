import { QuotesDirectory } from "@/components/admin/ecosystem/quotes-directory";
import { ArrowUpRight } from "@/components/ds/arrow-up-right";
import { DsEmptyState } from "@/components/ds/empty-state";
import { DsMetricBars } from "@/components/ds/metric-bars";
import { DsMetricCard } from "@/components/ds/metric-card";
import { DsTable } from "@/components/ds/data-table";
import { ecosystemIcon } from "@/lib/ecosystem";
import { formatAdminDate, interpolate, type AdminDict, type AdminLocale } from "@/lib/admin-i18n";
import type { QuotesMetrics, QuotesMetricsResult } from "@/lib/ecosystem-metrics";
import Link from "next/link";

function monthLabel(month: string, lang: AdminLocale): string {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return month;
  return formatAdminDate(new Date(Date.UTC(year, m - 1, 1)), lang, { month: "short" });
}

function monthFull(month: string, lang: AdminLocale): string {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return month;
  return formatAdminDate(new Date(Date.UTC(year, m - 1, 1)), lang, { month: "short", year: "numeric" });
}

export function EcosystemHeader({ t, lead }: { t: AdminDict["ecosystem"]; lead?: string }) {
  return (
    <header className="eco-head">
      <p className="eco-kicker">CTRL®</p>
      <h1 className="eco-title">{t.title}</h1>
      <p className="eco-lead">{lead ?? t.lead}</p>
    </header>
  );
}

export function QuotesCard({ t, result }: { t: AdminDict["ecosystem"]; result: QuotesMetricsResult }) {
  return (
    <article className="eco-card" data-product="quotes">
      <div className="eco-card-head">
        <div className="eco-brand">
          <img className="eco-icon" src={ecosystemIcon("quotes")} width={48} height={48} alt="" />
          <div>
            <h2>{t.quotesName}</h2>
            <p>{t.quotesLead}</p>
          </div>
        </div>
        <span className="eco-pill" data-tone={result.status === "ok" ? "live" : "soon"}>
          {result.status === "ok" ? t.statusLive : t.statusSoon}
        </span>
      </div>
      {result.status === "ok" ? (
        <div className="eco-snap">
          <div>
            <span>{t.workspaces}</span>
            <strong>{result.data.workspacesAlive}</strong>
          </div>
          <div>
            <span>{t.trialsActive}</span>
            <strong>{result.data.trialsActive}</strong>
          </div>
          <div>
            <span>{t.quotes}</span>
            <strong>{result.data.quotes}</strong>
          </div>
        </div>
      ) : (
        <p className="eco-lead">{result.status === "unconfigured" ? t.unconfigured : t.unavailable}</p>
      )}
      <Link href="/admin/ecosistema/quotes" className="eco-cta">
        {t.open}
        <ArrowUpRight className="eco-arrow" />
      </Link>
    </article>
  );
}

export function AgendaCard({ t }: { t: AdminDict["ecosystem"] }) {
  return (
    <article className="eco-card">
      <div className="eco-card-head">
        <div className="eco-brand">
          <img className="eco-icon" src={ecosystemIcon("agenda")} width={48} height={48} alt="" />
          <div>
            <h2>{t.agendaName}</h2>
            <p>{t.agendaLead}</p>
          </div>
        </div>
        <span className="eco-pill" data-tone="soon">{t.statusSoon}</span>
      </div>
      <p className="eco-lead">{t.agendaBody}</p>
      <Link href="/admin/ecosistema/agenda" className="eco-cta eco-cta-ghost">
        {t.open}
        <ArrowUpRight className="eco-arrow" />
      </Link>
    </article>
  );
}

export function QuotesDetail({
  t,
  lang,
  result,
}: {
  t: AdminDict["ecosystem"];
  lang: AdminLocale;
  result: QuotesMetricsResult;
}) {
  return (
    <>
      <header className="eco-head">
        <Link href="/admin/ecosistema" className="eco-back">← {t.back}</Link>
        <h1 className="eco-title">{t.quotesName}</h1>
        <p className="eco-lead">{t.quotesLead}</p>
        {result.status === "ok" ? (
          <p className="eco-kicker">{interpolate(t.updated, { when: formatAdminDate(result.data.generatedAt, lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}</p>
        ) : null}
      </header>
      {result.status !== "ok" ? (
        <DsEmptyState title={t.quotesName} body={result.status === "unconfigured" ? t.unconfigured : t.unavailable} />
      ) : (
        <QuotesFigures t={t} lang={lang} data={result.data} />
      )}
    </>
  );
}

function QuotesFigures({ t, lang, data }: { t: AdminDict["ecosystem"]; lang: AdminLocale; data: QuotesMetrics }) {
  const bars = data.signups.map((row) => ({ label: monthLabel(row.month, lang), value: row.workspaces }));
  return (
    <>
      <section className="eco-metrics">
        <DsMetricCard label={t.workspaces} value={data.workspacesAlive} />
        <DsMetricCard label={t.users} value={data.users} />
        <DsMetricCard label={t.quotes} value={data.quotes} />
        <DsMetricCard label={t.trialsActive} value={data.trialsActive} />
        <DsMetricCard label={t.trialsExpired} value={data.trialsExpired} />
        <DsMetricCard label={t.lifetime} value={data.lifetimeOverrides} />
        <DsMetricCard label={t.stripeSubs} value={t.statusPayments} pending hint={t.paymentsBody} />
        <DsMetricCard label={t.mrr} value={t.statusPayments} pending />
      </section>
      <QuotesDirectory t={t} lang={lang} users={data.userList} workspaces={data.workspaceList} />
      <DsMetricBars title={t.signupsTitle} caption={t.signupsCaption} data={bars} empty={t.emptyChart} />
      {data.signups.some((row) => row.workspaces > 0) ? (
        <DsTable
          title={t.signupsTitle}
          columns={[
            { key: "month", label: t.month },
            { key: "workspaces", label: t.signups, numeric: true },
          ]}
          rows={data.signups.map((row) => ({ month: monthFull(row.month, lang), workspaces: row.workspaces }))}
        />
      ) : null}
      <DsEmptyState title={t.paymentsTitle} body={t.paymentsBody} />
    </>
  );
}

export function AgendaDetail({ t }: { t: AdminDict["ecosystem"] }) {
  return (
    <>
      <header className="eco-head">
        <Link href="/admin/ecosistema" className="eco-back">← {t.back}</Link>
        <h1 className="eco-title">{t.agendaName}</h1>
        <p className="eco-lead">{t.agendaLead}</p>
      </header>
      <DsEmptyState title={t.agendaTitle} body={t.agendaBody} />
    </>
  );
}
