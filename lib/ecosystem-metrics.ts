import "server-only";

export const ECOSYSTEM_APPS = ["quotes", "agenda"] as const;
export type EcosystemAppId = (typeof ECOSYSTEM_APPS)[number];

export const isEcosystemApp = (value: unknown): value is EcosystemAppId =>
  value === "quotes" || value === "agenda";

export type QuotesMetrics = {
  app: "quotes";
  generatedAt: string;
  workspacesAlive: number;
  users: number;
  quotes: number;
  trialsActive: number;
  trialsExpired: number;
  lifetimeOverrides: number;
  stripeSubscriptionsActive: number;
  stripeByPlan: { starter: number; pro: number; business: number };
  signups: { month: string; workspaces: number }[];
};

export type QuotesMetricsResult =
  | { status: "ok"; data: QuotesMetrics }
  | { status: "unconfigured" }
  | { status: "unavailable" };

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseMetrics(body: unknown): QuotesMetrics | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (row.app !== "quotes") return null;
  const byPlan = row.stripeByPlan && typeof row.stripeByPlan === "object" ? (row.stripeByPlan as Record<string, unknown>) : {};
  const signups = Array.isArray(row.signups)
    ? row.signups.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const month = String((item as { month?: unknown }).month ?? "");
        if (!/^\d{4}-\d{2}$/.test(month)) return [];
        return [{ month, workspaces: asCount((item as { workspaces?: unknown }).workspaces) }];
      })
    : [];
  return {
    app: "quotes",
    generatedAt: typeof row.generatedAt === "string" ? row.generatedAt : new Date().toISOString(),
    workspacesAlive: asCount(row.workspacesAlive),
    users: asCount(row.users),
    quotes: asCount(row.quotes),
    trialsActive: asCount(row.trialsActive),
    trialsExpired: asCount(row.trialsExpired),
    lifetimeOverrides: asCount(row.lifetimeOverrides),
    stripeSubscriptionsActive: asCount(row.stripeSubscriptionsActive),
    stripeByPlan: {
      starter: asCount(byPlan.starter),
      pro: asCount(byPlan.pro),
      business: asCount(byPlan.business),
    },
    signups,
  };
}

function quotesBaseUrl(): string {
  const raw = process.env.ECOSYSTEM_QUOTES_URL?.trim() || "https://quotes.ctrlagency.dev";
  return raw.replace(/\/+$/, "");
}

/** Fetch aggregated Quotes metrics. Never logs the token. No PII is expected in the payload. */
export async function fetchQuotesMetrics(): Promise<QuotesMetricsResult> {
  const secret = process.env.ECOSYSTEM_METRICS_SECRET?.trim();
  if (!secret || secret.length < 16) return { status: "unconfigured" };
  const url = `${quotesBaseUrl()}/api/internal/ecosystem-metrics`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 503) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      if (body?.error === "unconfigured" || res.status === 401) return { status: "unconfigured" };
      return { status: "unavailable" };
    }
    if (!res.ok) return { status: "unavailable" };
    const parsed = parseMetrics(await res.json());
    return parsed ? { status: "ok", data: parsed } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
