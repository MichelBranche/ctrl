"use server";

import { revalidatePath } from "next/cache";
import { CAN_SIGN_IN_SQL, guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { cancelMeeting, createMeeting, disconnect, getMeeting, GoogleError, nowLocal, parseEmails } from "@/lib/google-meet";
import { isFounder } from "@/lib/team-types";

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
