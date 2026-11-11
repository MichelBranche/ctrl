"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/admin/profile-actions";

export function ProfileForm({ name, lastName, contactEmail, phone, website, loginEmail }: { name: string; lastName: string; contactEmail: string; phone: string; website: string; loginEmail: string }) {
  const [state, action, pending] = useActionState(saveProfile, {});
  return <form action={action} className="adm-form">
    <label className="adm-field"><span>Nome</span><input className="adm-input" name="name" autoComplete="given-name" defaultValue={name} required maxLength={100} disabled={pending} /></label>
    <label className="adm-field"><span>Cognome</span><input className="adm-input" name="lastName" autoComplete="family-name" defaultValue={lastName} maxLength={100} disabled={pending} /></label>
    <label className="adm-field"><span>Email di contatto</span><input className="adm-input" name="contactEmail" type="email" autoComplete="email" defaultValue={contactEmail} maxLength={254} disabled={pending} aria-describedby="profile-email-help" /></label>
    <p className="adm-muted" id="profile-email-help">Per accedere continui a usare {loginEmail}. L’email di contatto è facoltativa.</p>
    <label className="adm-field"><span>Telefono</span><input className="adm-input" name="phone" type="tel" autoComplete="tel" defaultValue={phone} maxLength={40} disabled={pending} /></label>
    <label className="adm-field"><span>Sito o profilo professionale</span><input className="adm-input" name="website" type="url" autoComplete="url" placeholder="https://" defaultValue={website} maxLength={500} disabled={pending} /></label>
    <div className="adm-row-actions"><button className="adm-btn adm-btn-primary" disabled={pending}>{pending ? "Salvataggio…" : "Salva profilo"}</button><p role="status" className={state.error ? "adm-error" : "adm-ok"}>{state.error ?? state.ok ?? ""}</p></div>
  </form>;
}
