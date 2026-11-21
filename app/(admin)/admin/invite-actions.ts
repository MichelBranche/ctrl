"use server";

import { passwordOk, signInAfterInvite } from "@/lib/admin";
import { acceptInvite, readInvite, type InviteProfile } from "@/lib/team-invite";
import { tokenShapeOk } from "@/lib/team-invite-core";
import { getAdminCopy } from "@/lib/admin-locale";
import { photoError, profileFieldsError } from "@/lib/profile-validate";

export type InviteState = { error?: string; next?: "setup" | "twofactor" };
export type InviteProfileState = { error?: string; ok?: number };

type Copy = Awaited<ReturnType<typeof getAdminCopy>>["t"];
const text = (form: FormData, key: string, max: number) => (typeof form.get(key) === "string" ? String(form.get(key)).trim().slice(0, max) : "");

/** Reads and validates the onboarding profile fields (name, surname, phone, optional photo) from the form. */
function readProfile(form: FormData, t: Copy): { profile: InviteProfile } | { error: string } {
  const profile: InviteProfile = { name: text(form, "name", 101), lastName: text(form, "lastName", 101), phone: text(form, "phone", 41), photo: null };
  const fieldErr = profileFieldsError(profile);
  if (fieldErr) return { error: t.auth[fieldErr] };
  const photo = typeof form.get("photo") === "string" ? String(form.get("photo")) : "";
  if (photo) {
    const err = photoError(photo);
    if (err) return { error: t.auth[err] };
    profile.photo = photo;
  }
  return { profile };
}

/**
 * Step "Il tuo profilo": checks the token is still pending and the profile is valid. Stores nothing: the profile is
 * written together with the password in acceptInviteAction, in the same single-use UPDATE that consumes the token.
 */
export async function checkInviteProfileAction(token: string, _: InviteProfileState, form: FormData): Promise<InviteProfileState> {
  const { t } = await getAdminCopy();
  if (typeof token !== "string" || !tokenShapeOk(token)) return { error: t.auth.inviteInvalid };
  const view = await readInvite(token).catch(() => null);
  if (!view || view.state !== "valid") return { error: t.auth.inviteGone };
  const read = readProfile(form, t);
  return "error" in read ? { error: read.error } : { ok: Date.now() };
}

/**
 * Accepts an invite: personal password (twice) plus the onboarding profile, then the single-use token is consumed
 * atomically. Founders continue to the mandatory guided 2FA setup (no session until it is on); everyone else is
 * signed in and offered 2FA with a "Più tardi" option. A form without the profile marker (page opened before the
 * onboarding step existed) keeps the old behaviour: password only.
 */
export async function acceptInviteAction(token: string, _: InviteState, form: FormData): Promise<InviteState> {
  const { t } = await getAdminCopy();
  if (typeof token !== "string" || !tokenShapeOk(token)) return { error: t.auth.inviteInvalid };
  const password = String(form.get("password") ?? "").slice(0, 501);
  const confirm = String(form.get("confirm") ?? "").slice(0, 501);
  if (!passwordOk(password)) return { error: t.auth.passwordTooShort };
  if (password !== confirm) return { error: t.auth.passwordMismatch };
  let profile: InviteProfile | null = null;
  if (form.get("profile") === "1") {
    const read = readProfile(form, t);
    if ("error" in read) return { error: read.error };
    profile = read.profile;
  }
  const user = await acceptInvite(token, password, Date.now(), profile);
  if (!user) return { error: t.auth.inviteGone };
  return { next: (await signInAfterInvite(user)) === "setup" ? "setup" : "twofactor" };
}
