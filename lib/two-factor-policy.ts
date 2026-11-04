/*
 * Who must use 2FA and what a correct password leads to. Pure (no DB, no cookies) so scripts/two-factor-test.mjs
 * can test the rules directly. Founders: mandatory. Everyone else: optional.
 */
import { isFounder } from "@/lib/team-types";

/** Roles of the account (multi-role). A bare string is accepted as a single role. Founder in any position: required. */
export type RoleInput = readonly string[] | string;
const list = (r: RoleInput) => (typeof r === "string" ? [r] : r);
export const twoFactorRequired = (roles: RoleInput) => isFounder(list(roles));

/** After a correct password: straight in, ask for the code, or run the guided setup first. */
export type LoginNext = "session" | "code" | "setup";
export function loginNext(role: RoleInput, enabled: boolean): LoginNext {
  if (enabled) return "code";
  return twoFactorRequired(role) ? "setup" : "session";
}

/** A signed session is honoured only if the account meets its 2FA rule (catches sessions issued before the rule). */
export const sessionAllowed = (role: RoleInput, enabled: boolean) => enabled || !twoFactorRequired(role);

/** Founders cannot switch 2FA off themselves; another founder can reset it, which forces setup at next login. */
export const canDisableTwoFactor = (role: RoleInput) => !twoFactorRequired(role);

/**
 * The guided setup may open a session only if 2FA was activated after this setup ticket was issued
 * (proves the code step happened in this flow, not an old enrolment). 2s slack for clock rounding.
 */
export function forcedSetupFinishable(enabledAt: string | null, ticketIssuedAtMs: number) {
  if (!enabledAt) return false;
  const t = Date.parse(enabledAt);
  return Number.isFinite(t) && t >= ticketIssuedAtMs - 2000;
}
