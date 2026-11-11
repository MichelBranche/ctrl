import type { ModelMessage } from "ai";
import { aiConfigured, aiMockEnabled } from "@/lib/ai/config";
import { classifyAsk, offTopicReply } from "@/lib/ai/copy";
import { aiFailure, aiJson, readActor, readJson } from "@/lib/ai/http";
import { AI_MSG } from "@/lib/ai/messages";
import { answerCrm } from "@/lib/ai/provider";
import { releaseSlot, takeSlot } from "@/lib/ai/quota";
import { crmSnapshot, crmTools, mockCrmAnswer } from "@/lib/ai/tools";

const MAX_MESSAGES = 8;
const MAX_CHARS = 500;

function history(value: unknown): ModelMessage[] | null {
  if (!value || typeof value !== "object" || !("messages" in value) || !Array.isArray((value as { messages?: unknown }).messages)) return null;
  const messages = (value as { messages: unknown[] }).messages.slice(-MAX_MESSAGES).flatMap((item): ModelMessage[] => {
    if (!item || typeof item !== "object") return [];
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return [];
    const text = content.trim().slice(0, MAX_CHARS);
    return text ? [{ role, content: text }] : [];
  });
  return messages.length ? messages : null;
}

/**
 * POST /api/admin/ai/chat  { messages }
 * CRM-only assistant. Tools are read-only and run on the server. Off-topic questions are refused without calling a model.
 */
export async function POST(req: Request) {
  const gate = await readActor();
  if (!gate.ok) return gate.response;
  const user = gate.user;
  const body = await readJson(req, 24_000);
  if (!body.ok) return body.response;
  const messages = history(body.value);
  if (!messages) return aiJson({ error: AI_MSG.badRequest, code: "bad_request" }, 400);
  const last = [...messages].reverse().find((message) => message.role === "user");
  const question = typeof last?.content === "string" ? last.content : "";
  if (!question) return aiJson({ error: AI_MSG.badRequest, code: "bad_request" }, 400);

  if (classifyAsk(question) === "offtopic") return aiJson({ reply: offTopicReply() });
  if (!user.crm) return aiJson({ reply: AI_MSG.noCrm });
  if (!aiConfigured()) return aiJson({ error: AI_MSG.unconfigured, code: "unconfigured" }, 503);

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
    const reply = aiMockEnabled()
      ? await mockCrmAnswer(question, user)
      : await answerCrm(messages, crmTools(user), () => crmSnapshot(user));
    return aiJson({ reply });
  } catch (error) {
    await releaseSlot(user.id);
    return aiFailure(error);
  }
}
