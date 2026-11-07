import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ContactPanel, type PanelAnalysis } from "@/components/admin/crm/contact-panel";
import { ImportDialog } from "@/components/admin/crm/import-dialog";
import { CrmHeader, CrmIcon, CRM_ICON, CrmTabs, day, romeToday, ScoreBadge } from "@/components/admin/crm/crm-ui";
import { DraftEditor } from "@/components/admin/crm/draft-editor";
import { RubricaTable, type RubricaRow, type SortHead } from "@/components/admin/crm/rubrica-table";
import { RADAR_LAYOUT, RubricaToolbar } from "@/components/admin/crm/rubrica-toolbar";
import { requireSection } from "@/lib/admin";
import { countContacts, crmOwners, facets, listContacts, listDrafts, radarStats, type Contact, type ContactFilter } from "@/lib/crm";
import { isStage, SOURCE_LABEL } from "@/lib/crm-core";
import {
  contactEmailPath, CRM_HOME, PANEL_TABS, parseRadarQuery, PRIO_RANGE, RADAR, radarSearch, RUBRICA, RUBRICA_PAGE_SIZE, RUBRICA_SORTS,
  type PanelTab, type RadarQuery, type RubricaSort,
} from "@/lib/crm-nav";
import { canAccess } from "@/lib/team-types";

type SP = Record<string, string | string[] | undefined>;

export default function RadarPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <main className="adm-main crm-main crm-main-rubrica">
      <Suspense fallback={<RadarSkeleton />}><Body searchParams={searchParams} /></Suspense>
    </main>
  );
}

function RadarSkeleton() {
  return (
    <div aria-busy="true" aria-label="Caricamento del Radar">
      <div className="adm-skel" style={{ height: "4.5rem", width: "min(28rem, 80%)", borderRadius: ".6rem" }} />
      <div className="crm-kpis crm-kpis-5" style={{ marginTop: "2rem" }}>{[0, 1, 2, 3, 4].map((i) => <div key={i} className="adm-skel crm-kpi" style={{ height: "5.5rem" }} />)}</div>
      <div className="adm-skel" style={{ height: "2.6rem", borderRadius: ".6rem", marginBottom: "1rem" }} />
      <div className="adm-skel" style={{ height: "24rem", borderRadius: ".9rem" }} />
    </div>
  );
}

function PanelSkeleton() {
  return (
    <aside className="crm-panel crm-panel-loading" aria-busy="true" aria-label="Caricamento della scheda">
      <div className="adm-skel" style={{ height: "3.5rem", borderRadius: ".6rem" }} />
      <div className="adm-skel" style={{ height: "2.2rem", borderRadius: ".6rem" }} />
      <div className="adm-skel" style={{ height: "16rem", borderRadius: ".6rem" }} />
    </aside>
  );
}

const ASC_FIRST: RubricaSort[] = ["nome", "citta", "azione"];
const I = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  funnel: CRM_ICON["/admin/crm/pipeline"],
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
};
const LEVEL = (score: number) => (score >= 70 ? "Potenziale alto" : score >= 40 ? "Potenziale medio" : "Potenziale basso");

function scoreBand(prio: RadarQuery["prio"]): Pick<ContactFilter, "scoreMin" | "scoreMax" | "noScore"> {
  switch (prio) {
    case "": return {};
    case "senza": return { noScore: true };
    case "alta": case "media": case "bassa": return { scoreMin: PRIO_RANGE[prio][0], scoreMax: PRIO_RANGE[prio][1] };
    default: {
      const never: never = prio;
      return never;
    }
  }
}

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const sp = await searchParams;
  const query = parseRadarQuery(sp);
  const today = romeToday();
  const filter: ContactFilter = {
    source: "radar", q: query.q || undefined, stage: isStage(query.fase) ? query.fase : undefined, type: query.categoria || undefined,
    city: query.citta || undefined, archived: query.archivio, owner: query.resp === "me" ? me.id : query.resp || undefined, ...scoreBand(query.prio),
  };
  const pageOf = (p: number) => listContacts({ ...filter, sort: query.ordina, dir: query.dir, limit: RUBRICA_PAGE_SIZE, offset: (p - 1) * RUBRICA_PAGE_SIZE });
  const [total, firstTry, stats, f, owners] = await Promise.all([countContacts(filter), pageOf(query.p), radarStats(), facets("radar"), crmOwners()]);
  const pages = Math.max(1, Math.ceil(total / RUBRICA_PAGE_SIZE));
  const page = Math.min(query.p, pages);
  const contacts = page === query.p ? firstTry : await pageOf(page);
  const drafts = await listDrafts(contacts.map((c) => c.id));
  const view: RadarQuery = { ...query, p: page };
  const href = (patch: Partial<RadarQuery>) => `${RADAR}${radarSearch(view, patch)}`;

  const sort = Object.fromEntries(RUBRICA_SORTS.map((k) => {
    const active = view.ordina === k;
    const next = active ? (view.dir === "asc" ? "desc" : "asc") : ASC_FIRST.includes(k) ? "asc" : "desc";
    return [k, { href: href({ ordina: k, dir: next, p: 1 }), dir: active ? view.dir : null } satisfies SortHead];
  })) as Record<RubricaSort, SortHead>;
  const rows: RubricaRow[] = contacts.map((c) => {
    const mine = drafts.filter((d) => d.contactId === c.id);
    return {
      id: c.id, version: c.version, name: c.businessName, type: c.type, stage: c.stage, city: c.city, address: c.address, region: c.region,
      source: SOURCE_LABEL[c.source], score: c.score, nextAction: c.nextAction, nextActionAt: c.nextActionAt, href: href({ c: c.id }),
      reasons: c.scoreReasons, drafts: { ready: mine.filter((d) => d.status === "bozza").length, sent: mine.filter((d) => d.status === "inviata").length },
    };
  });
  const from = total ? (page - 1) * RUBRICA_PAGE_SIZE + 1 : 0;
  const filtered = Boolean(filter.q || filter.stage || filter.type || filter.city || filter.owner || filter.archived || query.prio);
  const listKey = radarSearch(view, { c: "", tab: "analisi" });
  const canSend = canAccess(me, "email");
  const panelLinks = {
    close: href({ c: "" }), tabs: Object.fromEntries(PANEL_TABS.map((t) => [t, href({ tab: t })])) as Record<PanelTab, string>,
    email: view.c ? { list: contactEmailPath(view.c), compose: `${contactEmailPath(view.c)}?compose=new` } : undefined,
  };
  const analysis: PanelAnalysis = { href: href({ tab: "analisi" }), render: (c) => <IrisAnalysis contact={c} canSend={canSend} /> };

  return (
    <div className="crm-rubrica crm-radar" data-panel={view.c ? "open" : undefined}>
      <div className="crm-rubrica-main">
        <CrmHeader title="Radar" intro="I prospect trovati da Iris, con punteggio e motivazioni: valutali e scegli chi contattare.">
          <span className="crm-import">
            <button type="button" className="adm-btn" disabled aria-describedby="crm-radar-search-note"><CrmIcon d={I.search} />Nuova ricerca</button>
            <span id="crm-radar-search-note" className="adm-sr">Le ricerche partono da Iris, fuori dal CRM: i prospect trovati arrivano qui da soli.</span>
          </span>
          <span className="crm-import"><ImportDialog /></span>
        </CrmHeader>
        <CrmTabs current={RADAR} />

        <section className="crm-kpis crm-kpis-5" aria-label="Numeri del Radar">
          <Link href={RADAR as Route} className="crm-kpi is-hero"><CrmIcon d={CRM_ICON[RADAR]} /><span className="crm-kpi-num">{stats.total}</span><span className="crm-kpi-label">Prospect dal Radar</span></Link>
          <Link href={`${RADAR}?fase=nuovo` as Route} className="crm-kpi" title="Prospect ancora in fase Nuovo"><CrmIcon d={I.eye} /><span className="crm-kpi-num">{stats.toReview}</span><span className="crm-kpi-label">Da valutare</span></Link>
          <Link href={`${RADAR}?fase=nuovo&prio=alta` as Route} className="crm-kpi" title="Ancora da valutare, con punteggio Iris 70 o più"><CrmIcon d={I.star} /><span className="crm-kpi-num">{stats.priority}</span><span className="crm-kpi-label">Priorità alta</span></Link>
          <div className="crm-kpi" title="Bozze email di Iris in attesa di revisione: nessuna parte senza un clic su Invia"><CrmIcon d={I.mail} /><span className="crm-kpi-num">{stats.draftsReady}</span><span className="crm-kpi-label">Bozze da rivedere</span></div>
          <Link href={`${CRM_HOME}/pipeline` as Route} className="crm-kpi" title="Prospect in fase Call o Preventivo"><CrmIcon d={I.funnel} /><span className="crm-kpi-num">{stats.inDeal}</span><span className="crm-kpi-label">In trattativa</span></Link>
        </section>

        <RubricaToolbar query={view} types={f.types} cities={f.cities} owners={owners} userId={me.id} layout={RADAR_LAYOUT} />

        {rows.length ? (
          <RubricaTable key={listKey} variant="radar" rows={rows} activeId={view.c} sort={sort} owners={owners} today={today}
            pager={{ from, to: from + rows.length - 1, total, prev: page > 1 ? href({ p: page - 1 }) : null, next: page < pages ? href({ p: page + 1 }) : null }} />
        ) : (
          <div className="crm-card-panel crm-empty-state">
            {filtered
              ? <><p>Nessun prospect con questi filtri.</p><Link className="adm-btn adm-btn-sm" href={(view.c ? `${RADAR}?c=${view.c}` : RADAR) as Route}>Azzera i filtri</Link></>
              : <><p>Ancora nessun prospect dal Radar.</p><p className="adm-muted">Li invia Iris quando trova aziende interessanti: arrivano qui con punteggio, motivazioni ed eventuale bozza email.</p></>}
          </div>
        )}
        <p className="crm-hint adm-muted crm-radar-note">I prospect del Radar sono già contatti della <Link href={`${RUBRICA}?fonte=radar` as Route}>Rubrica</Link> (fonte Radar). Niente parte da solo: nessuna email senza un clic su Invia, nessuna opportunità creata dal punteggio.</p>
      </div>
      {view.c ? (
        <Suspense key={`${view.c}:${view.tab}`} fallback={<PanelSkeleton />}>
          <ContactPanel id={view.c} tab={view.tab} me={me} links={panelLinks} analysis={analysis} />
        </Suspense>
      ) : null}
    </div>
  );
}

/**
 * The Iris evidence exactly as received (score, reasons, drafts): the CRM does not grade the reasons or infer
 * opportunities. Drafts use the shared editor, so sending follows the same rules as the contact page.
 */
async function IrisAnalysis({ contact: c, canSend }: { contact: Contact; canSend: boolean }) {
  const drafts = await listDrafts([c.id]);
  return (
    <>
      <section className="crm-iris crm-iris-analysis" aria-labelledby={`iris-${c.id}`}>
        <div className="crm-iris-top">
          <h3 id={`iris-${c.id}`}><CrmIcon d={I.spark} />Analisi di Iris</h3>
          <span className="adm-muted">{c.source === "radar" ? `Ricevuta il ${day(c.createdAt)}` : SOURCE_LABEL[c.source]}</span>
        </div>
        {c.score === null
          ? <p className="adm-muted">Iris non ha inviato un punteggio per questo prospect.</p>
          : <p className="crm-iris-score"><ScoreBadge score={c.score} /><strong>{LEVEL(c.score)}</strong><span className="adm-muted">punteggio commerciale di Iris, su 100</span></p>}
        <h4>Motivi indicati da Iris</h4>
        {c.scoreReasons.length
          ? <ul className="crm-iris-points">{c.scoreReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          : <p className="adm-muted">Nessuna motivazione ricevuta.</p>}
        <p className="crm-hint adm-muted">Riportati così come li ha scritti Iris: il CRM non assegna gravità né stima opportunità.</p>
      </section>
      <section className="crm-radar-drafts" aria-label="Bozze email di Iris">
        <h4>Bozze email di Iris</h4>
        {drafts.length
          ? drafts.map((d) => <details key={d.id} open={d.status === "bozza"}><summary>{d.subject} <span className="adm-badge">{d.status}</span></summary><DraftEditor draft={d} to={c.email} canSend={canSend} /></details>)
          : <p className="crm-empty adm-muted">Nessuna bozza per questo prospect.</p>}
      </section>
    </>
  );
}
