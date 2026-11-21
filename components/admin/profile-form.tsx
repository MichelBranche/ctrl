"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/admin/profile-actions";
import { useAdminLocale } from "@/components/admin/locale-provider";
import { interpolate } from "@/lib/admin-i18n";

export function ProfileForm({ name, lastName, contactEmail, phone, website, loginEmail }: { name: string; lastName: string; contactEmail: string; phone: string; website: string; loginEmail: string }) {
  const { t } = useAdminLocale();
  const [state, action, pending] = useActionState(saveProfile, {});
  return <form action={action} className="adm-form">
    <label className="adm-field"><span>{t.profile.firstName}</span><input className="adm-input" name="name" autoComplete="given-name" defaultValue={name} required maxLength={100} disabled={pending} /></label>
    <label className="adm-field"><span>{t.profile.lastName}</span><input className="adm-input" name="lastName" autoComplete="family-name" defaultValue={lastName} maxLength={100} disabled={pending} /></label>
    <label className="adm-field"><span>{t.profile.contactEmail}</span><input className="adm-input" name="contactEmail" type="email" autoComplete="email" defaultValue={contactEmail} maxLength={254} disabled={pending} aria-describedby="profile-email-help" /></label>
    <p className="adm-muted" id="profile-email-help">{interpolate(t.profile.emailHelp, { email: loginEmail })}</p>
    <label className="adm-field"><span>{t.profile.phone}</span><input className="adm-input" name="phone" type="tel" autoComplete="tel" defaultValue={phone} maxLength={40} disabled={pending} aria-describedby="profile-phone-help" /></label>
    <p className="adm-muted" id="profile-phone-help">{t.profile.phoneHelp}</p>
    <label className="adm-field"><span>{t.profile.website}</span><input className="adm-input" name="website" type="url" autoComplete="url" placeholder="https://" defaultValue={website} maxLength={500} disabled={pending} /></label>
    <div className="adm-row-actions"><button className="adm-btn adm-btn-primary" disabled={pending}>{pending ? t.profile.saving : t.profile.save}</button><p role="status" className={state.error ? "adm-error" : "adm-ok"}>{state.error ?? state.ok ?? ""}</p></div>
  </form>;
}
