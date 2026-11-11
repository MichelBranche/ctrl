import { aiConfigured, dailyLimit } from "@/lib/ai/config";
import { aiJson, readActor } from "@/lib/ai/http";
import { remainingSlots } from "@/lib/ai/quota";

/** Whether the admin AI can run, and how many requests this person has left today. No secrets. */
export async function GET() {
  const gate = await readActor();
  if (!gate.ok) return gate.response;
  const configured = aiConfigured();
  const remaining = configured ? await remainingSlots(gate.user.id) : null;
  return aiJson({ configured, limit: dailyLimit(), remaining });
}
