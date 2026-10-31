import "server-only";

/**
 * Read-only Vercel REST calls for the dashboard (Web Analytics API and deployments).
 * Needs VERCEL_API_TOKEN (a personal token, read scope is enough), VERCEL_PROJECT_ID and, for team projects, VERCEL_TEAM_ID.
 * Without them every helper returns null and the dashboard shows "Configura".
 */
const API = "https://api.vercel.com";
const cfg = () => {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  return token && projectId ? { token, projectId, teamId: process.env.VERCEL_TEAM_ID } : null;
};
export const vercelConfigured = () => cfg() !== null;

async function get<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const c = cfg();
  if (!c) return null;
  const qs = new URLSearchParams({ ...params, projectId: c.projectId, ...(c.teamId ? { teamId: c.teamId } : {}) });
  const res = await fetch(`${API}${path}?${qs}`, { headers: { Authorization: `Bearer ${c.token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Vercel API ${res.status}`);
  return (await res.json()) as T;
}

export type Bucket = { key: string; pageviews: number; visitors: number };
type AggRow = Record<string, string | number> & { pageviews: number; visitors: number };

/** One dimension of Web Analytics over the last `days` days (Hobby keeps one month). */
export async function analytics(by: "day" | "requestPath" | "referrerHostname" | "country" | "deviceType", days: number, limit = 10) {
  const until = new Date();
  const since = new Date(until.getTime() - (days - 1) * 86_400_000);
  const res = await get<{ data: AggRow[] }>("/v1/query/web-analytics/visits/aggregate", {
    by,
    since: since.toISOString().slice(0, 10),
    until: until.toISOString(),
    limit: String(limit),
  });
  if (!res) return null;
  return res.data.map((r): Bucket => ({
    key: String(by === "day" ? r.timestamp : (r[by] ?? "")),
    pageviews: Number(r.pageviews ?? 0),
    visitors: Number(r.visitors ?? 0),
  }));
}

export type Deployment = { id: string; url: string; state: string; target: string | null; createdAt: number; message: string; sha: string };

export async function deployments(limit = 8): Promise<Deployment[] | null> {
  const res = await get<{ deployments: Array<Record<string, unknown> & { meta?: Record<string, string> }> }>("/v6/deployments", { limit: String(limit) });
  if (!res) return null;
  return res.deployments.map((d) => ({
    id: String(d.uid),
    url: String(d.url),
    state: String(d.readyState ?? d.state ?? ""),
    target: d.target ? String(d.target) : null,
    createdAt: Number(d.created ?? 0),
    message: (d.meta?.githubCommitMessage ?? "").split("\n")[0],
    sha: (d.meta?.githubCommitSha ?? "").slice(0, 7),
  }));
}
