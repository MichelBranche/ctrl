"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { requestIrisSearch } from "@/lib/crm-iris";
import { RADAR } from "@/lib/crm-nav";
import { isFounder } from "@/lib/team-types";

function originFrom(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "https://www.ctrlagency.dev";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Founders only. The daily credit and the single active request are checked again in the database. */
export async function askIrisAction(input: unknown): Promise<{ ok: true } | { error: string }> {
  const me = await guardSection("crm");
  const result = await requestIrisSearch({
    userId: me.id,
    name: me.name,
    founder: isFounder(me),
    params: input,
    origin: originFrom(await headers()),
  });
  if (!result.ok) return { error: result.error };
  await logAction("crm.iris_request", { type: "crm", id: result.id }, { id: result.id }).catch(() => {});
  revalidatePath(RADAR);
  return { ok: true };
}
