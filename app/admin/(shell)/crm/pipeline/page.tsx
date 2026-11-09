import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ContactBoard, type ContactCard } from "@/components/admin/crm/contact-board";
import { ContactPanel } from "@/components/admin/crm/contact-panel";
import { CrmHeader, CrmIcon, CrmTabs, eur } from "@/components/admin/crm/crm-ui";
import { KeyShortcut } from "@/components/admin/crm/follow-up-client";
import { OpportunityBoard, type DealCard } from "@/components/admin/crm/opportunity-board";
import { OpportunityDialog } from "@/components/admin/crm/opportunity-dialog";
import { SavedDealViews } from "@/components/admin/crm/saved-deal-views";
import { requireSection } from "@/lib/admin";
import { contactTouches, countContacts, crmOwners, getContact, listContacts, type Contact } from "@/lib/crm";
import { conversionRate, isDealPriority, isSource, isStage, SOURCE_LABEL, STAGES } from "@/lib/crm-core";
import { kpiWeekChange, recordOggiKpis } from "@/lib/crm-kpi";
import {
  contactMailHref, PANEL_TABS, parsePipelineQuery, PIPELINE, pipelineSearch, type PanelTab, type PipelineQuery,
} from "@/lib/crm-nav";
import { getOpportunity, listOpportunities, openDealAmounts, opportunityTotals, type DealFilter } from "@/lib/crm-opportunity";
import { canAccess } from "@/lib/team-types";

type SP = Record<string, string | string[] | undefined>;
const BOARD_LIMIT = 500;

export default function PipelinePage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <main className="adm-main crm-main crm-main-rubrica crm-pipeline-page">
      <Suspense fallback={<p className="adm-muted" aria-busy="true">Caricamento della pipeline…</p>}><Body searchParams={searchParams} /></Suspense>
    </main>
  );
}

function hrefOf(view: PipelineQuery, patch: Partial<PipelineQuery> = {}) {
  return `${PIPELINE}${pipelineSearch(view, patch)}`;
}

const touchLabel = (touch: { at: string; name: string | null } | undefined) => {
  if (!touch) return "Autore non disponibile";
  const when = new Date(touch.at).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return touch.name ? `${touch.name} · ${when}` : `Autore non disponibile · ${when}`;
};

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const query = parsePipelineQuery(await searchParams);
  const contactsMode = query.tipo === "contatti";
  const view = query;
  const href = (patch: Partial<PipelineQuery>) => hrefOf(view, patch);
  const owners = await crmOwners();
  const stage = isStage(query.apri) ? query.apri : "nuovo";
  const presetContact = query.contatto ? await getContact(query.contatto) : null;

  const filter: DealFilter = {
    q: query.q || undefined,
    unassigned: query.resp === "none",
    ownerId: query.resp === "me" ? me.id : query.resp && query.resp !== "none" ? query.resp : undefined,
    source: isSource(query.fonte) ? query.fonte : undefined,
    priority: query.prio === "nessuna" ? "nessuna" : isDealPriority(query.prio) ? query.prio : undefined,
    period: query.periodo,
  };
  const contactFilter = {
    q: query.q || undefined,
    owner: query.resp === "me" ? me.id : query.resp || undefined,
    source: isSource(query.fonte) ? query.fonte : undefined,
    limit: BOARD_LIMIT,
  };
  const [deals, totals, contacts, contactCount, snap, book] = await Promise.all([
    contactsMode ? Promise.resolve([]) : listOpportunities(filter),
    contactsMode ? Promise.resolve(null) : opportunityTotals(filter),
    contactsMode ? listContacts(contactFilter) : Promise.resolve([]),
    contactsMode ? countContacts(contactFilter) : Promise.resolve(0),
    recordOggiKpis(),
    countContacts(),
  ]);
  const potentialPct = await kpiWeekChange("potential_value_cents");
  const touches = contactsMode ? await contactTouches(contacts.map((c) => c.id)) : new Map();
  const amounts = contactsMode ? await openDealAmounts(contacts.map((c) => c.id)) : new Map<string, number | null>();
  const shown = (c: Contact): { cents: number | null; kind: "" | "reale" | "stimato" } => {
    if (amounts.has(c.id)) {
      const dealValue = amounts.get(c.id);
      if (dealValue !== null && dealValue !== undefined) return { cents: Math.round(dealValue * 100), kind: "reale" };
    }
    if (c.estimatedValueCents !== null) return { cents: c.estimatedValueCents, kind: "stimato" };
    return { cents: null, kind: "" };
  };
  const openDeal = !contactsMode && query.o ? await getOpportunity(query.o) : null;
  const panelContact = openDeal?.contactId || query.c;
  const rate = totals ? conversionRate(totals.won, totals.lost) : null;
  const bareDeals = !contactsMode && !query.q && !query.resp && !query.fonte && !query.prio && totals && totals.open === 0 && totals.won === 0 && totals.lost === 0;
  const cards: DealCard[] = deals.map((d) => ({
    id: d.id, version: d.version, contactId: d.contactId, name: d.contactName, title: d.title, city: d.city,
    value: eur(d.valueEur), valueEur: d.valueEur, score: d.score, stage: d.stage, priority: d.priority,
    active: d.id === openDeal?.id, href: href({ c: d.contactId, o: d.id, nuova: false }),
  }));
  const mail = canAccess(me, "email");
  const people: ContactCard[] = contacts.map((c) => ({
    id: c.id, version: c.version, name: c.businessName, city: c.city, stage: c.stage, score: c.score,
    href: href({ c: c.id, o: "", tab: "dettagli" }),
    historyHref: href({ c: c.id, o: "", tab: "cronologia" }),
    emailHref: mail ? contactMailHref(c.id, "pipeline", pipelineSearch(view, { c: "", o: "", nuova: false, tab: "dettagli" }).slice(1)) : null,
    active: c.id === query.c,
    owner: c.ownerName ? (c.ownerActive === false ? `${c.ownerName} (non più nel team)` : c.ownerName) : "Non assegnato",
    touch: touchLabel(touches.get(c.id)),
    source: SOURCE_LABEL[c.source],
    valueCents: shown(c).cents,
    valueKind: shown(c).kind,
  }));
  const openPerson = contacts.find((c) => c.id === query.c);
  const openMoney = openPerson ? shown(openPerson) : null;
  const banner = openMoney?.cents != null ? `${eur(openMoney.cents / 100)}${openMoney.kind === "stimato" ? " stimato" : ""}` : null;
  const panelLinks = panelContact ? {
    close: href({ c: "", o: "" }),
    tabs: Object.fromEntries(PANEL_TABS.map((t) => [t, href({ c: panelContact, o: contactsMode ? "" : openDeal?.id ?? "", tab: t })])) as Record<PanelTab, string>,
    email: mail ? {
      list: contactMailHref(panelContact, "pipeline", pipelineSearch(view, { c: "", o: "", nuova: false, tab: "dettagli" }).slice(1)),
      compose: contactMailHref(panelContact, "pipeline", pipelineSearch(view, { c: "", o: "", nuova: false, tab: "dettagli" }).slice(1), true),
    } : undefined,
  } : null;
  const deal = openDeal && openDeal.contactId === panelContact ? {
    id: openDeal.id, version: openDeal.version, stage: openDeal.stage, title: openDeal.title, valueEur: openDeal.valueEur,
    ownerUserId: openDeal.ownerUserId, priority: openDeal.priority,
    former: openDeal.ownerUserId && openDeal.ownerActive === false ? `${openDeal.ownerName ?? "Account eliminato"} (ex membro)` : null,
  } : null;

  return (
    <div className="crm-rubrica" data-panel={panelContact ? "open" : undefined}>
      <div className="crm-rubrica-main">
        <KeyShortcut href={href({ nuova: true, apri: "", tipo: "opportunita" })} keyName="o" />
        <CrmHeader className="crm-pipeline-glow" title="Pipeline" intro={contactsMode
          ? "I contatti, nella fase in cui sono oggi. Iris li aggiunge da solo. Un'opportunità è una trattativa a parte."
          : "Trattative aperte a mano. I contatti restano nella vista Contatti e non diventano opportunità da soli."}>
          <OpportunityDialog query={view} stage={stage} owners={owners} me={me.id} preset={presetContact && !presetContact.archived ? { id: presetContact.id, name: presetContact.businessName, city: presetContact.city } : null} />
        </CrmHeader>
        <div className="crm-pipe-bar">
          <div className="crm-switch" role="group" aria-label="Cosa mostra la pipeline">
            <Link href={href({ tipo: "contatti", o: "", nuova: false }) as Route} aria-current={contactsMode ? "page" : undefined}>Contatti <span>{book}</span></Link>
            <Link href={href({ tipo: "opportunita" }) as Route} aria-current={contactsMode ? undefined : "page"}>Opportunità <span>{snap.opportunitiesActive}</span></Link>
          </div>
          <div className="crm-switch" role="group" aria-label="Vista">
            <Link href={href({ vista: "kanban" }) as Route} aria-current={view.vista === "kanban" ? "page" : undefined}>Kanban</Link>
            <Link href={href({ vista: "lista" }) as Route} aria-current={view.vista === "lista" ? "page" : undefined}>Lista</Link>
          </div>
          <div className="crm-pipe-kpis">
            <p><strong>{snap.opportunitiesActive}</strong><span>Opportunità attive</span></p>
            <p>
              <strong>{eur(snap.potentialValueCents / 100) || "0 €"}</strong>
              <span>Potenziale contattati</span>
              {potentialPct !== null ? <em>{potentialPct > 0 ? `+${potentialPct}%` : `${potentialPct}%`}</em> : null}
            </p>
          </div>
        </div>
        <CrmTabs current={PIPELINE} />

        <form className="crm-toolbar" action={PIPELINE} method="get" role="search">
          <label className="crm-search">
            <CrmIcon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
            <input className="adm-input" name="q" defaultValue={query.q} placeholder={contactsMode ? "Cerca un contatto…" : "Cerca un'opportunità…"} aria-label={contactsMode ? "Cerca un contatto" : "Cerca un'opportunità"} />
          </label>
          {query.resp ? <input type="hidden" name="resp" value={query.resp} /> : null}
          {query.fonte ? <input type="hidden" name="fonte" value={query.fonte} /> : null}
          {!contactsMode && query.prio ? <input type="hidden" name="prio" value={query.prio} /> : null}
          {!contactsMode && query.periodo !== "mese" ? <input type="hidden" name="periodo" value={query.periodo} /> : null}
          {query.vista === "lista" ? <input type="hidden" name="vista" value="lista" /> : null}
          {!contactsMode ? <input type="hidden" name="tipo" value="opportunita" /> : null}
          {!contactsMode && query.perso ? <input type="hidden" name="perso" value="1" /> : null}
          <button className="adm-btn adm-btn-sm" type="submit">Cerca</button>
          <Filter label="Responsabile" current={query.resp === "me" ? "I miei" : query.resp === "none" ? "Non assegnato" : owners.find((o) => o.id === query.resp)?.name ?? "Tutti"} options={[
            ["", "Tutti i responsabili"], ["me", "I miei"], ["none", "Non assegnato"], ...owners.map((o) => [o.id, o.name] as [string, string]),
          ]} href={(resp) => href({ resp })} />
          <Filter label="Fonte" current={isSource(query.fonte) ? SOURCE_LABEL[query.fonte] : "Tutte"} options={[
            ["", "Tutte le fonti"], ["radar", "Radar"], ["sito", "Sito"], ["manuale", "Manuale"],
          ]} href={(fonte) => href({ fonte })} />
          {!contactsMode ? (
            <Filter label="Priorità" current={query.prio === "nessuna" ? "Senza" : isDealPriority(query.prio) ? query.prio : "Tutte"} options={[
              ["", "Tutte"], ["alta", "Alta"], ["media", "Media"], ["bassa", "Bassa"], ["nessuna", "Senza priorità"],
            ]} href={(prio) => href({ prio })} />
          ) : null}
          {!contactsMode ? <SavedDealViews query={view} /> : null}
        </form>

        {contactsMode ? (
          <>
            {!people.length ? <p className="crm-notice" role="note">Nessun contatto con questi filtri. Un arrivo di Iris o un contatto già in rubrica compare qui nella sua fase, senza essere ricreato.</p> : null}
            <div key={`${query.q}|${query.resp}|${query.fonte}|${view.vista}`} className="crm-pipe-results">
              <ContactBoard cards={people} vista={view.vista} />
            </div>
            <footer className="crm-pipe-foot">
              <span>{contactCount} contatti</span>
              <span>Nella fase attuale, non azzerata</span>
              {contactCount > people.length ? <span>In pagina i primi {people.length}</span> : null}
            </footer>
          </>
        ) : (
          <>
            {bareDeals ? <p className="crm-notice" role="note">Nessuna opportunità esplicita. Si apre solo con «Nuova opportunità». I contatti, anche quelli in Call o arrivati da Iris, stanno nella vista Contatti e non vengono convertiti.</p> : null}
            <OpportunityBoard cards={cards} vista={view.vista} showLost={view.perso} expandLost={href({ perso: true })} addHref={Object.fromEntries(STAGES.map((s) => [s, href({ nuova: true, apri: s, contatto: panelContact || "" })])) as Record<(typeof STAGES)[number], string>} />
            <footer className="crm-pipe-foot">
              <span>{totals?.open ?? 0} opportunità attive</span>
              <span>{rate === null ? "n.d." : `${Math.round(rate * 100)}%`} tasso di conversione</span>
              <span>{eur(totals?.openValue ?? 0) || "0 €"} valore delle trattative</span>
              <span className="crm-switch" role="group" aria-label="Periodo dei chiusi">
                {([["mese", "Questo mese"], ["trimestre", "Questo trimestre"], ["tutto", "Tutto"]] as const).map(([id, label]) => (
                  <Link key={id} href={href({ periodo: id }) as Route} aria-current={view.periodo === id ? "page" : undefined}>{label}</Link>
                ))}
              </span>
            </footer>
          </>
        )}
      </div>
      {panelContact && panelLinks ? (
        <Suspense fallback={<aside className="crm-panel" aria-busy="true">Caricamento della scheda…</aside>}>
          <ContactPanel id={panelContact} tab={view.tab} me={me} links={panelLinks} deal={deal ?? undefined} presentation="rubrica" banner={banner} />
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
