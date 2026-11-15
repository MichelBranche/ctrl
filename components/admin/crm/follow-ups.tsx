import Link from "next/link";
import type { Route } from "next";
import { FollowUpDone } from "@/components/admin/crm/follow-up-client";
import type { DueAction } from "@/lib/crm";
import { CRM_HOME, type CrmScope } from "@/lib/crm-nav";
import { adminCrmStageLabel, formatAdminDate, type AdminDict, type AdminLocale } from "@/lib/admin-i18n";

export const addDays = (isoDay: string, n: number) => {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** When a follow-up falls relative to today (Rome dates). */
export function dueLabel(at: string, today: string, lang: AdminLocale, t: AdminDict): { text: string; tone: "late" | "today" | "soon" } {
  const day = at.slice(0, 10);
  if (day < today) return { text: t.crm.overdue, tone: "late" };
  if (day === today) return { text: t.crm.oggi, tone: "today" };
  if (day === addDays(today, 1)) return { text: t.crm.tomorrow, tone: "soon" };
  return { text: formatAdminDate(`${day}T12:00:00Z`, lang, { timeZone: "Europe/Rome", day: "numeric", month: "short" }), tone: "soon" };
}

/** Follow-up rows: done control, action, contact, owner (team view) and due chip. */
export function FollowUpRows({ items, today, showOwner, lang, t }: { items: DueAction[]; today: string; showOwner: boolean; lang: AdminLocale; t: AdminDict }) {
  return (
    <ul className="crm-todo">
      {items.map((a) => {
        const due = dueLabel(a.nextActionAt, today, lang, t);
        const label = a.nextAction || t.crm.defineNextAction;
        return (
          <li key={a.id} className="crm-todo-row">
            <FollowUpDone id={a.id} seenAt={a.nextActionAt} label={`${label}, ${a.businessName}`} />
            <div className="crm-todo-text">
              <Link href={`${CRM_HOME}/${a.id}` as Route} className="crm-todo-title">{label}</Link>
              <span className="adm-muted">{a.businessName} · {adminCrmStageLabel(lang, a.stage)}{showOwner ? ` · ${a.ownerName ?? t.crm.unassigned}` : ""}</span>
            </div>
            <span className="crm-due" data-tone={due.tone}>{due.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Le mie / Team" switch. Rendered only for people allowed to see the team (see followUpScope). */
export function ScopeSwitch({ base, scope, t }: { base: string; scope: CrmScope; t: AdminDict }) {
  return (
    <nav className="crm-scope" aria-label={t.crm.whose}>
      <Link href={base as Route} aria-current={scope === "mine" ? "true" : undefined}>{t.crm.mineF}</Link>
      <Link href={`${base}?ambito=team` as Route} aria-current={scope === "team" ? "true" : undefined}>{t.crm.team}</Link>
    </nav>
  );
}
