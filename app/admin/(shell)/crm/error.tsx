"use client";
import Link from "next/link";

/** CRM data could not be read (database unreachable, timeout). The shell and the rest of the admin keep working. */
export default function CrmError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="adm-main crm-main">
      <section className="crm-card-panel" role="alert">
        <h1 className="adm-h2">CRM non disponibile in questo momento</h1>
        <p className="adm-muted">I dati non si sono caricati. Riprova tra poco: niente è stato modificato.</p>
        <div className="adm-row-actions">
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => retry()}>Riprova</button>
          <Link className="adm-btn" href="/admin">Torna alla panoramica</Link>
        </div>
      </section>
    </main>
  );
}
