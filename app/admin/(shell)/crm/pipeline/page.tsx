import { Suspense } from "react";
import { CrmTabs, day, eur, romeToday } from "@/components/admin/crm/crm-ui";
import { Kanban, type Card } from "@/components/admin/crm/kanban";
import { requireSection } from "@/lib/admin";
import { listContacts } from "@/lib/crm";

export default function PipelinePage() {
  return <main className="adm-main"><Suspense fallback={<p className="adm-muted" aria-busy="true">Caricamento…</p>}><Body /></Suspense></main>;
}

async function Body() {
  await requireSection("crm");
  const today = romeToday();
  const contacts = await listContacts({ limit: 500 });
  const cards: Card[] = contacts.map((c) => ({
    id: c.id, name: c.businessName, city: c.city, value: eur(c.valueEur), nextAction: c.nextAction, nextDate: day(c.nextActionAt) || null,
    overdue: Boolean(c.nextActionAt && c.nextActionAt.slice(0, 10) < today && !["vinto", "perso"].includes(c.stage)), score: c.score, stage: c.stage,
  }));
  return (
    <>
      <header className="adm-top"><div><p className="adm-muted">Trascina una scheda per cambiare fase</p><h1 className="adm-h1">Pipeline</h1></div></header>
      <CrmTabs current="/admin/crm/pipeline" />
      <Kanban cards={cards} />
    </>
  );
}
