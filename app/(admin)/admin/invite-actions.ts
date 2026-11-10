"use server";

import { passwordOk, signInAfterInvite } from "@/lib/admin";
import { acceptInvite } from "@/lib/team-invite";
import { tokenShapeOk } from "@/lib/team-invite-core";

export type InviteState = { error?: string; next?: "setup" | "twofactor" };

/**
 * Accepts an invite: personal password (twice), then the single-use token is consumed atomically.
 * Founders continue to the mandatory guided 2FA setup (no session until it is on); everyone else is signed in
 * and offered 2FA with a "Più tardi" option.
 */
export async function acceptInviteAction(token: string, _: InviteState, form: FormData): Promise<InviteState> {
  if (typeof token !== "string" || !tokenShapeOk(token)) return { error: "Invito non valido." };
  const password = String(form.get("password") ?? "").slice(0, 501);
  const confirm = String(form.get("confirm") ?? "").slice(0, 501);
  if (!passwordOk(password)) return { error: "La password deve avere almeno 12 caratteri." };
  if (password !== confirm) return { error: "Le due password non coincidono." };
  const user = await acceptInvite(token, password);
  if (!user) return { error: "Questo invito non è più valido: è scaduto, è stato revocato o è già stato usato. Chiedi un nuovo invito al founder." };
  return { next: (await signInAfterInvite(user)) === "setup" ? "setup" : "twofactor" };
}
