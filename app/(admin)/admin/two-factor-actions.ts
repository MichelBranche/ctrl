"use server";

import { revalidatePath } from "next/cache";
import { confirmOwnPassword, getAdmin, recordSecondFactorFailure, reissueAfterRevocation, secondFactorLocked } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { canDisableTwoFactor } from "@/lib/two-factor-policy";
import { beginSetup, checkSecondFactor, confirmSetup, removeTwoFactor, twoFactorEnabled } from "@/lib/two-factor";

export type TwoFactorState = { error?: string; ok?: string; setup?: { secret: string; qrSvg: string }; codes?: string[] };

const LOCKED = "Troppi tentativi. Riprova tra 15 minuti.";

/** Step 1: new pending secret for the signed-in user only. */
export async function startTwoFactor(): Promise<TwoFactorState> {
  const me = await getAdmin();
  if (!me) return { error: "Sessione scaduta. Accedi di nuovo." };
  if (await twoFactorEnabled(me.id)) return { error: "La verifica in due passaggi è già attiva." };
  return { setup: await beginSetup(me.id, me.email) };
}

/** Step 2: activation only after a valid code from the app; returns the recovery codes once. */
export async function confirmTwoFactor(prev: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  const me = await getAdmin();
  if (!me) return { error: "Sessione scaduta. Accedi di nuovo." };
  if (await secondFactorLocked(me.id)) return { ...prev, error: LOCKED };
  const codes = await confirmSetup(me.id, String(form.get("code") ?? "").slice(0, 20)).catch(() => null);
  if (!codes) {
    await recordSecondFactorFailure(me.id);
    await logAction("auth.2fa_failed", { type: "user", id: me.id }, { step: "setup" }, me);
    return { ...prev, error: "Codice non valido o scaduto. Controlla l’ora del telefono e riprova." };
  }
  await logAction("auth.2fa_enabled", { type: "user", id: me.id }, undefined, me);
  revalidatePath("/admin/settings");
  return { codes, ok: "Verifica in due passaggi attiva." };
}

/** Disable: current password + a valid code (or a recovery code). */
export async function disableTwoFactor(_: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  const me = await getAdmin();
  if (!me) return { error: "Sessione scaduta. Accedi di nuovo." };
  if (!canDisableTwoFactor(me.roles)) return { error: "Per i founder la verifica in due passaggi è obbligatoria. Può azzerarla solo un altro founder." };
  if (await secondFactorLocked(me.id)) return { error: LOCKED };
  const pw = await confirmOwnPassword(String(form.get("password") ?? "").slice(0, 500));
  if (pw === "locked") return { error: LOCKED };
  if (pw === "wrong") return { error: "Password non corretta." };
  const kind = await checkSecondFactor(me.id, String(form.get("code") ?? "").slice(0, 40)).catch(() => null);
  if (!kind) {
    await recordSecondFactorFailure(me.id);
    await logAction("auth.2fa_failed", { type: "user", id: me.id }, { step: "disable" }, me);
    return { error: "Codice non valido o già usato." };
  }
  if (kind === "recovery") await logAction("auth.2fa_recovery_used", { type: "user", id: me.id }, { step: "disable" }, me);
  await removeTwoFactor(me.id);
  await reissueAfterRevocation();
  await logAction("auth.2fa_disabled", { type: "user", id: me.id }, undefined, me);
  revalidatePath("/admin/settings");
  return { ok: "Verifica in due passaggi disattivata." };
}
