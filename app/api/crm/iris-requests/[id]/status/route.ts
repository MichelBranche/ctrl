import { NextResponse } from "next/server";
import { applyIrisStatus } from "@/lib/crm-iris";
import { ingestAuth } from "@/lib/crm-core";
import { dbConfigured } from "@/lib/db";

const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const ID = /^[0-9a-f-]{36}$/i;

/**
 * Iris reports progress on a search request. Same bearer as /api/crm/ingest.
 * States move only forward (queued → working → ready, or error). Repeating the current state is idempotent.
 */
async function update(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = ingestAuth(req.headers.get("authorization"), process.env.CRM_INGEST_SECRET);
  if (auth === "unconfigured") return json({ error: "ingest non configurato" }, 503);
  if (auth !== "ok") return json({ error: "non autorizzato" }, 401);
  if (!dbConfigured) return json({ error: "database non disponibile" }, 503);
  const { id } = await ctx.params;
  if (!ID.test(id)) return json({ error: "richiesta sconosciuta" }, 404);
  let data: unknown;
  try { data = await req.json(); } catch { return json({ error: "JSON non valido" }, 400); }
  const result = await applyIrisStatus(id, data);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true, id: result.id }, 200);
}

export const POST = update;
export const PATCH = update;
