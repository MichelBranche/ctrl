import { Suspense } from "react";
import { CrmHeader, CrmTabs, romeToday } from "@/components/admin/crm/crm-ui";
import { addDays, FollowUpRows, ScopeSwitch } from "@/components/admin/crm/follow-ups";
import { requireSection } from "@/lib/admin";
import { dueActions, type DueAction } from "@/lib/crm";
import { followUpScope } from "@/lib/crm-nav";
import { isFounder } from "@/lib/team-types";

type SP = Record<string, string | string[] | undefined>;
const HERE = "/admin/crm/attivita";
const WINDOW_DAYS = 30;

export default function AttivitaPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <main className="adm-main crm-main"><Suspense fallback={<p className="adm-muted" aria-busy="true">Caricamento…</p>}><Body searchParams={searchParams} /></Suspense></main>;
}

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("crm");
  const sp = await searchParams;
  const founder = isFounder(me);
  const scope = followUpScope(typeof sp.ambito === "string" ? sp.ambito : undefined, founder);
  const today = romeToday();
  const tomorrow = addDays(today, 1);
  const items = await dueActions(scope === "team" ? null : me.id, today, addDays(today, WINDOW_DAYS));
  const day = (a: DueAction) => a.nextActionAt.slice(0, 10);
  const groups: [string, DueAction[]][] = [
    ["In ritardo", items.filter((a) => day(a) < today)],
    ["Oggi", items.filter((a) => day(a) === today)],
    ["Domani", items.filter((a) => day(a) === tomorrow)],
    [`Prossimi ${WINDOW_DAYS} giorni`, items.filter((a) => day(a) > tomorrow)],
  ];
  return (
    <>
      <CrmHeader title="Attività" intro="Follow-up e scadenze dei contatti, per non perdere un'opportunità." />
      <CrmTabs current={HERE} />
      <p className="crm-notice" role="note">
        Qui trovi i follow-up impostati nelle schede dei contatti, la stessa fonte della tua scrivania. Le attività condivise, con
        assegnatario, orario e calendario, arriveranno con la fase Attività del nuovo CRM.
      </p>
      <section className="crm-kpis is-compact" aria-label="Riepilogo">
        {groups.slice(0, 3).map(([label, list]) => (
          <div key={label} className="crm-kpi" data-tone={label === "In ritardo" && list.length ? "late" : undefined}>
            <span className="crm-kpi-num">{list.length}</span><span className="crm-kpi-label">{label}</span>
          </div>
        ))}
      </section>
      <section className="crm-card-panel">
        <div className="crm-panel-head">
          <h2 className="adm-h2">{scope === "team" ? "Follow-up del team" : "I miei follow-up"}</h2>
          {founder ? <ScopeSwitch base={HERE} scope={scope} /> : null}
        </div>
        {!items.length ? <p className="adm-muted crm-empty">Nessun follow-up nei prossimi {WINDOW_DAYS} giorni. Si pianificano dalla scheda di ogni contatto.</p> : null}
        {groups.map(([label, list]) => list.length ? (
          <div key={label} className="crm-group">
            <h3 className="crm-group-title">{label} <span className="crm-count">{list.length}</span></h3>
            <FollowUpRows items={list} today={today} showOwner={scope === "team"} />
          </div>
        ) : null)}
        {items.length >= 50 ? <p className="adm-muted crm-foot">Sono mostrati i primi 50 follow-up in ordine di scadenza.</p> : null}
      </section>
    </>
  );
}
