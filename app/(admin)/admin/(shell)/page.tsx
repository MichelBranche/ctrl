import { Suspense } from "react";
import { CommandCenter } from "@/components/admin/command/center";
import { requireSection } from "@/lib/admin";
import { loadCommandCenter } from "@/lib/command-center";
import { commandFixturesOn } from "@/lib/command-fixtures";
import { parseRange } from "@/lib/dashboard-data";

export default function Overview({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

function OverviewSkeleton() {
  return (
    <main className="adm-main cc" aria-busy="true" aria-label="Caricamento della panoramica">
      <div className="cc-hero"><div className="adm-skel" style={{ height: "8rem", width: "min(100%, 28rem)" }} /></div>
      <div className="cc-kpis">
        {[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel cc-card" style={{ height: "8.6rem" }} />)}
      </div>
    </main>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const [me, sp] = await Promise.all([requireSection("overview"), searchParams]);
  const range = parseRange(sp.range);
  const empty = commandFixturesOn() && sp.stato === "vuoto";
  const model = await loadCommandCenter(me, range, Boolean(sp.negato), empty);
  return <CommandCenter model={model} />;
}
