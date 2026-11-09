/*
 * Iris search requests: the form schema, the status machine, and the webhook contract.
 * No database and no secrets. Safe for the Radar form and for tests.
 */
import { z } from "zod";

export const IRIS_STATUSES = ["queued", "working", "ready", "error"] as const;
export type IrisStatus = (typeof IRIS_STATUSES)[number];
export const isIrisStatus = (v: unknown): v is IrisStatus => (IRIS_STATUSES as readonly string[]).includes(String(v));

/** Shown when a queued or working request has been sitting longer than this. Not stored. */
export const IRIS_STALE_MS = 3 * 60 * 60 * 1000;
export const IRIS_RECENT_MS = 24 * 60 * 60 * 1000;

export const SITE_CRITERIA = ["assente", "datato", "lento", "non mobile"] as const;
export type SiteCriterion = (typeof SITE_CRITERIA)[number];
export const SITE_CRITERION_LABEL: Record<SiteCriterion, string> = {
  assente: "Sito assente",
  datato: "Sito datato",
  lento: "Sito lento",
  "non mobile": "Non ottimizzato per mobile",
};

const sector = z.string().trim().min(2, "Un settore è troppo corto.").max(60, "Un settore è troppo lungo.");
export const irisParamsSchema = z.object({
  zone: z.string().trim().min(2, "Indica il comune, la provincia o l'area.").max(120, "La zona è troppo lunga."),
  sectors: z.array(sector).min(1, "Indica almeno un settore.").max(8, "Massimo 8 settori."),
  count: z.number().int("Il numero di lead non è valido.").min(10, "Minimo 10 lead.").max(50, "Massimo 50 lead."),
  siteCriteria: z.array(z.enum(SITE_CRITERIA)).max(SITE_CRITERIA.length),
  notes: z.string().trim().max(1000, "Le note superano i 1000 caratteri.").optional().nullable(),
}).transform((v) => {
  const seen = new Set<string>();
  const sectors: string[] = [];
  for (const raw of v.sectors) {
    const key = raw.toLocaleLowerCase("it");
    if (seen.has(key)) continue;
    seen.add(key);
    sectors.push(raw);
  }
  const criteria: SiteCriterion[] = [];
  for (const c of v.siteCriteria) if (!criteria.includes(c)) criteria.push(c);
  return {
    zone: v.zone,
    sectors,
    count: v.count,
    siteCriteria: criteria,
    notes: v.notes ? v.notes : null,
  };
}).refine((v) => v.sectors.length > 0, { path: ["sectors"], message: "Indica almeno un settore." });

export type IrisParams = z.infer<typeof irisParamsSchema>;

export const irisStatusSchema = z.object({
  status: z.enum(["working", "ready", "error"]),
  inserted: z.number().int().min(0).max(10_000).optional(),
  duplicates: z.number().int().min(0).max(10_000).optional(),
  error_message: z.string().trim().max(1000).optional().nullable(),
});
export type IrisStatusBody = z.infer<typeof irisStatusSchema>;

/** Forward only. The same status again is accepted and does not move the request. */
export function irisTransition(from: IrisStatus, to: IrisStatus): "ok" | "same" | "reject" {
  if (from === to) return "same";
  if (from === "ready" || from === "error" || to === "queued") return "reject";
  if (from === "queued" && (to === "working" || to === "ready" || to === "error")) return "ok";
  if (from === "working" && (to === "ready" || to === "error")) return "ok";
  return "reject";
}

export type IrisPhase = "queued" | "working" | "ready" | "expired";

export type IrisNotice = {
  id: string;
  name: string;
  time: string;
  zone: string;
  sectors: string[];
  phase: IrisPhase;
  inserted: number;
  blocked: boolean;
};

/** The sentence shown in the Radar banner and inside the form. */
export function irisNoticeText(n: Pick<IrisNotice, "phase" | "name" | "time" | "inserted">): string {
  if (n.phase === "ready") {
    const nLead = n.inserted === 1 ? "1 lead aggiunto" : `${n.inserted} lead aggiunti`;
    return `Pronta: ${nLead}`;
  }
  if (n.phase === "expired") return `Ricerca richiesta da ${n.name} alle ${n.time} scaduta.`;
  const state = n.phase === "working" ? "in lavorazione" : "in coda";
  return `Ricerca già richiesta da ${n.name} alle ${n.time} (${state}). Attendi almeno 60 minuti e verifica in Radar se i lead sono già stati uniti.`;
}

export function romeClock(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

const HEADER_NAME = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Header for the outbound webhook. `Authorization` is sent as `Bearer <key>`.
 * Any other allowed header name carries the key alone.
 */
export function irisWebhookHeaders(key: string, headerName: string | undefined): Record<string, string> | null {
  const name = headerName?.trim() || "Authorization";
  if (!key.trim() || !HEADER_NAME.test(name)) return null;
  const value = name.toLowerCase() === "authorization" ? `Bearer ${key.trim()}` : key.trim();
  return { [name]: value, "content-type": "application/json", accept: "application/json" };
}

export type IrisWebhookBody = {
  requestId: string;
  requestedBy: { id: string; name: string };
  zone: string;
  sectors: string[];
  count: number;
  siteCriteria: SiteCriterion[];
  notes: string | null;
  createdAt: string;
  statusUrl: string;
  ingestUrl: string;
};

export function irisWebhookBody(input: {
  id: string; userId: string; name: string; params: IrisParams; createdAt: string; origin: string;
}): IrisWebhookBody {
  const origin = input.origin.replace(/\/$/, "");
  return {
    requestId: input.id,
    requestedBy: { id: input.userId, name: input.name },
    zone: input.params.zone,
    sectors: input.params.sectors,
    count: input.params.count,
    siteCriteria: input.params.siteCriteria,
    notes: input.params.notes,
    createdAt: input.createdAt,
    statusUrl: `${origin}/api/crm/iris-requests/${input.id}/status`,
    ingestUrl: `${origin}/api/crm/ingest`,
  };
}
