"use client";
import Link from "next/link";
import { useAdminLocale } from "@/components/admin/locale-provider";

/** CRM data could not be read (database unreachable, timeout). The shell and the rest of the admin keep working. */
export default function CrmError({ retry }: { error: unknown; retry: () => void }) {
  const { t } = useAdminLocale();
  return (
    <main className="adm-main crm-main">
      <section className="crm-card-panel" role="alert">
        <h1 className="adm-h2">{t.crm.errorTitle}</h1>
        <p className="adm-muted">{t.crm.errorBody}</p>
        <div className="adm-row-actions">
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => retry()}>{t.crm.retry}</button>
          <Link className="adm-btn" href="/admin">{t.crm.backToOverview}</Link>
        </div>
      </section>
    </main>
  );
}
