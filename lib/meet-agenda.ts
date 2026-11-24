import "server-only";
import { type ClientMeeting, clientMeetingsBetween, pastClientMeetings, romeToUtc } from "@/lib/client-meet";
import { addMinutes, GoogleError, type Meeting, meetingsBetween, nowLocal } from "@/lib/google-meet";

/*
 * One agenda for Riunioni: client meetings always come from the database; team meetings come from Google Calendar
 * (the "adapter") only when the agency account is connected. Without Google the calendar still works on the DB.
 * Every time here is Rome wall time "YYYY-MM-DDTHH:MM", so both sources compare and sort the same way.
 */

export type MeetKind = "team" | "cliente";
export type AgendaItem = {
  kind: MeetKind; id: string; title: string; start: string; end: string; minutes: number;
  meetUrl: string | null; href: string; who: string;
};

const fromTeam = (m: Meeting): AgendaItem => {
  const start = nowLocal(new Date(m.start)), end = nowLocal(new Date(m.end));
  const minutes = Math.round((new Date(m.end).getTime() - new Date(m.start).getTime()) / 60000);
  return { kind: "team", id: m.id, title: m.title, start, end, minutes, meetUrl: m.meetUrl, href: `/admin/riunioni/team/${encodeURIComponent(m.id)}`, who: `${m.attendees.length} ${m.attendees.length === 1 ? "invitato" : "invitati"}` };
};
const fromClient = (m: ClientMeeting): AgendaItem => ({
  kind: "cliente", id: m.id, title: m.title, start: m.start, end: addMinutes(m.start, m.minutes), minutes: m.minutes,
  meetUrl: m.meetUrl, href: `/admin/riunioni/cliente/${encodeURIComponent(m.id)}`, who: m.clientName,
});

export type Agenda = { items: AgendaItem[]; googleError: string | null; disconnected: boolean };

/** Meetings starting in [fromLocal, toLocal), soonest first. */
export async function agendaBetween(fromLocal: string, toLocal: string, live: boolean): Promise<Agenda> {
  let googleError: string | null = null, disconnected = false;
  const [team, clients] = await Promise.all([
    live ? meetingsBetween(romeToUtc(fromLocal), romeToUtc(toLocal)).catch((e) => {
      googleError = e instanceof GoogleError ? e.message : "Google Calendar non risponde.";
      disconnected = e instanceof GoogleError && e.kind === "disconnected";
      return [] as Meeting[];
    }) : Promise.resolve([] as Meeting[]),
    clientMeetingsBetween(fromLocal, toLocal).catch(() => [] as ClientMeeting[]),
  ]);
  const items = [...team.map(fromTeam), ...clients.map(fromClient)].sort((a, b) => a.start.localeCompare(b.start));
  return { items, googleError, disconnected };
}

/** Recent past meetings (last 60 days), most recent first. */
export async function pastAgenda(live: boolean): Promise<AgendaItem[]> {
  const now = nowLocal();
  const from = new Date(Date.now() - 60 * 86_400_000);
  const [team, clients] = await Promise.all([
    live ? meetingsBetween(from, new Date()).catch(() => [] as Meeting[]) : Promise.resolve([] as Meeting[]),
    pastClientMeetings(now, 30).catch(() => [] as ClientMeeting[]),
  ]);
  return [...team.map(fromTeam), ...clients.map(fromClient)].filter((x) => x.start < now).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 40);
}

export { fromClient, fromTeam };
