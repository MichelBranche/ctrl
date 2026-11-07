import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ContactForm } from "@/components/admin/crm/contact-form";
import { ContactPanel } from "@/components/admin/crm/contact-panel";
import { NewContactShortcut } from "@/components/admin/crm/follow-up-client";
import { CrmHeader, CrmIcon, CRM_ICON, CrmTabs, romeToday } from "@/components/admin/crm/crm-ui";
import { RubricaTable, type RubricaRow, type SortHead } from "@/components/admin/crm/rubrica-table";
import { RubricaToolbar } from "@/components/admin/crm/rubrica-toolbar";
import { requireSection } from "@/lib/admin";
import { backfillRequests, countContacts, crmOwners, facets, listContacts, rubricaStats, type ContactFilter } from "@/lib/crm";
import { isSource, isStage, SOURCE_LABEL } from "@/lib/crm-core";
import { contactEmailPath, contactMailSearch, CRM_HOME, defaultContactMail, PANEL_TABS, parseRubricaQuery, RUBRICA, RUBRICA_PAGE_SIZE, RUBRICA_SORTS, rubricaSearch, type PanelTab, type RubricaQuery, type RubricaSort } from "@/lib/crm-nav";

type SP = Record<string, string | string[] | undefined>;

export default function RubricaPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <main className="adm-main crm-main crm-main-rubrica">
      <Suspense fallback={<RubricaSkeleton />}><Body searchParams={searchParams} /></Suspense>
    </main>
  );
}

function RubricaSkeleton() {
  return (
    <div aria-busy="true" aria-label="Caricamento della rubrica">
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

const NEW_CONTACT = `${RUBRICA}?nuovo=1#nuovo`;
const ASC_FIRST: RubricaSort[] = ["nome", "citta", "azione"];
const KPI = {
  check: "M20 6L9 17l-5-5",
  funnel: CRM_ICON["/admin/crm/pipeline"],
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
};

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const sp = await searchParams;
  const query = parseRubricaQuery(sp);
  // Lazy backfill of site requests into leads: once per instance, never blocks the page on failure.
  await backfillRequests().catch(() => {});
  const today = romeToday();
  const filter: ContactFilter = {
    q: query.q || undefined, stage: isStage(query.fase) ? query.fase : undefined, type: query.categoria || undefined, city: query.citta || undefined,
    source: isSource(query.fonte) ? query.fonte : undefined, archived: query.archivio, owner: query.resp === "me" ? me.id : query.resp || undefined,
  };
  const pageOf = (p: number) => listContacts({ ...filter, sort: query.ordina, dir: query.dir, limit: RUBRICA_PAGE_SIZE, offset: (p - 1) * RUBRICA_PAGE_SIZE });
  const [total, firstTry, stats, f, owners] = await Promise.all([countContacts(filter), pageOf(query.p), rubricaStats(today), facets(), crmOwners()]);
  const pages = Math.max(1, Math.ceil(total / RUBRICA_PAGE_SIZE));
  const page = Math.min(query.p, pages);
  const contacts = page === query.p ? firstTry : await pageOf(page);
  const view: RubricaQuery = { ...query, p: page };
  const href = (patch: Partial<RubricaQuery>) => `${RUBRICA}${rubricaSearch(view, patch)}`;

  const sort = Object.fromEntries(RUBRICA_SORTS.map((k) => {
    const active = view.ordina === k;
    const next = active ? (view.dir === "asc" ? "desc" : "asc") : ASC_FIRST.includes(k) ? "asc" : "desc";
    return [k, { href: href({ ordina: k, dir: next, p: 1 }), dir: active ? view.dir : null } satisfies SortHead];
  })) as Record<RubricaSort, SortHead>;
  const rows: RubricaRow[] = contacts.map((c) => ({
    id: c.id, version: c.version, name: c.businessName, type: c.type, stage: c.stage, city: c.city, address: c.address, region: c.region,
    source: SOURCE_LABEL[c.source], score: c.score, nextAction: c.nextAction, nextActionAt: c.nextActionAt, href: href({ c: c.id }),
  }));
  const from = total ? (page - 1) * RUBRICA_PAGE_SIZE + 1 : 0;
  const filtered = Boolean(filter.q || filter.stage || filter.type || filter.city || filter.source || filter.owner || filter.archived);
  const listKey = rubricaSearch(view, { c: "", tab: "dettagli" });
  const mailBase = defaultContactMail(view);
  const panelLinks = {
    close: href({ c: "" }), tabs: Object.fromEntries(PANEL_TABS.map((t) => [t, href({ tab: t })])) as Record<PanelTab, string>,
    email: view.c ? { list: `${contactEmailPath(view.c)}${contactMailSearch(mailBase)}`, compose: `${contactEmailPath(view.c)}${contactMailSearch(mailBase, { compose: "new" })}` } : undefined,
  };

  return (
    <div className="crm-rubrica" data-panel={view.c ? "open" : undefined}>
      <div className="crm-rubrica-main">
        <CrmHeader title="Rubrica" intro="Tutti i tuoi contatti: filtrali, gestiscili e passa all'azione.">
          <span className="crm-import">
            <button type="button" className="adm-btn" disabled aria-describedby="crm-import-note"><CrmIcon d={KPI.upload} />Importa</button>
            <span id="crm-import-note" className="adm-sr">Import da CSV non ancora disponibile: arriverà con anteprima e controllo dei duplicati prima di salvare.</span>
          </span>
          <Link className="adm-btn adm-btn-primary" href={NEW_CONTACT as Route}>+ Nuovo contatto</Link>
        </CrmHeader>
        <NewContactShortcut href={NEW_CONTACT} />
        <CrmTabs current={RUBRICA} />
        {sp.archiviato === "1" ? <p className="adm-ok" role="status">Contatto archiviato.</p> : null}

        <section className="crm-kpis crm-kpis-5" aria-label="Numeri della rubrica">
          <Link href={RUBRICA as Route} className="crm-kpi is-hero"><CrmIcon d={CRM_ICON[RUBRICA]} /><span className="crm-kpi-num">{stats.total}</span><span className="crm-kpi-label">Contatti totali</span></Link>
          <Link href={`${RUBRICA}?fase=contattato` as Route} className="crm-kpi"><CrmIcon d={KPI.check} /><span className="crm-kpi-num">{stats.contacted}</span><span className="crm-kpi-label">Contattati</span></Link>
          <Link href={`${CRM_HOME}/pipeline` as Route} className="crm-kpi" title="Contatti in fase Call o Preventivo"><CrmIcon d={KPI.funnel} /><span className="crm-kpi-num">{stats.inDeal}</span><span className="crm-kpi-label">In trattativa</span></Link>
          <Link href={`${RUBRICA}?fase=vinto` as Route} className="crm-kpi"><CrmIcon d={KPI.trophy} /><span className="crm-kpi-num">{stats.won}</span><span className="crm-kpi-label">Vinti</span></Link>
          <Link href={`${CRM_HOME}/attivita` as Route} className="crm-kpi" data-tone={stats.followUpDue ? "late" : undefined} title="Follow-up di oggi o scaduti"><CrmIcon d={KPI.clock} /><span className="crm-kpi-num">{stats.followUpDue}</span><span className="crm-kpi-label">Da ricontattare</span></Link>
        </section>

        <RubricaToolbar query={view} types={f.types} cities={f.cities} owners={owners} userId={me.id} />

        {rows.length ? (
          <RubricaTable key={listKey} rows={rows} activeId={view.c} sort={sort} owners={owners} today={today}
            pager={{ from, to: from + rows.length - 1, total, prev: page > 1 ? href({ p: page - 1 }) : null, next: page < pages ? href({ p: page + 1 }) : null }} />
        ) : (
          <div className="crm-card-panel crm-empty-state">
            {filtered
              ? <><p>Nessun contatto con questi filtri.</p><Link className="adm-btn adm-btn-sm" href={(view.c ? `${RUBRICA}?c=${view.c}` : RUBRICA) as Route}>Azzera i filtri</Link></>
              : <><p>Ancora nessun contatto in rubrica.</p><p className="adm-muted">Aggiungine uno a mano o importa i lead dal Radar.</p><Link className="adm-btn adm-btn-sm adm-btn-primary" href={NEW_CONTACT as Route}>+ Nuovo contatto</Link></>}
          </div>
        )}

        <section className="crm-card-panel" id="nuovo">
          <details open={sp.nuovo === "1"}><summary className="adm-h2">+ Nuovo contatto</summary><ContactForm owners={owners} /></details>
        </section>
      </div>
      {view.c ? (
        <Suspense key={`${view.c}:${view.tab}`} fallback={<PanelSkeleton />}>
          <ContactPanel id={view.c} tab={view.tab} me={me} links={panelLinks} />
        </Suspense>
      ) : null}
    </div>
  );
}
