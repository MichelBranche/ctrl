import { UserAvatar } from "@/components/admin/user-avatar";
import { Suspense } from "react";
import { ProfileForm } from "@/components/admin/profile-form";
import { db } from "@/lib/db";
import { ProfilePhoto } from "@/components/admin/profile-photo";
import { PasswordForm } from "@/components/admin/password-form";
import { requireSection } from "@/lib/admin";
import { AREA_LABEL, ROLE_LABEL } from "@/lib/team-types";

export default function SettingsPage() {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Caricamento…</p></main>}>
      <Body />
    </Suspense>
  );
}

const fmt = (ms: number) => new Date(ms).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" });

async function Body() {
  const admin = await requireSection("settings");
  const result = await db().execute({ sql: "SELECT contact_email, phone, website FROM admin_users WHERE id = ?", args: [admin.id] });
  const profile = result.rows[0];
  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Impostazioni</h1>
        </div>
      </header>
      <div className="adm-grid2">
        <section className="adm-panel">
          <h2 className="adm-h2">Il tuo profilo</h2>
          <p className="adm-muted">Lo staff vedrà questa foto sulle email che apri. Il nome compare passando il mouse sull’avatar.</p>
          <ProfilePhoto current={admin.avatarUrl} name={admin.name} />
          <ProfileForm name={admin.name} loginEmail={admin.email} contactEmail={String(profile?.contact_email ?? "")} phone={String(profile?.phone ?? "")} website={String(profile?.website ?? "")} />
        </section>
        <section className="adm-panel">
          <h2 className="adm-h2">Sessione</h2>
          {admin ? (
            <dl className="adm-dl">
              <dt>Account</dt>
              <dd className="adm-person"><UserAvatar name={admin.name} src={admin.avatarUrl} small />{admin.name} · {admin.email}</dd>
              <dt>Ruolo</dt>
              <dd>{ROLE_LABEL[admin.role]}{admin.area ? ` · ${AREA_LABEL[admin.area]}` : ""}</dd>
              <dt>Accesso</dt>
              <dd className="adm-num">{fmt(admin.issuedAt)}</dd>
              <dt>Scade</dt>
              <dd className="adm-num">{fmt(admin.expiresAt)}</dd>
              <dt>Cookie</dt>
              <dd>httpOnly, SameSite strict, 12 ore</dd>
            </dl>
          ) : null}
        </section>
        <section className="adm-panel">
          <h2 className="adm-h2">Cambia password</h2>
          <p className="adm-muted">La password è salvata solo come hash scrypt nel database. Cambiandola chiudi le altre sessioni aperte con questo account.</p>
          <PasswordForm />
        </section>
      </div>
    </main>
  );
}
