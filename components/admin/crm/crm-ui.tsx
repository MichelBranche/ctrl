import Link from "next/link";
import type { Route } from "next";

export const eur = (v: number | null) => (v === null ? "" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));
export const day = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", year: "numeric" }) : "");
export const romeToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const TABS = [["/admin/crm", "Rubrica"], ["/admin/crm/pipeline", "Pipeline"], ["/admin/crm/radar", "Radar"]] as const;
export function CrmTabs({ current }: { current: (typeof TABS)[number][0] }) {
  return (
    <nav className="adm-tabs" aria-label="Sezioni CRM">
      {TABS.map(([href, label]) => <Link key={href} href={href as Route} className="adm-tab" aria-current={href === current ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const level = score >= 70 ? "alto" : score >= 40 ? "medio" : "basso";
  return <span className="adm-badge crm-score" data-level={level} title={`Punteggio ${score} su 100`}>{score}</span>;
}
