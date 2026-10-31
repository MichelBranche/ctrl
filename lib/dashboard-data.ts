import "server-only";
import { db } from "@/lib/db";
import { analytics, deployments, vercelConfigured, type Bucket, type Deployment } from "@/lib/vercel";

/** Real numbers only: every helper returns null when its source is unavailable, never a placeholder. */
export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];
export const parseRange = (v: unknown): Range => (v === "30" ? 30 : v === "90" ? 90 : 7);

export type Point = { date: string; pageviews: number; visitors: number };
export type Traffic = { current: Point[]; previous: Point[] };

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Daily pageviews and visitors for `days` days plus the period before it, for deltas. The API allows 62 days per query, so longer spans are chunked. */
export async function traffic(days: Range): Promise<Traffic | null> {
  if (!vercelConfigured()) return null;
  const total = days * 2;
  const end = Date.now();
  const chunks: Promise<Bucket[] | null>[] = [];
  for (let back = 0; back < total; back += 60) {
    const span = Math.min(60, total - back);
    chunks.push(analytics("day", span, 100, end - back * DAY));
  }
  const rows = (await Promise.all(chunks)).flatMap((c) => c ?? []);
  const byDate = new Map<string, Point>();
  for (const r of rows) byDate.set(r.key.slice(0, 10), { date: r.key.slice(0, 10), pageviews: r.pageviews, visitors: r.visitors });
  const series: Point[] = [];
  for (let i = total - 1; i >= 0; i--) {
    const d = iso(end - i * DAY);
    series.push(byDate.get(d) ?? { date: d, pageviews: 0, visitors: 0 });
  }
  return { previous: series.slice(0, days), current: series.slice(days) };
}

export type Breakdowns = { pages: Bucket[]; refs: Bucket[]; countries: Bucket[]; devices: Bucket[] };

export async function breakdowns(days: Range, limit = 8): Promise<Breakdowns | null> {
  if (!vercelConfigured()) return null;
  // Breakdown queries are not grouped by day, so the 62-day cap does not apply.
  const [pages, refs, countries, devices] = await Promise.all([
    analytics("requestPath", days, limit),
    analytics("referrerHostname", days, limit),
    analytics("country", days, limit),
    analytics("deviceType", days, 6),
  ]);
  const clean = (b: Bucket[] | null) => (b ?? []).filter((r) => r.key);
  return { pages: clean(pages), refs: clean(refs), countries: clean(countries), devices: clean(devices) };
}

export type DailyCounts = { requests: number[]; subscribers: number[]; prevRequests: number; prevSubscribers: number };

/** Turso: requests and newsletter sign-ups per day over the range, plus totals for the previous period. */
export async function dailyCounts(days: Range): Promise<DailyCounts | null> {
  const end = Date.now();
  const since = iso(end - (days - 1) * DAY);
  const prevSince = iso(end - (days * 2 - 1) * DAY);
  try {
    const [req, sub, prev] = await db().batch(
      [
        { sql: "SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM contact_requests WHERE created_at >= ? GROUP BY d", args: [since] },
        { sql: "SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM subscribers WHERE created_at >= ? GROUP BY d", args: [since] },
        {
          sql: `SELECT (SELECT COUNT(*) FROM contact_requests WHERE created_at >= ?1 AND created_at < ?2) AS r,
                       (SELECT COUNT(*) FROM subscribers WHERE created_at >= ?1 AND created_at < ?2) AS s`,
          args: [prevSince, since],
        },
      ],
      "read",
    );
    const fill = (rows: typeof req.rows) => {
      const m = new Map(rows.map((r) => [String(r.d), Number(r.n)]));
      return Array.from({ length: days }, (_, i) => m.get(iso(end - (days - 1 - i) * DAY)) ?? 0);
    };
    return { requests: fill(req.rows), subscribers: fill(sub.rows), prevRequests: Number(prev.rows[0]?.r ?? 0), prevSubscribers: Number(prev.rows[0]?.s ?? 0) };
  } catch {
    return null;
  }
}

export type Activity = { kind: "post" | "request" | "subscriber"; at: string; title: string; href: string; detail: string };

export async function recentActivity(limit = 8): Promise<Activity[] | null> {
  try {
    const [p, r, s] = await db().batch(
      [
        { sql: "SELECT id, title, published, created_at, updated_at FROM posts ORDER BY updated_at DESC LIMIT ?", args: [limit] },
        { sql: "SELECT id, name, subject, created_at FROM contact_requests ORDER BY created_at DESC LIMIT ?", args: [limit] },
        { sql: "SELECT email, created_at, unsubscribed_at FROM subscribers ORDER BY created_at DESC LIMIT ?", args: [limit] },
      ],
      "read",
    );
    const items: Activity[] = [
      ...p.rows.map((x) => ({
        kind: "post" as const,
        at: String(x.updated_at),
        title: String(x.title),
        href: `/admin/edit?id=${x.id}`,
        detail: x.created_at === x.updated_at ? (Number(x.published) ? "Articolo pubblicato" : "Bozza creata") : "Articolo modificato",
      })),
      ...r.rows.map((x) => ({ kind: "request" as const, at: String(x.created_at), title: String(x.name), href: `/admin/requests?open=${x.id}`, detail: `Nuova richiesta · ${x.subject}` })),
      ...s.rows.map((x) => ({ kind: "subscriber" as const, at: String(x.created_at), title: String(x.email), href: "/admin/newsletter", detail: x.unsubscribed_at ? "Iscritto, poi disiscritto" : "Nuovo iscritto newsletter" })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  } catch {
    return null;
  }
}

export async function latestDeploy(): Promise<Deployment | null> {
  try {
    const list = await deployments(10);
    return list?.find((d) => d.target === "production") ?? null;
  } catch {
    return null;
  }
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** Percent change, or null when the previous period is empty (a % of zero is meaningless). */
export const delta = (now: number, before: number) => (before > 0 ? (now - before) / before : null);
