/*
 * Radar ingest schema: one contact as accepted by the CRM. Pure zod, no Node APIs, so the browser can use it too
 * (paste-from-AI preview). Re-exported by lib/crm-core.ts.
 */
import { z } from "zod";

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
  country: opt(100),
  score: z.number().int().min(0).max(100).optional().nullable(),
  score_reasons: z.array(z.string().max(300)).max(20).optional().nullable(),
  notes: opt(5000),
  /** Proposed job value in whole euros. Applied only when the contact is created. */
  estimatedValue: z.number().int().min(0).max(100_000).optional().nullable(),
  estimatedValueNote: z.string().trim().max(200).optional().nullable(),
  draft: ingestDraftSchema.optional().nullable(),
});
export const ingestSchema = z.object({
  contacts: z.array(ingestContactSchema).min(1).max(100),
  irisRequestId: z.string().trim().regex(/^[0-9a-f-]{36}$/i, "irisRequestId non valido").optional().nullable(),
});
export type IngestContact = z.infer<typeof ingestContactSchema>;
