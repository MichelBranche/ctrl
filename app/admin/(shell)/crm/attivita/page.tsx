import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ActivityCheck } from "@/components/admin/crm/activity-check";
import { ActivityDialog, type ActivityDraftView } from "@/components/admin/crm/activity-dialog";
import { ContactPanel } from "@/components/admin/crm/contact-panel";
import { CrmHeader, CrmIcon, CrmTabs, romeToday } from "@/components/admin/crm/crm-ui";
import { FollowUpDone } from "@/components/admin/crm/follow-up-client";
import { ScopeSwitch } from "@/components/admin/crm/follow-ups";
import { requireSection } from "@/lib/admin";
import { activityTotals, getActivity, listActivities, monthMarks, openDealsForContact, weekProgress, type Activity } from "@/lib/crm-activity";
import { crmOwners, dueActions, getContact, type DueAction } from "@/lib/crm";
import { ACTIVITY_KIND_LABEL, STAGE_LABEL, type Stage } from "@/lib/crm-core";
import {
  activitySearch, addIsoDays, ATTIVITA, contactMailHref, followUpScope, PANEL_TABS, parseActivityQuery, romeWeek,
  type ActivityQuery, type PanelTab,
} from "@/lib/crm-nav";
import { canAccess, isFounder } from "@/lib/team-types";

type SP = Record<string, string | string[] | undefined>;

export default function AttivitaPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <main className="adm-main crm-main"><Suspense fallback={<p className="adm-muted" aria-busy="true">Caricamento…</p>}><Body searchParams={searchParams} /></Suspense></main>;
}

const KIND_ICON: Record<Activity["kind"], string> = {
  email: "M3 6h18v12H3zM3 7l9 6 9-6",
  call: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  meeting: "M4 5h16v15H4zM8 3v4M16 3v4M4 9h16",
  radar: "M12 12l5-5M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5M12 12h.01",
  followup: "M9 5H5v14h14v-4M14 5h5v5M11 13l8-8",
  altro: "M7 3h7l5 5v13H7zM14 3v5h5",
};

function bucket(date: string, today: string): string {
  if (date < today) return "In ritardo";
  if (date === today) return "Oggi";
  if (date === addIsoDays(today, 1)) return "Domani";
  if (date <= romeWeek(today).end) return "Questa settimana";
  return "Più avanti";
}

const GROUP_ORDER = ["In ritardo", "Oggi", "Domani", "Questa settimana", "Più avanti"];

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const sp = await searchParams;
  const founder = isFounder(me);
  const parsed = parseActivityQuery(sp);
  const scope = followUpScope(parsed.ambito, founder);
  const query: ActivityQuery = { ...parsed, ambito: scope, resp: founder && scope === "team" ? parsed.resp : "" };
  const today = romeToday();
  const month = query.mese || today.slice(0, 7);
  const viewer = { id: me.id, founder };
  const [items, totals, week, marks, owners, followups] = await Promise.all([
    listActivities({
      q: query.q, scope, stato: query.stato, resp: query.resp, unassigned: query.resp === "none",
      fase: query.fase, priority: query.prio === "alta" || query.prio === "media" || query.prio === "bassa" || query.prio === "nessuna" ? query.prio : undefined,
      giorno: query.giorno,
    }, viewer),
    activityTotals(viewer, scope, today, month),
    weekProgress(viewer, scope, romeWeek(today).start, romeWeek(today).end),
    monthMarks(viewer, scope, month),
    founder ? crmOwners() : Promise.resolve([]),
    query.stato === "fatte" || query.prio ? Promise.resolve([]) : dueActions(scope === "team" ? null : me.id, today, addIsoDays(today, 60)),
  ]);
  const follow = followups.filter((f) => {
    const day = f.nextActionAt.slice(0, 10);
    if (query.giorno && day !== query.giorno) return false;
    if (query.fase && f.stage !== query.fase) return false;
    if (query.resp === "none" && f.ownerUserId) return false;
    if (query.resp && query.resp !== "none" && f.ownerUserId !== query.resp) return false;
    if (query.q) {
      const blob = `${f.nextAction ?? ""} ${f.businessName}`.toLowerCase();
      if (!blob.includes(query.q.toLowerCase())) return false;
    }
    return true;
  });
  const fuToday = follow.filter((f) => f.nextActionAt.slice(0, 10) === today).length;
  const fuLate = follow.filter((f) => f.nextActionAt.slice(0, 10) < today).length;
  const fuSoon = follow.filter((f) => { const d = f.nextActionAt.slice(0, 10); return d > today && d <= addIsoDays(today, 7); }).length;
  const editing = query.a ? await getActivity(query.a, viewer) : null;
  const presetId = query.contatto || editing?.contactId || "";
  const preset = presetId ? await getContact(presetId) : null;
  const deals = preset ? await openDealsForContact(preset.id) : [];
  if (editing?.opportunityId && !deals.some((d) => d.id === editing.opportunityId)) deals.push({ id: editing.opportunityId, title: "Opportunità già collegata" });
  const href = (patch: Partial<ActivityQuery>) => `${ATTIVITA}${activitySearch(query, patch)}`;
  const mailDa = activitySearch(query, { c: "", nuova: false, a: "", tab: "dettagli" }).slice(1);
  const panelLinks = query.c ? {
    close: href({ c: "" }),
    tabs: Object.fromEntries(PANEL_TABS.map((t) => [t, href({ c: query.c, tab: t })])) as Record<PanelTab, string>,
    email: { list: contactMailHref(query.c, "attivita", mailDa), compose: contactMailHref(query.c, "attivita", mailDa, true) },
  } : null;
  const draft: ActivityDraftView | null = editing ? {
    id: editing.id, version: editing.version, title: editing.title, kind: editing.kind, dueDate: editing.dueDate,
    dueTime: editing.dueTime, priority: editing.priority, assigneeUserId: editing.assigneeUserId,
    contactId: editing.contactId, contactName: editing.contactName, opportunityId: editing.opportunityId,
  } : null;
  const groups = new Map<string, { activities: Activity[]; follow: DueAction[] }>();
  for (const name of GROUP_ORDER) groups.set(name, { activities: [], follow: [] });
  for (const a of items) groups.get(bucket(a.dueDate, today))!.activities.push(a);
  for (const f of follow) groups.get(bucket(f.nextActionAt.slice(0, 10), today))!.follow.push(f);
  const empty = !items.length && !follow.length;
  const delta = totals.prevMonth > 0 ? Math.round(((totals.doneMonth - totals.prevMonth) / totals.prevMonth) * 100) : null;
  const meetings = canAccess(me, "meetings");

  return (
    <div className="crm-rubrica" data-panel={query.c ? "open" : undefined}>
      <div className="crm-rubrica-main">
        <CrmHeader title="Attività" intro="Gestisci follow-up, scadenze e attività. Non perdere un'opportunità.">
          <ActivityDialog query={query} owners={owners} me={me.id} founder={founder} editing={draft} deals={deals} preset={preset ? { id: preset.id, name: preset.businessName } : null} />
          <Link className="adm-btn" href={(meetings ? "/admin/riunioni" : "#crm-cal") as Route}>{meetings ? "Calendario" : "Calendario del mese"}</Link>
        </CrmHeader>
        <CrmTabs current={ATTIVITA} />
        <p className="crm-notice" role="note">
          Le attività di questa pagina sono solo quelle create con «Nuova attività». Un follow-up già sulla scheda resta un follow-up
          (lo vedi qui, non è stato copiato). La scrivania personale non entra in questo elenco.
        </p>
        <section className="crm-kpis is-compact" aria-label="Riepilogo">
          <div className="crm-kpi"><span className="crm-kpi-num">{totals.today + fuToday}</span><span className="crm-kpi-label">Attività di oggi</span></div>
          <div className="crm-kpi"><span className="crm-kpi-num">{totals.soon + fuSoon}</span><span className="crm-kpi-label">In scadenza</span></div>
          <div className="crm-kpi" data-tone={totals.overdue + fuLate ? "late" : undefined}><span className="crm-kpi-num">{totals.overdue + fuLate}</span><span className="crm-kpi-label">In ritardo</span></div>
          <div className="crm-kpi">
            <span className="crm-kpi-num">{totals.doneMonth}</span><span className="crm-kpi-label">Completate nel mese</span>
            {delta !== null ? <span className="crm-kpi-chip is-quiet" title={`${totals.prevMonth} nel mese precedente`}>{delta > 0 ? `+${delta}` : delta}% sul mese scorso</span> : null}
          </div>
        </section>
        <div className="crm-act">
          <section className="crm-card-panel" aria-labelledby="crm-act-h">
            <div className="crm-panel-head">
              <h2 id="crm-act-h" className="adm-h2">{scope === "team" ? "Attività del team" : "Le mie"}</h2>
              {founder ? <ScopeSwitch base={ATTIVITA} scope={scope} /> : null}
            </div>
            <form className="crm-act-filters" method="get" action={ATTIVITA} role="search">
              {scope === "team" ? <input type="hidden" name="ambito" value="team" /> : null}
              {query.giorno ? <input type="hidden" name="giorno" value={query.giorno} /> : null}
              {query.mese ? <input type="hidden" name="mese" value={query.mese} /> : null}
              <input className="adm-input" name="q" defaultValue={query.q} placeholder="Cerca attività, azienda, nota…" aria-label="Cerca" />
              <select className="adm-input" name="stato" defaultValue={query.stato} aria-label="Stato">
                <option value="aperte">Aperte</option>
                <option value="fatte">Completate</option>
                <option value="tutte">Tutti gli stati</option>
              </select>
              {founder && scope === "team" ? (
                <select className="adm-input" name="resp" defaultValue={query.resp} aria-label="Responsabile">
                  <option value="">Tutti i responsabili</option>
                  <option value="none">Non assegnate</option>
                  {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : null}
              <select className="adm-input" name="fase" defaultValue={query.fase} aria-label="Fase del contatto">
                <option value="">Tutte le fasi</option>
                {(Object.keys(STAGE_LABEL) as Stage[]).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
              <select className="adm-input" name="prio" defaultValue={query.prio} aria-label="Priorità">
                <option value="">Priorità</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="bassa">Bassa</option>
                <option value="nessuna">Senza priorità</option>
              </select>
              <button className="adm-btn" type="submit">Filtra</button>
              {query.giorno ? <Link className="adm-btn adm-btn-sm" href={href({ giorno: "" }) as Route}>Togli il giorno</Link> : null}
            </form>
            {empty ? (
              <p className="adm-muted crm-empty">
                Nessuna attività {scope === "team" ? "del team" : "tua"} con questi filtri. Un contatto in Call, un punteggio Iris, un import CSV o un&apos;email non creano una riga.
                I follow-up già sulle schede, se ci sono, compaiono qui senza essere convertiti.
              </p>
            ) : null}
            {[...groups.entries()].map(([label, group]) => (group.activities.length || group.follow.length) ? (
              <div key={label} className="crm-group">
                <h3 className="crm-group-title">{label} <span className="crm-count">{group.activities.length + group.follow.length}</span></h3>
                <ul className="crm-act-list">
                  {group.activities.map((a) => <ActivityRow key={a.id} a={a} today={today} showAssignee={scope === "team"} editHref={href({ a: a.id, nuova: false })} openHref={a.contactId ? href({ c: a.contactId, nuova: false, a: "" }) : ""} />)}
                  {group.follow.map((f) => <FollowRow key={f.id} f={f} today={today} showOwner={scope === "team"} openHref={href({ c: f.id, nuova: false, a: "" })} />)}
                </ul>
              </div>
            ) : null)}
          </section>
          <aside className="crm-rail" aria-label="Calendario e scadenze">
            <Month month={month} marks={marks} today={today} selected={query.giorno} href={(m, day) => href({ mese: m === today.slice(0, 7) ? "" : m, giorno: day })} />
            <section className="crm-card-panel">
              <h2 className="adm-h2">Prossime scadenze</h2>
              <Upcoming items={items.filter((a) => !a.doneAt).slice(0, 5)} href={(id) => href({ c: id })} />
            </section>
            <section className="crm-card-panel">
              <h2 className="adm-h2">{scope === "team" ? "Attività del team" : "Le mie"} <span className="adm-muted">Questa settimana</span></h2>
              {week.total ? (
                <>
                  <p className="crm-act-progress"><strong>{week.done}</strong> di {week.total} con scadenza in questa settimana</p>
                  <div className="crm-act-bar" role="meter" aria-valuemin={0} aria-valuemax={week.total} aria-valuenow={week.done} aria-label="Completate questa settimana">
                    <span style={{ width: `${Math.round((week.done / week.total) * 100)}%` }} />
                  </div>
                </>
              ) : <p className="adm-muted">Nessuna attività con scadenza in questa settimana.</p>}
            </section>
          </aside>
        </div>
      </div>
      {panelLinks && query.c ? <ContactPanel id={query.c} tab={query.tab} me={me} links={panelLinks} /> : null}
    </div>
  );
}

function ActivityRow({ a, today, showAssignee, editHref, openHref }: { a: Activity; today: string; showAssignee: boolean; editHref: string; openHref: string }) {
  const late = !a.doneAt && a.dueDate < today;
  const badge = a.opportunityStage ? `Pipeline: ${STAGE_LABEL[a.opportunityStage]}` : a.contactStage ? STAGE_LABEL[a.contactStage] : "";
  return (
    <li className="crm-act-row">
      <ActivityCheck id={a.id} version={a.version} done={Boolean(a.doneAt)} label={`${a.doneAt ? "Riapri" : "Completa"} ${a.title}`} />
      <span className="crm-act-kind" title={ACTIVITY_KIND_LABEL[a.kind]}><CrmIcon d={KIND_ICON[a.kind]} /></span>
      <div className="crm-todo-text">
        {openHref ? <Link href={openHref as Route} className="crm-todo-title">{a.title}</Link> : <strong className="crm-todo-title">{a.title}</strong>}
        <span className="adm-muted">{[a.contactName, a.city].filter(Boolean).join(" · ") || "Senza contatto"}</span>
      </div>
      {badge ? <span className="crm-stage" data-stage={a.opportunityStage ?? a.contactStage ?? undefined}>{badge}</span> : <span />}
      {a.contactSource === "radar" || a.kind === "radar" ? <span className="adm-badge">Radar</span> : null}
      {showAssignee ? <span className="crm-avatar is-sm" title={a.assigneeName ?? "Non assegnata"}>{(a.assigneeName ?? "·").slice(0, 1)}</span> : null}
      <time className="crm-due" data-tone={late ? "late" : a.dueDate === today ? "today" : "soon"} dateTime={`${a.dueDate}${a.dueTime ? `T${a.dueTime}` : ""}`}>{a.dueTime ?? `${Number(a.dueDate.slice(8))} ${a.dueDate.slice(5, 7)}`}</time>
      <Link className="adm-btn adm-btn-sm" href={editHref as Route}>Modifica</Link>
    </li>
  );
}

function FollowRow({ f, today, showOwner, openHref }: { f: DueAction; today: string; showOwner: boolean; openHref: string }) {
  const day = f.nextActionAt.slice(0, 10);
  const label = f.nextAction || "Follow-up del contatto";
  return (
    <li className="crm-act-row">
      <FollowUpDone id={f.id} seenAt={f.nextActionAt} label={`${label}, ${f.businessName}`} />
      <span className="crm-act-kind" title="Follow-up del contatto"><CrmIcon d={KIND_ICON.followup} /></span>
      <div className="crm-todo-text">
        <Link href={openHref as Route} className="crm-todo-title">{label}</Link>
        <span className="adm-muted">{f.businessName}{showOwner ? ` · ${f.ownerName ?? "Non assegnato"}` : ""} · follow-up del contatto</span>
      </div>
      <span className="crm-stage" data-stage={f.stage}>{STAGE_LABEL[f.stage]}</span>
      <time className="crm-due" data-tone={day < today ? "late" : day === today ? "today" : "soon"} dateTime={day}>{day.slice(8).replace(/^0/, "")}/{day.slice(5, 7)}</time>
    </li>
  );
}

function Upcoming({ items, href }: { items: Activity[]; href: (contactId: string) => string }) {
  if (!items.length) return <p className="adm-muted">Nessuna scadenza aperta.</p>;
  return (
    <ul className="crm-act-upcoming">
      {items.map((a) => (
        <li key={a.id}>
          {a.contactId ? <Link href={href(a.contactId) as Route}>{a.title}</Link> : <span>{a.title}</span>}
          <span className="adm-muted">{a.dueTime ? `${a.dueDate.slice(8)} ${a.dueTime}` : a.dueDate}</span>
        </li>
      ))}
    </ul>
  );
}

const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];

function Month({ month, marks, today, selected, href }: {
  month: string; marks: Record<string, { activities: number; meetings: number }>; today: string; selected: string;
  href: (month: string, day: string) => string;
}) {
  const [y, m] = month.split("-").map(Number);
  const firstWd = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "short" }).format(new Date(`${month}-01T12:00:00Z`));
  const idx = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[firstWd] ?? 1;
  const lead = idx === 0 ? 6 : idx - 1;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", month: "long", year: "numeric" });
  const cells: { date: string }[] = [];
  for (let i = 0; i < lead; i++) cells.push({ date: "" });
  for (let d = 1; d <= count; d++) cells.push({ date: `${month}-${String(d).padStart(2, "0")}` });
  return (
    <section className="crm-card-panel" id="crm-cal" aria-labelledby="crm-cal-h">
      <div className="crm-panel-head">
        <h2 id="crm-cal-h" className="adm-h2">{label}</h2>
        <span className="adm-row-actions">
          <Link className="crm-icon-btn" href={href(prev, "") as Route} aria-label="Mese precedente" scroll={false}>‹</Link>
          <Link className="crm-icon-btn" href={href(next, "") as Route} aria-label="Mese successivo" scroll={false}>›</Link>
        </span>
      </div>
      <div className="crm-cal" role="grid" aria-label={label}>
        {WEEKDAYS.map((d, i) => <span key={`${d}${i}`} className="crm-cal-wd" role="columnheader">{d}</span>)}
        {cells.map((c, i) => c.date ? (
          <Link key={c.date} href={href(month, selected === c.date ? "" : c.date) as Route} role="gridcell" aria-current={c.date === today ? "date" : undefined} aria-selected={c.date === selected} data-mark={marks[c.date] ? "" : undefined} title={marks[c.date] ? `${marks[c.date].activities} attività, ${marks[c.date].meetings} riunioni` : undefined}>
            {Number(c.date.slice(8))}
          </Link>
        ) : <span key={`e${i}`} />)}
      </div>
    </section>
  );
}
