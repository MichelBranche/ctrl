"use server";
import { revalidatePath } from "next/cache";
import { guardSection } from "@/lib/admin";
import { createSavedView, deleteSavedView, renameSavedView } from "@/lib/crm-views";
import { RUBRICA } from "@/lib/crm-nav";
import { isFounder } from "@/lib/team-types";

const refresh = () => revalidatePath(RUBRICA);

export async function createViewAction(name: string, search: string, shared: boolean): Promise<{ ok: true } | { error: string }> {
  const me = await guardSection("crm");
  const result = await createSavedView({ ownerId: me.id, name, search, shared: Boolean(shared), founder: isFounder(me) });
  if ("error" in result) return result;
  refresh();
  return { ok: true };
}

export async function renameViewAction(id: string, name: string): Promise<{ ok: true } | { error: string }> {
  const me = await guardSection("crm");
  const result = await renameSavedView({ id, userId: me.id, founder: isFounder(me), name });
  if ("error" in result) return result;
  refresh();
  return { ok: true };
}

export async function deleteViewAction(id: string): Promise<{ ok: true } | { error: string }> {
  const me = await guardSection("crm");
  const result = await deleteSavedView({ id, userId: me.id, founder: isFounder(me) });
  if ("error" in result) return result;
  refresh();
  return { ok: true };
}
