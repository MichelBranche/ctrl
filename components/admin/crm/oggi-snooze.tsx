"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { panelFollowUpAction } from "@/app/admin/crm-actions";
import { updateActivityAction } from "@/app/admin/crm-activity-actions";
import { CrmIcon } from "@/components/admin/crm/crm-ui";

export type SnoozeTarget =
  | { kind: "followup"; id: string; version: number; text: string | null }
  | { kind: "activity"; id: string; version: number };

export type SnoozeOption = { day: string; label: string; hint: string };

/**
 * "Rimanda": moves one follow-up or activity to a later day with the existing write paths (contact follow-up form,
 * activity update). The text, owner and time stay as they are; a stale version shows the conflict message.
 */
export function SnoozeMenu({ target, options, label }: { target: SnoozeTarget; options: SnoozeOption[]; label: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const move = (day: string, menu: HTMLDetailsElement | null) => start(async () => {
    setError(null);
    let result: { ok?: string; error?: string };
    try {
      if (target.kind === "followup") {
        const f = new FormData();
        f.set("id", target.id);
        f.set("version", String(target.version));
        f.set("next_action", target.text ?? "");
        f.set("next_action_at", day);
        result = await panelFollowUpAction({}, f);
      } else {
        result = await updateActivityAction({ id: target.id, version: target.version, dueDate: day });
      }
    } catch {
      result = { error: "Non rimandato. Riprova." };
    }
    menu?.removeAttribute("open");
    if (result.error) setError(result.error);
    router.refresh();
  });
  return (
    <>
      <details className="rb-pop og-snooze">
        <summary className="rb-btn rb-btn-quiet og-snooze-btn" aria-label={`Rimanda: ${label}`} title="Rimanda" aria-disabled={busy || undefined}>
          <CrmIcon d="M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" /><span>{busy ? "…" : "Rimanda"}</span>
        </summary>
        <div className="rb-pop-panel og-snooze-panel" role="menu" aria-label="Rimanda a">
          <p className="rb-pop-title">Rimanda a</p>
          {options.map((o) => (
            <button key={o.day} type="button" role="menuitem" disabled={busy}
              onClick={(e) => move(o.day, e.currentTarget.closest("details"))}>
              <span>{o.label}</span><small>{o.hint}</small>
            </button>
          ))}
        </div>
      </details>
      {error ? <p className="adm-error og-row-error" role="alert">{error}</p> : null}
    </>
  );
}
