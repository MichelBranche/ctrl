import { db } from "@/lib/db";
import { ensureAuditSchema, ensureCrmSchema } from "@/lib/migrate";

/**
 * One row per Rome day for the Oggi sparklines. Today's row is rewritten on each visit (idempotent).
 * Past days are filled only where a count is derivable:
 * contacts still in the book, by created_at; open deals, by opened_at and closed_at.
 * Assignment, due work and overdue work are not reconstructed: those columns stay null.
 * Rollback: DROP TABLE crm_kpi_daily. The page then shows the live numbers without a line.
 */

export type KpiCounts = {
  contactsTotal: number;
  assigned: number;
  opportunitiesActive: number;
  todoDue: number;
  overdue: number;
  /** Contacts with at least one real send. */
  contactsContacted: number;
  /** Value of those contacts, in cents: open deal when it has an amount, otherwise the estimate. Never both. */
  potentialValueCents: number;
};

export type KpiField = "contacts_total" | "assigned" | "opportunities_active" | "todo_due";
export type SparkPoint = { i: number; v: number };

const SPAN = 30;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar day in Europe/Rome. */
export function romeDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Shift a YYYY-MM-DD by n days. Noon UTC stays on the same Rome date in both CET and CEST. */
export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function romeDayOf(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return romeDay(new Date(t));
}

/** Earliest known send day (Rome) for contacts still in the book. `last_sent_at` is only the latest send. */
async function contactedDays(): Promise<Map<string, string>> {
  await ensureCrmSchema();
  await ensureAuditSchema();
  const [alive, outreach, drafts, audits] = await Promise.all([
    db().execute("SELECT id FROM crm_contacts WHERE archived = 0"),
    db().execute("SELECT contact_id AS id, last_sent_at AS at FROM crm_outreach WHERE last_sent_at IS NOT NULL"),
    db().execute("SELECT contact_id AS id, sent_at AS at FROM crm_drafts WHERE status = 'inviata' AND sent_at IS NOT NULL"),
    db().execute("SELECT json_extract(details, '$.contact') AS id, created_at AS at FROM audit_log WHERE action = 'crm.draft_sent'"),
  ]);
  const ids = new Set(alive.rows.map((r) => String(r.id)));
  const earliest = new Map<string, string>();
  for (const row of [...outreach.rows, ...drafts.rows, ...audits.rows]) {
    const id = row.id ? String(row.id) : "";
    if (!ids.has(id) || !row.at) continue;
    const day = romeDayOf(String(row.at));
    if (!day) continue;
    const prev = earliest.get(id);
    if (!prev || day < prev) earliest.set(id, day);
  }
  return earliest;
}

/** Open deal euros when the amount is set (0 counts). Otherwise the estimate, in cents. Never both. */
function shownCents(deal: unknown, estimate: unknown): number | null {
  if (deal !== null && deal !== undefined && deal !== "") return Math.round(Number(deal) * 100);
  if (estimate !== null && estimate !== undefined && estimate !== "") return Number(estimate);
  return null;
}

/** Live figures, same definitions the snapshot stores. `today` is a Rome day. */
export async function liveKpiCounts(today: string): Promise<KpiCounts> {
  await ensureCrmSchema();
  const tomorrow = shiftDay(today, 1);
  const [contacts, deals, follow, acts, money, sent] = await Promise.all([
    db().execute("SELECT COUNT(*) AS total, SUM(CASE WHEN owner_user_id IS NOT NULL THEN 1 ELSE 0 END) AS assigned FROM crm_contacts WHERE archived = 0"),
    db().execute("SELECT COUNT(*) AS n FROM crm_opportunities o JOIN crm_contacts c ON c.id = o.contact_id WHERE c.archived = 0 AND o.closed_at IS NULL"),
    db().execute({
      sql: `SELECT
        SUM(CASE WHEN substr(next_action_at, 1, 10) <= ? THEN 1 ELSE 0 END) AS due,
        SUM(CASE WHEN substr(next_action_at, 1, 10) < ? THEN 1 ELSE 0 END) AS late
        FROM crm_contacts WHERE archived = 0 AND stage NOT IN ('vinto','perso') AND next_action_at IS NOT NULL`,
      args: [tomorrow, today],
    }),
    db().execute({
      sql: `SELECT
        SUM(CASE WHEN due_date <= ? THEN 1 ELSE 0 END) AS due,
        SUM(CASE WHEN due_date < ? THEN 1 ELSE 0 END) AS late
        FROM crm_activities WHERE done_at IS NULL`,
      args: [tomorrow, today],
    }),
    db().execute(`SELECT c.id AS id, c.estimated_value_cents AS estimate,
      (SELECT MAX(o.value_eur) FROM crm_opportunities o WHERE o.contact_id = c.id AND o.closed_at IS NULL) AS deal
      FROM crm_contacts c WHERE c.archived = 0`),
    contactedDays(),
  ]);
  const c = contacts.rows[0] ?? {};
  const f = follow.rows[0] ?? {};
  const a = acts.rows[0] ?? {};
  let potential = 0;
  for (const row of money.rows) {
    if (!sent.has(String(row.id))) continue;
    const cents = shownCents(row.deal, row.estimate);
    if (cents !== null) potential += cents;
  }
  return {
    contactsTotal: Number(c.total ?? 0),
    assigned: Number(c.assigned ?? 0),
    opportunitiesActive: Number(deals.rows[0]?.n ?? 0),
    todoDue: Number(f.due ?? 0) + Number(a.due ?? 0),
    overdue: Number(f.late ?? 0) + Number(a.late ?? 0),
    contactsContacted: sent.size,
    potentialValueCents: potential,
  };
}

type ContactStamp = { day: string };
type DealStamp = { opened: string; closed: string | null };

async function stamps(): Promise<{ contacts: ContactStamp[]; deals: DealStamp[] }> {
  const [contacts, deals] = await Promise.all([
    db().execute("SELECT created_at FROM crm_contacts WHERE archived = 0"),
    db().execute(`SELECT o.opened_at, o.closed_at FROM crm_opportunities o JOIN crm_contacts c ON c.id = o.contact_id WHERE c.archived = 0`),
  ]);
  return {
    contacts: contacts.rows.flatMap((r) => {
      const day = romeDayOf(String(r.created_at ?? ""));
      return day ? [{ day }] : [];
    }),
    deals: deals.rows.flatMap((r) => {
      const opened = romeDayOf(String(r.opened_at ?? ""));
      if (!opened) return [];
      const closed = r.closed_at ? romeDayOf(String(r.closed_at)) : null;
      return [{ opened, closed }];
    }),
  };
}

/**
 * Inserts past days that have no row yet. Contacts: still in the book and created on or before that Rome day.
 * Deals: opened on or before that day and not closed by the end of it. Other columns stay null.
 * Existing rows are left alone, except a past day that has no contacted count yet: that count is filled from real sends.
 * The potential stays null on those days, because an estimate is not a historical fact.
 */
export async function backfillKpiDays(today = romeDay(), span = SPAN): Promise<number> {
  await ensureCrmSchema();
  if (!DAY.test(today)) return 0;
  const days = Array.from({ length: span - 1 }, (_, n) => shiftDay(today, n - (span - 1)));
  const have = await db().execute({
    sql: `SELECT day FROM crm_kpi_daily WHERE day >= ? AND day < ?`,
    args: [days[0], today],
  });
  const present = new Set(have.rows.map((r) => String(r.day)));
  const missing = days.filter((d) => !present.has(d));
  const holes = await db().execute({ sql: "SELECT day FROM crm_kpi_daily WHERE day < ? AND contacts_contacted IS NULL", args: [today] });
  const fill = holes.rows.map((r) => String(r.day));
  if (!missing.length && !fill.length) return 0;
  const [{ contacts, deals }, sent] = await Promise.all([stamps(), contactedDays()]);
  const sentDays = [...sent.values()];
  const now = new Date().toISOString();
  if (missing.length) {
    await db().batch(missing.map((day) => ({
      sql: `INSERT INTO crm_kpi_daily (day, contacts_total, assigned, opportunities_active, todo_due, overdue, contacts_contacted, created_at)
        VALUES (?, ?, NULL, ?, NULL, NULL, ?, ?) ON CONFLICT(day) DO NOTHING`,
      args: [
        day,
        contacts.filter((c) => c.day <= day).length,
        deals.filter((d) => d.opened <= day && (d.closed === null || d.closed > day)).length,
        sentDays.filter((d) => d <= day).length,
        now,
      ],
    })), "write");
  }
  if (fill.length) {
    await db().batch(fill.map((day) => ({
      sql: "UPDATE crm_kpi_daily SET contacts_contacted = ? WHERE day = ? AND contacts_contacted IS NULL",
      args: [sentDays.filter((d) => d <= day).length, day],
    })), "write");
  }
  return missing.length;
}

/** Rewrites the Rome day of `now` with the live counts. A second call the same day updates that row. */
export async function recordOggiKpis(now = new Date()): Promise<KpiCounts> {
  const today = romeDay(now);
  await backfillKpiDays(today);
  const counts = await liveKpiCounts(today);
  await db().execute({
    sql: `INSERT INTO crm_kpi_daily (day, contacts_total, assigned, opportunities_active, todo_due, overdue, contacts_contacted, potential_value_cents, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(day) DO UPDATE SET
        contacts_total = excluded.contacts_total,
        assigned = excluded.assigned,
        opportunities_active = excluded.opportunities_active,
        todo_due = excluded.todo_due,
        overdue = excluded.overdue,
        contacts_contacted = excluded.contacts_contacted,
        potential_value_cents = excluded.potential_value_cents`,
    args: [today, counts.contactsTotal, counts.assigned, counts.opportunitiesActive, counts.todoDue, counts.overdue, counts.contactsContacted, counts.potentialValueCents, now.toISOString()],
  });
  return counts;
}

/** Percent only when both numbers exist and the older one is not zero. Otherwise null: nothing is invented. */
export function kpiChange(now: number | null, then: number | null): number | null {
  if (now === null || then === null || then === 0) return null;
  return Math.round(((now - then) / Math.abs(then)) * 100);
}

/** Today against the same field seven days earlier. Null when either cell is missing. */
export async function kpiWeekChange(field: "contacts_contacted" | "potential_value_cents", day = romeDay()): Promise<number | null> {
  await ensureCrmSchema();
  const then = shiftDay(day, -7);
  const res = await db().execute({
    sql: `SELECT day, ${field} AS value FROM crm_kpi_daily WHERE day IN (?, ?)`,
    args: [day, then],
  });
  const cell = (wanted: string) => {
    const row = res.rows.find((r) => String(r.day) === wanted);
    if (!row || row.value === null || row.value === undefined) return null;
    return Number(row.value);
  };
  return kpiChange(cell(day), cell(then));
}

const COLUMN: Record<KpiField, string> = {
  contacts_total: "contacts_total",
  assigned: "assigned",
  opportunities_active: "opportunities_active",
  todo_due: "todo_due",
};

/** Real points in the last `span` Rome days, placed on a 0..span-1 axis. Nulls are omitted, not filled in. */
export async function kpiSeries(field: KpiField, today = romeDay(), span = SPAN): Promise<SparkPoint[]> {
  await ensureCrmSchema();
  const start = shiftDay(today, -(span - 1));
  const col = COLUMN[field];
  const res = await db().execute({
    sql: `SELECT day, ${col} AS v FROM crm_kpi_daily WHERE day >= ? AND day <= ? AND ${col} IS NOT NULL ORDER BY day`,
    args: [start, today],
  });
  const index = new Map(Array.from({ length: span }, (_, i) => [shiftDay(start, i), i]));
  return res.rows.flatMap((r) => {
    const i = index.get(String(r.day));
    return i === undefined ? [] : [{ i, v: Number(r.v) }];
  });
}
