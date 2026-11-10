import "server-only";
import { normEmail } from "@/lib/crm-core";
import { db } from "@/lib/db";
import { parseRecipients } from "@/lib/mail/recipients";
import { ensureCrmSchema, ensureEmailSchema } from "@/lib/migrate";

/*
 * Founder workload reads. One grouped query per metric for the whole team (no per-person round trip).
 * Emails count on the sender (email_send_log.user_id). Contacts and deals count on the owner
 * (owner_user_id). Those two people can differ.
 * "Valore vinto" is crm_opportunities.value_eur. "Introiti" is team_jobs.amount_cents.
 * They are never added together. The daily series is computed from these rows, not from a stored KPI snapshot.
 */

export const TEAM_PERIODS = [7, 30, 90] as const;
export type TeamPeriodDays = (typeof TEAM_PERIODS)[number];

export type PeriodWindow = {
  days: TeamPeriodDays;
  /** Inclusive UTC dates, same window getEarnings uses for team_jobs.date. */
  fromDay: string;
  toDay: string;
  /** Inclusive start and exclusive end for ISO timestamps (created_at, done_at, closed_at). */
  fromIso: string;
  toIso: string;
  dayList: string[];
};

export type MemberKpi = {
  emailsSent: number;
  emailsUnconfirmed: number;
  contacts: number;
  activitiesDone: number;
  activitiesOverdue: number;
  wonEur: number;
  incomeCents: number;
};

export const ZERO_KPI: MemberKpi = {
  emailsSent: 0, emailsUnconfirmed: 0, contacts: 0, activitiesDone: 0, activitiesOverdue: 0, wonEur: 0, incomeCents: 0,
};

export type TeamEmail = { id: string; recipients: string; subject: string; ok: boolean; createdAt: string };
export type EmailContact = { id: string; name: string };
export type TeamDayPoint = { day: string; emails: number; activities: number; won: number; incomeCents: number };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function parseTeamPeriod(v: unknown): TeamPeriodDays {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  return n === 7 || n === 30 || n === 90 ? n : 30;
}

/** How many email rows to show. The "mostra altre" link steps this by 20, up to 200. */
export function parseEmailLimit(v: unknown): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 20) return 20;
  return Math.min(n, 200);
}

/** Query string for the team list and a person page. 30 days is the default and stays out of the URL. */
export function teamQuery(days: TeamPeriodDays, extra?: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  if (days !== 30) q.set("giorni", String(days));
  if (extra) for (const [key, value] of Object.entries(extra)) if (value !== undefined && value !== "") q.set(key, String(value));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Europe/Rome calendar date, used only to decide which open activities are overdue. */
export function romeToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function periodWindow(days: TeamPeriodDays, now = new Date()): PeriodWindow {
  const toDay = isoDay(now);
  const fromDay = isoDay(new Date(now.getTime() - (days - 1) * 86_400_000));
  const fromIso = `${fromDay}T00:00:00.000Z`;
  const end = new Date(`${toDay}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const toIso = end.toISOString();
  const dayList: string[] = [];
  for (let t = new Date(fromIso); t < end; t = new Date(t.getTime() + 86_400_000)) dayList.push(isoDay(t));
  return { days, fromDay, toDay, fromIso, toIso, dayList };
}

async function ready() {
  await Promise.all([ensureCrmSchema(), ensureEmailSchema()]);
}

const num = (v: unknown) => Number(v ?? 0);

function fillCounts(rows: readonly Record<string, unknown>[], column: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    const id = row.user_id;
    if (!id) continue;
    out.set(String(id), num(row[column]));
  }
  return out;
}

/** KPIs for every user that has a row. Missing users are zeros: look them up with ZERO_KPI. */
export async function teamMemberKpisFor(days: TeamPeriodDays, now = new Date()): Promise<Map<string, MemberKpi>> {
  await ready();
  return kpisIn(periodWindow(days, now), romeToday(now));
}

async function kpisIn(window: PeriodWindow, today: string): Promise<Map<string, MemberKpi>> {
  const [emails, contacts, done, overdue, won, income] = await db().batch([
    {
      sql: `SELECT user_id,
              SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS sent,
              SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS unconfirmed
            FROM email_send_log
            WHERE created_at >= ? AND created_at < ?
            GROUP BY user_id`,
      args: [window.fromIso, window.toIso],
    },
    {
      sql: `SELECT owner_user_id AS user_id, COUNT(*) AS n
            FROM crm_contacts
            WHERE archived = 0 AND owner_user_id IS NOT NULL
            GROUP BY owner_user_id`,
      args: [],
    },
    {
      sql: `SELECT assignee_user_id AS user_id, COUNT(*) AS n
            FROM crm_activities
            WHERE assignee_user_id IS NOT NULL AND done_at >= ? AND done_at < ?
            GROUP BY assignee_user_id`,
      args: [window.fromIso, window.toIso],
    },
    {
      sql: `SELECT assignee_user_id AS user_id, COUNT(*) AS n
            FROM crm_activities
            WHERE assignee_user_id IS NOT NULL AND done_at IS NULL AND due_date < ?
            GROUP BY assignee_user_id`,
      args: [today],
    },
    {
      sql: `SELECT owner_user_id AS user_id, COALESCE(SUM(value_eur), 0) AS v
            FROM crm_opportunities
            WHERE owner_user_id IS NOT NULL AND stage = 'vinto' AND closed_at >= ? AND closed_at < ?
            GROUP BY owner_user_id`,
      args: [window.fromIso, window.toIso],
    },
    {
      sql: `SELECT user_id, COALESCE(SUM(amount_cents), 0) AS c
            FROM team_jobs
            WHERE date >= ? AND date <= ?
            GROUP BY user_id`,
      args: [window.fromDay, window.toDay],
    },
  ], "read");

  const sent = new Map<string, { sent: number; unconfirmed: number }>();
  for (const row of emails.rows) {
    if (!row.user_id) continue;
    sent.set(String(row.user_id), { sent: num(row.sent), unconfirmed: num(row.unconfirmed) });
  }
  const contactN = fillCounts(contacts.rows as Record<string, unknown>[], "n");
  const doneN = fillCounts(done.rows as Record<string, unknown>[], "n");
  const lateN = fillCounts(overdue.rows as Record<string, unknown>[], "n");
  const wonN = fillCounts(won.rows as Record<string, unknown>[], "v");
  const incomeN = fillCounts(income.rows as Record<string, unknown>[], "c");
  const ids = new Set<string>([...sent.keys(), ...contactN.keys(), ...doneN.keys(), ...lateN.keys(), ...wonN.keys(), ...incomeN.keys()]);
  const out = new Map<string, MemberKpi>();
  for (const id of ids) {
    const mail = sent.get(id);
    out.set(id, {
      emailsSent: mail?.sent ?? 0,
      emailsUnconfirmed: mail?.unconfirmed ?? 0,
      contacts: contactN.get(id) ?? 0,
      activitiesDone: doneN.get(id) ?? 0,
      activitiesOverdue: lateN.get(id) ?? 0,
      wonEur: wonN.get(id) ?? 0,
      incomeCents: incomeN.get(id) ?? 0,
    });
  }
  return out;
}

export async function listMemberEmails(userId: string, window: PeriodWindow, limit: number): Promise<{ rows: TeamEmail[]; more: boolean; contacts: Map<string, EmailContact> }> {
  await ready();
  const cap = Math.min(Math.max(limit, 1), 200);
  const res = await db().execute({
    sql: `SELECT id, recipients, subject, ok, created_at FROM email_send_log
          WHERE user_id = ? AND created_at >= ? AND created_at < ?
          ORDER BY created_at DESC LIMIT ?`,
    args: [userId, window.fromIso, window.toIso, cap + 1],
  });
  const more = res.rows.length > cap;
  const rows: TeamEmail[] = res.rows.slice(0, cap).map((r) => ({
    id: String(r.id),
    recipients: String(r.recipients),
    subject: String(r.subject),
    ok: Number(r.ok) === 1,
    createdAt: String(r.created_at),
  }));
  return { rows, more, contacts: await contactsForEmails(rows) };
}

/** Open contacts whose email matches a recipient. One query for the whole page. Archived rows are ignored. */
export async function contactsForEmails(rows: readonly { recipients: string }[]): Promise<Map<string, EmailContact>> {
  const addresses = [...new Set(rows.flatMap((row) => parseRecipients(row.recipients).map(normEmail)).filter((a) => a.includes("@") && a.length <= 254))];
  const out = new Map<string, EmailContact>();
  if (!addresses.length) return out;
  await ready();
  for (let i = 0; i < addresses.length; i += 80) {
    const chunk = addresses.slice(i, i + 80);
    const marks = chunk.map(() => "?").join(",");
    const res = await db().execute({
      sql: `SELECT id, business_name, email_norm, email FROM crm_contacts
            WHERE archived = 0 AND (email_norm IN (${marks}) OR (email_norm = '' AND lower(trim(email)) IN (${marks})))
            ORDER BY id`,
      args: [...chunk, ...chunk],
    });
    for (const row of res.rows) {
      const key = normEmail(String(row.email_norm || row.email || ""));
      if (!key || out.has(key)) continue;
      out.set(key, { id: String(row.id), name: String(row.business_name) });
    }
  }
  return out;
}

function dayCounts(rows: readonly Record<string, unknown>[], value: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) out.set(String(row.d), num(row[value]));
  return out;
}

/** Per-day counts over the window. Income is cents, the other series are counts. Scales stay separate. */
export async function memberTrend(userId: string, window: PeriodWindow): Promise<TeamDayPoint[]> {
  await ready();
  const [emails, activities, won, income] = await db().batch([
    {
      sql: `SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM email_send_log
            WHERE user_id = ? AND ok = 1 AND created_at >= ? AND created_at < ? GROUP BY d`,
      args: [userId, window.fromIso, window.toIso],
    },
    {
      sql: `SELECT substr(done_at, 1, 10) AS d, COUNT(*) AS n FROM crm_activities
            WHERE assignee_user_id = ? AND done_at >= ? AND done_at < ? GROUP BY d`,
      args: [userId, window.fromIso, window.toIso],
    },
    {
      sql: `SELECT substr(closed_at, 1, 10) AS d, COUNT(*) AS n FROM crm_opportunities
            WHERE owner_user_id = ? AND stage = 'vinto' AND closed_at >= ? AND closed_at < ? GROUP BY d`,
      args: [userId, window.fromIso, window.toIso],
    },
    {
      sql: `SELECT date AS d, COALESCE(SUM(amount_cents), 0) AS c FROM team_jobs
            WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY date`,
      args: [userId, window.fromDay, window.toDay],
    },
  ], "read");
  const emailN = dayCounts(emails.rows as Record<string, unknown>[], "n");
  const activityN = dayCounts(activities.rows as Record<string, unknown>[], "n");
  const wonN = dayCounts(won.rows as Record<string, unknown>[], "n");
  const incomeN = dayCounts(income.rows as Record<string, unknown>[], "c");
  return window.dayList.map((day) => ({
    day,
    emails: emailN.get(day) ?? 0,
    activities: activityN.get(day) ?? 0,
    won: wonN.get(day) ?? 0,
    incomeCents: incomeN.get(day) ?? 0,
  }));
}
