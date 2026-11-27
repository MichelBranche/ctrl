import "@/components/ds/admin-ui.css";
import "@/components/ds/crm.css";
import "@/components/ds/status.css";
import "@/components/ds/rubrica.css";
import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ContactForm } from "@/components/admin/crm/contact-form";
import { ImportDialog } from "@/components/admin/crm/import-dialog";
import { ContactPanel } from "@/components/admin/crm/contact-panel";
import { NewContactShortcut } from "@/components/admin/crm/follow-up-client";
import { CrmIcon, CrmTabs, initials, romeToday } from "@/components/admin/crm/crm-ui";
import { RubricaBoard, type BoardRow, type SortHead } from "@/components/admin/crm/rubrica-board";
import { RubricaStages } from "@/components/admin/crm/rubrica-stages";
import { RubricaToolbar, VistaMemory } from "@/components/admin/crm/rubrica-tools";
import { toneOf } from "@/components/ds/status";
import { requireSection } from "@/lib/admin";
import { backfillRequests, countContacts, crmOwners, facets, listContacts, openActivitiesFor, rubricaSegments, stageCounts, type ContactFilter } from "@/lib/crm";
import { isSource, isStage } from "@/lib/crm-core";
import { resolveKind } from "@/lib/crm-kind";
import { agoLabel, pickNextTouch } from "@/lib/crm-next";
import { listSavedViews } from "@/lib/crm-views";
import {
  ATTIVITA, contactEmailPath, contactMailSearch, defaultContactMail, PANEL_TABS, parseRubricaQuery, RUBRICA, RUBRICA_PAGE_SIZE, RUBRICA_SORTS,
  rubricaSearch, type PanelTab, type RubricaQuery, type RubricaSort,
} from "@/lib/crm-nav";
import { canAccess, isFounder } from "@/lib/team-types";

type SP = Record<string, string | string[] | undefined>;

export default function RubricaPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<RubricaSkeleton />}><Body searchParams={searchParams} /></Suspense>
  );
}

function RubricaSkeleton() {
  return (
    <main className="ds-page cr rb" aria-busy="true" aria-label="Caricamento della rubrica">
      <div className="rb-skel" style={{ height: "7.5rem" }} />
      <div className="rb-skel" style={{ height: "6rem" }} />
      <div className="rb-skel" style={{ height: "28rem" }} />
    </main>
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

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const sp = await searchParams;
  const query = parseRubricaQuery(sp);
  await backfillRequests().catch(() => {});
  const today = romeToday();
  const founder = isFounder(me);
  const filter: ContactFilter = {
    q: query.q || undefined, stage: isStage(query.fase) ? query.fase : undefined, type: query.categoria || undefined, city: query.citta || undefined, region: query.regione || undefined, country: query.stato || undefined,
    source: isSource(query.fonte) ? query.fonte : undefined, archived: query.archivio,
    owner: query.seg === "liberi" ? "none" : query.resp === "me" ? me.id : query.resp || undefined,
    kind: query.seg === "aziende" ? "azienda" : query.seg === "persone" ? "persona" : undefined,
  };
  const pageOf = (p: number) => listContacts({ ...filter, sort: query.ordina, dir: query.dir, limit: RUBRICA_PAGE_SIZE, offset: (p - 1) * RUBRICA_PAGE_SIZE });
  const [total, firstTry, segments, f, owners, views, stages] = await Promise.all([
    countContacts(filter), pageOf(query.p), rubricaSegments(), facets(), crmOwners(), listSavedViews(me.id), stageCounts(filter),
  ]);
  const pages = Math.max(1, Math.ceil(total / RUBRICA_PAGE_SIZE));
  const page = Math.min(query.p, pages);
  const contacts = page === query.p ? firstTry : await pageOf(page);
  const activities = await openActivitiesFor(contacts.map((c) => c.id));
  const view: RubricaQuery = { ...query, p: page };
  const href = (patch: Partial<RubricaQuery>) => `${RUBRICA}${rubricaSearch(view, patch)}`;
  const sort = Object.fromEntries(RUBRICA_SORTS.map((k) => {
    const active = view.ordina === k;
    const next = active ? (view.dir === "asc" ? "desc" : "asc") : ASC_FIRST.includes(k) ? "asc" : "desc";
    return [k, { href: href({ ordina: k, dir: next, p: 1 }), dir: active ? view.dir : null } satisfies SortHead];
  })) as Record<RubricaSort, SortHead>;
  const mailOk = canAccess(me, "email");
  const mailBase = defaultContactMail(view);
  const rows: BoardRow[] = contacts.map((c) => {
    const kind = resolveKind(c);
    const open = activities.get(c.id) ?? [];
    const next = pickNextTouch([
      ...open.map((a) => ({ title: a.title, at: a.at, time: a.time, source: "attivita" as const })),
      ...(c.nextActionAt ? [{ title: c.nextAction ?? "Follow-up", at: c.nextActionAt, source: "followup" as const }] : []),
    ], today);
    const person = c.contactName && c.contactName !== c.businessName ? c.contactName : null;
    return {
      id: c.id, version: c.version, name: c.businessName,
      category: c.type ?? (kind === "persona" ? "Persona" : null), person, city: c.city,
      stage: c.stage, score: c.score, tone: toneOf(c.type ?? kind), letters: initials(c.businessName),
      owner: c.ownerUserId ? { name: c.ownerName ?? "Ex membro", letters: initials(c.ownerName ?? "?"), tone: toneOf(c.ownerName), active: c.ownerActive !== false } : null,
      updated: agoLabel(c.updatedAt),
      href: href({ c: c.id }), planHref: `${ATTIVITA}?nuova=1&contatto=${c.id}`,
      mailHref: mailOk && c.email ? `${contactEmailPath(c.id)}${contactMailSearch(mailBase, { compose: "new" })}` : null,
      next: next ? { title: next.title, relative: next.relative, overdue: next.overdue, today: next.at === today } : null,
    };
  });
  const from = total ? (page - 1) * RUBRICA_PAGE_SIZE + 1 : 0;
  const filtered = Boolean(filter.q || filter.stage || filter.type || filter.city || filter.region || filter.country || filter.source || filter.owner || filter.archived || filter.kind);
  const listKey = rubricaSearch(view, { c: "", tab: "dettagli" });
  const panelLinks = {
    close: href({ c: "" }), tabs: Object.fromEntries(PANEL_TABS.map((t) => [t, href({ tab: t })])) as Record<PanelTab, string>,
    email: view.c ? { list: `${contactEmailPath(view.c)}${contactMailSearch(mailBase)}`, compose: `${contactEmailPath(view.c)}${contactMailSearch(mailBase, { compose: "new" })}` } : undefined,
  };

  const stageTotal = Object.values(stages).reduce((a, b) => a + b, 0);

  return (
    <main className="ds-page cr rb">
      <div className="crm-rubrica crm-rubrica-page" data-panel={view.c ? "open" : undefined}>
        <VistaMemory vista={view.vista} />
        <div className="crm-rubrica-main rb-main">
          <header className="rb-head">
            <div className="rb-head-row">
              <div className="rb-head-title">
                <p className="rb-kicker">CRM</p>
                <h1>Rubrica <span className="rb-count" aria-label={`${segments.tutti} contatti`}>{segments.tutti.toLocaleString("it-IT")}</span></h1>
              </div>
              <div className="rb-head-actions">
                {founder ? <span className="crm-import rb-import"><ImportDialog autoOpen={sp.importa === "1"} /></span> : null}
                <Link className="rb-cta" href={NEW_CONTACT as Route} aria-keyshortcuts="N">
                  <CrmIcon d="M12 5v14M5 12h14" /><span>Nuovo contatto</span><kbd aria-hidden="true">N</kbd>
                </Link>
              </div>
            </div>
            <CrmTabs current={RUBRICA} />
          </header>
          <NewContactShortcut href={NEW_CONTACT} />
          {sp.archiviato === "1" ? <p className="rb-flash" role="status">Contatto archiviato.</p> : null}

          <RubricaStages counts={stages} total={stageTotal} active={isStage(view.fase) ? view.fase : null}
            hrefs={Object.fromEntries(Object.keys(stages).map((st) => [st, href({ fase: view.fase === st ? "" : st, p: 1 })])) as Record<keyof typeof stages, string>} />

          <section className="rb-list" aria-label="Contatti">
            <RubricaToolbar query={view} counts={segments} views={views} founder={founder} cities={f.cities} regions={f.regions} countries={f.countries} types={f.types} owners={owners} />
            {rows.length ? (
              <RubricaBoard key={listKey} rows={rows} layout={view.vista} activeId={view.c} sort={sort} owners={owners} today={today} canEmail={mailOk}
                pager={{ from, to: from + rows.length - 1, total, prev: page > 1 ? href({ p: page - 1 }) : null, next: page < pages ? href({ p: page + 1 }) : null }} />
            ) : (
              <div className="rb-blank">
                {filtered
                  ? <><p className="rb-blank-title">Nessun contatto con questi filtri.</p><p className="rb-blank-lead">Prova a togliere un filtro o a cercare un altro nome.</p><Link className="rb-btn" href={(view.c ? `${RUBRICA}?c=${view.c}` : RUBRICA) as Route}>Azzera i filtri</Link></>
                  : <><p className="rb-blank-title">Ancora nessun contatto in rubrica.</p><p className="rb-blank-lead">Aggiungine uno a mano o importa i lead dal Radar.</p><Link className="rb-cta" href={NEW_CONTACT as Route}>Nuovo contatto</Link></>}
              </div>
            )}
          </section>

          <section className="rb-new" id="nuovo">
            <details open={sp.nuovo === "1"}><summary><CrmIcon d="M12 5v14M5 12h14" />Nuovo contatto</summary><ContactForm owners={owners} /></details>
          </section>
        </div>
        {view.c ? (
          <Suspense key={`${view.c}:${view.tab}`} fallback={<PanelSkeleton />}>
            <ContactPanel id={view.c} tab={view.tab} me={me} links={panelLinks} presentation="rubrica" />
          </Suspense>
        ) : null}
      </div>
    </main>
  );
}
