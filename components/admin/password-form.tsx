"use client";

import { useActionState, useEffect, useRef } from "react";
import { updatePassword, type ActionState } from "@/app/admin/dashboard-actions";
import { useAdminLocale } from "@/components/admin/locale-provider";
import { SaveBar, SettingRow } from "@/components/admin/settings-ui";

export function PasswordForm() {
  const { t } = useAdminLocale();
  const [state, action, pending] = useActionState<ActionState, FormData>(updatePassword, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="st-form">
      <div className="st-rows">
        <SettingRow label={t.passwordForm.current}><input className="st-input" name="current" type="password" autoComplete="current-password" required /></SettingRow>
        <SettingRow label={t.passwordForm.next}><input className="st-input" name="next" type="password" autoComplete="new-password" minLength={12} required /></SettingRow>
        <SettingRow label={t.passwordForm.confirm}><input className="st-input" name="confirm" type="password" autoComplete="new-password" minLength={12} required /></SettingRow>
      </div>
      <SaveBar pending={pending} ok={state.ok} error={state.error} label={t.passwordForm.submit} pendingLabel={t.passwordForm.pending} />
    </form>
  );
}
