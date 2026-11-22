"use client";

import { startTransition, useActionState, useState } from "react";
import { saveSocial, type ActionState } from "@/app/admin/dashboard-actions";
import { SaveBar, SettingRow } from "@/components/admin/settings-ui";

export function SocialForm({ keys, labels, initial }: { keys: string[]; labels: Record<string, string>; initial: Record<string, string> }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSocial, {});
  const [filled, setFilled] = useState(() => Object.fromEntries(keys.map((k) => [k, Boolean(initial[k])])));
  return (
    <form
      className="st-form"
      onSubmit={(e) => {
        // Submit without the automatic form reset, so a rejected URL stays editable.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <div className="st-rows">
        {keys.map((k) => (
          <SettingRow key={k} label={<><i className="st-dot" data-on={filled[k] || undefined} aria-hidden="true" />{labels[k]}</>} hint={filled[k] ? "Compilato" : "Vuoto, resta nascosto"}>
            <input className="st-input" name={k} type="url" inputMode="url" defaultValue={initial[k]} placeholder="https://" autoComplete="off"
              onChange={(e) => { const v = Boolean(e.currentTarget.value.trim()); setFilled((f) => (f[k] === v ? f : { ...f, [k]: v })); }} />
          </SettingRow>
        ))}
      </div>
      <SaveBar pending={pending} ok={state.ok} error={state.error} label="Salva profili" pendingLabel="Salvataggio…" hint="I campi vuoti restano nascosti." />
    </form>
  );
}
