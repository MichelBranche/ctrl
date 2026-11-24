import "@/components/ds/admin-ui.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/meetings.css";
import { Suspense } from "react";
import { DetailMissing, MeetDetail } from "@/components/admin/meet/meet-detail";
import { requireSection } from "@/lib/admin";
import { connection, getMeeting, googleConfigured, nowLocal } from "@/lib/google-meet";
import { fromTeam } from "@/lib/meet-agenda";

export default function TeamMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="ds-page rb mt mt-narrow" aria-busy="true"><div className="mt-skel" style={{ height: "20rem" }} /></main>}><Body params={params} /></Suspense>;
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("meetings");
  const { id } = await params;
  const live = googleConfigured() && Boolean(await connection().catch(() => null));
  if (!live) return <DetailMissing text="Le riunioni team arrivano da Google Calendar, che ora non è collegato." />;
  const m = await getMeeting(decodeURIComponent(id));
  if (!m) return <DetailMissing text="Riunione non trovata: forse è stata annullata." />;
  const it = fromTeam(m);
  return (
    <MeetDetail kind={it.kind === "google" ? "google" : "team"} id={m.id} title={m.title} start={it.start} end={it.end} now={nowLocal()} allDay={it.allDay}
      minutes={it.minutes}
      meetUrl={m.meetUrl} calendarUrl={m.calendarUrl} notesLabel="Note" notes={m.notes || null}
      people={m.attendees.length ? <ul className="mt-people-list">{m.attendees.map((a) => <li key={a}><span className="mt-ava" aria-hidden="true">{a.slice(0, 1).toUpperCase()}</span>{a}</li>)}</ul> : <p className="mt-dim">Nessun invitato.</p>} />
  );
}
