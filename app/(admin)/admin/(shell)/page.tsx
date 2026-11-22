import "@/components/ds/admin-ui.css";
import "@/components/ds/status.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/overview.css";
import { Suspense } from "react";
import { CommandCenter } from "@/components/admin/command/center";
import { requireSection } from "@/lib/admin";
import { loadCommandCenter } from "@/lib/command-center";
import { commandFixturesOn } from "@/lib/command-fixtures";
import { parseRange } from "@/lib/dashboard-data";
import { getAdminCopy } from "@/lib/admin-locale";

export default function Overview({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function OverviewSkeleton() {
  const { t } = await getAdminCopy();
  return (
    <main className="ds-page rb ov" aria-busy="true" aria-label={t.command.loading}>
      <div className="ov-skel" style={{ minHeight: "7.5rem" }} />
      <div className="ov-skel" style={{ minHeight: "9rem" }} />
      <div className="ov-skel" style={{ minHeight: "20rem" }} />
    </main>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const [me, sp] = await Promise.all([requireSection("overview"), searchParams]);
  const range = parseRange(sp.range);
  const empty = commandFixturesOn() && sp.stato === "vuoto";
  const live = commandFixturesOn() && sp.stato === "reale";
  const model = await loadCommandCenter(me, range, Boolean(sp.negato), empty, live);
  return <CommandCenter model={model} />;
}
