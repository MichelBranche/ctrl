import "@/components/ds/admin-ui.css";
import "@/components/ds/status.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/desk.css";
import { Suspense } from "react";
import Link from "next/link";
import { requireSection } from "@/lib/admin";
import { canAccess, isFounder } from "@/lib/team-types";
import { dueActions, type DueAction } from "@/lib/crm";
import { STAGE_LABEL } from "@/lib/crm-core";
import { ensureDeskSchema, ensureEmailSchema } from "@/lib/migrate";
import { db } from "@/lib/db";
import { DeskNew } from "@/components/admin/desk-controls";
import { DeskBoard, type DeskRow } from "@/components/admin/desk-board";
import { deskQuery } from "@/lib/desk-query";
import { MAIL_STATUSES, isMailStatus } from "@/lib/mail/workflow-types";
import { getAdminCopy } from "@/lib/admin-locale";
import { interpolate } from "@/lib/admin-i18n";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function DeskPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<DeskSkeleton />}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function DeskSkeleton() {
  const { t } = await getAdminCopy();
  return (
    <main className="ds-page rb dk" aria-busy="true" aria-label={t.desk.loading}>
      <div className="dk-skel" style={{ minHeight: "7.5rem" }} />
      <div className="dk-skel" style={{ minHeight: "6.5rem" }} />
      <div className="dk-skel" style={{ minHeight: "22rem" }} />
    </main>
  );
}

async function Body({ searchParams }: { searchParams: Search }) {
  const [me, { t }, params] = await Promise.all([requireSection("desk"), getAdminCopy(), searchParams]);
  await Promise.all([ensureDeskSchema(), ensureEmailSchema()]);
  const emailAccess = canAccess(me, "email");
  const [items, mail] = await Promise.all([
    db().execute({ sql: "SELECT id,kind,title,body,due,done,pinned FROM desk_items WHERE user_id=? ORDER BY done,pinned DESC,due IS NULL,due,created_at DESC", args: [me.id] }),
    emailAccess
      ? db().execute({
          sql: `SELECT c.message_key,r.subject,r.sender,COALESCE(w.status,'todo') AS status FROM email_claims c LEFT JOIN email_references r ON r.message_key=c.message_key LEFT JOIN email_workflow w ON w.message_key=c.message_key WHERE c.user_id=?${isFounder(me) ? "" : " AND COALESCE(r.mailbox,'hello')='hello'"} ORDER BY c.claimed_at DESC`,
          args: [me.id],
        })
      : Promise.resolve({ rows: [] }),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  // CRM follow-ups due today or overdue: your own, or everyone's for founders. Never breaks the desk.
  const crmAccess = canAccess(me, "crm");
  const founder = isFounder(me);
  const crmDue: DueAction[] = crmAccess ? await dueActions(founder ? null : me.id, today).catch(() => []) : [];

  const rows: DeskRow[] = [
    ...items.rows.map((row): DeskRow => row.kind === "task"
      ? { kind: "task", id: String(row.id), title: String(row.title), body: String(row.body ?? ""), due: row.due ? String(row.due) : null, done: Number(row.done) === 1 }
      : { kind: "note", id: String(row.id), title: String(row.title), body: String(row.body ?? ""), done: Number(row.done) === 1, pinned: Number(row.pinned) === 1 }),
    ...mail.rows.map((row): DeskRow => ({
      kind: "mail", id: String(row.message_key), title: String(row.subject || t.desk.claimedMail), sender: String(row.sender || t.desk.missingRef),
      status: isMailStatus(row.status) ? row.status : "todo", statusLabel: isMailStatus(row.status) ? MAIL_STATUSES[row.status] : MAIL_STATUSES.todo,
      href: `/admin/desk/email?key=${row.message_key}`,
    })),
    ...crmDue.map((a): DeskRow => ({
      kind: "crm", id: a.id, title: a.businessName, next: a.nextAction || t.desk.nextActionFallback, due: a.nextActionAt.slice(0, 10),
      stage: a.stage, stageLabel: STAGE_LABEL[a.stage], owner: founder ? a.ownerName : null, href: `/admin/crm/${a.id}`,
    })),
  ];
  const open = rows.filter((r) => (r.kind === "mail" ? r.status !== "done" : r.kind === "crm" ? true : !r.done)).length;

  return (
    <main className="ds-page rb dk">
      <div className="rb-main">
        <header className="rb-head dk-head">
          <div className="rb-head-row">
            <div className="rb-head-title">
              <p className="rb-kicker">{t.desk.kicker}</p>
              <h1>{t.desk.title} <span className="rb-count">{interpolate(t.desk.countLabel, { n: open })}</span></h1>
              <p className="dk-lead">{interpolate(t.desk.lead, { name: me.name })}</p>
            </div>
            <div className="rb-head-actions">
              {emailAccess ? <Link className="rb-btn" href="/admin/desk/inviate">{t.desk.sentHistory}</Link> : null}
              <DeskNew />
            </div>
          </div>
        </header>
        <DeskBoard rows={rows} today={today} emailAccess={emailAccess} crmAccess={crmAccess} initial={deskQuery(params)} />
      </div>
    </main>
  );
}
