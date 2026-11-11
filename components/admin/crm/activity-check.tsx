"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setActivityDoneAction } from "@/app/admin/crm-activity-actions";

/** Complete or reopen. The checkbox submits; a stale version shows the error instead of a silent no-op. */
export function ActivityCheck({ id, version, done, label }: { id: string; version: number; done: boolean; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form action={async () => {
      if (pending) return;
      setPending(true);
      setError("");
      const result = await setActivityDoneAction({ id, version, done: !done }).catch(() => ({ error: "Non salvata. Riprova." }));
      setPending(false);
      if ("error" in result && result.error) { setError(result.error); return; }
      router.refresh();
    }}>
      <input type="checkbox" checked={done} disabled={pending} aria-label={label} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      {error ? <span className="adm-error" role="alert">{error}</span> : null}
    </form>
  );
}
