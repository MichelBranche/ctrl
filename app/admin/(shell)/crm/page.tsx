import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ActivityCheck } from "@/components/admin/crm/activity-check";
import { CrmHeader, CrmIcon, CRM_ICON, CrmTabs, CrmTip, eur, romeToday, ScoreBadge } from "@/components/admin/crm/crm-ui";
import { KeyShortcut, NewContactShortcut } from "@/components/admin/crm/follow-up-client";
import { addDays, dueLabel, FollowUpRows, ScopeSwitch } from "@/components/admin/crm/follow-ups";
import { LeavingRow, RollValue } from "@/components/admin/crm/oggi-motion";
import { requireSection } from "@/lib/admin";
import { backfillRequests, crmOverview, dueActions, priorityContacts, recentCrmEvents, unassignedContacts, type CrmEvent } from "@/lib/crm";
import { conversionRate, SOURCE_LABEL, STAGE_LABEL, type Stage } from "@/lib/crm-core";
import { CRM_HOME, followUpScope, PIPELINE, RUBRICA } from "@/lib/crm-nav";
import { listActivities } from "@/lib/crm-activity";
import { opportunityTotals } from "@/lib/crm-opportunity";
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
    <div className="crm-oggi-page" aria-busy="true" aria-label="Caricamento del CRM">
      <div className="crm-oggi-lead">
        <div className="crm-skel-head">
          <div className="adm-skel crm-skel-kicker" />
          <div className="adm-skel crm-skel-title" />
          <div className="adm-skel crm-skel-date" />
          <div className="adm-skel crm-skel-status" />
        </div>
        <div className="adm-skel crm-skel-tabs" />
      </div>
      <div className="crm-meter">{[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel crm-meter-skel" />)}</div>
      <div className="crm-oggi-grid">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="adm-skel crm-skel-panel" />)}</div>
    </div>
  );
}

const NEW_CONTACT = `${RUBRICA}?nuovo=1#nuovo`;
function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(now));
  return h >= 5 && h < 13 ? "Buongiorno" : h >= 13 && h < 18 ? "Buon pomeriggio" : "Buonasera";
}

function romeDateLabel(now = new Date()) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" }).format(now);
}

function countPhrase(n: number, one: string, many: string, zero: string) {
  if (n === 0) return zero;
  if (n === 1) return `1 ${one}`;
  return `${n} ${many}`;
}

/** Status under the greeting, from counts already loaded for this view. */
function oggiStatus(todo: number, free: number) {
  const tasks = countPhrase(todo, "cosa da fare", "cose da fare", "Niente da fare");
  const owners = countPhrase(free, "non assegnato", "non assegnati", "nessuno senza responsabile");
  return `${tasks} · ${owners}`;
}

function EmptyNote({ icon, text }: { icon: string; text: string }) {
  return <p className="crm-empty"><CrmIcon d={icon} /><span>{text}</span></p>;
}

/** Share of contacts in a stage. Zero when the book is empty, so the legend never invents a ratio. */
function stagePct(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function ScoreRing({ score }: { score: number | null }) {
  if (score === null) return null;
  const level = score >= 70 ? "alto" : score >= 40 ? "medio" : "basso";
  return (
    <span className="crm-score-ring" data-level={level} style={{ ["--p" as string]: score }}>
      <ScoreBadge score={score} />
    </span>
  );
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

const initials = (name: string) => name.split(/\s+/).filter((w) => /\p{L}/u.test(w[0] ?? "")).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "·";

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const sp = await searchParams;
  // Site requests become leads once per instance; Oggi is now the CRM entry, so it runs here too.
  await backfillRequests().catch(() => {});
  const founder = isFounder(me);
  const scope = followUpScope(typeof sp.ambito === "string" ? sp.ambito : undefined, founder);
  const today = romeToday();
  const tomorrow = addDays(today, 1);
  const viewer = { id: me.id, founder };
  const [ov, due, events, priority, unassigned, deals, openActs] = await Promise.all([
    crmOverview(), dueActions(scope === "team" ? null : me.id, today, tomorrow), recentCrmEvents(5).catch(() => []), priorityContacts(3), unassignedContacts(4), opportunityTotals(),
    listActivities({ scope, stato: "aperte", until: tomorrow }, viewer),
  ]);
  const rate = conversionRate(deals.won, deals.lost);
  const pipelineStages: Stage[] = ["nuovo", "contattato", "call", "preventivo", "vinto", "perso"];
  const feed = events.map((e) => ({ e, d: describe(e) })).filter((x) => x.d);
  const listCap = 4;
  const followShown = due.slice(0, listCap);
  const actShown = openActs.slice(0, listCap - followShown.length);
  const todoHidden = due.length + openActs.length - followShown.length - actShown.length;
  const feedShown = feed.slice(0, listCap);
  const first = me.name.trim().split(/\s+/)[0] || me.name;

  const todoCount = due.length + openActs.length;

  return (
    <>
      <NewContactShortcut href={NEW_CONTACT} />
      <KeyShortcut href={`${PIPELINE}?nuova=1`} keyName="o" />
      <div className="crm-oggi-page">
          <div className="crm-oggi-lead">
            <CrmHeader
              title={`${greeting()}, ${first}`}
              note={<p className="crm-date">{romeDateLabel()}</p>}
              intro={oggiStatus(todoCount, ov.unassigned)}
            />
            <CrmTabs current={CRM_HOME} />
          </div>

          <script dangerouslySetInnerHTML={{ __html: "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!sessionStorage.getItem('crm-oggi-kpis'))document.documentElement.classList.add('crm-roll-play')}catch(e){}" }} />
          <section className="crm-meter" aria-label="Numeri del CRM">
            <Link href={RUBRICA as Route} className="crm-meter-cell is-lead">
              <CrmIcon d={CRM_ICON["/admin/crm/rubrica"]} />
              <span className="crm-meter-num"><RollValue id="total" text={String(ov.total)} /></span>
              <span className="crm-meter-label">Contatti totali</span>
              {ov.newThisMonth ? <span className="crm-kpi-chip" title={`${ov.newThisMonth} nuovi questo mese`}>↗ +{ov.newThisMonth}<span className="adm-sr"> nuovi questo mese</span></span> : null}
            </Link>
            <div className="crm-meter-cell">
              <CrmIcon d={CRM_ICON["/admin/crm/pipeline"]} />
              <span className="crm-meter-num"><RollValue id="rate" text={rate === null ? "n.d." : `${Math.round(rate * 100)}%`} /></span>
              <span className="crm-meter-label">Conversione</span>
              <span className="crm-kpi-chip is-quiet" title={`${deals.won} opportunità vinte, ${deals.lost} perse`}>{deals.won} vinte</span>
            </div>
            <Link href={"/admin/crm/pipeline" as Route} className="crm-meter-cell" title="Trattative aperte a mano, non i contatti in una fase">
              <CrmIcon d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />
              <span className="crm-meter-num"><RollValue id="open" text={String(deals.open)} /></span>
              <span className="crm-meter-label">Opportunità attive</span>
            </Link>
            <div className="crm-meter-cell">
              <CrmIcon d="M5 20V12M10 20V8M15 20v-5M20 20V4" />
              <span className="crm-meter-num"><RollValue id="won" text={eur(deals.wonValue) || "0 €"} /></span>
              <span className="crm-meter-label">Valore vinto</span>
            </div>
          </section>

          <div className="crm-oggi-grid">
            <section className="crm-card-panel" data-slot="todo" aria-labelledby="crm-todo-h">
              <div className="crm-panel-head">
                <h2 id="crm-todo-h" className="adm-h2">
                  <CrmIcon d={CRM_ICON["/admin/crm/attivita"]} /> Da fare oggi <span className="crm-count">{todoCount}</span>
                  <CrmTip text="I follow-up si pianificano dalla scheda. Le attività si creano nella sezione Attività." />
                </h2>
              </div>
              <div className="crm-card-body">
                {founder ? <ScopeSwitch base={CRM_HOME} scope={scope} /> : null}
                {followShown.length ? <FollowUpRows items={followShown} today={today} showOwner={scope === "team"} /> : null}
                {actShown.length ? (
                  <ul className="crm-todo">
                    {actShown.map((a) => {
                      const due = dueLabel(a.dueDate, today);
                      const pill = a.dueTime && due.tone !== "late" ? `${due.text} · ${a.dueTime.slice(0, 5)}` : due.text;
                      return (
                        <LeavingRow key={a.id}>
                          <div className="crm-todo-row">
                            <ActivityCheck id={a.id} version={a.version} done={false} label={`Completa ${a.title}`} />
                            <div className="crm-todo-text">
                              <Link href={`/admin/crm/attivita?a=${a.id}${scope === "team" ? "&ambito=team" : ""}` as Route} className="crm-todo-title">{a.title}</Link>
                              <span className="adm-muted">{a.contactName ?? "Senza contatto"} · attività</span>
                            </div>
                            <span className="crm-due" data-tone={due.tone}>{pill}</span>
                          </div>
                        </LeavingRow>
                      );
                    })}
                  </ul>
                ) : null}
                {!followShown.length && !actShown.length ? <EmptyNote icon={CRM_ICON["/admin/crm/attivita"]} text={scope === "team" ? "Niente in scadenza per il team." : "Niente in scadenza per te."} /> : null}
              </div>
              <p className="crm-card-foot">
                {todoHidden > 0 ? <span className="adm-muted crm-foot">Il resto è nella vista Attività.</span> : <span />}
                <Link className="crm-more" href={(scope === "team" ? "/admin/crm/attivita?ambito=team" : "/admin/crm/attivita") as Route}>Vedi tutte →</Link>
              </p>
            </section>

            <section className="crm-card-panel" data-slot="feed" aria-labelledby="crm-feed-h">
              <div className="crm-panel-head">
                <h2 id="crm-feed-h" className="adm-h2"><CrmIcon d="M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" /> Attività recenti</h2>
              </div>
              <div className="crm-card-body">
                {feedShown.length ? (
                  <ul className="crm-feed">
                    {feedShown.map(({ e, d }) => (
                      <li key={e.id}>
                        <span className="crm-feed-icon" data-tone={d!.tone}><CrmIcon d={d!.icon} /></span>
                        <div className="crm-todo-text">
                          {e.contactId ? <Link href={`${CRM_HOME}/${e.contactId}` as Route} className="crm-todo-title">{d!.title}</Link> : <strong className="crm-todo-title">{d!.title}</strong>}
                          <span className="adm-muted">{d!.sub}{e.actor ? ` · ${e.actor}` : ""}</span>
                        </div>
                        <time className="adm-muted crm-ago" dateTime={e.at}>{ago(e.at)}</time>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyNote icon="M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" text="Nessuna attività recente." />}
              </div>
              {founder ? <p className="crm-card-foot"><Link className="crm-more" href={"/admin/audit" as Route}>Registro →</Link></p> : null}
            </section>

            <section className="crm-card-panel" data-slot="quick" aria-labelledby="crm-quick-h">
              <div className="crm-panel-head">
                <h2 id="crm-quick-h" className="adm-h2">
                  <CrmIcon d="M13 2L4 14h7l-1 8 9-12h-7z" /> Azioni rapide
                  <CrmTip text="Un'opportunità è una trattativa, non un contatto. L'import CSV non ne crea." />
                </h2>
              </div>
              <div className="crm-card-body">
                <div className="crm-quick">
                  <Link href={NEW_CONTACT as Route} className="crm-quick-item is-primary"><CrmIcon d={EVENT_ICON.add} /><span>Nuovo contatto</span><kbd>N</kbd></Link>
                  <Link href={`${PIPELINE}?nuova=1` as Route} className="crm-quick-item">
                    <CrmIcon d={CRM_ICON["/admin/crm/pipeline"]} /><span>Aggiungi opportunità</span><kbd>O</kbd>
                  </Link>
                  <Link href={`${RUBRICA}?importa=1` as Route} className="crm-quick-item">
                    <CrmIcon d="M12 4v11M7 10l5 5 5-5M5 20h14" /><span>Importa contatti</span>
                  </Link>
                  <Link href={"/admin/crm/radar" as Route} className="crm-quick-item" title="I prospect arrivano dalle ricerche di Iris">
                    <CrmIcon d={CRM_ICON["/admin/crm/radar"]} /><span>Prospect Radar</span>
                  </Link>
                </div>
              </div>
            </section>

            <section className="crm-card-panel" data-slot="prio" aria-labelledby="crm-top-h">
              <div className="crm-panel-head">
                <h2 id="crm-top-h" className="adm-h2"><CrmIcon d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" /> Contatti prioritari <span className="crm-count">{priority.length}</span></h2>
              </div>
              <div className="crm-card-body">
                {priority.length ? (
                  <ul className="crm-prio">
                    {priority.map((c) => (
                      <li key={c.id}>
                        <Link href={`${CRM_HOME}/${c.id}` as Route} className="crm-prio-row">
                          <span className="crm-avatar" aria-hidden="true">{initials(c.businessName)}</span>
                          <span className="crm-prio-text">
                            <strong>{c.businessName}</strong>
                            <span className="adm-muted">{[c.city, c.type].filter(Boolean).join(" · ") || SOURCE_LABEL[c.source]}</span>
                          </span>
                          <span className="crm-stage" data-stage={c.stage}>{STAGE_LABEL[c.stage]}</span>
                          <ScoreRing score={c.score} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyNote icon="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" text="Nessun contatto con punteggio." />}
              </div>
              <p className="crm-card-foot"><Link className="crm-more" href={RUBRICA as Route}>Vedi tutti →</Link></p>
            </section>

            <section className="crm-card-panel" data-slot="free" aria-labelledby="crm-free-h">
              <div className="crm-panel-head">
                <h2 id="crm-free-h" className="adm-h2">
                  <CrmIcon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 9-5.2M17 15v6M14 18h6" /> Non assegnati <span className="crm-count">{ov.unassigned}</span>
                  <CrmTip text="Contatti aperti senza responsabile, per esempio i lead del sito e i prospect Radar. Assegnali dalla scheda." />
                </h2>
              </div>
              <div className="crm-card-body">
                {unassigned.length ? (
                  <ul className="crm-todo">
                    {unassigned.map((c) => (
                      <li key={c.id} className="crm-todo-row">
                        <span className="crm-avatar is-sm" aria-hidden="true">{initials(c.businessName)}</span>
                        <div className="crm-todo-text">
                          <Link href={`${CRM_HOME}/${c.id}` as Route} className="crm-todo-title">{c.businessName}</Link>
                          <span className="adm-muted">{[c.city, c.type].filter(Boolean).join(" · ") || STAGE_LABEL[c.stage]}</span>
                        </div>
                        <span className="crm-due" data-tone="soon">{SOURCE_LABEL[c.source]}</span>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyNote icon="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 9-5.2M17 15v6M14 18h6" text="Nessun contatto senza responsabile." />}
              </div>
              <p className="crm-card-foot"><Link className="crm-more" href={RUBRICA as Route}>Rubrica →</Link></p>
            </section>

            <section className="crm-card-panel" data-slot="pipe" aria-labelledby="crm-pipe-h">
              <div className="crm-panel-head">
                <h2 id="crm-pipe-h" className="adm-h2">
                  <CrmIcon d={CRM_ICON["/admin/crm/pipeline"]} /> Pipeline
                  <CrmTip text="Conta i contatti, non le trattative. La fase non viene azzerata e non apre un'opportunità." />
                </h2>
              </div>
              <div className="crm-card-body">
                <p className="adm-muted crm-hint">{ov.total} contatti, nella fase attuale. {deals.open ? `${deals.open} opportunità esplicite a parte.` : "Nessuna opportunità esplicita."}</p>
                <div className="crm-bar" role="img" aria-label={pipelineStages.map((s) => `${STAGE_LABEL[s]} ${ov.byStage[s]}, ${stagePct(ov.byStage[s], ov.total)}%`).join(", ")}>
                  <div className="crm-bar-fill">
                    {ov.total
                      ? pipelineStages.map((s) => (ov.byStage[s] ? <span key={s} data-stage={s} style={{ flexGrow: ov.byStage[s] }} /> : null))
                      : <span className="crm-bar-idle" />}
                  </div>
                </div>
                <ul className="crm-legend">
                  {pipelineStages.map((s) => (
                    <li key={s}>
                      <span className="crm-dot" data-stage={s} />
                      <span className="crm-legend-name">{STAGE_LABEL[s]}</span>
                      <strong>{ov.byStage[s]}</strong>
                      <span className="crm-legend-pct">{stagePct(ov.byStage[s], ov.total)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
      </div>
    </>
  );
}
