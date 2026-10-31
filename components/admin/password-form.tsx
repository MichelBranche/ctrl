"use client";

import { useActionState, useEffect, useRef } from "react";
import { updatePassword, type ActionState } from "@/app/admin/dashboard-actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(updatePassword, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="adm-form">
      <label className="adm-field">
        <span>Password attuale</span>
        <input className="adm-input" name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="adm-field">
        <span>Nuova password (almeno 12 caratteri)</span>
        <input className="adm-input" name="next" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      <label className="adm-field">
        <span>Ripeti la nuova password</span>
        <input className="adm-input" name="confirm" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      <div className="adm-row-actions">
        <button className="adm-btn adm-btn-primary" disabled={pending}>
          {pending ? "Aggiornamento…" : "Aggiorna password"}
        </button>
        <p role="status" className={state.error ? "adm-error" : "adm-ok"}>
          {state.error ?? state.ok ?? ""}
        </p>
      </div>
    </form>
  );
}
