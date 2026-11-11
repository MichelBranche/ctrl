"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { saveContactAction, type CrmState } from "@/app/admin/crm-actions";
import type { Contact } from "@/lib/crm";

export type OwnerOption = { id: string; name: string };

/** Create (no contact) or edit form. Dedupe errors link to the existing contact. */
export function ContactForm({ contact, owners }: { contact?: Contact; owners: OwnerOption[] }) {
  const [state, action, pending] = useActionState<CrmState, FormData>(saveContactAction, {});
  const c = contact;
  // The current responsible person stays selected even after leaving the team: saving never clears it, only an explicit choice does.
  const formerOwner = c?.ownerUserId && !owners.some((o) => o.id === c.ownerUserId) ? { id: c.ownerUserId, name: `${c.ownerName ?? "Account eliminato"} (${c.ownerActive === false ? "ex membro" : "senza accesso CRM"})` } : null;
  const f = (label: string, name: string, value: string | number | null | undefined, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="adm-field"><span>{label}</span><input className="adm-input" name={name} defaultValue={value ?? ""} {...extra} /></label>
  );
  return (
    <form action={action} className="adm-form">
      {c ? <><input type="hidden" name="id" value={c.id} /><input type="hidden" name="version" value={c.version} /></> : null}
      <div className="adm-grid2">
        {f("Attività o persona", "business_name", c?.businessName, { required: true, maxLength: 200 })}
        {f("Categoria", "type", c?.type, { maxLength: 80, placeholder: "Es. ristorante, studio legale" })}
        {f("Referente", "contact_name", c?.contactName, { maxLength: 120 })}
        {f("Email", "email", c?.email, { type: "email", maxLength: 200 })}
        {f("Telefono", "phone", c?.phone, { type: "tel", maxLength: 40 })}
        {f("Sito web", "website", c?.website, { maxLength: 300, placeholder: "esempio.it" })}
        {f("Indirizzo", "address", c?.address, { maxLength: 300 })}
        {f("Città", "city", c?.city, { maxLength: 100 })}
        {f("Regione", "region", c?.region, { maxLength: 100 })}
        {f("Valore (€)", "value_eur", c?.valueEur, { inputMode: "decimal", maxLength: 20 })}
        {f("Prossima azione", "next_action", c?.nextAction, { maxLength: 300, placeholder: "Es. richiamare per il preventivo" })}
        {f("Entro il", "next_action_at", c?.nextActionAt?.slice(0, 10), { type: "date" })}
        {f("Punteggio (0-100)", "score", c?.score, { type: "number", min: 0, max: 100 })}
        <label className="adm-field"><span>Responsabile</span>
          <select className="adm-input" name="owner_user_id" defaultValue={c?.ownerUserId ?? ""}>
            <option value="">{c ? "Nessuno" : "Io"}</option>
            {formerOwner ? <option value={formerOwner.id}>{formerOwner.name}</option> : null}
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
      </div>
      <label className="adm-field"><span>Note</span><textarea className="adm-input" name="notes" rows={3} maxLength={5000} defaultValue={c?.notes ?? ""} /></label>
      {state.error ? <p className="adm-error" role="alert">{state.error}{state.duplicateId ? <> <Link href={`/admin/crm/${state.duplicateId}` as Route}>Apri il contatto esistente</Link></> : null}</p> : null}
      {state.ok ? <p className="adm-ok" role="status">{state.ok}{!c && state.id ? <> <Link href={`/admin/crm/${state.id}` as Route}>Apri la scheda</Link></> : null}</p> : null}
      <div className="adm-row-actions"><button className="adm-btn adm-btn-primary" disabled={pending}>{pending ? "Salvo…" : c ? "Salva modifiche" : "Crea contatto"}</button></div>
    </form>
  );
}
