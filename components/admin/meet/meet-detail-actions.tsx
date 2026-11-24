"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelClientMeetingAction, cancelMeetingAction } from "@/app/admin/meet-actions";
import { Icon, MI } from "@/components/admin/meet/meet-icons";

/** Cancel from the detail page: same server actions and confirms as before, then back to the calendar. */
export function CancelMeeting({ kind, id }: { kind: "team" | "cliente"; id: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () => {
    if (kind === "team") {
      if (!confirm("Annullare la riunione? Google avvisa tutti gli invitati.")) return;
      start(async () => { const r = await cancelMeetingAction(id); if (r.error) setErr(r.error); else router.replace("/admin/riunioni?annullata=1"); });
    } else {
      if (!confirm("Annullare la riunione con il cliente?")) return;
      const notify = confirm("Vuoi avvisare il cliente con un'email di annullamento?");
      start(async () => {
        const r = await cancelClientMeetingAction(id, notify);
        // A failed client email still cancels the meeting: show the warning, the calendar refreshes on the next visit.
        if (r.error && !r.error.startsWith("Riunione annullata")) setErr(r.error); else router.replace(`/admin/riunioni?annullata=${r.error ? "mail" : "1"}`);
      });
    }
  };
  return (
    <span className="mt-cancel">
      <button type="button" className="rb-btn mt-danger" disabled={pending} onClick={run}><Icon d={MI.trash} />{pending ? "Annullo…" : "Annulla riunione"}</button>
      {err ? <span className="mt-msg" data-tone="error" role="alert">{err}</span> : null}
    </span>
  );
}
