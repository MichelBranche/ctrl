import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ContactForm } from "@/components/admin/crm/contact-form";
import { ImportDialog } from "@/components/admin/crm/import-dialog";
import { ContactPanel } from "@/components/admin/crm/contact-panel";
import { NewContactShortcut } from "@/components/admin/crm/follow-up-client";
import { avatarHue, CrmHeader, CrmTabs, initials, romeToday } from "@/components/admin/crm/crm-ui";
import { RubricaBoard, type BoardRow, type SortHead } from "@/components/admin/crm/rubrica-board";
import { RubricaSegments, RubricaTools, VistaMemory } from "@/components/admin/crm/rubrica-tools";
import { requireSection } from "@/lib/admin";
import { backfillRequests, countContacts, crmOwners, facets, listContacts, openActivitiesFor, rubricaSegments, type ContactFilter } from "@/lib/crm";
import { isSource, isStage } from "@/lib/crm-core";
import { resolveKind } from "@/lib/crm-kind";
import { pickNextTouch } from "@/lib/crm-next";
import { listSavedViews } from "@/lib/crm-views";
import {
  ATTIVITA, contactEmailPath, contactMailSearch, defaultContactMail, PANEL_TABS, parseRubricaQuery, RUBRICA, RUBRICA_PAGE_SIZE, RUBRICA_SORTS,
  rubricaSearch, type PanelTab, type RubricaQuery, type RubricaSort,
} from "@/lib/crm-nav";
import { canAccess, isFounder } from "@/lib/team-types";

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
      <div className="adm-skel" style={{ height: "2.4rem", borderRadius: ".6rem", margin: "1.2rem 0" }} />
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

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const sp = await searchParams;
  const query = parseRubricaQuery(sp);
  await backfillRequests().catch(() => {});
  const today = romeToday();
  const founder = isFounder(me);
  const filter: ContactFilter = {
    q: query.q || undefined, stage: isStage(query.fase) ? query.fase : undefined, type: query.categoria || undefined, city: query.citta || undefined,
    source: isSource(query.fonte) ? query.fonte : undefined, archived: query.archivio,
    owner: query.seg === "liberi" ? "none" : query.resp === "me" ? me.id : query.resp || undefined,
    kind: query.seg === "aziende" ? "azienda" : query.seg === "persone" ? "persona" : undefined,
  };
  const pageOf = (p: number) => listContacts({ ...filter, sort: query.ordina, dir: query.dir, limit: RUBRICA_PAGE_SIZE, offset: (p - 1) * RUBRICA_PAGE_SIZE });
  const [total, firstTry, segments, f, owners, views] = await Promise.all([
    countContacts(filter), pageOf(query.p), rubricaSegments(), facets(), crmOwners(), listSavedViews(me.id),
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
    return {
      id: c.id, version: c.version, name: c.businessName,
      sub: c.type ?? (kind === "persona" ? (c.contactName && c.contactName !== c.businessName ? c.contactName : "Persona") : c.contactName),
      stage: c.stage, score: c.score, hue: avatarHue(c.businessName), letters: initials(c.businessName),
      href: href({ c: c.id }), planHref: `${ATTIVITA}?nuova=1&contatto=${c.id}`,
      mailHref: mailOk && c.email ? `${contactEmailPath(c.id)}${contactMailSearch(mailBase, { compose: "new" })}` : null,
      next: next ? { title: next.title, relative: next.relative, overdue: next.overdue } : null,
    };
  });
  const from = total ? (page - 1) * RUBRICA_PAGE_SIZE + 1 : 0;
  const filtered = Boolean(filter.q || filter.stage || filter.type || filter.city || filter.source || filter.owner || filter.archived || filter.kind);
  const listKey = rubricaSearch(view, { c: "", tab: "dettagli" });
  const panelLinks = {
    close: href({ c: "" }), tabs: Object.fromEntries(PANEL_TABS.map((t) => [t, href({ tab: t })])) as Record<PanelTab, string>,
    email: view.c ? { list: `${contactEmailPath(view.c)}${contactMailSearch(mailBase)}`, compose: `${contactEmailPath(view.c)}${contactMailSearch(mailBase, { compose: "new" })}` } : undefined,
  };

  return (
    <div className="crm-rubrica crm-rubrica-page" data-panel={view.c ? "open" : undefined}>
      <VistaMemory vista={view.vista} />
      <div className="crm-rubrica-main">
        <CrmHeader className="crm-rubrica-glow" title="Rubrica" intro="Tutti i tuoi contatti: filtrali, gestiscili e passa all'azione.">
          <span className="crm-import"><ImportDialog autoOpen={sp.importa === "1"} /></span>
          <Link className="adm-btn adm-btn-primary" href={NEW_CONTACT as Route}>Nuovo contatto</Link>
        </CrmHeader>
        <NewContactShortcut href={NEW_CONTACT} />
        <CrmTabs current={RUBRICA} />
        {sp.archiviato === "1" ? <p className="adm-ok" role="status">Contatto archiviato.</p> : null}
        <RubricaSegments query={view} counts={segments} views={views} founder={founder} />
        <RubricaTools query={view} cities={f.cities} types={f.types} owners={owners} />

        {rows.length ? (
          <RubricaBoard key={listKey} rows={rows} layout={view.vista} activeId={view.c} sort={sort} owners={owners} today={today} canEmail={mailOk}
            pager={{ from, to: from + rows.length - 1, total, prev: page > 1 ? href({ p: page - 1 }) : null, next: page < pages ? href({ p: page + 1 }) : null }} />
        ) : (
          <div className="crm-card-panel crm-empty-state">
            {filtered
              ? <><p>Nessun contatto con questi filtri.</p><Link className="adm-btn adm-btn-sm" href={(view.c ? `${RUBRICA}?c=${view.c}` : RUBRICA) as Route}>Azzera i filtri</Link></>
              : <><p>Ancora nessun contatto in rubrica.</p><p className="adm-muted">Aggiungine uno a mano o importa i lead dal Radar.</p><Link className="adm-btn adm-btn-sm adm-btn-primary" href={NEW_CONTACT as Route}>Nuovo contatto</Link></>}
          </div>
        )}

        <section className="crm-card-panel" id="nuovo">
          <details open={sp.nuovo === "1"}><summary className="adm-h2">Nuovo contatto</summary><ContactForm owners={owners} /></details>
        </section>
      </div>
      {view.c ? (
        <Suspense key={`${view.c}:${view.tab}`} fallback={<PanelSkeleton />}>
          <ContactPanel id={view.c} tab={view.tab} me={me} links={panelLinks} presentation="rubrica" />
        </Suspense>
      ) : null}
    </div>
  );
}
