import { revalidatePath } from "next/cache";
import { getAdmin } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { ingestContact } from "@/lib/crm";
import { AI_IMPORT_MAX_CHARS, parseAiLeads } from "@/lib/crm-ai-import-core";
import { irisRequestExists } from "@/lib/crm-iris";
import { CRM_SECTIONS } from "@/lib/crm-nav";
import { dbConfigured } from "@/lib/db";
import { isFounder } from "@/lib/team-types";

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });
const UUID = /^[0-9a-f-]{36}$/i;

/** Same-site only: a cross-site page cannot spend the founders' quota with their cookie. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return Boolean(host) && new URL(origin).host === host; } catch { return false; }
}

/**
 * POST /api/admin/crm/ai-import  { text, irisRequestId? }
 * Founders only (403 otherwise). The answer pasted from an AI is read again here with the same rules as the
 * preview, each lead goes through ingestContact: duplicates are skipped and never overwritten, no email is sent.
 */
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return json({ error: "Accedi di nuovo per continuare." }, 401);
  if (!isFounder(admin)) return json({ error: "Solo i founder possono caricare lead." }, 403);
  if (!sameOrigin(req)) return json({ error: "Richiesta non valida." }, 403);
  if (!dbConfigured) return json({ error: "Il database non è disponibile. Riprova più tardi." }, 503);

  const raw = await req.text();
  if (raw.length > AI_IMPORT_MAX_CHARS + 2_000) return json({ error: "Il testo è troppo lungo. Incolla al massimo 100 aziende per volta." }, 413);
  let body: { text?: unknown; irisRequestId?: unknown };
  try { body = JSON.parse(raw) as typeof body; } catch { return json({ error: "Richiesta non valida." }, 400); }
  if (!body || typeof body !== "object" || typeof body.text !== "string") return json({ error: "Incolla qui la risposta dell'AI." }, 400);

  const parsed = parseAiLeads(body.text);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  if (!parsed.contacts.length) return json({ error: "Nessuna azienda valida da importare.", rejected: parsed.rejected.length }, 400);

  let link: string | null = null;
  if (typeof body.irisRequestId === "string" && body.irisRequestId) {
    if (!UUID.test(body.irisRequestId) || !(await irisRequestExists(body.irisRequestId))) return json({ error: "La richiesta a Iris collegata non esiste più." }, 404);
    link = body.irisRequestId;
  }

  let inserted = 0, duplicates = 0;
  try {
    for (const c of parsed.contacts) {
      const r = await ingestContact(c, link);
      if (r.duplicate) duplicates++; else inserted++;
    }
  } catch {
    return json({ error: "Import interrotto. I lead già presenti non sono stati modificati; riprovare non crea doppioni.", inserted, duplicates }, 500);
  }
  await logAction("crm.ingest", link ? { type: "crm", id: link } : { type: "crm" }, { inserted, duplicates, via: "ai-paste" }).catch(() => {});
  if (inserted) for (const s of CRM_SECTIONS) revalidatePath(s.href);
  return json({ inserted, duplicates, rejected: parsed.rejected.length }, 200);
}
