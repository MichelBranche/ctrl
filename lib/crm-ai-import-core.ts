/*
 * AI fallback for the Radar: the brief a founder copies into any AI, and the tolerant reader for the answer
 * pasted back. Pure functions, no database and no secrets: the browser uses them for the preview and the
 * server runs the same reader again before writing anything.
 */
import { ingestContactSchema, type IngestContact } from "@/lib/crm-ingest-schema";
import { SITE_CRITERION_LABEL, type SiteCriterion } from "@/lib/crm-iris-core";

export const AI_IMPORT_MAX = 100;
export const AI_IMPORT_MAX_CHARS = 400_000;

export type AiBriefInput = { zone: string; sectors: string[]; count: number; siteCriteria: SiteCriterion[]; notes?: string | null };

const EXAMPLE = {
  contacts: [
    {
      business_name: "Nome dell'azienda (obbligatorio)",
      type: "Settore, es. Cantina",
      contact_name: "Nome del referente, oppure null",
      email: "Email pubblica, oppure null",
      phone: "Telefono, oppure null",
      website: "https://sito-ufficiale.it, oppure null",
      address: "Via e numero civico, oppure null",
      city: "Comune",
      region: "Provincia o regione",
      country: "Italia",
      score: 75,
      score_reasons: ["Motivo breve e verificabile", "Altro motivo"],
      estimatedValue: 2500,
      estimatedValueNote: "Perché questa stima, in una riga",
      notes: "Dove hai trovato i dati e cosa hai verificato",
    },
  ],
};

/** Self-contained prompt for Claude Code or any other AI. Plain Italian, the exact JSON shape the CRM reads. */
export function buildAiBrief(input: AiBriefInput): string {
  const count = Math.min(AI_IMPORT_MAX, Math.max(1, Math.round(input.count) || 30));
  const sectors = input.sectors.map((s) => s.trim()).filter(Boolean);
  const criteria = input.siteCriteria.map((c) => SITE_CRITERION_LABEL[c]);
  const notes = input.notes?.trim();
  return [
    `Trova ${count} aziende reali da contattare per CTRL, un'agenzia che realizza siti web.`,
    "",
    `Zona: ${input.zone.trim() || "da definire"}`,
    `Settori: ${sectors.length ? sectors.join(", ") : "qualsiasi"}`,
    `Numero di lead: ${count}`,
    `Criterio sito: ${criteria.length ? criteria.join(", ") : "nessuno in particolare"}`,
    `Note: ${notes || "nessuna"}`,
    "",
    "Regole obbligatorie:",
    "1. Per ogni azienda apri la homepage live e verifica che il sito risponda davvero. Se il criterio è \"Sito assente\", verifica che non esista un sito ufficiale.",
    "2. Non inventare mai email, nomi di persone o numeri di telefono. Scrivi solo dati letti su una fonte pubblica (sito ufficiale, scheda Google, pagina social ufficiale). Se un dato manca, metti null.",
    "3. Ogni azienda deve avere almeno uno tra email, telefono o sito.",
    "4. Niente duplicati. Escludi catene e franchising, salvo diversa indicazione nelle note.",
    "5. score va da 0 a 100: quanto è probabile che l'azienda abbia bisogno di un sito nuovo. In score_reasons scrivi motivi brevi e verificabili.",
    "6. estimatedValue è una stima in euro interi del lavoro sul sito; estimatedValueNote la spiega in una riga.",
    `7. Massimo ${AI_IMPORT_MAX} aziende per risposta.`,
    "",
    "Rispondi solo con JSON valido, senza testo prima o dopo, in questo formato esatto:",
    JSON.stringify(EXAMPLE, null, 2),
  ].join("\n");
}

/* ---------------------------------------------------------------- reader */

export type AiLeadRejected = { n: number; name: string; reason: string };
export type AiLeadsParsed = { contacts: IngestContact[]; rejected: AiLeadRejected[] };

const FIELD_LABEL: Record<string, string> = {
  business_name: "nome dell'azienda", type: "settore", contact_name: "referente", email: "email", phone: "telefono", website: "sito",
  address: "indirizzo", city: "città", region: "regione", country: "paese", score: "punteggio", score_reasons: "motivi",
  estimatedValue: "valore stimato", estimatedValueNote: "nota sul valore", notes: "note",
};

/** Other names an AI tends to use for the same field. */
const ALIASES: Record<string, string[]> = {
  business_name: ["businessName", "name", "company", "company_name", "azienda", "nome", "ragione_sociale"],
  type: ["sector", "settore", "category", "categoria"],
  contact_name: ["contactName", "contact", "referente", "owner"],
  email: ["mail", "e-mail", "email_address"],
  phone: ["telephone", "tel", "telefono", "phone_number"],
  website: ["site", "sito", "url", "web", "homepage"],
  address: ["indirizzo", "street"],
  city: ["comune", "città", "citta", "town"],
  region: ["provincia", "regione", "province", "state"],
  country: ["paese", "nazione"],
  score: ["punteggio", "rating"],
  score_reasons: ["scoreReasons", "reasons", "motivi"],
  estimatedValue: ["estimated_value", "value", "valore"],
  estimatedValueNote: ["estimated_value_note", "valueNote"],
  notes: ["note", "comment", "comments"],
};

const EMPTY = new Set(["", "null", "n/a", "n/d", "nd", "na", "-", "—", "none", "nessuno", "nessuna", "non disponibile", "unknown"]);

function text(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim();
  if (EMPTY.has(s.toLowerCase())) return null;
  return s.slice(0, max);
}

function whole(v: unknown, min: number, max: number): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.min(max, Math.max(min, Math.round(v)));
  if (typeof v !== "string") return null;
  const digits = v.replace(/[^\d,.-]/g, "").replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
}

function website(v: unknown): string | null {
  const s = text(v, 300);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s) ? `https://${s}` : s;
}

function pick(raw: Record<string, unknown>, key: string): unknown {
  if (raw[key] !== undefined) return raw[key];
  const lower = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]));
  if (lower[key.toLowerCase()] !== undefined) return lower[key.toLowerCase()];
  for (const alt of ALIASES[key] ?? []) if (lower[alt.toLowerCase()] !== undefined) return lower[alt.toLowerCase()];
  return undefined;
}

function normalize(raw: Record<string, unknown>) {
  const reasons = pick(raw, "score_reasons");
  const list = Array.isArray(reasons) ? reasons : typeof reasons === "string" && reasons.trim() ? [reasons] : [];
  return {
    business_name: text(pick(raw, "business_name"), 200) ?? "",
    type: text(pick(raw, "type"), 80),
    contact_name: text(pick(raw, "contact_name"), 120),
    email: text(pick(raw, "email"), 200)?.replace(/^mailto:/i, "") ?? null,
    phone: text(pick(raw, "phone"), 40),
    website: website(pick(raw, "website")),
    address: text(pick(raw, "address"), 300),
    city: text(pick(raw, "city"), 100),
    region: text(pick(raw, "region"), 100),
    country: text(pick(raw, "country"), 100),
    score: whole(pick(raw, "score"), 0, 100),
    score_reasons: list.map((r) => text(r, 300)).filter((r): r is string => Boolean(r)).slice(0, 20),
    estimatedValue: whole(pick(raw, "estimatedValue"), 0, 100_000),
    estimatedValueNote: text(pick(raw, "estimatedValueNote"), 200),
    notes: text(pick(raw, "notes"), 5000),
  };
}

/** End of the JSON value that starts at `start` ({ or [), skipping brackets inside strings. */
function balancedEnd(s: string, start: number): number {
  const stack: string[] = [];
  let inString = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

function tryJson(s: string): unknown {
  const attempts = [s, s.replace(/[\u201C\u201D\u201E]/g, "\"").replace(/,\s*([}\]])/g, "$1")];
  for (const a of attempts) {
    try { return JSON.parse(a); } catch { /* next */ }
  }
  return undefined;
}

function candidates(input: string): string[] {
  const out: string[] = [];
  for (const m of input.matchAll(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/g)) out.push(m[1].trim());
  out.push(input.trim());
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch !== "{" && ch !== "[") continue;
    const end = balancedEnd(input, i);
    if (end > i) { out.push(input.slice(i, end + 1)); i = end; }
  }
  return out;
}

function listOf(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  for (const k of ["contacts", "leads", "results", "data", "aziende", "contatti", "items"]) if (Array.isArray(o[k])) return o[k] as unknown[];
  if (pick(o, "business_name") !== undefined) return [o];
  return null;
}

const domainOf = (url: string | null) => url?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0] || null;

/**
 * Reads whatever the AI answered: { "contacts": [...] }, a bare array, JSON inside a ```json block, or JSON with
 * text around it. Every lead is checked with the same rules as the Radar ingest; the rejected ones keep a reason.
 */
export function parseAiLeads(input: string): AiLeadsParsed | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: "Incolla qui la risposta dell'AI." };
  if (raw.length > AI_IMPORT_MAX_CHARS) return { error: "Il testo è troppo lungo. Incolla al massimo 100 aziende per volta." };
  let list: unknown[] | null = null;
  for (const c of candidates(raw)) {
    const parsed = tryJson(c);
    const found = parsed === undefined ? null : listOf(parsed);
    if (found) { list = found; break; }
  }
  if (!list) return { error: "Non trovo l'elenco delle aziende in questo testo. Copia tutta la risposta dell'AI, compresa la parte tra parentesi." };
  if (!list.length) return { error: "L'elenco è vuoto: l'AI non ha trovato aziende." };

  const contacts: IngestContact[] = [];
  const rejected: AiLeadRejected[] = [];
  const seen = new Set<string>();
  list.forEach((item, i) => {
    const n = i + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) { rejected.push({ n, name: `Riga ${n}`, reason: "non è un'azienda" }); return; }
    const lead = normalize(item as Record<string, unknown>);
    const name = lead.business_name || `Riga ${n}`;
    if (!lead.business_name) { rejected.push({ n, name, reason: "manca il nome dell'azienda" }); return; }
    if (!lead.email && !lead.phone && !lead.website) { rejected.push({ n, name, reason: "manca email, telefono o sito" }); return; }
    if (contacts.length >= AI_IMPORT_MAX) { rejected.push({ n, name, reason: `oltre il limite di ${AI_IMPORT_MAX} per volta` }); return; }
    const keys = [lead.email?.toLowerCase(), lead.phone?.replace(/[^\d+]/g, ""), domainOf(lead.website)].filter((k): k is string => Boolean(k));
    if (keys.some((k) => seen.has(k))) { rejected.push({ n, name, reason: "ripetuta nell'elenco" }); return; }
    const checked = ingestContactSchema.safeParse(lead);
    if (!checked.success) {
      const field = String(checked.error.issues[0]?.path[0] ?? "");
      rejected.push({ n, name, reason: `${FIELD_LABEL[field] ?? "un dato"} da correggere` });
      return;
    }
    keys.forEach((k) => seen.add(k));
    contacts.push({ ...checked.data, draft: null });
  });
  return { contacts, rejected };
}
