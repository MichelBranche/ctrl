import "server-only";
import { ensureTeam, type AdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { readSettings } from "@/lib/settings";
import { isArea, isRole, type Area, type Role } from "@/lib/team-types";

/* Team accounts and earnings reads. Every function takes the signed-in user and scopes what it returns:
   job-level rows only ever belong to the viewer, unless the viewer is a founder. */

export const LEADERBOARD_KEY = "team_leaderboard_visible";

export async function leaderboardVisible(): Promise<boolean> {
  return (await readSettings([LEADERBOARD_KEY]).catch(() => ({}) as Record<string, string>))[LEADERBOARD_KEY] === "1";
}

export type TeamUser = { id: string; email: string; name: string; role: Role; area: Area | null; active: boolean; emailAccess: boolean; createdAt: string; lastLoginAt: string | null; totalCents: number; jobs: number };

/** Founder-only: every account (never the password hash) with its lifetime totals. */
export async function listUsers(): Promise<TeamUser[]> {
  await ensureTeam();
  const res = await db().execute(`
    SELECT u.id, u.email, u.name, u.role, u.area, u.active, u.email_access, u.created_at, u.last_login_at,
           COALESCE(SUM(j.amount_cents), 0) AS total, COUNT(j.id) AS jobs
    FROM admin_users u LEFT JOIN team_jobs j ON j.user_id = u.id
    GROUP BY u.id ORDER BY (u.role = 'founder') DESC, u.created_at`);
  return res.rows.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    role: isRole(r.role) ? r.role : "member",
    area: isArea(r.area) ? r.area : null,
    active: Number(r.active) === 1,
    emailAccess: r.role === "founder" || Number(r.email_access) === 1,
    createdAt: String(r.created_at),
    lastLoginAt: r.last_login_at ? String(r.last_login_at) : null,
    totalCents: Number(r.total),
    jobs: Number(r.jobs),
  }));
}

export const EARN_RANGES = ["30", "90", "365", "all"] as const;
export type EarnRange = (typeof EARN_RANGES)[number];
export const EARN_RANGE_LABEL: Record<EarnRange, string> = { "30": "30g", "90": "90g", "365": "12 mesi", all: "Sempre" };
export const parseEarnRange = (v: unknown): EarnRange => (EARN_RANGES.includes(v as EarnRange) ? (v as EarnRange) : "365");

export type Job = { id: string; userId: string; userName: string; client: string; description: string; amountCents: number; date: string; area: Area | null };
export type LeaderRow = { userId: string; name: string; area: Area | null; totalCents: number; jobs: number };
export type MonthPoint = { month: string; cents: number };

export type Earnings = {
  scope: { userId: string | null; label: string };
  totalCents: number;
  prevCents: number | null;
  jobs: number;
  list: Job[];
  series: MonthPoint[];
  leaderboard: LeaderRow[] | null;
  people: { id: string; name: string }[];
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function rangeBounds(range: EarnRange, now: Date) {
  if (range === "all") return { from: "0000-01-01", prevFrom: null as string | null };
  const days = Number(range);
  const from = new Date(now.getTime() - (days - 1) * 86_400_000);
  const prev = new Date(from.getTime() - days * 86_400_000);
  return { from: isoDay(from), prevFrom: isoDay(prev) };
}

/** Earnings for the Introiti page. Members: only their own jobs (+ totals-only leaderboard when the founder allows it). */
export async function getEarnings(me: AdminUser, range: EarnRange, filterUser: string | null, now = new Date()): Promise<Earnings> {
  await ensureTeam();
  const founder = me.role === "founder";
  const userId = founder ? filterUser : me.id;
  const { from, prevFrom } = rangeBounds(range, now);
  const to = isoDay(now);
  const who = userId ? " AND j.user_id = ?" : "";
  const whoArgs = userId ? [userId] : [];
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  const showBoard = founder || (await leaderboardVisible());

  const [sumRes, prevRes, listRes, seriesRes, boardRes, peopleRes] = await db().batch(
    [
      { sql: `SELECT COALESCE(SUM(amount_cents),0) AS c, COUNT(*) AS n FROM team_jobs j WHERE date BETWEEN ? AND ?${who}`, args: [from, to, ...whoArgs] },
      { sql: `SELECT COALESCE(SUM(amount_cents),0) AS c FROM team_jobs j WHERE date >= ? AND date < ?${who}`, args: [prevFrom ?? from, from, ...whoArgs] },
      { sql: `SELECT j.id, j.user_id, u.name, j.client, j.description, j.amount_cents, j.date, j.area
              FROM team_jobs j JOIN admin_users u ON u.id = j.user_id
              WHERE j.date BETWEEN ? AND ?${who} ORDER BY j.date DESC, j.created_at DESC LIMIT 200`, args: [from, to, ...whoArgs] },
      { sql: `SELECT substr(date,1,7) AS m, SUM(amount_cents) AS c FROM team_jobs j WHERE date >= ?${who} GROUP BY m`, args: [`${months[0]}-01`, ...whoArgs] },
      // Totals only: never job rows. Shown to members only when the founder enabled it.
      { sql: showBoard
          ? `SELECT u.id, u.name, u.area, COALESCE(SUM(j.amount_cents),0) AS c, COUNT(j.id) AS n
             FROM admin_users u LEFT JOIN team_jobs j ON j.user_id = u.id AND j.date BETWEEN ? AND ?
             WHERE u.active = 1 OR j.id IS NOT NULL GROUP BY u.id ORDER BY c DESC, u.name`
          : "SELECT 1 WHERE 0", args: showBoard ? [from, to] : [] },
      { sql: founder ? "SELECT id, name FROM admin_users ORDER BY name" : "SELECT 1 WHERE 0", args: [] },
    ],
    "read",
  );
  const byMonth = new Map(seriesRes.rows.map((r) => [String(r.m), Number(r.c)]));
  const people = peopleRes.rows.map((r) => ({ id: String(r.id), name: String(r.name) }));
  return {
    scope: { userId, label: userId ? (userId === me.id ? "Tu" : (people.find((p) => p.id === userId)?.name ?? "Utente")) : "Tutto il team" },
    totalCents: Number(sumRes.rows[0]?.c ?? 0),
    jobs: Number(sumRes.rows[0]?.n ?? 0),
    prevCents: prevFrom ? Number(prevRes.rows[0]?.c ?? 0) : null,
    list: listRes.rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      userName: String(r.name),
      client: String(r.client),
      description: String(r.description),
      amountCents: Number(r.amount_cents),
      date: String(r.date),
      area: isArea(r.area) ? r.area : null,
    })),
    series: months.map((m) => ({ month: m, cents: byMonth.get(m) ?? 0 })),
    leaderboard: showBoard
      ? boardRes.rows.map((r) => ({ userId: String(r.id), name: String(r.name), area: isArea(r.area) ? r.area : null, totalCents: Number(r.c), jobs: Number(r.n) }))
      : null,
    people,
  };
}
