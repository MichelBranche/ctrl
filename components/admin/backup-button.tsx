"use client";

import { useActionState } from "react";
import { runBackupNow, type BackupActionState } from "@/app/admin/backup-actions";

export function BackupButton() {
  const [state, action, pending] = useActionState<BackupActionState>(runBackupNow, {});
  return (
    <form action={action} className="adm-row">
      <button type="submit" className="adm-btn" disabled={pending}>{pending ? "Backup in corso…" : "Esegui backup ora"}</button>
      {state.ok ? <p className="adm-muted" role="status">{state.ok}</p> : null}
      {state.error ? <p className="adm-error" role="alert">{state.error}</p> : null}
    </form>
  );
}
