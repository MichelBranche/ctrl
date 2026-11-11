"use server";

import { revalidatePath } from "next/cache";
import { CAN_SIGN_IN_SQL, guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { cancelEmail, type ClientMeeting, getClientMeeting, icsFile, inviteEmail, longWhen, markCancelled, MEET_URL_RE, saveClientMeeting } from "@/lib/client-meet";
import { addNote, getContact, setStage } from "@/lib/crm";
import { CRM_SECTIONS } from "@/lib/crm-nav";
import { cancelMeeting, connection, createMeeting, disconnect, EMAIL_RE, getMeeting, googleConfigured, GoogleError, nowLocal, parseEmails } from "@/lib/google-meet";
import { mailProvider } from "@/lib/mail";
import { emailSender } from "@/lib/mail/sender";
import { sendTransactional } from "@/lib/mail/transactional";
import { canAccess, isFounder } from "@/lib/team-types";

/* Every action re-checks the session and the "meetings" permission server-side. */

export type MeetState = { ok?: string; error?: string; url?: string };
const ID = /^[\w-]{1,64}$/;
const fail = (e: unknown): MeetState => ({ error: e instanceof GoogleError ? e.message : "Google Calendar non risponde. Riprova tra poco." });

async function memberEmails(ids: string[]) {
  const clean = ids.filter((i) => ID.test(i)).slice(0, 50);
  if (!clean.length) return [];
  const r = await db().execute({ sql: `SELECT email FROM admin_users WHERE id IN (${clean.map(() => "?").join(",")}) AND ${CAN_SIGN_IN_SQL}`, args: clean });
  return r.rows.map((x) => String(x.email).toLowerCase());
}

export async function createMeetingAction(_: MeetState, form: FormData): Promise<MeetState> {
  const me = await guardSection("meetings");
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const date = String(form.get("date") ?? ""), time = String(form.get("time") ?? "");
  const minutes = Number(form.get("minutes"));
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000);
  if (title.length < 2) return { error: "Dai un titolo alla riunione." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Data o ora non valide." };
  const start = `${date}T${time}`;
  if (start < nowLocal(new Date(Date.now() - 10 * 60_000))) return { error: "La riunione è nel passato." };
  if (![15, 30, 45, 60, 90, 120].includes(minutes)) return { error: "Durata non valida." };
  const ext = parseEmails(String(form.get("external") ?? ""));
  if (ext.bad.length) return { error: `Email non valide: ${ext.bad.slice(0, 3).join(", ")}` };
  const attendees = [...new Set([me.email.toLowerCase(), ...(await memberEmails(form.getAll("members").map(String))), ...ext.ok])];
  if (attendees.length > 50) return { error: "Massimo 50 partecipanti." };
  try {
    const m = await createMeeting({ title, start, minutes, attendees, notes });
    await logAction("meet.created", { type: "meeting", id: m.id }, { title, start, minutes, attendees: attendees.length, external: ext.ok.length });
    revalidatePath("/admin/riunioni");
    return { ok: "Riunione creata: gli invitati ricevono l'invito da Google Calendar.", url: m.meetUrl ?? undefined };
  } catch (e) {
    return fail(e);
  }
}

/** "Chiama" in Team: instant 30-minute meeting starting now with that member. */
export async function quickCallAction(memberId: string): Promise<MeetState> {
  const me = await guardSection("meetings");
  const [email] = await memberEmails([memberId]);
  if (!email) return { error: "Persona non attiva nel team." };
  const name = (await db().execute({ sql: "SELECT name FROM admin_users WHERE id = ?", args: [memberId] })).rows[0]?.name;
  try {
    const m = await createMeeting({ title: `Chiamata: ${me.name} e ${String(name ?? email)}`, start: nowLocal(), minutes: 30, attendees: [...new Set([me.email.toLowerCase(), email])], notes: "Chiamata veloce avviata dal pannello Ctrl." });
    await logAction("meet.quick_call", { type: "user", id: memberId }, { meeting: m.id });
    revalidatePath("/admin/riunioni");
    return m.meetUrl ? { ok: "Chiamata pronta.", url: m.meetUrl } : { error: "Google non ha creato il link Meet. Riprova." };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelMeetingAction(id: string): Promise<MeetState> {
  await guardSection("meetings");
  const m = await getMeeting(id);
  if (!m) return { error: "Riunione non trovata." };
  try {
    await cancelMeeting(id);
    await logAction("meet.cancelled", { type: "meeting", id }, { title: m.title, start: m.start, attendees: m.attendees.length });
    revalidatePath("/admin/riunioni");
    return { ok: "Riunione annullata: Google avvisa gli invitati." };
  } catch (e) {
    return fail(e);
  }
}

export async function disconnectGoogleAction(): Promise<MeetState> {
  const me = await guardSection("meetings");
  if (!isFounder(me)) return { error: "Solo i founder possono scollegare Google." };
  await disconnect();
  await logAction("meet.google_disconnected");
  revalidatePath("/admin/riunioni");
  return { ok: "Account Google scollegato." };
}

/* Client invites (Riunioni > Clienti). */

const organizer = () => (process.env.MAIL_FROM?.match(/[^\s<>]+@[^\s<>]+/)?.[0] ?? "hello@ctrlagency.dev").toLowerCase();

export async function inviteClientAction(_: MeetState, form: FormData): Promise<MeetState> {
  const me = await guardSection("meetings");
  const name = String(form.get("client_name") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const email = String(form.get("client_email") ?? "").trim().toLowerCase();
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const agenda = String(form.get("agenda") ?? "").trim().slice(0, 2000) || null;
  const date = String(form.get("date") ?? ""), time = String(form.get("time") ?? "");
  const minutes = Number(form.get("minutes"));
  const contactRaw = String(form.get("contact_id") ?? "");
  const manualUrl = String(form.get("meet_url") ?? "").trim();
  if (name.length < 2) return { error: "Indica il nome del cliente." };
  if (!EMAIL_RE.test(email)) return { error: "Email del cliente non valida." };
  if (title.length < 2) return { error: "Dai un titolo alla riunione." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Data o ora non valide." };
  const start = `${date}T${time}`;
  if (start < nowLocal(new Date(Date.now() - 10 * 60_000))) return { error: "La riunione è nel passato." };
  if (![15, 30, 45, 60, 90, 120].includes(minutes)) return { error: "Durata non valida." };
  // CRM data stays behind the crm permission: without it the invite still works, but no contact is read or updated.
  const contact = canAccess(me, "crm") && ID.test(contactRaw) ? await getContact(contactRaw) : null;
  const provider = mailProvider();
  if (!provider && !process.env.RESEND_API_KEY) return { error: "Email dell'agenzia non collegata: impossibile inviare l'invito." };

  let meetUrl: string | null = null, eventId: string | null = null;
  const live = googleConfigured() && Boolean(await connection().catch(() => null));
  if (live) {
    try {
      // Client listed as attendee, but Google stays silent: the client receives only our branded email.
      const m = await createMeeting({ title, start, minutes, attendees: [me.email.toLowerCase(), email], notes: agenda ?? "", tag: "client", notify: false });
      meetUrl = m.meetUrl; eventId = m.id;
    } catch (e) {
      if (!MEET_URL_RE.test(manualUrl)) return fail(e);
    }
  }
  meetUrl ??= MEET_URL_RE.test(manualUrl) ? manualUrl : null;
  if (!meetUrl) return { error: live ? "Google non ha creato il link Meet. Riprova." : "Google Calendar non è collegato: incolla un link Meet (da meet.new) per inviare l'invito." };

  const cm: ClientMeeting = { id: crypto.randomUUID(), contactId: contact?.id ?? null, clientName: name, clientEmail: email, title, agenda, start, minutes, meetUrl, eventId, createdBy: me.id };
  try {
    const { via } = await sendTransactional({ to: [email], cc: [], ...inviteEmail(cm), sender: emailSender(me), attachments: [icsFile(cm, organizer())] }, provider);
    console.info(`[mail] invito cliente inviato via ${via}`);
  } catch {
    if (eventId) await cancelMeeting(eventId, false).catch(() => {});
    return { error: "Invio dell'email non riuscito, la riunione non è stata creata. Riprova tra poco." };
  }
  await saveClientMeeting(cm);
  if (contact) {
    const w = longWhen(start, minutes);
    await addNote(contact.id, me.id, `Invito Google Meet inviato a ${email}: "${title}", ${w.day} alle ${w.from} (${minutes} min). Link: ${meetUrl}`);
    await db().execute({ sql: "UPDATE crm_contacts SET next_action = ?, next_action_at = ?, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", args: [`Riunione Meet: ${title} alle ${w.from}`.slice(0, 300), date, contact.id] });
    if (contact.stage === "nuovo" || contact.stage === "contattato") await setStage(contact.id, "call");
    revalidatePath(`/admin/crm/${contact.id}`);
    for (const s of CRM_SECTIONS) revalidatePath(s.href);
  }
  await logAction("meet.client_invited", { type: "client_meeting", id: cm.id }, { to: email, contact: contact?.id ?? null, start, minutes, calendar: Boolean(eventId) });
  revalidatePath("/admin/riunioni");
  return { ok: `Invito inviato a ${email}${eventId ? " ed evento creato in Google Calendar" : ""}.`, url: meetUrl };
}

export async function cancelClientMeetingAction(id: string, notify: boolean): Promise<MeetState> {
  const me = await guardSection("meetings");
  if (!/^[\w-]{1,64}$/.test(id)) return { error: "Riunione non valida." };
  const cm = await getClientMeeting(id);
  if (!cm) return { error: "Riunione non trovata." };
  if (cm.eventId) await cancelMeeting(cm.eventId, false).catch(() => {});
  await markCancelled(id);
  let mailed = false;
  if (notify) {
    try { await sendTransactional({ to: [cm.clientEmail], cc: [], ...cancelEmail(cm), sender: emailSender(me), attachments: [icsFile(cm, organizer(), true)] }, mailProvider()); mailed = true; } catch { /* reported below */ }
  }
  if (cm.contactId) await addNote(cm.contactId, me.id, `Riunione Meet annullata: "${cm.title}"${mailed ? ", cliente avvisato via email" : ""}.`).catch(() => {});
  await logAction("meet.client_cancelled", { type: "client_meeting", id }, { to: cm.clientEmail, notified: mailed });
  revalidatePath("/admin/riunioni");
  return notify && !mailed ? { error: "Riunione annullata, ma l'email al cliente non è partita. Avvisalo dalla casella Email." } : { ok: mailed ? "Riunione annullata, cliente avvisato." : "Riunione annullata." };
}
