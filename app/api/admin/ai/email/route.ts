import { aiConfigured, aiMockEnabled } from "@/lib/ai/config";
import { mockOutreachEmail, polishOutreach } from "@/lib/ai/copy";
import { buildEmailDossier } from "@/lib/ai/email-context";
import { aiFailure, aiJson, readActor, readJson } from "@/lib/ai/http";
import { AI_MSG } from "@/lib/ai/messages";
import { AiError, generateOutreach } from "@/lib/ai/provider";
import { releaseSlot, takeSlot } from "@/lib/ai/quota";

/**
 * POST /api/admin/ai/email  { contactId }
 * Fills a subject and a body. It never sends the email.
 * The contact dossier is loaded on the server and sent only to Groq, or to Cloudflare if Groq fails.
 */
export async function POST(req: Request) {
  const gate = await readActor();
  if (!gate.ok) return gate.response;
  const user = gate.user;
  if (!user.crm || !user.mail) return aiJson({ error: AI_MSG.forbidden, code: "forbidden" }, 403);
  if (!aiConfigured()) return aiJson({ error: AI_MSG.unconfigured, code: "unconfigured" }, 503);

  const body = await readJson(req, 4_000);
  if (!body.ok) return body.response;
  const contactId = body.value && typeof body.value === "object" && "contactId" in body.value
    ? String((body.value as { contactId?: unknown }).contactId ?? "")
    : "";
  const dossier = await buildEmailDossier(contactId).catch(() => null);
  if (!dossier) return aiJson({ error: AI_MSG.notFound, code: "not_found" }, 404);

  const slot = await takeSlot(user.id);
  if (!slot.ok) {
    const quota = slot.reason === "quota";
    return aiJson(
      { error: quota ? AI_MSG.quotaUser : AI_MSG.limitDb, code: quota ? "quota" : "limit_db" },
      quota ? 429 : 503,
      quota ? { "Retry-After": "3600" } : undefined,
    );
  }

  try {
    const draft = aiMockEnabled() ? mockOutreachEmail(dossier.businessName, dossier.issues) : await generateOutreach(dossier.prompt);
    const letter = polishOutreach(draft.subject, draft.body);
    if (!letter) {
      await releaseSlot(user.id);
      return aiFailure(new AiError("bad_output"));
    }
    return aiJson(letter);
  } catch (error) {
    await releaseSlot(user.id);
    return aiFailure(error);
  }
}
