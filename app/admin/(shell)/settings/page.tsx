import { Suspense } from "react";
import { PasswordForm } from "@/components/admin/password-form";
import { getAdmin, passwordSource, requireAdmin } from "@/lib/admin";

export default function SettingsPage() {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Caricamento…</p></main>}>
      <Body />
    </Suspense>
  );
}

const fmt = (ms: number) => new Date(ms).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" });

async function Body() {
  await requireAdmin();
  const admin = await getAdmin();
  let source: "dashboard" | "env" | null = null;
  try {
    source = await passwordSource();
  } catch {
    source = null;
  }
  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Impostazioni</h1>
        </div>
      </header>
      <div className="adm-grid2">
        <section className="adm-panel">
          <h2 className="adm-h2">Sessione</h2>
          {admin ? (
            <dl className="adm-dl">
              <dt>Account</dt>
              <dd>{admin.email}</dd>
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
          <p className="adm-muted">
            {source === "dashboard"
              ? "La password attuale è stata impostata da qui ed è salvata (come hash scrypt) nel database."
              : source === "env"
                ? "La password attuale viene da ADMIN_PASSWORD_HASH. Cambiandola qui, l'hash salvato nel database avrà la precedenza."
                : "Impossibile leggere l'origine della password."}
          </p>
          <PasswordForm />
        </section>
      </div>
    </main>
  );
}
