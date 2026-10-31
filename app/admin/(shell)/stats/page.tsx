import { Suspense } from "react";
import { BreakdownPanels, CardsSkeleton, PanelSkeleton, RangeTabs, StatCards, TrafficPanel } from "@/components/admin/dashboard";
import { requireAdmin } from "@/lib/admin";
import { parseRange } from "@/lib/dashboard-data";
import { vercelConfigured } from "@/lib/vercel";

export default function StatsPage({ searchParams }: PageProps<"/admin/stats">) {
  return (
    <main className="adm-main">
      <Suspense fallback={<><header className="adm-top"><h1 className="adm-h1">Statistiche</h1></header><CardsSkeleton /><PanelSkeleton h="24rem" /></>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin/stats">["searchParams"] }) {
  const [, sp] = await Promise.all([requireAdmin(), searchParams]);
  const range = parseRange(sp.range);
  return (
    <>
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Statistiche</h1>
          <p className="adm-muted">Vercel Web Analytics, senza cookie. Il piano Hobby conserva circa un mese di dati: i periodi più vecchi possono risultare vuoti.</p>
        </div>
        <RangeTabs base="/admin/stats" range={range} />
      </header>
      {!vercelConfigured() ? (
        <div className="adm-note">
          <p>Configura: aggiungi su Vercel le variabili VERCEL_API_TOKEN, VERCEL_PROJECT_ID e VERCEL_TEAM_ID, poi ridistribuisci.</p>
        </div>
      ) : (
        <>
          <Suspense key={`c${range}`} fallback={<CardsSkeleton />}>
            <StatCards range={range} />
          </Suspense>
          <Suspense key={`t${range}`} fallback={<PanelSkeleton h="24rem" />}>
            <TrafficPanel range={range} height={340} />
          </Suspense>
          <Suspense key={`b${range}`} fallback={<PanelSkeleton h="20rem" />}>
            <BreakdownPanels range={range} limit={10} />
          </Suspense>
        </>
      )}
    </>
  );
}
