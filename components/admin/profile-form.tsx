"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/admin/profile-actions";
import { useAdminLocale } from "@/components/admin/locale-provider";
import { interpolate } from "@/lib/admin-i18n";
import { SaveBar, SettingRow } from "@/components/admin/settings-ui";

export function ProfileForm({ name, lastName, contactEmail, phone, website, loginEmail }: { name: string; lastName: string; contactEmail: string; phone: string; website: string; loginEmail: string }) {
  const { t } = useAdminLocale();
  const [state, action, pending] = useActionState(saveProfile, {});
  return (
    <form action={action} className="st-form">
      <div className="st-rows">
        <SettingRow label={t.profile.firstName}><input className="st-input" name="name" autoComplete="given-name" defaultValue={name} required maxLength={100} disabled={pending} /></SettingRow>
        <SettingRow label={t.profile.lastName}><input className="st-input" name="lastName" autoComplete="family-name" defaultValue={lastName} maxLength={100} disabled={pending} /></SettingRow>
        <SettingRow label={t.profile.contactEmail} hint={interpolate(t.profile.emailHelp, { email: loginEmail })}>
          <input className="st-input" name="contactEmail" type="email" autoComplete="email" defaultValue={contactEmail} maxLength={254} disabled={pending} />
        </SettingRow>
        <SettingRow label={t.profile.phone} hint={t.profile.phoneHelp}>
          <input className="st-input" name="phone" type="tel" autoComplete="tel" defaultValue={phone} maxLength={40} disabled={pending} />
        </SettingRow>
        <SettingRow label={t.profile.website}><input className="st-input" name="website" type="url" autoComplete="url" placeholder="https://" defaultValue={website} maxLength={500} disabled={pending} /></SettingRow>
      </div>
      <SaveBar pending={pending} ok={state.ok} error={state.error} label={t.profile.save} pendingLabel={t.profile.saving} />
    </form>
  );
}
