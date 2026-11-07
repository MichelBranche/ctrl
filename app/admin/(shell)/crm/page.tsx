import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ActivityCheck } from "@/components/admin/crm/activity-check";
import { CrmHeader, CrmIcon, CRM_ICON, CrmTabs, eur, romeToday, ScoreBadge } from "@/components/admin/crm/crm-ui";
import { KeyShortcut, NewContactShortcut } from "@/components/admin/crm/follow-up-client";
import { addDays, FollowUpRows, ScopeSwitch } from "@/components/admin/crm/follow-ups";
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
    <div aria-busy="true" aria-label="Caricamento del CRM">
      <div className="adm-skel" style={{ height: "4.5rem", width: "min(28rem, 80%)", borderRadius: ".6rem" }} />
      <div className="crm-kpis" style={{ marginTop: "2rem" }}>{[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel crm-kpi" style={{ height: "6.5rem" }} />)}</div>
      <div className="crm-oggi"><div className="adm-skel" style={{ height: "18rem", borderRadius: ".9rem" }} /><div className="adm-skel" style={{ height: "18rem", borderRadius: ".9rem" }} /></div>
    </div>
  );
}

const NEW_CONTACT = `${RUBRICA}?nuovo=1#nuovo`;
function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(now));
  return h >= 5 && h < 13 ? "Buongiorno" : h >= 13 && h < 18 ? "Buon pomeriggio" : "Buonasera";
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
  const shown = due.slice(0, 6);
  const first = me.name.trim().split(/\s+/)[0] || me.name;

  return (
    <>
      <NewContactShortcut href={NEW_CONTACT} />
      <KeyShortcut href={`${PIPELINE}?nuova=1`} keyName="o" />
      <div className="crm-layout">
        <div className="crm-col-main">
          <CrmHeader title={<>{greeting()}, {first} <span aria-hidden="true">👋</span></>} intro="Gestisci contatti, opportunità e nuovi prospect in un unico spazio." />
          <CrmTabs current={CRM_HOME} />

          <section className="crm-kpis" aria-label="Numeri del CRM">
            <Link href={RUBRICA as Route} className="crm-kpi is-hero">
              <CrmIcon d={CRM_ICON["/admin/crm/rubrica"]} />
              <span className="crm-kpi-num">{ov.total}</span>
              <span className="crm-kpi-label">Contatti totali</span>
              {ov.newThisMonth ? <span className="crm-kpi-chip" title={`${ov.newThisMonth} nuovi questo mese`}>↗ +{ov.newThisMonth}<span className="adm-sr"> nuovi questo mese</span></span> : null}
            </Link>
            <div className="crm-kpi">
              <CrmIcon d={CRM_ICON["/admin/crm/pipeline"]} />
              <span className="crm-kpi-num">{rate === null ? "n.d." : `${Math.round(rate * 100)}%`}</span>
              <span className="crm-kpi-label">Conversione</span>
              <span className="crm-kpi-chip is-quiet" title={`${deals.won} opportunità vinte, ${deals.lost} perse`}>{deals.won} vinte</span>
            </div>
            <Link href={"/admin/crm/pipeline" as Route} className="crm-kpi" title="Trattative aperte a mano, non i contatti in una fase">
              <CrmIcon d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />
              <span className="crm-kpi-num">{deals.open}</span>
              <span className="crm-kpi-label">Opportunità attive</span>
            </Link>
            <div className="crm-kpi">
              <CrmIcon d="M5 20V12M10 20V8M15 20v-5M20 20V4" />
              <span className="crm-kpi-num">{eur(deals.wonValue) || "0 €"}</span>
              <span className="crm-kpi-label">Valore vinto</span>
              <span className="crm-kpi-chip is-quiet" title="Nessun confronto: manca ancora la data di chiusura">—</span>
            </div>
          </section>

          <div className="crm-oggi">
            <section className="crm-card-panel" aria-labelledby="crm-todo-h">
              <div className="crm-panel-head">
                <h2 id="crm-todo-h" className="adm-h2"><CrmIcon d={CRM_ICON["/admin/crm/attivita"]} /> Da fare oggi <span className="crm-count">{due.length + openActs.length}</span></h2>
                <div className="adm-row-actions">
                  {founder ? <ScopeSwitch base={CRM_HOME} scope={scope} /> : null}
                  <Link className="crm-more" href={(scope === "team" ? "/admin/crm/attivita?ambito=team" : "/admin/crm/attivita") as Route}>Vedi tutte →</Link>
                </div>
              </div>
              {shown.length ? <FollowUpRows items={shown} today={today} showOwner={scope === "team"} /> : null}
              {openActs.length ? (
                <ul className="crm-todo">
                  {openActs.slice(0, 4).map((a) => (
                    <li key={a.id} className="crm-todo-row">
                      <ActivityCheck id={a.id} version={a.version} done={false} label={`Completa ${a.title}`} />
                      <div className="crm-todo-text">
                        <Link href={`/admin/crm/attivita?a=${a.id}${scope === "team" ? "&ambito=team" : ""}` as Route} className="crm-todo-title">{a.title}</Link>
                        <span className="adm-muted">{a.contactName ?? "Senza contatto"} · attività</span>
                      </div>
                      <span className="crm-due" data-tone={a.dueDate < today ? "late" : "today"}>{a.dueTime ?? a.dueDate.slice(8)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!shown.length && !openActs.length ? <p className="adm-muted crm-empty">Niente in scadenza {scope === "team" ? "per il team" : "per te"} oggi e domani. I follow-up si pianificano dalla scheda. Le attività si creano nella sezione Attività.</p> : null}
              {due.length > shown.length || openActs.length > 4 ? <p className="adm-muted crm-foot">Il resto è nella vista Attività.</p> : null}
            </section>

            <section className="crm-card-panel" aria-labelledby="crm-feed-h">
              <div className="crm-panel-head">
                <h2 id="crm-feed-h" className="adm-h2"><CrmIcon d="M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" /> Attività recenti</h2>
                {founder ? <Link className="crm-more" href={"/admin/audit" as Route}>Registro →</Link> : null}
              </div>
              {feed.length ? (
                <ul className="crm-feed">
                  {feed.map(({ e, d }) => (
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
              ) : <p className="adm-muted crm-empty">Nessuna attività CRM registrata di recente.</p>}
            </section>
          </div>


          <section className="crm-card-panel" aria-labelledby="crm-top-h">
            <div className="crm-panel-head">
              <h2 id="crm-top-h" className="adm-h2"><CrmIcon d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" /> Contatti prioritari <span className="crm-count">{priority.length}</span></h2>
              <Link className="crm-more" href={RUBRICA as Route}>Vedi tutti →</Link>
            </div>
            {priority.length ? (
              <ul className="crm-top">
                {priority.map((c) => (
                  <li key={c.id}>
                    <Link href={`${CRM_HOME}/${c.id}` as Route} className="crm-top-card">
                      <span className="crm-avatar" aria-hidden="true">{initials(c.businessName)}</span>
                      <span className="crm-top-text">
                        <strong>{c.businessName}</strong>
                        <span className="adm-muted">{[c.city, c.type].filter(Boolean).join(" · ") || SOURCE_LABEL[c.source]}</span>
                        <span className="crm-stage" data-stage={c.stage}>{STAGE_LABEL[c.stage]}</span>
                      </span>
                      <ScoreBadge score={c.score} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="adm-muted crm-empty">Nessun contatto aperto con punteggio. Il punteggio arriva da Radar o si imposta nella scheda.</p>}
          </section>

          {ov.unassigned ? (
            <section className="crm-card-panel" aria-labelledby="crm-free-h">
              <div className="crm-panel-head">
                <h2 id="crm-free-h" className="adm-h2"><CrmIcon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 9-5.2M17 15v6M14 18h6" /> Non assegnati <span className="crm-count">{ov.unassigned}</span></h2>
                <Link className="crm-more" href={RUBRICA as Route}>Rubrica →</Link>
              </div>
              <p className="adm-muted crm-hint">Contatti aperti senza responsabile, per esempio i lead del sito e i prospect Radar. Assegnali dalla scheda.</p>
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
            </section>
          ) : null}
        </div>

        <aside className="crm-rail" aria-label="Scorciatoie CRM">
          <section className="crm-card-panel">
            <h2 className="adm-h2"><CrmIcon d="M13 2L4 14h7l-1 8 9-12h-7z" /> Azioni rapide</h2>
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
            <p className="adm-muted crm-foot">Un&apos;opportunità è una trattativa, non un contatto. L&apos;import CSV non ne crea.</p>
          </section>

          <section className="crm-card-panel">
            <h2 className="adm-h2"><CrmIcon d={CRM_ICON["/admin/crm/pipeline"]} /> Pipeline</h2>
            <p className="adm-muted crm-hint">{ov.total} contatti, nella fase attuale. {deals.open ? `${deals.open} opportunità esplicite a parte.` : "Nessuna opportunità esplicita."}</p>
            <div className="crm-bar" role="img" aria-label={pipelineStages.map((s) => `${STAGE_LABEL[s]} ${ov.byStage[s]}`).join(", ")}>
              {pipelineStages.map((s) => (ov.byStage[s] ? <span key={s} data-stage={s} style={{ flexGrow: ov.byStage[s] }} /> : null))}
            </div>
            <ul className="crm-legend">
              {pipelineStages.map((s) => <li key={s}><span className="crm-dot" data-stage={s} />{STAGE_LABEL[s]}<strong>{ov.byStage[s]}</strong></li>)}
            </ul>
            <p className="adm-muted crm-foot">Conta i contatti, non le trattative. La fase non viene azzerata e non apre un&apos;opportunità.</p>
          </section>

          <section className="crm-card-panel">
            <h2 className="adm-h2"><CrmIcon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /> Accesso rapido</h2>
            <ul className="crm-jump">
              <li><Link href={RUBRICA as Route}><CrmIcon d={CRM_ICON["/admin/crm/rubrica"]} /><span>Rubrica<small>{ov.total} contatti</small></span>→</Link></li>
              <li><Link href={"/admin/crm/pipeline" as Route}><CrmIcon d={CRM_ICON["/admin/crm/pipeline"]} /><span>Pipeline<small>{ov.total} contatti</small></span>→</Link></li>
              <li><Link href={"/admin/crm/radar" as Route}><CrmIcon d={CRM_ICON["/admin/crm/radar"]} /><span>Radar<small>{ov.radar} da Radar</small></span>→</Link></li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
