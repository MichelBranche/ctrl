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

/*
 * Rubrica URL state: filters, sort, page and the open contact panel all live in the query string, so links, refresh and
 * back/forward restore the same view. `c` (open contact) and `tab` never reset the filters or the page.
 */
export const RUBRICA_SORTS = ["aggiornato", "nome", "fase", "citta", "punteggio", "azione"] as const;
export type RubricaSort = (typeof RUBRICA_SORTS)[number];
export const PANEL_TABS = ["dettagli", "note", "attivita", "cronologia"] as const;
export type PanelTab = (typeof PANEL_TABS)[number];
export const RUBRICA_PAGE_SIZE = 25;

export type RubricaQuery = {
  q: string; fase: string; categoria: string; citta: string; fonte: string; resp: string; archivio: boolean;
  ordina: RubricaSort; dir: "asc" | "desc"; p: number; c: string; tab: PanelTab;
};
type Raw = Record<string, string | string[] | undefined> | URLSearchParams;
const read = (sp: Raw, k: string) => {
  const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
  return typeof v === "string" ? v.trim().slice(0, 120) : "";
};
const ID_RE = /^[0-9a-f-]{36}$/i;
/** Owner filter: "me", "none" or a user id (validated against the team on the server). */
const RESP_RE = /^(me|none|[\w-]{1,64})$/;

export function parseRubricaQuery(sp: Raw): RubricaQuery {
  const ordina = read(sp, "ordina");
  const tab = read(sp, "tab");
  const page = Number.parseInt(read(sp, "p"), 10);
  const sort = (RUBRICA_SORTS as readonly string[]).includes(ordina) ? (ordina as RubricaSort) : "aggiornato";
  const dir = read(sp, "dir");
  return {
    q: read(sp, "q"), fase: read(sp, "fase"), categoria: read(sp, "categoria"), citta: read(sp, "citta"), fonte: read(sp, "fonte"),
    resp: RESP_RE.test(read(sp, "resp")) ? read(sp, "resp") : "", archivio: read(sp, "archivio") === "1",
    ordina: sort, dir: dir === "asc" || dir === "desc" ? dir : sort === "nome" || sort === "citta" || sort === "azione" ? "asc" : "desc",
    p: Number.isFinite(page) && page > 1 ? Math.min(page, 10_000) : 1,
    c: ID_RE.test(read(sp, "c")) ? read(sp, "c") : "",
    tab: (PANEL_TABS as readonly string[]).includes(tab) ? (tab as PanelTab) : "dettagli",
  };
}

/** Query string for a rubrica view; defaults are omitted so URLs stay short and comparable. */
export function rubricaSearch(q: RubricaQuery, patch: Partial<RubricaQuery> = {}): string {
  const v = { ...q, ...patch };
  const out = new URLSearchParams();
  for (const k of ["q", "fase", "categoria", "citta", "fonte", "resp"] as const) if (v[k]) out.set(k, v[k]);
  if (v.archivio) out.set("archivio", "1");
  if (v.ordina !== "aggiornato" || v.dir !== "desc") { out.set("ordina", v.ordina); out.set("dir", v.dir); }
  if (v.p > 1) out.set("p", String(v.p));
  if (v.c) out.set("c", v.c);
  if (v.c && v.tab !== "dettagli") out.set("tab", v.tab);
  const s = out.toString();
  return s ? `?${s}` : "";
}

/**
 * Saved views keep only filter metadata: never the free-text search (it can hold names or emails), the open contact
 * or the page. Stored per user in the browser.
 */
export const SAVED_VIEW_KEYS = ["fase", "categoria", "citta", "fonte", "resp", "archivio", "ordina", "dir"] as const;
export function savedViewParams(search: string): string {
  const src = new URLSearchParams(search);
  const out = new URLSearchParams();
  for (const k of SAVED_VIEW_KEYS) { const v = src.get(k); if (v && v.length <= 120) out.set(k, v); }
  return out.toString();
}
export const savedViewsKey = (userId: string) => `ctrl:crm-views:v1:${userId}`;
