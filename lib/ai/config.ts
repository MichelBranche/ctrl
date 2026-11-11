import "server-only";

/**
 * Which free provider answers. Keys are read here and passed to the SDK.
 * They are never returned to the browser and never written to a log line.
 */

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_GROQ_FALLBACK = "openai/gpt-oss-20b";
export const DEFAULT_CLOUDFLARE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function cleanModel(value: string | undefined, fallback: string): string {
  const model = value?.trim() ?? "";
  if (!model || model.length > 120 || /[\s\r\n]/.test(model)) return fallback;
  return model;
}

/** Local fixture only. Ignored on Vercel production, same rule as the mock mailbox. */
export function aiMockEnabled(): boolean {
  return process.env.AI_MOCK === "1" && process.env.VERCEL_ENV !== "production";
}

export function groqKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  return key ? key : null;
}

export function groqModel(): string {
  return cleanModel(process.env.AI_MODEL, DEFAULT_GROQ_MODEL);
}

export function groqFallbackModel(): string {
  return cleanModel(process.env.AI_FALLBACK_MODEL, DEFAULT_GROQ_FALLBACK);
}

export function cloudflareConfig(): { accountId: string; token: string; model: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const token = process.env.CLOUDFLARE_AI_TOKEN?.trim() ?? "";
  if (!accountId || !token) return null;
  return { accountId, token, model: cleanModel(process.env.CLOUDFLARE_AI_MODEL, DEFAULT_CLOUDFLARE_MODEL) };
}

export function aiConfigured(): boolean {
  return aiMockEnabled() || Boolean(groqKey() || cloudflareConfig());
}

/** Successful requests per user per Rome day. Default 30: the free token-per-day cap is the binding limit. */
export function dailyLimit(): number {
  const raw = process.env.AI_DAILY_LIMIT?.trim();
  if (!raw) return 30;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 1000) return 30;
  return n;
}
