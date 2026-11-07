import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { CRM_SECTIONS, type CrmSectionHref } from "@/lib/crm-nav";

export const eur = (v: number | null) => (v === null ? "" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));
export const day = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", year: "numeric" }) : "");
export const romeToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function CrmIcon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
export const CRM_ICON: Record<CrmSectionHref, string> = {
  "/admin/crm": "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10",
  "/admin/crm/rubrica": "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8",
  "/admin/crm/pipeline": "M3 4h18l-7 8.5V19l-4 2v-8.5z",
  "/admin/crm/radar": "M12 12l5-5M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5M12 12h.01",
  "/admin/crm/attivita": "M4 4h16v16H4zM8 12l3 3 5-6",
};

/** The five CRM sections. Email is not a section: it opens from a contact. */
export function CrmTabs({ current }: { current: CrmSectionHref }) {
  return (
    <nav className="crm-tabs" aria-label="Sezioni CRM">
      {CRM_SECTIONS.map(({ href, label }) => (
        <Link key={href} href={href as Route} className="crm-tab" aria-current={href === current ? "page" : undefined}>
          <CrmIcon d={CRM_ICON[href]} />{label}
        </Link>
      ))}
    </nav>
  );
}

/** Page title block shared by the CRM sections: "CRM" eyebrow, title, one-line purpose, optional actions on the right. */
export function CrmHeader({ title, intro, children }: { title: ReactNode; intro: string; children?: ReactNode }) {
  return (
    <header className="crm-head">
      <div>
        <p className="crm-eyebrow">CRM</p>
        <h1 className="adm-h1">{title}</h1>
        <p className="adm-muted crm-intro">{intro}</p>
      </div>
      {children ? <div className="adm-row-actions">{children}</div> : null}
    </header>
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

/** Contact links shared by the full contact page and the contact panel. */
export const siteHref = (website: string | null) => (website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null);
export const telHref = (phone: string | null) => (phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null);
/** New message in Comunicazioni with the recipient filled in: the existing editor, nothing is sent until the user does it. */
export const composeHref = (email: string) => `/admin/email?${new URLSearchParams({ compose: "new", a: email })}`;
export const meetHref = (c: { businessName: string; email: string | null }) =>
  `/admin/riunioni?${new URLSearchParams({ titolo: `Call con ${c.businessName}`.slice(0, 120), ...(c.email ? { ospite: c.email } : {}) })}`;
export const initials = (name: string) => name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
