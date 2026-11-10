import { Suspense } from "react";
import { AdminShell } from "@/components/admin/shell";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { allowedSections, canAccess, SECTION_HREF } from "@/lib/team-types";

export default function ShellLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="adm-boot" aria-busy="true" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const allowed = allowedSections(me).map((s) => SECTION_HREF[s]);
  let newRequests = 0;
  if (canAccess(me, "requests")) try {
    const r = await db().execute("SELECT COUNT(*) AS n FROM contact_requests WHERE status = 'nuovo'");
    newRequests = Number(r.rows[0]?.n ?? 0);
  } catch {
    // Badge is optional; the Richieste page shows the error state itself.
  }
  return (
    <AdminShell userId={me.id} email={me.email} name={me.name} avatarUrl={me.avatarUrl} allowed={allowed} badges={{ requests: newRequests }}>
      {children}
    </AdminShell>
  );
}
