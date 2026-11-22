import "@/components/ds/admin-ui.css";
import "@/components/ds/desk.css";
import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { requireSection } from "@/lib/admin";
import { canAccess, isFounder } from "@/lib/team-types";
import { dueActions, type DueAction } from "@/lib/crm";
import { STAGE_LABEL } from "@/lib/crm-core";
import { ensureDeskSchema, ensureEmailSchema } from "@/lib/migrate";
import { db } from "@/lib/db";
import { DeskForm, DeskAction } from "@/components/admin/desk-controls";
import { MAIL_STATUSES, isMailStatus } from "@/lib/mail/workflow-types";
import { ArrowUpRight } from "@/components/ds/arrow-up-right";
import { DsMetricCard } from "@/components/ds/metric-card";
import { getAdminCopy } from "@/lib/admin-locale";
import { formatAdminDate, interpolate, type AdminDict } from "@/lib/admin-i18n";

export default function DeskPage() {
  return (
    <Suspense fallback={<DeskSkeleton />}>
      <Body />
    </Suspense>
  );
}

async function DeskSkeleton() {
  const { t } = await getAdminCopy();
  return (
    <main className="ds-page dk" aria-busy="true" aria-label={t.desk.loading}>
      <div className="ds-head dk-skel" style={{ minHeight: "7.5rem" }} />
      <div className="dk-kpis">
        {[0, 1, 2].map((i) => <div key={i} className="dk-skel" style={{ height: "6.5rem" }} />)}
      </div>
    </main>
  );
}

function dueLabel(due: string, today: string, done: boolean, lang: "it" | "en", t: AdminDict) {
  const formatted = formatAdminDate(`${due}T12:00:00Z`, lang, { day: "numeric", month: "short", year: "numeric" });
  if (due < today && !done) return { text: `${t.desk.overdue} · ${formatted}`, overdue: true };
  if (due === today && !done) return { text: `${t.desk.today} · ${formatted}`, overdue: false };
  return { text: formatted, overdue: false };
}

async function Body() {
  const [me, { lang, t }] = await Promise.all([requireSection("desk"), getAdminCopy()]);
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
  const tasks = items.rows.filter((row) => row.kind === "task");
  const notes = items.rows.filter((row) => row.kind === "note");
  const openTasks = tasks.filter((row) => !row.done);
  const doneTasks = tasks.filter((row) => row.done);
  const openNotes = notes.filter((row) => !row.done);
  const archivedNotes = notes.filter((row) => row.done);
  const dueToday = openTasks.filter((row) => row.due && String(row.due) <= today).length;
  const activeEmails = mail.rows.filter((row) => row.status !== "done");
  const doneEmails = mail.rows.filter((row) => row.status === "done");

  const renderItem = (row: (typeof items.rows)[number]) => {
    const task = row.kind === "task";
    const done = Number(row.done) === 1;
    const due = row.due ? String(row.due) : "";
    const when = due ? dueLabel(due, today, done, lang, t) : null;
    return (
      <li key={String(row.id)} className="dk-item" data-done={done || undefined}>
        <div className="dk-item-head">
          <strong>{row.pinned && !task ? "★ " : ""}{String(row.title)}</strong>
          {when ? <span className="dk-due" data-overdue={when.overdue || undefined}>{when.text}</span> : null}
        </div>
        {row.body ? <p className="dk-body">{String(row.body)}</p> : null}
        <div className="dk-actions">
          <DeskAction id={String(row.id)} operation={task ? (done ? "reopen" : "done") : done ? "restore" : "archive"}>
            {task ? (done ? t.desk.reopen : t.desk.complete) : done ? t.desk.restore : t.desk.archive}
          </DeskAction>
          {!task && !done ? (
            <DeskAction id={String(row.id)} operation={row.pinned ? "unpin" : "pin"}>
              {row.pinned ? t.desk.unpin : t.desk.pin}
            </DeskAction>
          ) : null}
        </div>
        <details className="dk-details dk-fold">
          <summary>{t.desk.edit}</summary>
          <DeskForm kind={task ? "task" : "note"} item={{ id: String(row.id), title: String(row.title), body: String(row.body), due }} />
        </details>
      </li>
    );
  };

  const renderMail = (row: (typeof mail.rows)[number]) => (
    <li key={String(row.message_key)} className="dk-item">
      <Link className="dk-link" href={(`/admin/desk/email?key=${row.message_key}`) as Route}>
        {String(row.subject || t.desk.claimedMail)}
      </Link>
      <div className="dk-item-head">
        <span className="dk-hint">{String(row.sender || t.desk.missingRef)}</span>
        <span className="dk-status" data-status={String(row.status)}>
          {isMailStatus(row.status) ? MAIL_STATUSES[row.status] : MAIL_STATUSES.todo}
        </span>
      </div>
    </li>
  );

  return (
    <main className="ds-page dk">
      <header className="ds-head">
        <p className="ds-kicker">{t.desk.kicker}</p>
        <h1 className="ds-title">{t.desk.title}</h1>
        <p className="ds-lead">{interpolate(t.desk.lead, { name: me.name })}</p>
      </header>

      <section className="dk-kpis" aria-label={t.desk.summary}>
        <DsMetricCard label={t.desk.dueToday} value={dueToday} />
        <DsMetricCard label={t.desk.openTasks} value={openTasks.length} />
        {emailAccess ? <DsMetricCard label={t.desk.emailsFollow} value={activeEmails.length} /> : null}
      </section>

      <div className="dk-grid">
        <section className="ds-card" aria-labelledby="dk-tasks">
          <div className="ds-card-head">
            <h2 id="dk-tasks">{t.desk.tasksTitle}</h2>
            <span className="dk-hint">{t.desk.onlyYou}</span>
          </div>
          <details className="dk-details">
            <summary>{t.desk.newTask}</summary>
            <DeskForm kind="task" />
          </details>
          <ul className="dk-list">{openTasks.map(renderItem)}</ul>
          {!openTasks.length ? <p className="dk-empty">{t.desk.tasksEmpty}</p> : null}
          {doneTasks.length ? (
            <details className="dk-details dk-fold">
              <summary>{interpolate(t.desk.completed, { n: doneTasks.length })}</summary>
              <ul className="dk-list">{doneTasks.map(renderItem)}</ul>
            </details>
          ) : null}
        </section>

        <section className="ds-card" aria-labelledby="dk-mail">
          <div className="ds-card-head">
            <h2 id="dk-mail">{t.desk.emailsTitle}</h2>
            {emailAccess ? (
              <Link href="/admin/email" className="dk-more">
                {t.desk.openInbox}
                <ArrowUpRight className="dk-arrow" />
              </Link>
            ) : null}
          </div>
          {!emailAccess ? (
            <p className="dk-empty">{t.desk.noEmailAccess}</p>
          ) : (
            <>
              <ul className="dk-list">{activeEmails.map(renderMail)}</ul>
              {!activeEmails.length ? <p className="dk-empty">{t.desk.emailsEmpty}</p> : null}
              {doneEmails.length ? (
                <details className="dk-details dk-fold">
                  <summary>{interpolate(t.desk.emailsDone, { n: doneEmails.length })}</summary>
                  <ul className="dk-list">{doneEmails.map(renderMail)}</ul>
                </details>
              ) : null}
            </>
          )}
        </section>

        {crmAccess ? (
          <section className="ds-card dk-wide" aria-labelledby="dk-crm">
            <div className="ds-card-head">
              <h2 id="dk-crm">{t.desk.crmTitle}</h2>
              <Link href={"/admin/crm/pipeline" as Route} className="dk-more">
                {t.desk.openPipeline}
                <ArrowUpRight className="dk-arrow" />
              </Link>
            </div>
            <ul className="dk-list">
              {crmDue.map((a) => (
                <li key={a.id} className="dk-item">
                  <Link className="dk-link" href={`/admin/crm/${a.id}` as Route}>{a.businessName}</Link>
                  <div className="dk-item-head">
                    <span className="dk-hint">
                      {a.nextAction || t.desk.nextActionFallback}
                      {founder && a.ownerName ? ` · ${a.ownerName}` : ""}
                    </span>
                    <span className="dk-due" data-overdue={a.nextActionAt < today || undefined}>
                      {a.nextActionAt < today ? t.desk.overdue : t.desk.today} · {STAGE_LABEL[a.stage]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {!crmDue.length ? <p className="dk-empty">{t.desk.crmEmpty}</p> : null}
          </section>
        ) : null}

        <section className="ds-card dk-wide" aria-labelledby="dk-notes">
          <div className="ds-card-head">
            <h2 id="dk-notes">{t.desk.notesTitle}</h2>
            <span className="dk-hint">{t.desk.notesHint}</span>
          </div>
          <details className="dk-details">
            <summary>{t.desk.newNote}</summary>
            <DeskForm kind="note" />
          </details>
          <ul className="dk-list">{openNotes.map(renderItem)}</ul>
          {!openNotes.length ? <p className="dk-empty">{t.desk.notesEmpty}</p> : null}
          {archivedNotes.length ? (
            <details className="dk-details dk-fold">
              <summary>{interpolate(t.desk.archived, { n: archivedNotes.length })}</summary>
              <ul className="dk-list">{archivedNotes.map(renderItem)}</ul>
            </details>
          ) : null}
        </section>
      </div>
    </main>
  );
}
