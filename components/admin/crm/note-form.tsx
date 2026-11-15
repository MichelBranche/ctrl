"use client";
import { useActionState } from "react";
import { addNoteAction, type CrmState } from "@/app/admin/crm-actions";
import { useCrm } from "@/components/admin/crm/use-crm";

export function NoteForm({ contactId }: { contactId: string }) {
  const { t } = useCrm();
  const [state, action, pending] = useActionState<CrmState, FormData>(addNoteAction, {});
  return (
    <form action={action} className="adm-form">
      <input type="hidden" name="id" value={contactId} />
      <label className="adm-field"><span>{t.crm.newNote}</span><textarea className="adm-input" name="body" rows={3} maxLength={5000} required placeholder={t.crm.notePlaceholder} /></label>
      {state.error ? <p className="adm-error" role="alert">{state.error}</p> : null}
      <div className="adm-row-actions"><button className="adm-btn adm-btn-sm" disabled={pending}>{pending ? t.crm.saving : t.crm.addNote}</button></div>
    </form>
  );
}
