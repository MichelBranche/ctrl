"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
      <label className="rb-field">
        <span>{kind === "task" ? t.desk.taskTitle : t.desk.noteTitle}</span>
        <input name="title" required maxLength={180} defaultValue={item?.title} disabled={pending} />
      </label>
      {kind === "task" ? (
        <label className="rb-field">
          <span>{t.desk.dueOptional}</span>
          <input name="due" type="date" defaultValue={item?.due} disabled={pending} />
        </label>
      ) : null}
      <label className="rb-field">
        <span>{kind === "task" ? t.desk.taskDetails : t.desk.noteBody}</span>
        <textarea name="body" rows={3} maxLength={6000} defaultValue={item?.body} disabled={pending} />
      </label>
      <div className="dk-form-foot">
        <button className="rb-cta rb-cta-sm" disabled={pending}>
          {pending ? t.desk.saving : item ? t.desk.saveChanges : kind === "task" ? t.desk.addTask : t.desk.saveNote}
        </button>
        <span role="status" className={state.error ? "adm-error" : "dk-hint"}>{state.error ?? state.ok}</span>
      </div>
    </form>
  );
}

/** Header creation menus: new task (primary) and new note. Same form and server action as before. */
export function DeskNew() {
  const { t } = useAdminLocale();
  return (
    <div className="rb-head-actions dk-new">
      <details className="rb-pop dk-new-pop">
        <summary className="rb-btn"><Plus />{t.desk.newNote}</summary>
        <div className="rb-pop-panel"><p className="rb-pop-title">{t.desk.newNote}</p><DeskForm kind="note" /></div>
      </details>
      <details className="rb-pop dk-new-pop">
        <summary className="rb-cta"><Plus /><span>{t.desk.newTask}</span></summary>
        <div className="rb-pop-panel"><p className="rb-pop-title">{t.desk.newTask}</p><DeskForm kind="task" /></div>
      </details>
    </div>
  );
}

function Plus() {
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

export function DeskAction({ id, operation, children, icon, quiet = false, label }: {
  id: string; operation: string; children: React.ReactNode; icon?: React.ReactNode; quiet?: boolean; label?: string;
}) {
  const { t } = useAdminLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className={quiet ? "rb-btn rb-btn-quiet dk-act" : "rb-btn dk-act"}
        disabled={pending}
        aria-label={label}
        title={label}
        onClick={() =>
          start(async () => {
            try {
              const result = await changeDeskItem(id, operation);
              setError(result.error ?? "");
              router.refresh();
            } catch {
              setError(t.desk.actionFailed);
            }
          })
        }
      >
        {icon}{pending ? <span>{t.desk.saving}</span> : children}
      </button>
      {error ? <span role="alert" className="adm-error dk-row-error">{error}</span> : null}
    </>
  );
}
