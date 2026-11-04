import "server-only";
import { db } from "@/lib/db";
import { addMinutes, MEET_TZ } from "@/lib/google-meet";
import { ensureClientMeetSchema } from "@/lib/migrate";

/*
 * Client Meet invites: the Calendar event (when Google is connected) carries the Meet link and lists the client as
 * attendee without Google's own email (sendUpdates=none); the client gets our branded Italian email via Resend instead,
 * with a .ics file and an "Aggiungi a Google Calendar" link. Without Google, a Meet link pasted by hand is used.
 */

export type ClientMeeting = {
  id: string; contactId: string | null; clientName: string; clientEmail: string; title: string; agenda: string | null;
  start: string; minutes: number; meetUrl: string; eventId: string | null; createdBy: string | null;
};
export const MEET_URL_RE = /^https:\/\/meet\.google\.com\/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}(\?[\w=&-]*)?$/;

/** Rome wall time "YYYY-MM-DDTHH:MM" to a UTC Date (DST aware, no libraries). */
export function romeToUtc(local: string): Date {
  const guess = new Date(`${local}:00Z`);
  const offset = (d: Date) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: MEET_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - d.getTime();
  };
  const first = new Date(guess.getTime() - offset(guess));
  return new Date(guess.getTime() - offset(first));
}
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function longWhen(local: string, minutes: number) {
  const d = romeToUtc(local);
  const day = d.toLocaleDateString("it-IT", { timeZone: MEET_TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const from = d.toLocaleTimeString("it-IT", { timeZone: MEET_TZ, hour: "2-digit", minute: "2-digit" });
  const to = romeToUtc(addMinutes(local, minutes)).toLocaleTimeString("it-IT", { timeZone: MEET_TZ, hour: "2-digit", minute: "2-digit" });
  return { day, from, to };
}

export function googleCalendarLink(m: { title: string; start: string; minutes: number; meetUrl: string; agenda?: string | null }) {
  const q = new URLSearchParams({
    action: "TEMPLATE", text: m.title, dates: `${stamp(romeToUtc(m.start))}/${stamp(romeToUtc(addMinutes(m.start, m.minutes)))}`,
    details: `${m.agenda ? `${m.agenda}\n\n` : ""}Google Meet: ${m.meetUrl}`, location: m.meetUrl, ctz: MEET_TZ,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
const fold = (line: string) => line.length <= 74 ? line : line.match(/.{1,73}/g)!.join("\r\n ");

/** RFC 5545 invite. METHOD:PUBLISH so it imports cleanly everywhere; status CANCELLED for the cancellation email. */
export function icsFile(m: ClientMeeting, organizer: string, cancelled = false) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ctrl Agency//Riunioni//IT", "CALSCALE:GREGORIAN", `METHOD:${cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT", `UID:${m.id}@ctrlagency.dev`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(romeToUtc(m.start))}`, `DTEND:${stamp(romeToUtc(addMinutes(m.start, m.minutes)))}`,
    `SUMMARY:${icsText(m.title)}`, `DESCRIPTION:${icsText(`${m.agenda ? `${m.agenda}\n\n` : ""}Google Meet: ${m.meetUrl}`)}`,
    `LOCATION:${icsText(m.meetUrl)}`, `URL:${m.meetUrl}`, `ORGANIZER;CN=Ctrl Agency:mailto:${organizer}`,
    `ATTENDEE;CN=${icsText(m.clientName)};ROLE=REQ-PARTICIPANT:mailto:${m.clientEmail}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`, `SEQUENCE:${cancelled ? 1 : 0}`, "END:VEVENT", "END:VCALENDAR",
  ];
  return { filename: cancelled ? "annullamento.ics" : "invito.ics", contentType: `text/calendar; charset=utf-8; method=${cancelled ? "CANCEL" : "PUBLISH"}`, content: Buffer.from(lines.map(fold).join("\r\n") + "\r\n", "utf8") };
}

export function inviteEmail(m: ClientMeeting) {
  const w = longWhen(m.start, m.minutes);
  const text = `Gentile ${m.clientName},

La ringraziamo per la disponibilità. Con piacere Le confermiamo la videochiamata con Ctrl Agency.

**Argomento:** ${m.title}
**Data:** ${w.day}
**Orario:** dalle ${w.from} alle ${w.to} (ora italiana)
**Collegamento:** ${m.meetUrl}
${m.agenda ? `\n**Ordine del giorno**\n${m.agenda}\n` : ""}
Per partecipare è sufficiente aprire il collegamento all'orario indicato, dal computer o dallo smartphone: non serve installare nulla. In allegato trova l'invito da aggiungere al Suo calendario, oppure può usare questo link: [Aggiungi a Google Calendar](${googleCalendarLink(m)})

Se l'orario non dovesse più andarLe bene, Le basta rispondere a questa email e troveremo insieme un'alternativa.

Cordiali saluti,`;
  return { subject: `Invito: ${m.title}, ${w.day} alle ${w.from}`, text, cta: { label: "Partecipa su Google Meet", href: m.meetUrl } };
}

export function cancelEmail(m: ClientMeeting) {
  const w = longWhen(m.start, m.minutes);
  return {
    subject: `Annullata: ${m.title}, ${w.day} alle ${w.from}`,
    text: `Gentile ${m.clientName},\n\nLe comunichiamo che la videochiamata "${m.title}" prevista per ${w.day} alle ${w.from} è stata annullata. Ci scusiamo per il disagio.\n\nLa ricontatteremo a breve per concordare una nuova data. Se preferisce, può rispondere direttamente a questa email.\n\nCordiali saluti,`,
  };
}

const toRow = (r: Record<string, unknown>): ClientMeeting => ({
  id: String(r.id), contactId: r.contact_id ? String(r.contact_id) : null, clientName: String(r.client_name), clientEmail: String(r.client_email),
  title: String(r.title), agenda: r.agenda ? String(r.agenda) : null, start: String(r.start_local), minutes: Number(r.minutes),
  meetUrl: String(r.meet_url), eventId: r.event_id ? String(r.event_id) : null, createdBy: r.created_by ? String(r.created_by) : null,
});

export async function saveClientMeeting(m: ClientMeeting) {
  await ensureClientMeetSchema();
  await db().execute({
    sql: "INSERT INTO client_meetings (id, contact_id, client_name, client_email, title, agenda, start_local, minutes, meet_url, event_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    args: [m.id, m.contactId, m.clientName, m.clientEmail, m.title, m.agenda, m.start, m.minutes, m.meetUrl, m.eventId, m.createdBy],
  });
}
export async function getClientMeeting(id: string) {
  await ensureClientMeetSchema();
  const r = (await db().execute({ sql: "SELECT * FROM client_meetings WHERE id = ? AND cancelled_at IS NULL", args: [id] })).rows[0];
  return r ? toRow(r as Record<string, unknown>) : null;
}
export async function markCancelled(id: string) {
  await db().execute({ sql: "UPDATE client_meetings SET cancelled_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [id] });
}
/** Upcoming (from one hour ago, Rome time), soonest first. */
export async function upcomingClientMeetings(fromLocal: string): Promise<ClientMeeting[]> {
  await ensureClientMeetSchema();
  const r = await db().execute({ sql: "SELECT * FROM client_meetings WHERE cancelled_at IS NULL AND start_local >= ? ORDER BY start_local LIMIT 50", args: [fromLocal] });
  return r.rows.map((x) => toRow(x as Record<string, unknown>));
}
