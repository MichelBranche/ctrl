/*
 * CRM navigation shared by the admin shell (client) and the CRM pages: sections, breadcrumb tail, old rubrica links
 * and the follow-up scope. Pure functions, no DB and no Node APIs, so the browser bundle can import it.
 */

export const CRM_HOME = "/admin/crm";
export const RUBRICA = "/admin/crm/rubrica";

export const CRM_SECTIONS = [
  { href: CRM_HOME, label: "Oggi" },
  { href: RUBRICA, label: "Rubrica" },
  { href: "/admin/crm/pipeline", label: "Pipeline" },
  { href: "/admin/crm/radar", label: "Radar" },
  { href: "/admin/crm/attivita", label: "Attività" },
] as const;
export type CrmSectionHref = (typeof CRM_SECTIONS)[number]["href"];

/** Label after "CRM" in the breadcrumb, or null on the CRM home. Any other segment is a contact id. */
export function crmCrumb(path: string): string | null {
  if (!path.startsWith(`${CRM_HOME}/`)) return null;
  const segment = path.slice(CRM_HOME.length + 1).split("/")[0];
  return CRM_SECTIONS.find((s) => s.href === `${CRM_HOME}/${segment}`)?.label ?? "Scheda contatto";
}

/** Query keys of the rubrica, which lived on /admin/crm before the Oggi page. */
export const RUBRICA_PARAMS = ["q", "fase", "categoria", "citta", "fonte", "archivio", "archiviato", "nuovo"] as const;

/** Old filtered links (/admin/crm?fase=call) keep working: same query on the rubrica. Null when nothing to redirect. */
export function legacyRubricaPath(pathname: string, search: URLSearchParams): string | null {
  if (pathname !== CRM_HOME || !RUBRICA_PARAMS.some((k) => search.has(k))) return null;
  return `${RUBRICA}?${search.toString()}`;
}

export type CrmScope = "mine" | "team";
/**
 * Whose follow-ups a CRM list shows. "team" only for people allowed to see everyone's (today: founders, the same rule
 * as the desk). Any other request, including a hand-written ?ambito=team, falls back to "mine".
 */
export const followUpScope = (requested: string | undefined, canSeeTeam: boolean): CrmScope =>
  requested === "team" && canSeeTeam ? "team" : "mine";
