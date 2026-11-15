"use server";

import { passwordOk, signInAfterInvite } from "@/lib/admin";
import { acceptInvite } from "@/lib/team-invite";
import { tokenShapeOk } from "@/lib/team-invite-core";
import { getAdminCopy } from "@/lib/admin-locale";

export type InviteState = { error?: string; next?: "setup" | "twofactor" };

/**
 * Accepts an invite: personal password (twice), then the single-use token is consumed atomically.
 * Founders continue to the mandatory guided 2FA setup (no session until it is on); everyone else is signed in
 * and offered 2FA with a "Più tardi" option.
 */
export async function acceptInviteAction(token: string, _: InviteState, form: FormData): Promise<InviteState> {
  const { t } = await getAdminCopy();
  if (typeof token !== "string" || !tokenShapeOk(token)) return { error: t.auth.inviteInvalid };
  const password = String(form.get("password") ?? "").slice(0, 501);
  const confirm = String(form.get("confirm") ?? "").slice(0, 501);
  if (!passwordOk(password)) return { error: t.auth.passwordTooShort };
  if (password !== confirm) return { error: t.auth.passwordMismatch };
  const user = await acceptInvite(token, password);
  if (!user) return { error: t.auth.inviteGone };
  return { next: (await signInAfterInvite(user)) === "setup" ? "setup" : "twofactor" };
}
