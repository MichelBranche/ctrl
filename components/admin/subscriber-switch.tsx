"use client";

import { useOptimistic, useTransition } from "react";
import { setSubscriberActive } from "@/app/admin/dashboard-actions";

/** iOS-style switch: flips instantly (optimistic), then the server action persists it; reverts on failure. */
export function SubscriberSwitch({ id, email, active }: { id: string; email: string; active: boolean }) {
  const [on, setOn] = useOptimistic(active);
  const [pending, start] = useTransition();
  const flip = () =>
    start(async () => {
      setOn(!on);
      const res = await setSubscriberActive(id, !on).catch(() => ({ ok: false }));
      if (!res.ok) alert(`Aggiornamento non riuscito per ${email}.`);
    });
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={`${on ? "Disattiva" : "Attiva"} ${email}`}
      className="adm-switch" data-on={on || undefined} aria-busy={pending} onClick={flip}>
      <span className="adm-switch-knob" />
    </button>
  );
}
