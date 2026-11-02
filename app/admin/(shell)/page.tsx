import Link from "next/link";
import { Suspense } from "react";
import { ActivityFeed, BreakdownPanels, CardsSkeleton, DeployPill, PanelSkeleton, RangeTabs, StatCards, TrafficPanel } from "@/components/admin/dashboard";
import { ShopOverview } from "@/components/admin/shop-overview";
import { requireSection } from "@/lib/admin";
import { canAccess } from "@/lib/team-types";
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
  const [me, sp] = await Promise.all([requireSection("overview"), searchParams]);
  const { email } = me;
  const kinds = (["post", "request", "subscriber", "order"] as const).filter((k) => canAccess(me, ({ post: "journal", request: "requests", subscriber: "newsletter", order: "shop" } as const)[k]));
  const range: Range = parseRange(sp.range);
  const counts = await content();
  return (
    <>
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Panoramica</h1>
          <p className="adm-muted">Accesso come {email}</p>
          {sp.negato ? <p className="adm-error" role="status">Questa sezione non rientra nella tua area.</p> : null}
        </div>
        <div className="adm-top-actions">
          <Suspense fallback={null}>
            <DeployPill />
          </Suspense>
          <RangeTabs base="/admin" range={range} />
          {canAccess(me, "journal") ? (
            <Link href="/admin/posts/new" className="adm-btn adm-btn-primary">
              Nuovo articolo
            </Link>
          ) : (
            <Link href="/admin/introiti#nuovo" className="adm-btn adm-btn-primary">
              Registra un lavoro
            </Link>
          )}
        </div>
      </header>
      <Suspense key={`c${range}`} fallback={<CardsSkeleton n={5} />}>
        <StatCards range={range} content={counts} />
      </Suspense>
      {canAccess(me, "shop") ? (
        <Suspense key={`s${range}`} fallback={<CardsSkeleton n={4} />}>
          <ShopOverview range={range} />
        </Suspense>
      ) : null}
      <div className="adm-dash">
        <Suspense key={`t${range}`} fallback={<PanelSkeleton />}>
          <TrafficPanel range={range} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <ActivityFeed kinds={me.role === "founder" ? undefined : [...kinds]} />
        </Suspense>
      </div>
      <Suspense key={`b${range}`} fallback={<PanelSkeleton h="14rem" />}>
        <BreakdownPanels range={range} limit={5} />
      </Suspense>
    </>
  );
}
