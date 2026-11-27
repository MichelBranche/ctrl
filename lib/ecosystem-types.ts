export const ECOSYSTEM_APPS = ["quotes", "agenda"] as const;
export type EcosystemAppId = (typeof ECOSYSTEM_APPS)[number];

export const isEcosystemApp = (value: unknown): value is EcosystemAppId =>
  value === "quotes" || value === "agenda";

export const ECOSYSTEM_ACCESS_STATUSES = [
  "lifetime",
  "paid",
  "redeem",
  "trial_active",
  "trial_expired",
  "none",
] as const;

export type EcosystemAccessStatus = (typeof ECOSYSTEM_ACCESS_STATUSES)[number];

export type EcosystemMemberRef = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
};

export type EcosystemUserWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
  status: EcosystemAccessStatus;
  planId: string;
  trialEndsAt: string | null;
};

export type EcosystemUserRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastSeenAt: string | null;
  status: EcosystemAccessStatus;
  trialEndsAt: string | null;
  workspaces: EcosystemUserWorkspace[];
};

export type EcosystemWorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  status: EcosystemAccessStatus;
  planId: string;
  trialEndsAt: string | null;
  overrideUntil: string | null;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  quoteCount: number;
  members: EcosystemMemberRef[];
};

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
  userList?: EcosystemUserRow[];
  workspaceList?: EcosystemWorkspaceRow[];
};

export type QuotesMetricsResult =
  | { status: "ok"; data: QuotesMetrics }
  | { status: "unconfigured" }
  | { status: "unavailable" };
