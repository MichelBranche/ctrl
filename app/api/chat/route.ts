import { NextResponse } from "next/server";
import { faqProvider, type AssistantProvider, type ChatMessage } from "@/lib/assistant";
import type { Locale } from "@/lib/i18n";
import { allow } from "@/lib/request-guard";

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
/** Whole request body. 20 messages x 1000 chars plus JSON overhead fits well under this. */
const MAX_BODY_BYTES = 32_000;
/** Per IP (salted daily hash, no raw IP stored): burst window and daily cap. Checked before any provider runs. */
const CHAT_LIMITS = { burst: 20, burstMs: 10 * 60_000, daily: 100, dailyMs: 24 * 3_600_000 } as const;

const TOO_MANY = {
  it: "Hai inviato molti messaggi in poco tempo. Riprova tra qualche minuto, oppure scrivici dalla pagina contatti.",
  en: "You have sent a lot of messages in a short time. Please try again in a few minutes, or write to us from the contact page.",
};
const TOO_BIG = { it: "Messaggio troppo lungo.", en: "Message too long." };

/** "ok", "limited" or "error" (DB unreachable). Both windows are always counted so a burst also uses up the daily cap. */
async function rateCheck(): Promise<"ok" | "limited" | "error"> {
  try {
    const burst = await allow("chat", CHAT_LIMITS.burst, CHAT_LIMITS.burstMs);
    const daily = await allow("chat-day", CHAT_LIMITS.daily, CHAT_LIMITS.dailyMs);
    return burst && daily ? "ok" : "limited";
  } catch {
    return "error";
  }
}

export async function POST(req: Request) {
  const lang0: Locale = new URL(req.url).searchParams.get("lang") === "en" ? "en" : "it";
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: TOO_BIG[lang0] }, { status: 413 });
  }
  const limit = await rateCheck();
  if (limit === "limited") {
    return NextResponse.json({ error: TOO_MANY[lang0], reply: TOO_MANY[lang0], links: [], source: "limit" }, { status: 429, headers: { "Retry-After": "600" } });
  }
  // Content-Length can be missing or wrong (chunked): count the bytes we actually read.
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: TOO_BIG[lang0] }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
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

  // If the limiter could not be checked, never reach a (future) paid provider: answer from the free FAQ only.
  const provider = limit === "ok" ? pickProvider() : faqProvider;
  try {
    const result = await provider.answer(clean, locale);
    return NextResponse.json(result);
  } catch {
    const result = await faqProvider.answer(clean, locale);
    return NextResponse.json(result);
  }
}
