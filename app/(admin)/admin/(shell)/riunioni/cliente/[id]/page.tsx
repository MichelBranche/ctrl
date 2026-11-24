import "@/components/ds/admin-ui.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/meetings.css";
import { Suspense } from "react";
import { DetailMissing, MeetDetail } from "@/components/admin/meet/meet-detail";
import { requireSection } from "@/lib/admin";
import { getClientMeeting } from "@/lib/client-meet";
import { addMinutes, nowLocal } from "@/lib/google-meet";
import { canAccess } from "@/lib/team-types";

export default function ClientMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="ds-page rb mt mt-narrow" aria-busy="true"><div className="mt-skel" style={{ height: "20rem" }} /></main>}><Body params={params} /></Suspense>;
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireSection("meetings");
  const { id } = await params;
  const m = /^[\w-]{1,64}$/.test(id) ? await getClientMeeting(id) : null;
  if (!m) return <DetailMissing text="Riunione non trovata: forse è stata annullata." />;
  const crm = canAccess(me, "crm");
  return (
    <MeetDetail kind="cliente" id={m.id} title={m.title} start={m.start} end={addMinutes(m.start, m.minutes)} minutes={m.minutes} now={nowLocal()}
      meetUrl={m.meetUrl} notesLabel="Ordine del giorno" notes={m.agenda}
      linkNote={m.eventId ? "Evento presente anche in Google Calendar." : "Link Meet inserito a mano (Google Calendar non collegato all'invio)."}
      people={(
        <dl className="mt-dl">
          <div><dt>Nome</dt><dd>{m.clientName}</dd></div>
          <div><dt>Email</dt><dd><a href={`mailto:${m.clientEmail}`}>{m.clientEmail}</a></dd></div>
          {crm && m.contactId ? <div><dt>CRM</dt><dd><a href={`/admin/crm/${m.contactId}`}>Apri la scheda contatto</a></dd></div> : null}
        </dl>
      )} />
  );
}
