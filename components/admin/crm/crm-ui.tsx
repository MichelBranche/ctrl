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

type Place = { businessName: string; address: string | null; city: string | null; region: string | null };
/** Free Google Maps search URL (no API key): business name + address, or city + region. */
export const mapsUrl = (c: Place) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.businessName, ...(c.address ? [c.address, c.city] : [c.city, c.region])].filter(Boolean).join(", "))}`;

export function MapPin() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
}

export function MapsLink({ contact, compact = false }: { contact: Place; compact?: boolean }) {
  return compact
    ? <a className="crm-maps-icon" href={mapsUrl(contact)} target="_blank" rel="noopener noreferrer" aria-label={`Apri ${contact.businessName} su Google Maps`} title="Apri su Google Maps"><MapPin /></a>
    : <a className="adm-btn adm-btn-sm" href={mapsUrl(contact)} target="_blank" rel="noopener noreferrer"><MapPin /> Apri su Google Maps</a>;
}
