"use client";

import { startTransition, useActionState } from "react";
import { saveSocial, type ActionState } from "@/app/admin/dashboard-actions";

export function SocialForm({ keys, labels, initial }: { keys: string[]; labels: Record<string, string>; initial: Record<string, string> }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSocial, {});
  return (
    <form
      className="adm-panel adm-form"
      onSubmit={(e) => {
        // Submit without the automatic form reset, so a rejected URL stays editable.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {keys.map((k) => (
        <label key={k} className="adm-field">
          <span>{labels[k]}</span>
          <input className="adm-input" name={k} type="url" inputMode="url" defaultValue={initial[k]} placeholder="https://" autoComplete="off" />
        </label>
      ))}
      <div className="adm-row-actions">
        <button className="adm-btn adm-btn-primary" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva profili"}
        </button>
        <p role="status" className={state.error ? "adm-error" : "adm-ok"}>
          {state.error ?? state.ok ?? ""}
        </p>
      </div>
    </form>
  );
}
