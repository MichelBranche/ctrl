"use server";

import { redirect } from "next/navigation";
import { passwordOk } from "@/lib/admin";
import { getAdminCopy } from "@/lib/admin-locale";
import { requestPasswordReset, resetPassword } from "@/lib/password-reset";
import { resetTokenShapeOk } from "@/lib/password-reset-core";

export type ForgotState = { sent?: number; error?: string };

/** Same answer for every address (no enumeration). The email, if any, goes out after the response. */
export async function requestResetAction(_: ForgotState, form: FormData): Promise<ForgotState> {
  const { lang, t } = await getAdminCopy();
  const email = String(form.get("email") ?? "").trim().slice(0, 200);
  if (!email) return { error: t.reset.enterEmail };
  await requestPasswordReset(email, lang);
  return { sent: Date.now() };
}

export type ResetState = { error?: string };

/** New password from the emailed link. No session is created: back to the sign-in (2FA still applies). */
export async function resetPasswordAction(token: string, _: ResetState, form: FormData): Promise<ResetState> {
  const { lang, t } = await getAdminCopy();
  if (!resetTokenShapeOk(token)) return { error: t.reset.linkGone };
  const password = String(form.get("password") ?? "").slice(0, 501);
  const confirm = String(form.get("confirm") ?? "").slice(0, 501);
  if (!passwordOk(password)) return { error: t.auth.passwordTooShort };
  if (password !== confirm) return { error: t.auth.passwordMismatch };
  if ((await resetPassword(token, password, lang)) !== "ok") return { error: t.reset.linkGone };
  redirect("/admin/login/aggiornata");
}
