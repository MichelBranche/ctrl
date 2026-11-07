/*
 * CRM shared core: stages, sources, dedupe keys, ingest schema and bearer check. No DB, no secrets, safe for tests.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const STAGES = ["nuovo", "contattato", "call", "preventivo", "vinto", "perso"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = { nuovo: "Nuovo", contattato: "Contattato", call: "Call", preventivo: "Preventivo", vinto: "Vinto", perso: "Perso" };
/** Column hint on the opportunity board. The same words name a contact's relationship and a deal's phase; they are not the same row. */
export const STAGE_HINT: Record<Stage, string> = {
  nuovo: "Lead da qualificare", contattato: "Primo contatto effettuato", call: "In conversazione",
  preventivo: "Offerta inviata", vinto: "Progetto confermato", perso: "Trattativa chiusa",
};
export const isStage = (v: unknown): v is Stage => STAGES.includes(v as Stage);
export const CLOSED_STAGES = ["vinto", "perso"] as const;
export const isClosedStage = (stage: Stage) => stage === "vinto" || stage === "perso";

/** Set by hand on a deal. Never derived from an Iris score. */
export const DEAL_PRIORITIES = ["alta", "media", "bassa"] as const;
export type DealPriority = (typeof DEAL_PRIORITIES)[number];
export const DEAL_PRIORITY_LABEL: Record<DealPriority, string> = { alta: "Alta", media: "Media", bassa: "Bassa" };
export const isDealPriority = (v: unknown): v is DealPriority => (DEAL_PRIORITIES as readonly string[]).includes(String(v));

/** Kind of a CRM activity. A follow-up already stored on the contact is not one of these rows. */
export const ACTIVITY_KINDS = ["followup", "email", "call", "meeting", "radar", "altro"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  followup: "Follow-up", email: "Email", call: "Chiamata", meeting: "Riunione", radar: "Radar", altro: "Attività",
};
export const isActivityKind = (v: unknown): v is ActivityKind => (ACTIVITY_KINDS as readonly string[]).includes(String(v));

export const SOURCES = ["sito", "manuale", "radar"] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABEL: Record<Source, string> = { sito: "Sito", manuale: "Manuale", radar: "Radar" };
export const isSource = (v: unknown): v is Source => SOURCES.includes(v as Source);

export const DRAFT_STATUSES = ["bozza", "inviata", "scartata"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

/** Webmail domains: never used as a company domain for dedupe. */
const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "hotmail.com", "hotmail.it", "outlook.com", "outlook.it", "live.com", "live.it", "yahoo.com", "yahoo.it", "icloud.com", "me.com", "libero.it", "virgilio.it", "tiscali.it", "alice.it", "tim.it", "fastwebnet.it", "email.it", "pec.it", "proton.me", "protonmail.com", "aruba.it"]);

export const normEmail = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** Digits only, Italian prefix (+39 / 0039) dropped; under 6 digits counts as empty. */
export function normPhone(v: string | null | undefined): string {
  let d = (v ?? "").replace(/\D+/g, "");
  if (d.startsWith("0039")) d = d.slice(4);
  else if (d.startsWith("39") && d.length > 10) d = d.slice(2);
  return d.length >= 6 ? d : "";
}

/** Registrable-ish host of a website ("https://www.Foo.it/x" -> "foo.it"). */
export function websiteDomain(v: string | null | undefined): string {
  const raw = (v ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const host = new URL(/^[a-z]+:\/\//.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
    return host.includes(".") ? host : "";
  } catch {
    return "";
  }
}

/** Company domain: the website, else the email domain unless it is a webmail. */
export function companyDomain(website: string | null | undefined, email: string | null | undefined): string {
  const w = websiteDomain(website);
  if (w) return w;
  const at = normEmail(email).split("@")[1] ?? "";
  return at && at.includes(".") && !FREE_MAIL.has(at) ? at : "";
}

export type DedupeKeys = { email: string; phone: string; domain: string };
export const dedupeKeys = (c: { email?: string | null; phone?: string | null; website?: string | null }): DedupeKeys => ({
  email: normEmail(c.email),
  phone: normPhone(c.phone),
  domain: companyDomain(c.website, c.email),
});
export const hasKeys = (k: DedupeKeys) => Boolean(k.email || k.phone || k.domain);

/** Same contact if any non-empty key matches. */
export const sameContact = (a: DedupeKeys, b: DedupeKeys) =>
  Boolean((a.email && a.email === b.email) || (a.phone && a.phone === b.phone) || (a.domain && a.domain === b.domain));

const opt = (max: number) => z.string().trim().max(max).optional().nullable();
export const ingestDraftSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body_text: z.string().trim().min(1).max(20_000),
  body_html: z.string().max(100_000).optional().nullable(),
});
export const ingestContactSchema = z.object({
  business_name: z.string().trim().min(1).max(200),
  type: opt(80),
  contact_name: opt(120),
  email: z.string().trim().max(200).email().optional().nullable().or(z.literal("")),
  phone: opt(40),
  website: opt(300),
  address: opt(300),
  city: opt(100),
  region: opt(100),
  score: z.number().int().min(0).max(100).optional().nullable(),
  score_reasons: z.array(z.string().max(300)).max(20).optional().nullable(),
  notes: opt(5000),
  draft: ingestDraftSchema.optional().nullable(),
});
export const ingestSchema = z.object({ contacts: z.array(ingestContactSchema).min(1).max(100) });
export type IngestContact = z.infer<typeof ingestContactSchema>;

/** Constant-time comparison (hashes first so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Bearer check for /api/crm/ingest. "unconfigured" when the secret env is missing or too short. */
export function ingestAuth(header: string | null, secret: string | undefined): "ok" | "unauthorized" | "unconfigured" {
  const s = secret?.trim();
  if (!s || s.length < 16) return "unconfigured";
  const m = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? "");
  return m && safeEqual(m[1].trim(), s) ? "ok" : "unauthorized";
}

/** Win rate on closed deals, null when nothing is closed yet. */
export const conversionRate = (won: number, lost: number) => (won + lost ? won / (won + lost) : null);
