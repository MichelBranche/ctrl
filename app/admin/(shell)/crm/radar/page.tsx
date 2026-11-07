import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CrmHeader, CrmTabs, ScoreBadge } from "@/components/admin/crm/crm-ui";
import { DraftEditor } from "@/components/admin/crm/draft-editor";
import { requireSection } from "@/lib/admin";
import { listContacts, listDrafts } from "@/lib/crm";
import { STAGE_LABEL } from "@/lib/crm-core";
import { canAccess } from "@/lib/team-types";

export default function RadarPage() {
  return <main className="adm-main crm-main"><Suspense fallback={<p className="adm-muted" aria-busy="true">Caricamento…</p>}><Body /></Suspense></main>;
}

async function Body() {
  const me = await requireSection("crm");
  const canSend = canAccess(me, "email");
  const contacts = (await listContacts({ source: "radar", limit: 300 })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const drafts = await listDrafts(contacts.map((c) => c.id));
  return (
    <>
      <CrmHeader title="Radar" intro="Prospect trovati da Iris, ordinati per punteggio commerciale." />
      <CrmTabs current="/admin/crm/radar" />
      <p className="adm-note">Niente parte da solo: ogni email viene inviata solo quando premi Invia.</p>
      {!contacts.length ? <p className="adm-muted">Ancora nessun prospect. Arrivano da POST /api/crm/ingest.</p> : null}
      {contacts.map((c) => {
        const mine = drafts.filter((d) => d.contactId === c.id);
        return (
          <section key={c.id} className="adm-panel">
            <div className="adm-panel-head">
              <h2 className="adm-h2"><Link href={`/admin/crm/${c.id}` as Route}>{c.businessName}</Link></h2>
              <span className="adm-row-actions"><span className="adm-badge">{STAGE_LABEL[c.stage]}</span><ScoreBadge score={c.score} /></span>
            </div>
            <p className="adm-muted">{[c.type, c.city, c.email ?? "senza email", c.website].filter(Boolean).join(" · ")}</p>
            {c.scoreReasons.length ? <ul className="crm-reasons">{c.scoreReasons.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
            {mine.length ? mine.map((d) => (
              <details key={d.id} open={d.status === "bozza"}><summary>{d.subject} <span className="adm-badge">{d.status}</span></summary>
                <DraftEditor draft={d} to={c.email} canSend={canSend} />
              </details>
            )) : <p className="adm-muted">Nessuna bozza.</p>}
          </section>
        );
      })}
    </>
  );
}
