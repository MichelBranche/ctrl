import Link from "next/link";
import { Suspense } from "react";
import { ActivityFeed, BreakdownPanels, CardsSkeleton, DeployPill, PanelSkeleton, RangeTabs, StatCards, TrafficPanel } from "@/components/admin/dashboard";
import { requireAdmin } from "@/lib/admin";
import { parseRange, type Range } from "@/lib/dashboard-data";
import { db } from "@/lib/db";

export default function Overview({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="adm-main">
      <Suspense fallback={<OverviewSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <header className="adm-top">
        <h1 className="adm-h1">Panoramica</h1>
      </header>
      <CardsSkeleton n={5} />
      <PanelSkeleton />
    </>
  );
}

async function content() {
  try {
    const [c] = await db().batch(
      [
        `SELECT (SELECT COUNT(*) FROM posts WHERE published = 1) AS pub, (SELECT COUNT(*) FROM posts WHERE published = 0) AS draft,
          (SELECT COUNT(*) FROM contact_requests WHERE status = 'nuovo') AS req_new,
          (SELECT COUNT(*) FROM subscribers WHERE unsubscribed_at IS NULL) AS subs`,
      ],
      "read",
    );
    const r = c.rows[0];
    return { pub: Number(r.pub), draft: Number(r.draft), reqNew: Number(r.req_new), subs: Number(r.subs) };
  } catch {
    return null;
  }
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const [{ email }, sp] = await Promise.all([requireAdmin(), searchParams]);
  const range: Range = parseRange(sp.range);
  const counts = await content();
  return (
    <>
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Panoramica</h1>
          <p className="adm-muted">Accesso come {email}</p>
        </div>
        <div className="adm-top-actions">
          <Suspense fallback={null}>
            <DeployPill />
          </Suspense>
          <RangeTabs base="/admin" range={range} />
          <Link href="/admin/posts/new" className="adm-btn adm-btn-primary">
            Nuovo articolo
          </Link>
        </div>
      </header>
      <Suspense key={`c${range}`} fallback={<CardsSkeleton n={5} />}>
        <StatCards range={range} content={counts} />
      </Suspense>
      <div className="adm-dash">
        <Suspense key={`t${range}`} fallback={<PanelSkeleton />}>
          <TrafficPanel range={range} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <ActivityFeed />
        </Suspense>
      </div>
      <Suspense key={`b${range}`} fallback={<PanelSkeleton h="14rem" />}>
        <BreakdownPanels range={range} limit={5} />
      </Suspense>
    </>
  );
}
