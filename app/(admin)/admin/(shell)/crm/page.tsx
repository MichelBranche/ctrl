import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ActivityCheck } from "@/components/admin/crm/activity-check";
import { CrmIcon, CRM_ICON, CrmTabs, CrmTip, romeToday, ScoreBadge } from "@/components/admin/crm/crm-ui";
import { FollowUpDone, KeyShortcut, NewContactShortcut } from "@/components/admin/crm/follow-up-client";
import { addDays, dueLabel, ScopeSwitch } from "@/components/admin/crm/follow-ups";
import { AttentionLists } from "@/components/admin/crm/attention-pop";
import { CrmBusy } from "@/components/admin/crm/crm-busy";
import { LeavingRow, RollValue } from "@/components/admin/crm/oggi-motion";
import { requireSection } from "@/lib/admin";
import { backfillRequests, crmOverview, dueActions, priorityContacts, recentCrmEvents, unassignedContacts, type CrmEvent } from "@/lib/crm";
import { type Stage } from "@/lib/crm-core";
import { adminCrmSourceLabel, adminCrmStageLabel, formatAdminDate, formatAdminShortAgo, interpolate, type AdminDict, type AdminLocale } from "@/lib/admin-i18n";
import { getAdminCopy } from "@/lib/admin-locale";
import { kpiSeries, liveKpiCounts, recordOggiKpis, type SparkPoint } from "@/lib/crm-kpi";
import { CRM_HOME, followUpScope, PIPELINE, RUBRICA } from "@/lib/crm-nav";
import { listActivities } from "@/lib/crm-activity";
import { isFounder } from "@/lib/team-types";

type SP = Record<string, string | string[] | undefined>;

export default function OggiPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <main className="adm-main crm-main">
      <Suspense fallback={<OggiSkeleton />}><Body searchParams={searchParams} /></Suspense>
    </main>
  );
}

function OggiSkeleton() {
  return (
    <CrmBusy k="loadingCrm" className="crm-oggi-page">
      <div className="crm-oggi-top">
        <div className="adm-skel crm-skel-kicker" />
        <div className="adm-skel crm-skel-title" />
        <div className="adm-skel crm-skel-status" />
        <div className="adm-skel crm-skel-tabs" />
      </div>
      <div className="crm-oggi-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel crm-kpi-skel" />)}</div>
      <div className="crm-oggi-split"><div className="adm-skel crm-skel-panel" /><div className="adm-skel crm-skel-panel is-side" /></div>
      <div className="adm-skel crm-skel-wide" />
      <div className="adm-skel crm-skel-wide is-short" />
    </CrmBusy>
  );
}

const NEW_CONTACT = `${RUBRICA}?nuovo=1#nuovo`;
const LIST = 4;

function romeDateLabel(lang: AdminLocale, now = new Date()) {
  const label = formatAdminDate(now, lang, { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function EmptyNote({ icon, text }: { icon: string; text: string }) {
  return <p className="crm-empty"><CrmIcon d={icon} /><span>{text}</span></p>;
}

function ScoreRing({ score, t }: { score: number | null; t: AdminDict }) {
  if (score === null) return null;
  const level = score >= 70 ? "alto" : score >= 40 ? "medio" : "basso";
  return (
    <span className="crm-score-ring" data-level={level} style={{ ["--p" as string]: score }}>
      <ScoreBadge score={score} t={t} />
    </span>
  );
}

/** A clock time only when the stored value actually has one. A date alone stays blank. */
function clockOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const bare = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (bare && trimmed.length <= 8) return `${bare[1]}:${bare[2]}`;
  const stamp = trimmed.match(/[T ]([01]\d|2[0-3]):([0-5]\d)/);
  return stamp ? `${stamp[1]}:${stamp[2]}` : null;
}

function ago(iso: string, lang: AdminLocale, t: AdminDict, now = Date.now()) {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return t.time.justNow;
  if (min < 60) return interpolate(t.time.minutesAgo, { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? t.crm.hoursAgoOne : interpolate(t.crm.hoursAgoN, { n: h });
  const d = Math.round(h / 24);
  return d === 1 ? t.crm.yesterday : interpolate(t.crm.daysAgoN, { n: d });
}

const EVENT_ICON: Record<string, string> = {
  add: "M12 5v14M5 12h14", stage: CRM_ICON["/admin/crm/pipeline"], radar: CRM_ICON["/admin/crm/radar"], note: "M5 4h11l3 3v13H5zM9 12h6M9 16h4",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6", done: "M5 12.5l4.5 4.5L19 7.5", edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4", archive: "M4 5h16v4H4zM6 9v10h12V9M10 13h4",
};
type Tone = "ok" | "accent" | "violet";
function describe(e: CrmEvent, lang: AdminLocale, t: AdminDict): { icon: string; title: string; sub: string; tone?: Tone } | null {
  const who = e.contactName ?? t.crm.contact;
  switch (e.action) {
    case "crm.contact_create": return { icon: EVENT_ICON.add, title: t.crm.event.contactAdded, sub: who, tone: "ok" };
    case "crm.contact_update": return { icon: EVENT_ICON.edit, title: t.crm.event.contactUpdated, sub: who };
    case "crm.stage": {
      const to = typeof e.details.to === "string" && e.details.to in t.crm.stage ? adminCrmStageLabel(lang, e.details.to as Stage) : null;
      return { icon: EVENT_ICON.stage, title: t.crm.event.stageUpdated, sub: to ? `${who} → ${to}` : who, tone: "accent" };
    }
    case "crm.note": return { icon: EVENT_ICON.note, title: t.crm.event.noteAdded, sub: who, tone: "ok" };
    case "crm.followup_done": return { icon: EVENT_ICON.done, title: t.crm.event.followUpDone, sub: who, tone: "ok" };
    case "crm.draft_sent": return { icon: EVENT_ICON.mail, title: t.crm.event.radarEmailSent, sub: typeof e.details.contact === "string" ? t.crm.radarDraft : who };
    case "crm.contact_archive": return { icon: EVENT_ICON.archive, title: t.crm.event.contactArchived, sub: who };
    case "crm.contact_restore": return { icon: EVENT_ICON.archive, title: t.crm.event.contactRestored, sub: who };
    case "crm.opportunity_create": return { icon: EVENT_ICON.add, title: t.crm.event.dealOpened, sub: who, tone: "accent" };
    case "crm.opportunity_update": return { icon: EVENT_ICON.edit, title: t.crm.event.dealUpdated, sub: who };
    case "crm.opportunity_stage": {
      const to = typeof e.details.to === "string" && e.details.to in t.crm.stage ? adminCrmStageLabel(lang, e.details.to as Stage) : null;
      return { icon: EVENT_ICON.stage, title: t.crm.event.dealStage, sub: to ? `${who} → ${to}` : who, tone: "accent" };
    }
    case "crm.activity_create": return { icon: EVENT_ICON.add, title: t.crm.event.activityCreated, sub: e.contactId ? who : t.crm.noContact };
    case "crm.activity_update": return { icon: EVENT_ICON.edit, title: t.crm.event.activityUpdated, sub: e.contactId ? who : t.crm.noContact };
    case "crm.activity_done": return { icon: EVENT_ICON.done, title: t.crm.event.activityDone, sub: e.contactId ? who : t.crm.noContact, tone: "ok" };
    case "crm.activity_reopen": return { icon: EVENT_ICON.edit, title: t.crm.event.activityReopened, sub: e.contactId ? who : t.crm.noContact };
    case "crm.ingest": {
      const n = Number(e.details.inserted ?? 0), d = Number(e.details.duplicates ?? 0);
      return { icon: EVENT_ICON.radar, title: t.crm.event.irisProspect, sub: `${interpolate(t.crm.ingestNew, { n })}${d ? `, ${interpolate(t.crm.ingestAlsoPresent, { n: d })}` : ""}`, tone: "violet" };
    }
    default: return null;
  }
}

function Sparkline({ points, tone }: { points: SparkPoint[]; tone: "quiet" | "accent" }) {
  const runs: SparkPoint[][] = [];
  for (const point of points) {
    const last = runs[runs.length - 1];
    if (last && point.i === last[last.length - 1]!.i + 1) last.push(point);
    else runs.push([point]);
  }
  const drawn = runs.filter((run) => run.length >= 2);
  if (!drawn.length) return <span className="crm-spark is-idle" data-tone={tone} aria-hidden="true" />;
  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / 29) * 112;
  const y = (v: number) => 4 + (1 - (v - min) / span) * 26;
  return (
    <svg className="crm-spark" data-tone={tone} viewBox="0 0 112 36" aria-hidden="true">
      {drawn.map((run) => {
        const line = run.map((p, i) => `${i ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
        const area = `${line} L${x(run[run.length - 1]!.i).toFixed(1)},36 L${x(run[0]!.i).toFixed(1)},36 Z`;
        return (
          <g key={run[0]!.i}>
            <path className="crm-spark-area" d={area} />
            <path className="crm-spark-line" d={line} />
          </g>
        );
      })}
    </svg>
  );
}

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const { lang, t } = await getAdminCopy();
  const me = await requireSection("crm");
  const sp = await searchParams;
  await backfillRequests().catch(() => {});
  const founder = isFounder(me);
  const scope = followUpScope(typeof sp.ambito === "string" ? sp.ambito : undefined, founder);
  const today = romeToday();
  const tomorrow = addDays(today, 1);
  const viewer = { id: me.id, founder };
  const kpi = await recordOggiKpis().catch(() => liveKpiCounts(today));
  const [ov, due, events, priority, unassigned, openActs, series] = await Promise.all([
    crmOverview(), dueActions(scope === "team" ? null : me.id, today, tomorrow), recentCrmEvents(6).catch(() => []), priorityContacts(3), unassignedContacts(6),
    listActivities({ scope, stato: "aperte", until: tomorrow }, viewer),
    Promise.all([
      kpiSeries("contacts_total", today), kpiSeries("assigned", today), kpiSeries("opportunities_active", today), kpiSeries("todo_due", today),
    ]),
  ]);
  const [contactsLine, assignedLine, dealsLine, todoLine] = series;
  const pipelineStages: Stage[] = ["nuovo", "contattato", "call", "preventivo", "vinto", "perso"];
  const feed = events.map((e) => ({ e, d: describe(e, lang, t) })).filter((x) => x.d);
  const followShown = due.slice(0, LIST);
  const actShown = openActs.slice(0, LIST - followShown.length);
  const month = ov.newThisMonth > 0
    ? { text: interpolate(t.crm.newThisMonth, { n: ov.newThisMonth }), tone: "ok" as const }
    : { text: t.crm.noneThisMonth, tone: "quiet" as const };
  const freeLine = ov.unassigned === 0
    ? { text: t.crm.noneToAssign, tone: "quiet" as const }
    : { text: ov.unassigned === 1 ? t.crm.oneToAssign : interpolate(t.crm.toAssignN, { n: ov.unassigned }), tone: "warn" as const };
  const dealStatus = kpi.opportunitiesActive === 0
    ? t.crm.noneActive
    : kpi.opportunitiesActive === 1 ? t.crm.oneActive : interpolate(t.crm.nActive, { n: kpi.opportunitiesActive });
  const isLate = (day: string) => day.slice(0, 10) < today;
  const todoCount = due.length + openActs.length;
  const overdueCount = due.filter((a) => isLate(a.nextActionAt)).length + openActs.filter((a) => isLate(a.dueDate)).length;
  const urgent = overdueCount === 0
    ? { text: t.crm.noneUrgent, tone: "quiet" as const }
    : { text: overdueCount === 1 ? t.crm.oneUrgent : interpolate(t.crm.nUrgent, { n: overdueCount }), tone: "late" as const };
  const todoTip = scope === "team" ? t.crm.todoTipTeam : t.crm.todoTipMine;

  return (
    <>
      <NewContactShortcut href={NEW_CONTACT} />
      <KeyShortcut href={`${PIPELINE}?nuova=1`} keyName="o" />
      <div className="crm-oggi-page">
        <header className="crm-oggi-top">
          <p className="crm-oggi-eye">{t.crm.eyebrow} / Overview</p>
          <div className="crm-oggi-title">
            <h1 className="adm-h1">{t.crm.oggi}</h1>
            <p className="crm-oggi-sub">{romeDateLabel(lang)} · {t.crm.operationalOverview}</p>
          </div>
          <div className="crm-oggi-actions">
            <Link href={NEW_CONTACT as Route} className="crm-oggi-new"><CrmIcon d={EVENT_ICON.add} /><span>{t.crm.addContact}</span><kbd>N</kbd></Link>
            <details className="crm-oggi-menu">
              <summary aria-label={t.crm.moreActions}><CrmIcon d="M6 9l6 6 6-6" /></summary>
              <div className="crm-oggi-menu-list">
                <Link href={`${PIPELINE}?nuova=1` as Route}><CrmIcon d={CRM_ICON["/admin/crm/pipeline"]} /><span>{t.crm.addDeal}</span><kbd>O</kbd></Link>
                <Link href={`${RUBRICA}?importa=1` as Route}><CrmIcon d="M12 4v11M7 10l5 5 5-5M5 20h14" /><span>{t.crm.importContacts}</span></Link>
                <Link href={"/admin/crm/radar" as Route}><CrmIcon d={CRM_ICON["/admin/crm/radar"]} /><span>{t.crm.radarProspects}</span></Link>
              </div>
            </details>
          </div>
          <CrmTabs current={CRM_HOME} t={t} lang={lang} />
        </header>

        <div hidden><script dangerouslySetInnerHTML={{ __html: "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!sessionStorage.getItem('crm-oggi-kpis'))document.documentElement.classList.add('crm-roll-play')}catch(e){}" }} /></div>
        <section className="crm-oggi-kpis" aria-label={t.crm.crmNumbers}>
          <article className="crm-kpi-card">
            <span className="crm-kpi-label"><CrmIcon d={CRM_ICON["/admin/crm/rubrica"]} /> {t.crm.contacts}</span>
            <span className="crm-kpi-num"><RollValue id="total" text={String(kpi.contactsTotal)} /></span>
            <span className="crm-kpi-meta" data-tone={month.tone}><i />{month.text}</span>
            <Sparkline points={contactsLine} tone="quiet" />
          </article>
          <article className="crm-kpi-card">
            <span className="crm-kpi-label"><CrmIcon d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 11l2 2 4-4" /> {t.crm.assigned}</span>
            <span className="crm-kpi-num"><RollValue id="assigned" text={String(kpi.assigned)} /></span>
            <span className="crm-kpi-meta" data-tone={freeLine.tone}><i />{freeLine.text}</span>
            <Sparkline points={assignedLine} tone="quiet" />
          </article>
          <article className="crm-kpi-card">
            <span className="crm-kpi-label"><CrmIcon d={CRM_ICON["/admin/crm/pipeline"]} /> {t.crm.deals}</span>
            <span className="crm-kpi-num"><RollValue id="open" text={String(kpi.opportunitiesActive)} /></span>
            <span className="crm-kpi-meta" data-tone="quiet"><i />{dealStatus}</span>
            <Sparkline points={dealsLine} tone="quiet" />
          </article>
          <article className="crm-kpi-card">
            <span className="crm-kpi-label"><CrmIcon d={CRM_ICON["/admin/crm/attivita"]} /> {t.crm.toDo} <CrmTip text={todoTip} /></span>
            <span className="crm-kpi-num"><RollValue id={`todo-${scope}`} text={String(todoCount)} /></span>
            <span className="crm-kpi-meta" data-tone={urgent.tone}><i />{urgent.text}</span>
            <Sparkline points={todoLine} tone="accent" />
          </article>
        </section>

        <div className="crm-oggi-split">
          <section className="crm-card-panel" aria-labelledby="crm-todo-h">
            <div className="crm-panel-head">
              <h2 id="crm-todo-h" className="adm-h2">
                <CrmIcon d={CRM_ICON["/admin/crm/attivita"]} /> {t.crm.toDoToday}
                <CrmTip text={t.crm.followUpsFromCard} />
              </h2>
              <div className="crm-head-actions">
                {founder ? <ScopeSwitch base={CRM_HOME} scope={scope} t={t} /> : null}
                <Link className="crm-more" href={(scope === "team" ? "/admin/crm/attivita?ambito=team" : "/admin/crm/attivita") as Route}>{t.crm.allActivities}</Link>
              </div>
            </div>
            <div className="crm-card-body">
              {followShown.length || actShown.length ? (
                <ul className="crm-todo">
                  {followShown.map((a) => {
                    const due = dueLabel(a.nextActionAt, today, lang, t);
                    const time = clockOf(a.nextActionAt);
                    return (
                      <li key={a.id} className="crm-todo-row">
                        <FollowUpDone id={a.id} seenAt={a.nextActionAt} label={`${a.nextAction || "Prossima azione"}, ${a.businessName}`} />
                        <div className="crm-todo-text">
                          <Link href={`${CRM_HOME}/${a.id}` as Route} className="crm-todo-title">{a.nextAction || "Prossima azione da definire"}</Link>
                          <span className="adm-muted">{a.businessName}{scope === "team" ? ` · ${a.ownerName ?? t.crm.unassigned}` : ""}</span>
                        </div>
                        <span className="crm-due" data-tone={due.tone}>{due.text}</span>
                        <span className="crm-clock">{time ?? "–"}{time ? null : <span className="adm-sr"> {t.crm.timeNotSet}</span>}</span>
                      </li>
                    );
                  })}
                  {actShown.map((a) => {
                    const due = dueLabel(a.dueDate, today, lang, t);
                    const time = clockOf(a.dueTime);
                    return (
                      <LeavingRow key={a.id}>
                        <div className="crm-todo-row">
                          <ActivityCheck id={a.id} version={a.version} done={false} label={`Completa ${a.title}`} />
                          <div className="crm-todo-text">
                            <Link href={`/admin/crm/attivita?a=${a.id}${scope === "team" ? "&ambito=team" : ""}` as Route} className="crm-todo-title">{a.title}</Link>
                            <span className="adm-muted">{a.contactName ?? t.crm.noContact}</span>
                          </div>
                          <span className="crm-due" data-tone={due.tone}>{due.text}</span>
                          <span className="crm-clock">{time ?? "–"}{time ? null : <span className="adm-sr"> {t.crm.timeNotSet}</span>}</span>
                        </div>
                      </LeavingRow>
                    );
                  })}
                </ul>
              ) : <EmptyNote icon={CRM_ICON["/admin/crm/attivita"]} text={scope === "team" ? "Niente in scadenza per il team." : "Niente in scadenza per te."} />}
            </div>
          </section>

          <section className="crm-card-panel" aria-labelledby="crm-attn-h">
            <div className="crm-panel-head">
              <h2 id="crm-attn-h" className="adm-h2">
                <CrmIcon d="M12 9v4M12 17h.01M10.3 4.5 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0z" /> {t.crm.needsAttention}
              </h2>
            </div>
            <div className="crm-card-body">
              <AttentionLists
                freeCount={String(ov.unassigned)}
                prioCount={String(priority.length)}
                freePanel={(
                  <>
                    {unassigned.length ? (
                      <ul className="crm-attn-list">
                        {unassigned.map((c) => (
                          <li key={c.id}>
                            <Link href={`${CRM_HOME}/${c.id}` as Route}>{c.businessName}</Link>
                            <span className="adm-muted">{adminCrmSourceLabel(lang, c.source)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="crm-empty">{t.crm.noUnassignedContacts}</p>}
                    <Link className="crm-more" href={"/admin/crm/rubrica?resp=none" as Route}>{t.crm.filteredList}</Link>
                  </>
                )}
                prioPanel={(
                  <>
                    {priority.length ? (
                      <ul className="crm-attn-list">
                        {priority.map((c) => (
                          <li key={c.id}>
                            <Link href={`${CRM_HOME}/${c.id}` as Route}>{c.businessName}</Link>
                            <ScoreRing score={c.score} t={t} />
                          </li>
                        ))}
                      </ul>
                    ) : <p className="crm-empty">{t.crm.noScoredContacts}</p>}
                    <Link className="crm-more" href={"/admin/crm/rubrica?ordina=punteggio&dir=desc" as Route}>{t.crm.listByScore}</Link>
                  </>
                )}
              />
            </div>
            <p className="crm-card-foot"><Link className="crm-more is-accent" href={RUBRICA as Route}>{t.crm.openRubrica}</Link></p>
          </section>
        </div>

        <section className="crm-card-panel" aria-labelledby="crm-pipe-h">
          <div className="crm-panel-head">
            <h2 id="crm-pipe-h" className="adm-h2">
              <CrmIcon d={CRM_ICON["/admin/crm/pipeline"]} /> {t.crm.salesPipeline}
              <CrmTip text={t.crm.pipelineCountsContacts} />
            </h2>
            <Link className="crm-more" href={PIPELINE as Route}>{t.crm.openPipeline}</Link>
          </div>
          <div className="crm-bar" role="img" aria-label={pipelineStages.map((s) => `${adminCrmStageLabel(lang, s)} ${ov.byStage[s]}`).join(", ")}>
            <div className="crm-bar-fill">
              {ov.total
                ? pipelineStages.map((s) => (ov.byStage[s] ? <span key={s} data-stage={s} style={{ flexGrow: ov.byStage[s] }} /> : null))
                : <span className="crm-bar-idle" />}
            </div>
          </div>
          <ol className="crm-pipe-cols">
            {pipelineStages.map((s) => (
              <li key={s}>
                <span>{adminCrmStageLabel(lang, s)}</span>
                <strong>{ov.byStage[s]}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="crm-card-panel" aria-labelledby="crm-feed-h">
          <div className="crm-panel-head">
            <h2 id="crm-feed-h" className="adm-h2"><CrmIcon d="M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" /> {t.crm.recentActivity}</h2>
            {founder ? <Link className="crm-more" href={"/admin/audit" as Route}>{t.crm.seeAll}</Link> : null}
          </div>
          {feed.length ? (
            <ul className="crm-feed">
              {feed.map(({ e, d }) => (
                <li key={e.id}>
                  <span className="crm-feed-icon" data-tone={d!.tone}><CrmIcon d={d!.icon} /></span>
                  <span className="crm-feed-line">
                    {e.contactId ? <Link href={`${CRM_HOME}/${e.contactId}` as Route}>{d!.title}</Link> : <strong>{d!.title}</strong>}
                    <span className="adm-muted">{d!.sub}{e.actor ? ` · ${e.actor}` : ""}</span>
                  </span>
                  <time className="crm-ago" dateTime={e.at}>{ago(e.at, lang, t)}</time>
                </li>
              ))}
            </ul>
          ) : <EmptyNote icon="M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" text={t.crm.noRecentActivity} />}
        </section>
      </div>
    </>
  );
}
