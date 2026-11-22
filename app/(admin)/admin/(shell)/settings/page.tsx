import { UserAvatar } from "@/components/admin/user-avatar";
import Link from "next/link";
import { Suspense } from "react";
import { AdminLangSwitch } from "@/components/admin/admin-lang-switch";
import { ProfileForm } from "@/components/admin/profile-form";
import { db } from "@/lib/db";
import { ProfilePhoto } from "@/components/admin/profile-photo";
import { PasswordForm } from "@/components/admin/password-form";
import { TwoFactorPanel } from "@/components/admin/two-factor";
import { twoFactorStatus } from "@/lib/two-factor";
import { canDisableTwoFactor, twoFactorRequired } from "@/lib/two-factor-policy";
import { requireSection } from "@/lib/admin";
import { canAccess } from "@/lib/team-types";
import { SESSION_HOURS } from "@/lib/session-lifetime";
import { getAdminCopy } from "@/lib/admin-locale";
import { adminAreaLabel, adminRoleLabel, formatAdminDateTime, interpolate } from "@/lib/admin-i18n";

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <Body />
    </Suspense>
  );
}

async function SettingsFallback() {
  const { t } = await getAdminCopy();
  return <main className="adm-main" aria-busy="true"><p className="adm-muted">{t.settings.loading}</p></main>;
}

async function Body() {
  const { lang, t } = await getAdminCopy();
  const admin = await requireSection("settings");
  const result = await db().execute({ sql: "SELECT last_name, contact_email, phone, website FROM admin_users WHERE id = ?", args: [admin.id] });
  const profile = result.rows[0];
  const twoFactor = await twoFactorStatus(admin.id);
  const required = twoFactorRequired(admin.roles);
  return (
    <main className="adm-main">
      <header className="adm-top">
        <div className="adm-settings-lang">
          <h1 className="adm-h1">{t.settings.title}</h1>
          <AdminLangSwitch variant="settings" />
        </div>
      </header>
      <div className="adm-grid2">
        <section className="adm-panel">
          <h2 className="adm-h2">{t.settings.languageTitle}</h2>
          <p className="adm-muted">{t.settings.languageLead}</p>
        </section>
        <section className="adm-panel">
          <h2 className="adm-h2">{t.settings.profileTitle}</h2>
          <p className="adm-muted">{t.settings.profileLead}</p>
          <ProfilePhoto current={admin.avatarUrl} name={admin.name} />
          <ProfileForm name={admin.name} lastName={String(profile?.last_name ?? "")} loginEmail={admin.email} contactEmail={String(profile?.contact_email ?? "")} phone={String(profile?.phone ?? "")} website={String(profile?.website ?? "")} />
        </section>
        <section className="adm-panel">
          <h2 className="adm-h2">{t.settings.sessionTitle}</h2>
          {admin ? (
            <dl className="adm-dl">
              <dt>{t.settings.account}</dt>
              <dd className="adm-person"><UserAvatar name={admin.name} src={admin.avatarUrl} small />{admin.name} · {admin.email}</dd>
              <dt>{t.settings.role}</dt>
              <dd>{admin.roles.map((r) => adminRoleLabel(lang, r)).join(", ")}{admin.area ? ` · ${adminAreaLabel(lang, admin.area)}` : ""}</dd>
              <dt>{t.settings.signedIn}</dt>
              <dd className="adm-num">{formatAdminDateTime(admin.issuedAt, lang)}</dd>
              <dt>{t.settings.expires}</dt>
              <dd className="adm-num">{formatAdminDateTime(admin.expiresAt, lang)}</dd>
              <dt>{t.settings.cookie}</dt>
              <dd>{admin.expiresAt - admin.issuedAt > SESSION_HOURS * 3_600_000 ? t.settings.cookieRemember : t.settings.cookieSession}</dd>
            </dl>
          ) : null}
        </section>
        <section className="adm-panel">
          <h2 className="adm-h2">{t.settings.passwordTitle}</h2>
          <p className="adm-muted">{t.settings.passwordLead}</p>
          <PasswordForm />
        </section>
        <section className="adm-panel">
          <h2 className="adm-h2">{t.settings.twoFactorTitle}</h2>
          <p className="adm-muted">
            {interpolate(t.settings.twoFactorLead, { requirement: required ? t.settings.twoFactorRequired : t.settings.twoFactorOptional })}
          </p>
          <TwoFactorPanel enabled={twoFactor.enabled} recoveryLeft={twoFactor.recoveryLeft} canDisable={canDisableTwoFactor(admin.roles)} />
        </section>
        {canAccess(admin, "social") ? (
          <section className="adm-panel">
            <h2 className="adm-h2">{t.settings.siteTitle}</h2>
            <p className="adm-muted">{t.settings.siteLead}</p>
            <Link href="/admin/settings/sito" className="adm-btn">{t.settings.siteOpen}</Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}
