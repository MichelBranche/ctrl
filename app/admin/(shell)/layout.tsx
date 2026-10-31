import { Suspense } from "react";
import { AdminShell } from "@/components/admin/shell";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export default function ShellLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="adm-boot" aria-busy="true" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();
  let newRequests = 0;
  try {
    const r = await db().execute("SELECT COUNT(*) AS n FROM contact_requests WHERE status = 'nuovo'");
    newRequests = Number(r.rows[0]?.n ?? 0);
  } catch {
    // Badge is optional; the Richieste page shows the error state itself.
  }
  return (
    <AdminShell email={email} badges={{ requests: newRequests }}>
      {children}
    </AdminShell>
  );
}
