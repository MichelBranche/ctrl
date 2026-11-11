import "server-only";
import { getAdmin } from "@/lib/admin";
import { AI_MSG, type AiCode } from "@/lib/ai/messages";
import { AiError, type AiKind } from "@/lib/ai/provider";
import { isFounder, canAccess } from "@/lib/team-types";
import type { AiActor } from "@/lib/ai/tools";

const NO_STORE = { "Cache-Control": "private, no-store" };

export function aiJson(body: unknown, status = 200, extra?: Record<string, string>): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

export function aiFail(kind: AiKind): Response {
  const error = messageFor(kind);
  const code: AiCode = kind === "bad_output" ? "bad_output" : kind;
  const status = statusFor(kind);
  return aiJson({ error, code }, status, status === 429 ? { "Retry-After": "3600" } : undefined);
}

function messageFor(kind: AiKind): string {
  switch (kind) {
    case "unconfigured": return AI_MSG.unconfigured;
    case "quota": return AI_MSG.quotaProvider;
    case "down": return AI_MSG.down;
    case "bad_output": return AI_MSG.badOutput;
    default: {
      const never: never = kind;
      return never;
    }
  }
}

function statusFor(kind: AiKind): number {
  switch (kind) {
    case "unconfigured":
    case "down":
    case "bad_output":
      return 503;
    case "quota":
      return 429;
    default: {
      const never: never = kind;
      return never;
    }
  }
}

/** Provider failures become a fixed Italian sentence. The provider's own text can echo the prompt, so it stays out of the response and the log. */
export function aiFailure(error: unknown): Response {
  if (error instanceof AiError) return aiFail(error.kind);
  return aiFail("down");
}

export async function readJson(req: Request, maxBytes: number): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: aiJson({ error: AI_MSG.tooBig, code: "bad_request" satisfies AiCode }, 413) };
  }
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { ok: false, response: aiJson({ error: AI_MSG.tooBig, code: "bad_request" satisfies AiCode }, 413) };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, response: aiJson({ error: AI_MSG.badRequest, code: "bad_request" satisfies AiCode }, 400) };
  }
}

export async function readActor(): Promise<{ ok: true; user: AiActor } | { ok: false; response: Response }> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, response: aiJson({ error: AI_MSG.unauthorized, code: "unauthorized" satisfies AiCode }, 401) };
  return { ok: true, user: { id: admin.id, founder: isFounder(admin), crm: canAccess(admin, "crm"), mail: canAccess(admin, "email") } };
}
