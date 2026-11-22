import "@/components/ds/admin-ui.css";
import "@/components/ds/crm.css";
import "@/components/ds/status.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/oggi.css";
import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ActivityCheck } from "@/components/admin/crm/activity-check";
import { CrmIcon, CRM_ICON, CrmTabs, CrmTip, initials, romeToday } from "@/components/admin/crm/crm-ui";
import { FollowUpDone, KeyShortcut, NewContactShortcut } from "@/components/admin/crm/follow-up-client";
import { addDays, ScopeSwitch } from "@/components/admin/crm/follow-ups";
import { LeavingRow, RollValue } from "@/components/admin/crm/oggi-motion";
import { SnoozeMenu, type SnoozeOption } from "@/components/admin/crm/oggi-snooze";
import { RubricaStages } from "@/components/admin/crm/rubrica-stages";
import { PopDismiss } from "@/components/admin/crm/rubrica-tools";
import { DueChip, ScoreMeter, StageBadge, ToneAvatar, toneOf } from "@/components/ds/status";
import { requireSection } from "@/lib/admin";
import { backfillRequests, crmOverview, dueActions, priorityContacts, recentCrmEvents, unassignedContacts, type CrmEvent } from "@/lib/crm";
import { ACTIVITY_KIND_LABEL, SOURCE_LABEL, STAGES, STAGE_LABEL, type ActivityKind, type Stage } from "@/lib/crm-core";
import { kpiSeries, liveKpiCounts, recordOggiKpis, type SparkPoint } from "@/lib/crm-kpi";
import { CRM_HOME, followUpScope, PIPELINE, RUBRICA } from "@/lib/crm-nav";
import { listActivities } from "@/lib/crm-activity";
import { isFounder } from "@/lib/team-types";

type SP = Record<string, string | string[] | undefined>;

export default function OggiPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<OggiSkeleton />}><Body searchParams={searchParams} /></Suspense>
  );
}

function OggiSkeleton() {
  return (
    <main className="ds-page cr rb og" aria-busy="true" aria-label="Caricamento del CRM">
      <div className="rb-main">
        <div className="og-skel" style={{ minHeight: "8.5rem" }} />
        <div className="og-skel" style={{ minHeight: "7rem" }} />
        <div className="og-skel" style={{ minHeight: "22rem" }} />
      </div>
    </main>
  );
}

const NEW_CONTACT = `${RUBRICA}?nuovo=1#nuovo`;

function romeDateLabel(now = new Date()) {
  const label = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" }).format(now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function EmptyNote({ icon, text }: { icon: string; text: string }) {
  return <p className="og-empty"><CrmIcon d={icon} /><span>{text}</span></p>;
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

function ago(iso: string, now = Date.now()) {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "ora";
  if (min < 60) return `${min} min fa`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${h === 1 ? "ora" : "ore"} fa`;
  const d = Math.round(h / 24);
  return d === 1 ? "ieri" : `${d} giorni fa`;
}

const EVENT_ICON: Record<string, string> = {
  add: "M12 5v14M5 12h14", stage: CRM_ICON["/admin/crm/pipeline"], radar: CRM_ICON["/admin/crm/radar"], note: "M5 4h11l3 3v13H5zM9 12h6M9 16h4",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6", done: "M5 12.5l4.5 4.5L19 7.5", edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4", archive: "M4 5h16v4H4zM6 9v10h12V9M10 13h4",
};
type Tone = "ok" | "accent" | "violet";
function describe(e: CrmEvent): { icon: string; title: string; sub: string; tone?: Tone } | null {
  const who = e.contactName ?? "Contatto";
  switch (e.action) {
    case "crm.contact_create": return { icon: EVENT_ICON.add, title: "Contatto aggiunto", sub: who, tone: "ok" };
    case "crm.contact_update": return { icon: EVENT_ICON.edit, title: "Contatto aggiornato", sub: who };
    case "crm.stage": {
      const to = typeof e.details.to === "string" && e.details.to in STAGE_LABEL ? STAGE_LABEL[e.details.to as Stage] : null;
      return { icon: EVENT_ICON.stage, title: "Fase aggiornata", sub: to ? `${who} → ${to}` : who, tone: "accent" };
    }
    case "crm.note": return { icon: EVENT_ICON.note, title: "Nota aggiunta", sub: who, tone: "ok" };
    case "crm.followup_done": return { icon: EVENT_ICON.done, title: "Follow-up completato", sub: who, tone: "ok" };
    case "crm.draft_sent": return { icon: EVENT_ICON.mail, title: "Email inviata da Radar", sub: typeof e.details.contact === "string" ? "Bozza Radar" : who };
    case "crm.contact_archive": return { icon: EVENT_ICON.archive, title: "Contatto archiviato", sub: who };
    case "crm.contact_restore": return { icon: EVENT_ICON.archive, title: "Contatto ripristinato", sub: who };
    case "crm.opportunity_create": return { icon: EVENT_ICON.add, title: "Opportunità aperta", sub: who, tone: "accent" };
    case "crm.opportunity_update": return { icon: EVENT_ICON.edit, title: "Trattativa aggiornata", sub: who };
    case "crm.opportunity_stage": {
      const to = typeof e.details.to === "string" && e.details.to in STAGE_LABEL ? STAGE_LABEL[e.details.to as Stage] : null;
      return { icon: EVENT_ICON.stage, title: "Fase della trattativa", sub: to ? `${who} → ${to}` : who, tone: "accent" };
    }
    case "crm.activity_create": return { icon: EVENT_ICON.add, title: "Attività creata", sub: e.contactId ? who : "Senza contatto" };
    case "crm.activity_update": return { icon: EVENT_ICON.edit, title: "Attività aggiornata", sub: e.contactId ? who : "Senza contatto" };
    case "crm.activity_done": return { icon: EVENT_ICON.done, title: "Attività completata", sub: e.contactId ? who : "Senza contatto", tone: "ok" };
    case "crm.activity_reopen": return { icon: EVENT_ICON.edit, title: "Attività riaperta", sub: e.contactId ? who : "Senza contatto" };
    case "crm.ingest": {
      const n = Number(e.details.inserted ?? 0), d = Number(e.details.duplicates ?? 0);
      return { icon: EVENT_ICON.radar, title: "Prospect da Iris", sub: `${n} nuovi${d ? `, ${d} già presenti` : ""}`, tone: "violet" };
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
    <svg className="crm-spark" data-tone={tone} viewBox="0 0 112 36" preserveAspectRatio="none" aria-hidden="true">
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


type Bucket = "ritardo" | "oggi" | "domani";
const BUCKETS: { id: Bucket; label: string; hint: string }[] = [
  { id: "ritardo", label: "In ritardo", hint: "Scaduti nei giorni passati" },
  { id: "oggi", label: "Oggi", hint: "In scadenza oggi" },
  { id: "domani", label: "Domani", hint: "In scadenza domani" },
];
const isBucket = (v: unknown): v is Bucket => v === "ritardo" || v === "oggi" || v === "domani";

const KIND_ICON: Record<ActivityKind | "contatto", string> = {
  contatto: "M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
  followup: "M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
  email: "M3 6h18v12H3zM3 7l9 6 9-6",
  call: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
  meeting: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  radar: CRM_ICON["/admin/crm/radar"],
  altro: "M5 12.5l4.5 4.5L19 7.5",
};

type TodoRow = {
  key: string; bucket: Bucket; kind: ActivityKind | "contatto"; kindLabel: string; title: string; href: string;
  who: string; stage: Stage | null; owner: string | null; day: string; time: string | null;
  done: { kind: "followup"; id: string; seenAt: string } | { kind: "activity"; id: string; version: number };
  snooze: { kind: "followup"; id: string; version: number; text: string | null } | { kind: "activity"; id: string; version: number };
};

const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short" });

/** Later days offered by "Rimanda", from today (Rome). */
function snoozeOptions(today: string): SnoozeOption[] {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = addDays(today, ((8 - weekday) % 7) || 7);
  const raw = [
    { day: addDays(today, 1), label: "Domani" },
    { day: addDays(today, 3), label: "Tra 3 giorni" },
    { day: monday, label: "Lunedì prossimo" },
    { day: addDays(today, 7), label: "Tra una settimana" },
  ];
  const seen = new Set<string>();
  return raw.filter((o) => (seen.has(o.day) ? false : (seen.add(o.day), true))).map((o) => ({ ...o, hint: shortDay(o.day) }));
}

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const sp = await searchParams;
  await backfillRequests().catch(() => {});
  const founder = isFounder(me);
  const scope = followUpScope(typeof sp.ambito === "string" ? sp.ambito : undefined, founder);
  const filter = isBucket(sp.scadenza) ? sp.scadenza : null;
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
  const feed = events.map((e) => ({ e, d: describe(e) })).filter((x) => x.d);
  const bucketOf = (day: string): Bucket => (day.slice(0, 10) < today ? "ritardo" : day.slice(0, 10) === today ? "oggi" : "domani");
  const team = scope === "team";

  const rows: TodoRow[] = [
    ...due.map((a): TodoRow => ({
      key: `c-${a.id}`, bucket: bucketOf(a.nextActionAt), kind: "contatto", kindLabel: "Follow-up", title: a.nextAction || "Prossima azione da definire",
      href: `${CRM_HOME}/${a.id}`, who: a.businessName, stage: a.stage, owner: a.ownerName, day: a.nextActionAt.slice(0, 10), time: clockOf(a.nextActionAt),
      done: { kind: "followup", id: a.id, seenAt: a.nextActionAt }, snooze: { kind: "followup", id: a.id, version: a.version, text: a.nextAction },
    })),
    ...openActs.map((a): TodoRow => ({
      key: `a-${a.id}`, bucket: bucketOf(a.dueDate), kind: a.kind, kindLabel: ACTIVITY_KIND_LABEL[a.kind], title: a.title,
      href: `/admin/crm/attivita?a=${a.id}${team ? "&ambito=team" : ""}`, who: a.contactName ?? "Senza contatto", stage: a.contactStage, owner: a.assigneeName,
      day: a.dueDate, time: clockOf(a.dueTime),
      done: { kind: "activity", id: a.id, version: a.version }, snooze: { kind: "activity", id: a.id, version: a.version },
    })),
  ].sort((x, y) => (x.day === y.day ? (x.time ?? "99").localeCompare(y.time ?? "99") : x.day.localeCompare(y.day)));

  const counts = { ritardo: 0, oggi: 0, domani: 0 } as Record<Bucket, number>;
  for (const r of rows) counts[r.bucket] += 1;
  const todoCount = rows.length;
  const shown = filter ? rows.filter((r) => r.bucket === filter) : rows;
  const options = snoozeOptions(today);
  const href = (next: { scadenza?: Bucket | null; ambito?: string }) => {
    const q = new URLSearchParams();
    const amb = next.ambito ?? (team ? "team" : "");
    if (amb) q.set("ambito", amb);
    const sc = next.scadenza === undefined ? filter : next.scadenza;
    if (sc) q.set("scadenza", sc);
    const s = q.toString();
    return s ? `${CRM_HOME}?${s}` : CRM_HOME;
  };
  const stageTotal = STAGES.reduce((n, st) => n + ov.byStage[st], 0);
  const month = ov.newThisMonth > 0 ? { text: `+${ov.newThisMonth} questo mese`, tone: "ok" as const } : { text: "Nessuno nuovo questo mese", tone: "quiet" as const };
  const freeLine = ov.unassigned === 0
    ? { text: "Tutti assegnati", tone: "ok" as const }
    : { text: ov.unassigned === 1 ? "1 da assegnare" : `${ov.unassigned} da assegnare`, tone: "warn" as const };
  const dealStatus = kpi.opportunitiesActive === 0 ? "Nessuna attiva" : kpi.opportunitiesActive === 1 ? "1 attiva" : `${kpi.opportunitiesActive} attive`;
  const urgent = counts.ritardo === 0
    ? { text: "Nessuna in ritardo", tone: "ok" as const }
    : { text: counts.ritardo === 1 ? "1 in ritardo" : `${counts.ritardo} in ritardo`, tone: "late" as const };
  const todoTip = team
    ? "Il numero è il da fare del team, come la lista: follow-up e attività in scadenza fino a domani. La linea è il totale dell'agenzia."
    : "Il numero è il tuo da fare, come la lista: follow-up e attività in scadenza fino a domani. La linea è il totale dell'agenzia, perché lo storico non si divide per persona.";
  const groups = (filter ? BUCKETS.filter((b) => b.id === filter) : BUCKETS).map((b) => ({ ...b, rows: shown.filter((r) => r.bucket === b.id) })).filter((g) => g.rows.length);
  let rowIndex = 0;

  return (
    <>
      <NewContactShortcut href={NEW_CONTACT} />
      <KeyShortcut href={`${PIPELINE}?nuova=1`} keyName="o" />
      <PopDismiss />
      <main className="ds-page cr rb og">
        <div className="rb-main">
          <header className="rb-head">
            <div className="rb-head-row">
              <div className="rb-head-title">
                <p className="rb-kicker">CRM · {romeDateLabel()}</p>
                <h1>Oggi <span className="rb-count" aria-label={`${todoCount} da fare`}>{todoCount.toLocaleString("it-IT")} da fare</span></h1>
              </div>
              <div className="rb-head-actions">
                <details className="rb-pop og-more">
                  <summary className="rb-btn" aria-label="Altre azioni"><span>Altro</span><CrmIcon d="M6 9l6 6 6-6" /></summary>
                  <div className="rb-pop-panel og-more-panel" role="menu">
                    <Link role="menuitem" href={`${PIPELINE}?nuova=1` as Route}><CrmIcon d={CRM_ICON["/admin/crm/pipeline"]} /><span>Aggiungi opportunità</span><kbd>O</kbd></Link>
                    <Link role="menuitem" href={`${RUBRICA}?importa=1` as Route}><CrmIcon d="M12 4v11M7 10l5 5 5-5M5 20h14" /><span>Importa contatti</span></Link>
                    <Link role="menuitem" href={"/admin/crm/radar" as Route}><CrmIcon d={CRM_ICON["/admin/crm/radar"]} /><span>Prospect Radar</span></Link>
                  </div>
                </details>
                <Link className="rb-cta" href={NEW_CONTACT as Route} aria-keyshortcuts="N">
                  <CrmIcon d="M12 5v14M5 12h14" /><span>Nuovo contatto</span><kbd aria-hidden="true">N</kbd>
                </Link>
              </div>
            </div>
            <CrmTabs current={CRM_HOME} />
          </header>

          <section className="og-strip" aria-labelledby="og-strip-h" data-active={filter ?? undefined}>
            <div className="og-strip-head">
              <h2 id="og-strip-h">Da fare oggi <CrmTip text="Follow-up dei contatti e attività in scadenza fino a domani. Un riquadro filtra la lista; cliccalo di nuovo per tornare a tutto." /></h2>
              {founder ? <ScopeSwitch base={CRM_HOME} scope={scope} /> : null}
            </div>
            <div className="og-strip-bar" aria-hidden="true">
              {todoCount ? BUCKETS.map((b, i) => counts[b.id] ? <span key={b.id} data-due={b.id} style={{ flexGrow: counts[b.id], ["--i" as string]: i }} /> : null) : <span className="og-strip-idle" />}
            </div>
            <nav className="og-strip-tiles" aria-label="Filtra per scadenza">
              {BUCKETS.map((b, i) => (
                <Link key={b.id} data-due={b.id} href={href({ scadenza: filter === b.id ? null : b.id }) as Route} scroll={false}
                  aria-current={filter === b.id ? "true" : undefined} title={filter === b.id ? "Togli il filtro" : `${b.hint}: mostra solo questi`} style={{ ["--i" as string]: i }}>
                  <span className="og-tile-label"><i aria-hidden="true" />{b.label}</span>
                  <span className="og-tile-n">{counts[b.id]}</span>
                  <span className="og-tile-sub">{b.id === "oggi" ? shortDay(today) : b.id === "domani" ? shortDay(tomorrow) : counts.ritardo ? "da recuperare" : "niente"}</span>
                </Link>
              ))}
              <Link data-due="tutto" href={href({ scadenza: null }) as Route} scroll={false} aria-current={filter ? undefined : "true"} title="Mostra tutto" style={{ ["--i" as string]: 3 }}>
                <span className="og-tile-label"><i aria-hidden="true" />Tutto</span>
                <span className="og-tile-n">{todoCount}</span>
                <span className="og-tile-sub">{team ? "del team" : "tuoi"}</span>
              </Link>
            </nav>
          </section>

          <div className="og-grid">
            <section className="og-list" aria-labelledby="og-list-h">
              <div className="og-list-head">
                <h2 id="og-list-h">Follow-up e attività {filter ? <span className="rb-badge rb-badge-quiet">{shown.length}</span> : null}</h2>
                <Link className="og-link" href={(team ? "/admin/crm/attivita?ambito=team" : "/admin/crm/attivita") as Route}>Tutte le attività <CrmIcon d="M5 12h14M13 6l6 6-6 6" /></Link>
              </div>
              {groups.length ? groups.map((g) => (
                <div key={g.id} className="og-group" data-due={g.id}>
                  <h3 className="og-group-h"><i aria-hidden="true" />{g.label}<span>{g.rows.length}</span></h3>
                  <ul className="og-rows">
                    {g.rows.map((r) => {
                      const late = r.day < today ? Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${r.day}T12:00:00Z`)) / 86_400_000) : 0;
                      const chip = late ? (late === 1 ? "Da ieri" : `Da ${late} giorni`) : r.day === today ? "Oggi" : "Domani";
                      const i = rowIndex++;
                      const sub = (
                        <span className="og-row-sub">
                          <span className="og-row-who">{r.who}</span>
                          {r.stage ? <StageBadge stage={r.stage} label={STAGE_LABEL[r.stage]} /> : null}
                          {team ? <span className="og-row-owner">{r.owner ? <><ToneAvatar letters={initials(r.owner)} tone={toneOf(r.owner)} size="sm" />{r.owner}</> : "Non assegnato"}</span> : null}
                        </span>
                      );
                      const body = (
                        <div className="og-row" style={{ ["--i" as string]: Math.min(i, 12) }}>
                          <span className="og-row-done">
                            {r.done.kind === "followup"
                              ? <FollowUpDone id={r.done.id} seenAt={r.done.seenAt} label={`${r.title}, ${r.who}`} />
                              : <ActivityCheck id={r.done.id} version={r.done.version} done={false} label={`Completa ${r.title}`} />}
                          </span>
                          <span className="og-kind" data-kind={r.kind} title={r.kindLabel}><CrmIcon d={KIND_ICON[r.kind]} /><span className="adm-sr">{r.kindLabel}</span></span>
                          <span className="og-row-main">
                            <Link href={r.href as Route} className="og-row-title">{r.title}</Link>
                            {sub}
                          </span>
                          <span className="og-row-when">
                            <DueChip label={chip} overdue={late > 0} today={r.day === today} />
                            <span className="og-clock">{r.time ?? <span className="adm-sr">orario non indicato</span>}</span>
                          </span>
                          <span className="og-row-act"><SnoozeMenu target={r.snooze} options={options.filter((o) => o.day !== r.day)} label={r.title} /></span>
                        </div>
                      );
                      return r.done.kind === "activity" ? <LeavingRow key={r.key}>{body}</LeavingRow> : <li key={r.key} className="og-li">{body}</li>;
                    })}
                  </ul>
                </div>
              )) : (
                <EmptyNote icon={CRM_ICON["/admin/crm/attivita"]} text={filter ? "Niente in questa scadenza." : team ? "Niente in scadenza per il team." : "Niente in scadenza per te."} />
              )}
            </section>

            <aside className="og-side">
              <section className="og-card" aria-labelledby="og-attn-h">
                <div className="og-card-head">
                  <h2 id="og-attn-h">Richiedono attenzione</h2>
                </div>
                <div className="og-attn">
                  <div className="og-attn-block" data-tone={ov.unassigned ? "warn" : "ok"}>
                    <p className="og-attn-title"><i aria-hidden="true" />Senza responsabile <b>{ov.unassigned}</b></p>
                    {unassigned.length ? (
                      <ul className="og-mini">
                        {unassigned.map((c) => (
                          <li key={c.id}>
                            <ToneAvatar letters={initials(c.businessName)} tone={toneOf(c.businessName)} size="sm" />
                            <Link href={`${CRM_HOME}/${c.id}` as Route}>{c.businessName}</Link>
                            <span className="og-mini-meta">{SOURCE_LABEL[c.source]}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="og-mini-empty">Nessun contatto senza responsabile.</p>}
                    <Link className="og-link" href={"/admin/crm/rubrica?resp=none" as Route}>Elenco filtrato <CrmIcon d="M5 12h14M13 6l6 6-6 6" /></Link>
                  </div>
                  <div className="og-attn-block" data-tone="ok">
                    <p className="og-attn-title"><i aria-hidden="true" />Punteggio più alto <b>{priority.length}</b></p>
                    {priority.length ? (
                      <ul className="og-mini">
                        {priority.map((c) => (
                          <li key={c.id}>
                            <ToneAvatar letters={initials(c.businessName)} tone={toneOf(c.businessName)} size="sm" />
                            <Link href={`${CRM_HOME}/${c.id}` as Route}>{c.businessName}</Link>
                            <ScoreMeter score={c.score} compact />
                          </li>
                        ))}
                      </ul>
                    ) : <p className="og-mini-empty">Nessun contatto con punteggio.</p>}
                    <Link className="og-link" href={"/admin/crm/rubrica?ordina=punteggio&dir=desc" as Route}>Elenco per punteggio <CrmIcon d="M5 12h14M13 6l6 6-6 6" /></Link>
                  </div>
                </div>
              </section>

              <section className="og-card" aria-labelledby="og-feed-h">
                <div className="og-card-head">
                  <h2 id="og-feed-h">Attività recenti</h2>
                  {founder ? <Link className="og-link" href={"/admin/audit" as Route}>Vedi tutte <CrmIcon d="M5 12h14M13 6l6 6-6 6" /></Link> : null}
                </div>
                {feed.length ? (
                  <ul className="og-feed">
                    {feed.map(({ e, d }) => (
                      <li key={e.id}>
                        <span className="og-feed-icon" data-tone={d!.tone}><CrmIcon d={d!.icon} /></span>
                        <span className="og-feed-line">
                          {e.contactId ? <Link href={`${CRM_HOME}/${e.contactId}` as Route}>{d!.title}</Link> : <strong>{d!.title}</strong>}
                          <span>{d!.sub}{e.actor ? ` · ${e.actor}` : ""}</span>
                        </span>
                        <time dateTime={e.at}>{ago(e.at)}</time>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyNote icon="M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" text="Nessuna attività recente." />}
              </section>
            </aside>
          </div>

          <div hidden><script dangerouslySetInnerHTML={{ __html: "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!sessionStorage.getItem('crm-oggi-kpis'))document.documentElement.classList.add('crm-roll-play')}catch(e){}" }} /></div>
          <section className="og-kpis" aria-label="Numeri del CRM">
            <Link href={RUBRICA as Route} className="og-kpi" data-kpi="contatti" style={{ ["--i" as string]: 0 }}>
              <span className="og-tile-label"><i aria-hidden="true" />Contatti</span>
              <span className="og-kpi-n"><RollValue id="total" text={String(kpi.contactsTotal)} /></span>
              <span className="og-kpi-meta" data-tone={month.tone}>{month.text}</span>
              <Sparkline points={contactsLine} tone="quiet" />
            </Link>
            <div className="og-kpi" data-kpi="assegnati" style={{ ["--i" as string]: 1 }}>
              <span className="og-tile-label"><i aria-hidden="true" />Assegnati</span>
              <span className="og-kpi-n"><RollValue id="assigned" text={String(kpi.assigned)} /></span>
              <span className="og-kpi-meta" data-tone={freeLine.tone}>{freeLine.text}</span>
              <Sparkline points={assignedLine} tone="quiet" />
            </div>
            <Link href={PIPELINE as Route} className="og-kpi" data-kpi="opportunita" style={{ ["--i" as string]: 2 }}>
              <span className="og-tile-label"><i aria-hidden="true" />Opportunità</span>
              <span className="og-kpi-n"><RollValue id="open" text={String(kpi.opportunitiesActive)} /></span>
              <span className="og-kpi-meta" data-tone="quiet">{dealStatus}</span>
              <Sparkline points={dealsLine} tone="quiet" />
            </Link>
            <div className="og-kpi" data-kpi="dafare" style={{ ["--i" as string]: 3 }}>
              <span className="og-tile-label"><i aria-hidden="true" />Da fare <CrmTip text={todoTip} /></span>
              <span className="og-kpi-n"><RollValue id={`todo-${scope}`} text={String(todoCount)} /></span>
              <span className="og-kpi-meta" data-tone={urgent.tone}>{urgent.text}</span>
              <Sparkline points={todoLine} tone="accent" />
            </div>
          </section>

          <section className="og-pipe" aria-labelledby="og-pipe-h">
            <div className="og-card-head og-pipe-head">
              <h2 id="og-pipe-h">Contatti per fase <CrmTip text="Conta i contatti, non le trattative. Un riquadro apre la rubrica filtrata per quella fase." /></h2>
              <Link className="og-link" href={PIPELINE as Route}>Apri pipeline <CrmIcon d="M5 12h14M13 6l6 6-6 6" /></Link>
            </div>
            <RubricaStages counts={ov.byStage} total={stageTotal} active={null}
              hrefs={Object.fromEntries(STAGES.map((st) => [st, `${RUBRICA}?fase=${st}`])) as Record<Stage, string>} />
          </section>
        </div>
      </main>
    </>
  );
}
