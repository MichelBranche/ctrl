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

/** Label after "CRM" in the breadcrumb, or null on the CRM home. Any other segment is a contact id (its mail: "Email"). */
export function crmCrumb(path: string): string | null {
  if (!path.startsWith(`${CRM_HOME}/`)) return null;
  const [segment, sub] = path.slice(CRM_HOME.length + 1).split("/");
  const section = CRM_SECTIONS.find((s) => s.href === `${CRM_HOME}/${segment}`)?.label;
  return section ?? (sub === "email" ? "Email" : "Scheda contatto");
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

/*
 * Contact email view (/admin/crm/<id>/email): the Rubrica view it came from travels in `da` (filters, sort and page only,
 * re-parsed and rebuilt here, never echoed), so "back" and the panel tabs land on the same list with the contact open.
 * `m` + `k` open one message by All Mail uid and its stable key; `compose` opens the existing composer.
 */
export const contactEmailPath = (id: string) => `${CRM_HOME}/${id}/email`;
export const CONTACT_MAIL_VIEWS = ["tutte", "ricevute", "inviate"] as const;
export type ContactMailView = (typeof CONTACT_MAIL_VIEWS)[number];
export type ContactMailQuery = {
  back: RubricaQuery; vista: ContactMailView; m: number | null; k: string; compose: "new" | "reply" | "all" | null; img: boolean;
};
const MAIL_KEY_RE = /^[a-f0-9]{32}$/;

export function parseContactMailQuery(sp: Raw): ContactMailQuery {
  const raw = sp instanceof URLSearchParams ? sp.get("da") : sp.da;
  const da = typeof raw === "string" && raw.length <= 1000 ? raw.replace(/^\?/, "") : "";
  const back = parseRubricaQuery(new URLSearchParams(da));
  const vista = read(sp, "vista");
  const m = read(sp, "m");
  const compose = read(sp, "compose");
  return {
    back: { ...back, c: "", tab: "dettagli" },
    vista: (CONTACT_MAIL_VIEWS as readonly string[]).includes(vista) ? (vista as ContactMailView) : "tutte",
    m: /^\d{1,10}$/.test(m) && Number(m) > 0 ? Number(m) : null,
    k: MAIL_KEY_RE.test(read(sp, "k")) ? read(sp, "k") : "",
    compose: compose === "new" || compose === "reply" || compose === "all" ? compose : null,
    img: read(sp, "img") === "1",
  };
}

/** Query string of the contact email view; `da` is rebuilt from the parsed Rubrica state. */
export function contactMailSearch(q: ContactMailQuery, patch: Partial<ContactMailQuery> = {}): string {
  const v = { ...q, ...patch };
  const out = new URLSearchParams();
  const da = rubricaSearch(v.back, { c: "", tab: "dettagli" }).slice(1);
  if (da) out.set("da", da);
  if (v.vista !== "tutte") out.set("vista", v.vista);
  if (v.m) { out.set("m", String(v.m)); if (v.k) out.set("k", v.k); }
  if (v.compose) out.set("compose", v.compose);
  if (v.img && v.m) out.set("img", "1");
  const s = out.toString();
  return s ? `?${s}` : "";
}

/** Same-origin Rubrica path with this contact's panel open on `tab` (the safe "back" of the email view). */
export const rubricaReturn = (id: string, back: RubricaQuery, tab: PanelTab = "dettagli") =>
  `${RUBRICA}${rubricaSearch(back, { c: ID_RE.test(id) ? id : "", tab })}`;

export const defaultContactMail = (back: RubricaQuery): ContactMailQuery =>
  ({ back: { ...back, c: "", tab: "dettagli" }, vista: "tutte", m: null, k: "", compose: null, img: false });

/*
 * Radar URL state: the Rubrica keys (search, filters, sort, page, open contact) plus the Iris score band `prio`.
 * Defaults differ from the Rubrica: best Iris score first, and the panel opens on the Iris analysis.
 */
export const RADAR = `${CRM_HOME}/radar`;
export const RADAR_PRIOS = ["alta", "media", "bassa", "senza"] as const;
export type RadarPrio = (typeof RADAR_PRIOS)[number];
export type RadarTab = PanelTab | "analisi";
export type RadarQuery = Omit<RubricaQuery, "tab"> & { prio: RadarPrio | ""; tab: RadarTab };
/** Same bands as the score badge: alta 70+, media 40-69, bassa under 40, senza = no score from Iris. */
export const PRIO_RANGE: Record<Exclude<RadarPrio, "senza">, [number, number]> = { alta: [70, 100], media: [40, 69], bassa: [0, 39] };

export function parseRadarQuery(sp: Raw): RadarQuery {
  const base = parseRubricaQuery(sp);
  const prio = read(sp, "prio"), tab = read(sp, "tab");
  const sorted = (RUBRICA_SORTS as readonly string[]).includes(read(sp, "ordina"));
  return {
    ...base,
    ...(sorted ? {} : { ordina: "punteggio" as const, dir: "desc" as const }),
    prio: (RADAR_PRIOS as readonly string[]).includes(prio) ? (prio as RadarPrio) : "",
    tab: (PANEL_TABS as readonly string[]).includes(tab) ? (tab as PanelTab) : "analisi",
  };
}

export function radarSearch(q: RadarQuery, patch: Partial<RadarQuery> = {}): string {
  const v = { ...q, ...patch };
  const out = new URLSearchParams(rubricaSearch({ ...v, tab: "dettagli" }).slice(1));
  if (v.ordina === "punteggio" && v.dir === "desc") { out.delete("ordina"); out.delete("dir"); }
  else if (!out.has("ordina")) { out.set("ordina", v.ordina); out.set("dir", v.dir); }
  if (v.prio) out.set("prio", v.prio);
  if (v.c && v.tab !== "analisi") out.set("tab", v.tab);
  const s = out.toString();
  return s ? `?${s}` : "";
}

/*
 * Pipeline URL state. `c` opens the shared contact panel, `o` is the deal inside it.
 * `periodo` filters closed deals and the footer; open deals stay on the board.
 */
export const PIPELINE = `${CRM_HOME}/pipeline`;
export const PIPELINE_PERIODS = ["mese", "trimestre", "tutto"] as const;
export const PIPELINE_VIEWS = ["kanban", "lista"] as const;
export type PipelinePeriod = (typeof PIPELINE_PERIODS)[number];
export type PipelineView = (typeof PIPELINE_VIEWS)[number];
export type PipelineQuery = {
  q: string; resp: string; fonte: string; prio: string; periodo: PipelinePeriod; vista: PipelineView;
  c: string; o: string; tab: PanelTab; perso: boolean; nuova: boolean; contatto: string; apri: string;
};

export function parsePipelineQuery(sp: Raw): PipelineQuery {
  const periodo = read(sp, "periodo");
  const vista = read(sp, "vista");
  const tab = read(sp, "tab");
  const prio = read(sp, "prio");
  const resp = read(sp, "resp");
  return {
    q: read(sp, "q"),
    resp: RESP_RE.test(resp) ? resp : "",
    fonte: read(sp, "fonte"),
    prio: prio === "alta" || prio === "media" || prio === "bassa" || prio === "nessuna" ? prio : "",
    periodo: (PIPELINE_PERIODS as readonly string[]).includes(periodo) ? (periodo as PipelinePeriod) : "mese",
    vista: vista === "lista" ? "lista" : "kanban",
    c: ID_RE.test(read(sp, "c")) ? read(sp, "c") : "",
    o: ID_RE.test(read(sp, "o")) ? read(sp, "o") : "",
    tab: (PANEL_TABS as readonly string[]).includes(tab) ? (tab as PanelTab) : "dettagli",
    perso: read(sp, "perso") === "1",
    nuova: read(sp, "nuova") === "1",
    contatto: ID_RE.test(read(sp, "contatto")) ? read(sp, "contatto") : "",
    apri: read(sp, "apri"),
  };
}

export function pipelineSearch(q: PipelineQuery, patch: Partial<PipelineQuery> = {}): string {
  const v = { ...q, ...patch };
  const out = new URLSearchParams();
  if (v.q) out.set("q", v.q);
  if (v.resp) out.set("resp", v.resp);
  if (v.fonte) out.set("fonte", v.fonte);
  if (v.prio) out.set("prio", v.prio);
  if (v.periodo !== "mese") out.set("periodo", v.periodo);
  if (v.vista === "lista") out.set("vista", "lista");
  if (v.perso) out.set("perso", "1");
  if (v.nuova) out.set("nuova", "1");
  if (v.contatto) out.set("contatto", v.contatto);
  if (v.apri) out.set("apri", v.apri);
  if (v.c) out.set("c", v.c);
  if (v.o) out.set("o", v.o);
  if (v.c && v.tab !== "dettagli") out.set("tab", v.tab);
  const s = out.toString();
  return s ? `?${s}` : "";
}

/** UTC instant of midnight in Europe/Rome on the first day of the period. Null means no lower bound. */
export function pipelinePeriodStart(period: PipelinePeriod, now = new Date()): string | null {
  if (period === "tutto") return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const startMonth = period === "mese" ? month : Math.floor((month - 1) / 3) * 3 + 1;
  const want = { year, month: startMonth, day: 1 };
  for (const shift of [0, 1, 2]) {
    const t = new Date(Date.UTC(want.year, want.month - 1, want.day) - shift * 3_600_000);
    const got = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(t).map((p) => [p.type, p.value]));
    if (Number(got.year) === want.year && Number(got.month) === want.month && Number(got.day) === want.day && got.hour === "00") return t.toISOString();
  }
  return new Date(Date.UTC(want.year, want.month - 1, want.day) - 3_600_000).toISOString();
}
