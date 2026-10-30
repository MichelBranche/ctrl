import { NextResponse } from "next/server";
import { faqProvider, type AssistantProvider, type ChatMessage } from "@/lib/assistant";
import type { Locale } from "@/lib/i18n";

/**
 * POST /api/chat  { messages: ChatMessage[], lang: "it" | "en" }
 * -> { reply, links, source }
 *
 * Today only the deterministic FAQ provider (lib/assistant.ts) is used.
 *
 * To plug a real LLM later (e.g. Vercel AI SDK, not installed yet):
 *   1. npm i ai @ai-sdk/openai   (or route through Vercel AI Gateway)
 *   2. implement an `llmProvider: AssistantProvider` that calls
 *      generateText / streamText with a system prompt built from
 *      lib/content.ts (services, team, projects, CONTACT_EMAIL) and the
 *      rule "never invent prices or stats; quotes are on request".
 *   3. return it from pickProvider() when the key is present, keeping
 *      faqProvider as the fallback on error.
 */
function pickProvider(): AssistantProvider {
  const hasLLM = Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY);
  if (hasLLM) {
    // return llmProvider;  <- plug the real model here
  }
  return faqProvider;
}

const MAX_MESSAGES = 20;
const MAX_CHARS = 1000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { messages, lang } = (body ?? {}) as { messages?: unknown; lang?: unknown };
  const locale: Locale = lang === "en" ? "en" : "it";
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  const clean: ChatMessage[] = messages
    .slice(-MAX_MESSAGES)
    .filter(
      (m): m is ChatMessage =>
        !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  try {
    const result = await pickProvider().answer(clean, locale);
    return NextResponse.json(result);
  } catch {
    const result = await faqProvider.answer(clean, locale);
    return NextResponse.json(result);
  }
}
