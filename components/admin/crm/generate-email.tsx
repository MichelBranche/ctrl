"use client";

import { useEffect, useRef, useState } from "react";
import { AI_MSG } from "@/lib/ai/messages";

type Fill = { subject: string; body: string };

/**
 * Fills the composer. The request never sends the email: Invia stays the only send control.
 */
export function GenerateEmailButton({ contactId, disabled, onFill }: {
  contactId: string;
  disabled?: boolean;
  onFill: (draft: Fill) => void;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    let stop = false;
    void fetch("/api/admin/ai/status", { cache: "no-store" })
      .then((res) => res.ok ? res.json() as Promise<{ configured?: boolean }> : null)
      .then((data) => { if (!stop && data) setConfigured(data.configured === true); })
      .catch(() => { if (!stop) setConfigured(null); });
    return () => { stop = true; };
  }, []);

  const unavailable = configured === false;
  const label = unavailable ? AI_MSG.unconfigured : busy ? "Generazione…" : done ? "Rigenera con AI" : "Genera con AI";

  return (
    <div className="crm-ai-generate">
      <button
        type="button"
        className="adm-btn adm-btn-sm"
        disabled={disabled || busy || unavailable}
        aria-busy={busy || undefined}
        aria-describedby={error ? "crm-ai-generate-error" : undefined}
        onClick={() => {
          if (lock.current || busy || unavailable) return;
          lock.current = true;
          setBusy(true);
          setError("");
          void fetch("/api/admin/ai/email", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ contactId }),
          })
            .then(async (res) => {
              const data = await res.json().catch(() => ({})) as { subject?: string; body?: string; error?: string; code?: string };
              if (!res.ok || !data.subject || !data.body) {
                if (data.code === "unconfigured") setConfigured(false);
                setError(data.error || AI_MSG.down);
                return;
              }
              onFill({ subject: data.subject, body: data.body });
              setDone(true);
              setConfigured(true);
            })
            .catch(() => setError(AI_MSG.down))
            .finally(() => { lock.current = false; setBusy(false); });
        }}
      >
        {label}
      </button>
      <p className="adm-muted">Compila oggetto e messaggio. Non invia.</p>
      {error ? <p id="crm-ai-generate-error" className="adm-error" role="alert">{error}</p> : null}
    </div>
  );
}
