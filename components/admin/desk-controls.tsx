"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { saveDeskItem, changeDeskItem } from "@/app/admin/desk-actions";
import { useAdminLocale } from "@/components/admin/locale-provider";

export function DeskForm({ kind, item }: { kind: "task" | "note"; item?: { id: string; title: string; body: string; due: string } }) {
  const { t } = useAdminLocale();
  const [state, action, pending] = useActionState(saveDeskItem, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !item) form.current?.reset();
  }, [state, item]);
  return (
    <form ref={form} action={action} className="dk-form">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <label className="dk-field">
        <span>{kind === "task" ? t.desk.taskTitle : t.desk.noteTitle}</span>
        <input className="dk-input" name="title" required maxLength={180} defaultValue={item?.title} disabled={pending} />
      </label>
      {kind === "task" ? (
        <label className="dk-field">
          <span>{t.desk.dueOptional}</span>
          <input className="dk-input" name="due" type="date" defaultValue={item?.due} disabled={pending} />
        </label>
      ) : null}
      <label className="dk-field">
        <span>{kind === "task" ? t.desk.taskDetails : t.desk.noteBody}</span>
        <textarea className="dk-input" name="body" rows={3} maxLength={6000} defaultValue={item?.body} disabled={pending} />
      </label>
      <div className="dk-actions">
        <button className="dk-btn dk-btn-primary" disabled={pending}>
          {pending ? t.desk.saving : item ? t.desk.saveChanges : kind === "task" ? t.desk.addTask : t.desk.saveNote}
        </button>
        <span role="status" className={state.error ? "adm-error" : "dk-hint"}>{state.error ?? state.ok}</span>
      </div>
    </form>
  );
}

export function DeskAction({ id, operation, children }: { id: string; operation: string; children: React.ReactNode }) {
  const { t } = useAdminLocale();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="dk-btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const result = await changeDeskItem(id, operation);
              setError(result.error ?? "");
            } catch {
              setError(t.desk.actionFailed);
            }
          })
        }
      >
        {pending ? t.desk.saving : children}
      </button>
      {error ? <span role="alert" className="adm-error">{error}</span> : null}
    </>
  );
}
