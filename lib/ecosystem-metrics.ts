import "server-only";

export {
  ECOSYSTEM_APPS,
  isEcosystemApp,
  type EcosystemAppId,
  type EcosystemAccessStatus,
  type EcosystemMemberRef,
  type EcosystemUserRow,
  type EcosystemUserWorkspace,
  type EcosystemWorkspaceRow,
  type QuotesMetrics,
  type QuotesMetricsResult,
} from "@/lib/ecosystem-types";

import { ECOSYSTEM_ACCESS_STATUSES, type EcosystemAccessStatus, type EcosystemMemberRef, type EcosystemUserRow, type EcosystemUserWorkspace, type EcosystemWorkspaceRow, type QuotesMetrics, type QuotesMetricsResult } from "@/lib/ecosystem-types";

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function asStatus(value: unknown): EcosystemAccessStatus | null {
  return typeof value === "string" && (ECOSYSTEM_ACCESS_STATUSES as readonly string[]).includes(value)
    ? (value as EcosystemAccessStatus)
    : null;
}

function asRole(value: unknown): EcosystemMemberRef["role"] | null {
  return value === "owner" || value === "admin" || value === "member" ? value : null;
}

function asIso(value: unknown): string | null {
  if (value == null) return null;
  return asText(value);
}

function parseMember(value: unknown): EcosystemMemberRef | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = asText(row.id);
  const name = asText(row.name);
  const email = asText(row.email);
  const role = asRole(row.role);
  if (!id || !name || !email || !role) return null;
  return { id, name, email, role };
}

function parseUserWorkspace(value: unknown): EcosystemUserWorkspace | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = asText(row.id);
  const name = asText(row.name);
  const slug = asText(row.slug);
  const role = asRole(row.role);
  const status = asStatus(row.status);
  const planId = asText(row.planId);
  if (!id || !name || !slug || !role || !status || !planId) return null;
  return { id, name, slug, role, status, planId, trialEndsAt: asIso(row.trialEndsAt) };
}

function parseUserRow(value: unknown): EcosystemUserRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = asText(row.id);
  const name = asText(row.name);
  const email = asText(row.email);
  const createdAt = asText(row.createdAt);
  const status = asStatus(row.status);
  if (!id || !name || !email || !createdAt || !status) return null;
  const workspaces = Array.isArray(row.workspaces)
    ? row.workspaces.flatMap((item) => {
        const parsed = parseUserWorkspace(item);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    id,
    name,
    email,
    createdAt,
    lastSeenAt: asIso(row.lastSeenAt),
    status,
    trialEndsAt: asIso(row.trialEndsAt),
    workspaces,
  };
}

function parseWorkspaceRow(value: unknown): EcosystemWorkspaceRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = asText(row.id);
  const name = asText(row.name);
  const slug = asText(row.slug);
  const createdAt = asText(row.createdAt);
  const status = asStatus(row.status);
  const planId = asText(row.planId);
  if (!id || !name || !slug || !createdAt || !status || !planId) return null;
  const members = Array.isArray(row.members)
    ? row.members.flatMap((item) => {
        const parsed = parseMember(item);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    id,
    name,
    slug,
    createdAt,
    status,
    planId,
    trialEndsAt: asIso(row.trialEndsAt),
    overrideUntil: asIso(row.overrideUntil),
    subscriptionStatus: asText(row.subscriptionStatus),
    subscriptionPlan: asText(row.subscriptionPlan),
    periodEnd: asIso(row.periodEnd),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
    quoteCount: asCount(row.quoteCount),
    members,
  };
}

function parseList<T>(value: unknown, parse: (item: unknown) => T | null): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const parsed = parse(item);
    return parsed ? [parsed] : [];
  });
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
    userList: parseList(row.userList, parseUserRow),
    workspaceList: parseList(row.workspaceList, parseWorkspaceRow),
  };
}

function quotesBaseUrl(): string {
  const raw = process.env.ECOSYSTEM_QUOTES_URL?.trim() || "https://quotes.ctrlagency.dev";
  return raw.replace(/\/+$/, "");
}

/** Fetch Quotes metrics and directories for founders. Never logs the token. */
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
