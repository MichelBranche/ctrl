import "@/components/ds/admin-ui.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/site-content.css";
import { TeamEditor } from "@/components/admin/site-content/team-editor";
import { requireSection } from "@/lib/admin";
import { getAdminCopy } from "@/lib/admin-locale";
import { dbConfigured } from "@/lib/db";
import { getSiteTeamAdmin } from "@/lib/site-team";
import Link from "next/link";

export default async function ContenutiPage() {
  await requireSection("siteContent");
  const { t } = await getAdminCopy();
  const copy = t.siteContent;
  let members: Awaited<ReturnType<typeof getSiteTeamAdmin>> = [];
  let dbOk = dbConfigured;
  if (dbConfigured) {
    try {
      members = await getSiteTeamAdmin();
    } catch {
      dbOk = false;
    }
  }
  return (
    <main className="ds-page rb sc">
      <header className="rb-head">
        <div className="rb-head-row">
          <div className="rb-head-title">
            <p className="rb-kicker">{copy.kicker}</p>
            <h1>{copy.title}</h1>
            <p className="sc-lead">{copy.lead}</p>
          </div>
          <div className="rb-head-actions">
            <a className="rb-btn" href="/team" target="_blank" rel="noopener noreferrer">{copy.openTeam}</a>
          </div>
        </div>
        <nav className="rb-segs sc-tabs" aria-label={copy.title}>
          <Link href="/admin/sito/contenuti" aria-current="page">{copy.tabTeam}</Link>
        </nav>
      </header>
      <TeamEditor members={members} dbOk={dbOk} />
    </main>
  );
}
