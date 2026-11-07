import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ContactPanel } from "@/components/admin/crm/contact-panel";
import { CrmHeader, CrmIcon, CrmTabs, eur } from "@/components/admin/crm/crm-ui";
import { KeyShortcut } from "@/components/admin/crm/follow-up-client";
import { OpportunityBoard, type DealCard } from "@/components/admin/crm/opportunity-board";
import { OpportunityDialog } from "@/components/admin/crm/opportunity-dialog";
import { SavedDealViews } from "@/components/admin/crm/saved-deal-views";
import { requireSection } from "@/lib/admin";
import { crmOwners, getContact } from "@/lib/crm";
import { conversionRate, isDealPriority, isSource, isStage, SOURCE_LABEL, STAGES } from "@/lib/crm-core";
import {
  contactEmailPath, PANEL_TABS, parsePipelineQuery, PIPELINE, pipelineSearch, type PanelTab, type PipelineQuery,
} from "@/lib/crm-nav";
import { getOpportunity, listOpportunities, opportunityTotals, type DealFilter } from "@/lib/crm-opportunity";

type SP = Record<string, string | string[] | undefined>;

export default function PipelinePage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <main className="adm-main crm-main crm-main-rubrica">
      <Suspense fallback={<p className="adm-muted" aria-busy="true">Caricamento della pipeline…</p>}><Body searchParams={searchParams} /></Suspense>
    </main>
  );
}

function hrefOf(view: PipelineQuery, patch: Partial<PipelineQuery> = {}) {
  return `${PIPELINE}${pipelineSearch(view, patch)}`;
}

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const query = parsePipelineQuery(await searchParams);
  const filter: DealFilter = {
    q: query.q || undefined,
    unassigned: query.resp === "none",
    ownerId: query.resp === "me" ? me.id : query.resp && query.resp !== "none" ? query.resp : undefined,
    source: isSource(query.fonte) ? query.fonte : undefined,
    priority: query.prio === "nessuna" ? "nessuna" : isDealPriority(query.prio) ? query.prio : undefined,
    period: query.periodo,
  };
  const [deals, totals, owners] = await Promise.all([listOpportunities(filter), opportunityTotals(filter), crmOwners()]);
  const openDeal = query.o ? await getOpportunity(query.o) : null;
  const panelContact = openDeal?.contactId || query.c;
  const presetContact = query.contatto ? await getContact(query.contatto) : null;
  const stage = isStage(query.apri) ? query.apri : "nuovo";
  const view = query;
  const href = (patch: Partial<PipelineQuery>) => hrefOf(view, patch);
  const rate = conversionRate(totals.won, totals.lost);
  const bare = !query.q && !query.resp && !query.fonte && !query.prio;
  const cards: DealCard[] = deals.map((d) => ({
    id: d.id, version: d.version, contactId: d.contactId, name: d.contactName, title: d.title, city: d.city,
    value: eur(d.valueEur), score: d.score, stage: d.stage, priority: d.priority,
    active: d.id === openDeal?.id, href: href({ c: d.contactId, o: d.id, nuova: false }),
  }));
  const panelLinks = panelContact ? {
    close: href({ c: "", o: "" }),
    tabs: Object.fromEntries(PANEL_TABS.map((t) => [t, href({ c: panelContact, o: openDeal?.id ?? "", tab: t })])) as Record<PanelTab, string>,
    email: { list: contactEmailPath(panelContact), compose: `${contactEmailPath(panelContact)}?compose=new` },
  } : null;
  const deal = openDeal && openDeal.contactId === panelContact ? {
    id: openDeal.id, version: openDeal.version, stage: openDeal.stage, title: openDeal.title, valueEur: openDeal.valueEur,
    ownerUserId: openDeal.ownerUserId, priority: openDeal.priority,
    former: openDeal.ownerUserId && openDeal.ownerActive === false ? `${openDeal.ownerName ?? "Account eliminato"} (ex membro)` : null,
  } : null;

  return (
    <div className="crm-rubrica" data-panel={panelContact ? "open" : undefined}>
      <div className="crm-rubrica-main">
        <KeyShortcut href={href({ nuova: true, apri: "" })} keyName="o" />
        <CrmHeader title="Pipeline" intro="Gestisci le opportunità commerciali e segui l'avanzamento delle trattative.">
          <div className="crm-switch" role="group" aria-label="Vista">
            <Link href={href({ vista: "kanban" }) as Route} aria-current={view.vista === "kanban" ? "page" : undefined}>Kanban</Link>
            <Link href={href({ vista: "lista" }) as Route} aria-current={view.vista === "lista" ? "page" : undefined}>Lista</Link>
          </div>
          <OpportunityDialog query={view} stage={stage} owners={owners} me={me.id} preset={presetContact && !presetContact.archived ? { id: presetContact.id, name: presetContact.businessName, city: presetContact.city } : null} />
        </CrmHeader>
        <CrmTabs current={PIPELINE} />

        <form className="crm-toolbar" action={PIPELINE} method="get" role="search">
          <label className="crm-search">
            <CrmIcon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
            <input className="adm-input" name="q" defaultValue={query.q} placeholder="Cerca opportunità…" aria-label="Cerca opportunità" />
          </label>
          {query.resp ? <input type="hidden" name="resp" value={query.resp} /> : null}
          {query.fonte ? <input type="hidden" name="fonte" value={query.fonte} /> : null}
          {query.prio ? <input type="hidden" name="prio" value={query.prio} /> : null}
          {query.periodo !== "mese" ? <input type="hidden" name="periodo" value={query.periodo} /> : null}
          {query.vista === "lista" ? <input type="hidden" name="vista" value="lista" /> : null}
          {query.perso ? <input type="hidden" name="perso" value="1" /> : null}
          <button className="adm-btn adm-btn-sm" type="submit">Cerca</button>
          <Filter label="Responsabile" current={query.resp || "Tutti"} options={[
            ["", "Tutti i responsabili"], ["me", "I miei"], ["none", "Non assegnato"], ...owners.map((o) => [o.id, o.name] as [string, string]),
          ]} href={(resp) => href({ resp })} />
          <Filter label="Fonte" current={isSource(query.fonte) ? SOURCE_LABEL[query.fonte] : "Tutte"} options={[
            ["", "Tutte le fonti"], ["radar", "Radar"], ["sito", "Sito"], ["manuale", "Manuale"],
          ]} href={(fonte) => href({ fonte })} />
          <Filter label="Priorità" current={query.prio === "nessuna" ? "Senza" : isDealPriority(query.prio) ? query.prio : "Tutte"} options={[
            ["", "Tutte"], ["alta", "Alta"], ["media", "Media"], ["bassa", "Bassa"], ["nessuna", "Senza priorità"],
          ]} href={(prio) => href({ prio })} />
          <SavedDealViews query={view} />
        </form>

        {bare && totals.open === 0 && totals.won === 0 && totals.lost === 0 ? (
          <p className="crm-notice" role="note">Nessuna opportunità. Si crea solo con «Nuova opportunità», per una trattativa concreta. Un contatto in Call, un punteggio Iris o un import CSV non diventano una card. Lo storico non è stato convertito.</p>
        ) : null}

        <OpportunityBoard cards={cards} vista={view.vista} showLost={view.perso} expandLost={href({ perso: true })} addHref={Object.fromEntries(STAGES.map((s) => [s, href({ nuova: true, apri: s, contatto: panelContact || "" })])) as Record<(typeof STAGES)[number], string>} />

        <footer className="crm-pipe-foot">
          <span>{totals.open} opportunità attive</span>
          <span>{rate === null ? "n.d." : `${Math.round(rate * 100)}%`} tasso di conversione</span>
          <span>{eur(totals.openValue) || "0 €"} valore stimato</span>
          <span className="crm-switch" role="group" aria-label="Periodo dei chiusi">
            {([["mese", "Questo mese"], ["trimestre", "Questo trimestre"], ["tutto", "Tutto"]] as const).map(([id, label]) => (
              <Link key={id} href={href({ periodo: id }) as Route} aria-current={view.periodo === id ? "page" : undefined}>{label}</Link>
            ))}
          </span>
        </footer>
      </div>
      {panelContact && panelLinks ? (
        <Suspense fallback={<aside className="crm-panel" aria-busy="true">Caricamento della scheda…</aside>}>
          <ContactPanel id={panelContact} tab={view.tab} me={me} links={panelLinks} deal={deal ?? undefined} />
        </Suspense>
      ) : null}
    </div>
  );
}

function Filter({ label, current, options, href }: { label: string; current: string; options: [string, string][]; href: (value: string) => string }) {
  return (
    <details className="crm-menu">
      <summary className="adm-btn adm-btn-sm">{label}: {current}</summary>
      <div className="crm-menu-list">
        {options.map(([value, text]) => <Link key={value || "all"} href={href(value) as Route}>{text}</Link>)}
      </div>
    </details>
  );
}
