/**
 * CSV import, pure half: parse, column guess, and row checks. No database, no logging.
 * Imported contacts are ordinary Rubrica rows (source manuale). Score, stage, owner and drafts are not fields
 * here, so a CSV cannot invent an Iris analysis or move a contact.
 * A row already in the database (same email, phone or company domain) is skipped, never overwritten.
 * A later row in the same file that matches an earlier importable row is skipped the same way.
 */

export const IMPORT_FIELDS = ["businessName", "contactName", "email", "phone", "website", "city", "region", "address", "type", "notes"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
  businessName: "Azienda", contactName: "Referente", email: "Email", phone: "Telefono", website: "Sito",
  city: "Città", region: "Provincia / regione", address: "Indirizzo", type: "Categoria", notes: "Note",
};

/** One confirm, small enough to check by hand and to stay inside the app (nothing is uploaded elsewhere). */
export const IMPORT_MAX_ROWS = 200;
export const IMPORT_MAX_BYTES = 700_000;
const MAX_COLUMNS = 40;
const FIELD_MAX: Record<ImportField, number> = {
  businessName: 200, contactName: 120, email: 200, phone: 40, website: 300, city: 100, region: 100, address: 300, type: 80, notes: 5000,
};

/** Same shape as the contact form. */
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export type ImportRow = Partial<Record<ImportField, string | null>>;
export type ParsedCsv = { headers: string[]; rows: string[][] };
export type CsvError = { error: string };

const SEP_CANDIDATES = [";", ",", "\t"] as const;

function countSep(text: string, sep: string): number {
  let n = 0, quoted = false;
  const head = text.slice(0, 8000);
  for (let i = 0; i < head.length; i++) {
    const c = head[i];
    if (c === '"') {
      if (quoted && head[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    } else if (!quoted && (c === "\n" || c === "\r")) break;
    else if (!quoted && c === sep) n++;
  }
  return n;
}

/** Semicolon wins a tie: that is what Italian spreadsheets write. */
export function detectSeparator(text: string): "," | ";" | "\t" {
  let best: "," | ";" | "\t" = ";";
  let bestN = -1;
  for (const sep of SEP_CANDIDATES) {
    const n = countSep(text, sep);
    if (n > bestN) { best = sep; bestN = n; }
  }
  return best;
}

/** RFC-style records: quotes, doubled quotes, and line breaks inside quotes. Never evaluates a cell. */
export function parseCsv(raw: string): ParsedCsv | CsvError {
  const text = raw.replace(/^\uFEFF/, "");
  if (!text.trim()) return { error: "Il file è vuoto." };
  if (text.length > IMPORT_MAX_BYTES) return { error: "Il file supera 700 KB. Dividilo e riprova." };
  const sep = detectSeparator(text);
  const records: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((cell) => cell.trim() !== "")) records.push(row);
      row = [];
    } else cur += c;
  }
  if (quoted) return { error: "Virgolette non chiuse: controlla il file e riprova." };
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some((cell) => cell.trim() !== "")) records.push(row);
  }
  if (records.length < 2) return { error: "Serve la riga di intestazione e almeno una riga di dati." };
  const headers = records[0].map((h) => h.replace(/\u0000/g, "").trim());
  if (headers.length > MAX_COLUMNS) return { error: `Troppe colonne (massimo ${MAX_COLUMNS}).` };
  if (headers.every((h) => !h)) return { error: "Manca la riga di intestazione." };
  const rows = records.slice(1).map((r) => headers.map((_, i) => (r[i] ?? "").replace(/\u0000/g, "")));
  if (rows.length > IMPORT_MAX_ROWS) return { error: `Massimo ${IMPORT_MAX_ROWS} righe per volta. Il file ne ha ${rows.length}: dividilo.` };
  return { headers, rows };
}

const headerKey = (h: string) => h.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const SYNONYMS: Record<string, ImportField> = {
  azienda: "businessName", "ragione sociale": "businessName", company: "businessName", business: "businessName",
  "nome azienda": "businessName", denominazione: "businessName", nome: "businessName", name: "businessName",
  referente: "contactName", contatto: "contactName", "nome contatto": "contactName", "contact name": "contactName", contact: "contactName",
  email: "email", "e mail": "email", mail: "email", posta: "email",
  telefono: "phone", tel: "phone", cellulare: "phone", cell: "phone", phone: "phone", mobile: "phone",
  sito: "website", website: "website", web: "website", url: "website",
  citta: "city", comune: "city", city: "city", localita: "city",
  provincia: "region", regione: "region", region: "region",
  indirizzo: "address", via: "address", address: "address",
  categoria: "type", tipo: "type", settore: "type", type: "type",
  note: "notes", notes: "notes", annotazioni: "notes",
};

/** Unknown headers, including punteggio, fase and responsabile, stay unmapped. */
export function guessField(header: string): ImportField | "" {
  return SYNONYMS[headerKey(header)] ?? "";
}

/** First column wins a field; a second guess for the same field stays empty so the user can choose. */
export function guessMap(headers: string[]): (ImportField | "")[] {
  const used = new Set<ImportField>();
  return headers.map((h) => {
    const field = guessField(h);
    if (!field || used.has(field)) return "";
    used.add(field);
    return field;
  });
}

/** Spreadsheet formula prefixes become text. A leading + on a phone number is a country code, not a formula. */
function asText(value: string, field: ImportField): string {
  if (field === "phone") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export type RowIssue = "nome" | "email" | "telefono" | "chiave" | "lungo";

/**
 * One mapped row, ready for the duplicate check. `issue` means it will not be written.
 * `text` is what would be stored (formula cells already made inert).
 */
export function normalizeRow(input: unknown): { text: ImportRow; issue: RowIssue | null } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Riga non valida." };
  const src = input as Record<string, unknown>;
  const text: ImportRow = {};
  for (const field of IMPORT_FIELDS) {
    if (!(field in src) || src[field] == null || src[field] === "") continue;
    if (typeof src[field] !== "string") return { error: "Riga non valida." };
    const raw = src[field].replace(/\u0000/g, "").trim();
    if (!raw) continue;
    const stored = asText(raw, field);
    if (stored.length > FIELD_MAX[field]) return { text, issue: "lungo" };
    text[field] = stored;
  }
  const name = text.businessName ?? "";
  if (!name) return { text, issue: "nome" };
  if (text.email && !isEmail(text.email)) return { text, issue: "email" };
  if (text.phone && !/^[+\d][\d\s()./-]{5,}$/.test(text.phone)) return { text, issue: "telefono" };
  if (!text.email && !text.phone && !text.website) return { text, issue: "chiave" };
  return { text, issue: null };
}

/** Mapped grid sent to the server. Score, stage and owner are not columns, so they cannot be smuggled in by the mapping. */
export function mapRows(rows: string[][], map: (ImportField | "")[]): ImportRow[] | CsvError {
  const fields = map.filter((f): f is ImportField => Boolean(f));
  if (!fields.includes("businessName")) return { error: "Abbina una colonna ad Azienda." };
  if (new Set(fields).size !== fields.length) return { error: "Due colonne sono abbinate allo stesso campo." };
  return rows.map((cells) => {
    const row: ImportRow = {};
    map.forEach((field, i) => {
      if (!field) return;
      const value = cells[i] ?? "";
      if (value.trim()) row[field] = value;
    });
    return row;
  });
}

export const ISSUE_LABEL: Record<RowIssue, string> = {
  nome: "Manca il nome dell'azienda",
  email: "Email non valida",
  telefono: "Telefono non valido",
  chiave: "Manca email, telefono o sito: senza un riferimento non si possono riconoscere i duplicati",
  lungo: "Un campo supera la lunghezza ammessa",
};
