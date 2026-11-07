import Link from "next/link";
import type { Route } from "next";
import { FollowUpDone } from "@/components/admin/crm/follow-up-client";
import type { DueAction } from "@/lib/crm";
import { STAGE_LABEL } from "@/lib/crm-core";
import { CRM_HOME, type CrmScope } from "@/lib/crm-nav";

export const addDays = (isoDay: string, n: number) => {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const shortDay = (isoDay: string) => new Date(`${isoDay}T12:00:00Z`).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" });

/** When a follow-up falls relative to today (Rome dates). */
export function dueLabel(at: string, today: string): { text: string; tone: "late" | "today" | "soon" } {
  const day = at.slice(0, 10);
  if (day < today) return { text: "In ritardo", tone: "late" };
  if (day === today) return { text: "Oggi", tone: "today" };
  if (day === addDays(today, 1)) return { text: "Domani", tone: "soon" };
  return { text: shortDay(day), tone: "soon" };
}

/** Follow-up rows: done control, action, contact, owner (team view) and due chip. */
export function FollowUpRows({ items, today, showOwner }: { items: DueAction[]; today: string; showOwner: boolean }) {
  return (
    <ul className="crm-todo">
      {items.map((a) => {
        const due = dueLabel(a.nextActionAt, today);
        const label = a.nextAction || "Prossima azione da definire";
        return (
          <li key={a.id} className="crm-todo-row">
            <FollowUpDone id={a.id} seenAt={a.nextActionAt} label={`${label}, ${a.businessName}`} />
            <div className="crm-todo-text">
              <Link href={`${CRM_HOME}/${a.id}` as Route} className="crm-todo-title">{label}</Link>
              <span className="adm-muted">{a.businessName} · {STAGE_LABEL[a.stage]}{showOwner ? ` · ${a.ownerName ?? "Non assegnato"}` : ""}</span>
            </div>
            <span className="crm-due" data-tone={due.tone}>{due.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Le mie / Team" switch. Rendered only for people allowed to see the team (see followUpScope). */
export function ScopeSwitch({ base, scope }: { base: string; scope: CrmScope }) {
  return (
    <nav className="crm-scope" aria-label="Di chi">
      <Link href={base as Route} aria-current={scope === "mine" ? "true" : undefined}>Le mie</Link>
      <Link href={`${base}?ambito=team` as Route} aria-current={scope === "team" ? "true" : undefined}>Team</Link>
    </nav>
  );
}
