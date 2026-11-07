"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { completeFollowUpAction } from "@/app/admin/crm-actions";

/** Round "done" control of a follow-up row. The follow-up text stays on the contact as a note. */
export function FollowUpDone({ id, seenAt, label }: { id: string; seenAt: string; label: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="crm-check" disabled={busy} aria-label={`Segna come fatto: ${label}`} title="Segna come fatto"
        onClick={() => start(async () => {
          const r = await completeFollowUpAction(id, seenAt).catch(() => ({ error: "Non riuscito. Riprova." }));
          setError(r.error ?? null);
          router.refresh();
        })}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </button>
      {error ? <p className="adm-error crm-row-error" role="alert">{error}</p> : null}
    </>
  );
}

/** "N" opens the new-contact form, unless the person is typing or a dialog is open. */
export function NewContactShortcut({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("[aria-modal='true']")) return;
      e.preventDefault();
      router.push(href as Route);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, router]);
  return null;
}
