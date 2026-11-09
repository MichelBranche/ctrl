import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { ingestContact } from "@/lib/crm";
import { irisRequestExists } from "@/lib/crm-iris";
import { ingestAuth, ingestSchema } from "@/lib/crm-core";
import { dbConfigured } from "@/lib/db";

const MAX_BYTES = 1_000_000;
const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Radar ingest: the external prospecting assistant posts contacts (and optional email drafts).
 * Bearer CRM_INGEST_SECRET, compared in constant time. Nothing is ever sent from here: drafts wait for an explicit "Invia".
 */
export async function POST(req: Request) {
  const auth = ingestAuth(req.headers.get("authorization"), process.env.CRM_INGEST_SECRET);
  if (auth === "unconfigured") return json({ error: "ingest non configurato" }, 503);
  if (auth !== "ok") return json({ error: "non autorizzato" }, 401);
  if (!dbConfigured) return json({ error: "database non disponibile" }, 503);
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: "payload troppo grande" }, 413);
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return json({ error: "JSON non valido" }, 400); }
  const parsed = ingestSchema.safeParse(data);
  if (!parsed.success) return json({ error: "dati non validi", issues: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
  let link: string | null = null;
  if (parsed.data.irisRequestId) {
    if (!(await irisRequestExists(parsed.data.irisRequestId))) return json({ error: "richiesta Iris sconosciuta" }, 404);
    link = parsed.data.irisRequestId;
  }
  const ids: string[] = [];
  let inserted = 0, duplicates = 0;
  for (const c of parsed.data.contacts) {
    const r = await ingestContact(c, link);
    ids.push(r.id);
    if (r.duplicate) duplicates++; else inserted++;
  }
  await logAction("crm.ingest", { type: "crm" }, { inserted, duplicates, via: "radar" }, null).catch(() => {});
  return json({ inserted, duplicates, ids }, 200);
}
