import "@/components/ds/admin-ui.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/settings.css";
import { Suspense } from "react";
import { UserAvatar } from "@/components/admin/user-avatar";
import { AdminLangSwitch } from "@/components/admin/admin-lang-switch";
import { ProfileForm } from "@/components/admin/profile-form";
import { db } from "@/lib/db";
import { ProfilePhoto } from "@/components/admin/profile-photo";
import { PasswordForm } from "@/components/admin/password-form";
import { TwoFactorDisable, TwoFactorPanel } from "@/components/admin/two-factor";
import { SettingsNav } from "@/components/admin/settings-ui";
import { twoFactorStatus } from "@/lib/two-factor";
import { canDisableTwoFactor, twoFactorRequired } from "@/lib/two-factor-policy";
import { requireSection } from "@/lib/admin";
import { canAccess } from "@/lib/team-types";
import { SESSION_HOURS } from "@/lib/session-lifetime";
import { getAdminCopy } from "@/lib/admin-locale";
import { settingsNav } from "@/lib/settings-nav";
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
  return (
    <main className="ds-page rb st" aria-busy="true" aria-label={t.settings.loading}>
      <div className="st-layout"><div className="st-skel st-skel-nav" /><div className="st-body"><div className="st-skel" style={{ height: "5rem" }} /><div className="st-skel" style={{ height: "24rem" }} /></div></div>
    </main>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "quiet"; children: React.ReactNode }) {
  return <span className="st-badge" data-tone={tone}><i aria-hidden="true" />{children}</span>;
}

async function Body() {
  const { lang, t } = await getAdminCopy();
  const admin = await requireSection("settings");
  const result = await db().execute({ sql: "SELECT last_name, contact_email, phone, website FROM admin_users WHERE id = ?", args: [admin.id] });
  const profile = result.rows[0];
  const twoFactor = await twoFactorStatus(admin.id);
  const required = twoFactorRequired(admin.roles);
  const canDisable = canDisableTwoFactor(admin.roles);
  const dangerZone = twoFactor.enabled && canDisable;
  const remembered = admin.expiresAt - admin.issuedAt > SESSION_HOURS * 3_600_000;
  return (
    <main className="ds-page rb st">
      <div className="st-layout">
        <SettingsNav items={settingsNav(t, { social: canAccess(admin, "social"), onMain: true })} current="profilo" label={t.settings.navLabel} />
        <div className="st-body">
          <header className="st-head">
            <p className="rb-kicker">{t.settings.kicker}</p>
            <h1>{t.settings.title}</h1>
            <p className="st-lead">{t.settings.lead}</p>
          </header>

          <section id="profilo" className="st-card" aria-labelledby="st-profile-h">
            <div className="st-card-head">
              <div><h2 id="st-profile-h">{t.settings.profileTitle}</h2><p>{t.settings.profileLead}</p></div>
            </div>
            <ProfilePhoto current={admin.avatarUrl} name={admin.name} />
            <ProfileForm name={admin.name} lastName={String(profile?.last_name ?? "")} loginEmail={admin.email} contactEmail={String(profile?.contact_email ?? "")} phone={String(profile?.phone ?? "")} website={String(profile?.website ?? "")} />
          </section>

          <section id="lingua" className="st-card" aria-labelledby="st-lang-h">
            <div className="st-card-head">
              <div><h2 id="st-lang-h">{t.settings.languageTitle}</h2><p>{t.settings.languageLead}</p></div>
            </div>
            <div className="st-rows">
              <div className="st-row">
                <span className="st-row-label"><b>{t.settings.languageLabel}</b><small>{t.settings.languageSaved}</small></span>
                <span className="st-row-control st-lang"><AdminLangSwitch variant="settings" /></span>
              </div>
            </div>
          </section>

          <section id="sicurezza" className="st-card" aria-labelledby="st-pass-h">
            <div className="st-card-head">
              <div><h2 id="st-pass-h">{t.settings.passwordTitle}</h2><p>{t.settings.passwordLead}</p></div>
            </div>
            <PasswordForm />
          </section>

          <section className="st-card" aria-labelledby="st-2fa-h">
            <div className="st-card-head">
              <div>
                <h2 id="st-2fa-h">{t.settings.twoFactorTitle}</h2>
                <p>{interpolate(t.settings.twoFactorLead, { requirement: required ? t.settings.twoFactorRequired : t.settings.twoFactorOptional })}</p>
              </div>
              <span className="st-card-badges">
                {required ? <Badge tone="quiet">{t.settings.statusRequired}</Badge> : null}
                {twoFactor.enabled ? <Badge tone="ok">{t.settings.statusActive}</Badge> : <Badge tone={required ? "warn" : "quiet"}>{t.settings.statusInactive}</Badge>}
              </span>
            </div>
            <div className="st-card-body st-2fa">
              {dangerZone
                ? <p className="st-note">{interpolate(t.twoFactor.onHint, { status: t.twoFactor.statusOn, n: twoFactor.recoveryLeft })}</p>
                : <TwoFactorPanel enabled={twoFactor.enabled} recoveryLeft={twoFactor.recoveryLeft} canDisable={canDisable} />}
            </div>
          </section>

          <section id="sessione" className="st-card" aria-labelledby="st-session-h">
            <div className="st-card-head">
              <div><h2 id="st-session-h">{t.settings.sessionTitle}</h2><p>{t.settings.sessionLead}</p></div>
              <Badge tone="ok">{t.settings.statusActive}</Badge>
            </div>
            <dl className="st-rows st-dl">
              <div className="st-row"><dt className="st-row-label"><b>{t.settings.account}</b></dt><dd className="st-row-control st-person"><UserAvatar name={admin.name} src={admin.avatarUrl} small /><span><b>{admin.name}</b><small>{admin.email}</small></span></dd></div>
              <div className="st-row"><dt className="st-row-label"><b>{t.settings.role}</b></dt><dd className="st-row-control">{admin.roles.map((r) => adminRoleLabel(lang, r)).join(", ")}{admin.area ? ` · ${adminAreaLabel(lang, admin.area)}` : ""}</dd></div>
              <div className="st-row"><dt className="st-row-label"><b>{t.settings.signedIn}</b></dt><dd className="st-row-control st-num">{formatAdminDateTime(admin.issuedAt, lang)}</dd></div>
              <div className="st-row"><dt className="st-row-label"><b>{t.settings.expires}</b></dt><dd className="st-row-control st-num">{formatAdminDateTime(admin.expiresAt, lang)}</dd></div>
              <div className="st-row"><dt className="st-row-label"><b>{t.settings.cookie}</b></dt><dd className="st-row-control">{remembered ? t.settings.cookieRemember : t.settings.cookieSession}</dd></div>
            </dl>
          </section>

          {dangerZone ? (
            <section className="st-card st-danger" aria-labelledby="st-danger-h">
              <div className="st-card-head">
                <div><h2 id="st-danger-h">{t.settings.dangerTitle}</h2><p>{t.settings.dangerLead}</p></div>
              </div>
              <div className="st-card-body st-2fa"><TwoFactorDisable recoveryLeft={twoFactor.recoveryLeft} /></div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
