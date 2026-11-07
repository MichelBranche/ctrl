import "server-only";
import { dedupeKeys, hasKeys, isSource, sameContact, SOURCE_LABEL } from "@/lib/crm-core";
import { createContact, findDuplicate } from "@/lib/crm";
import { db } from "@/lib/db";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, ISSUE_LABEL, normalizeRow, type ImportRow } from "@/lib/crm-import-core";
import { ensureCrmSchema } from "@/lib/migrate";

/**
 * Preview reads. Confirm writes only rows that are still new at that moment, through createContact, which
 * inserts source "manuale", no score, no owner, no draft. A duplicate answer never updates the existing contact.
 */
export type PreviewRow = { line: number; name: string; email: string; status: "new" | "file" | "db" | "invalid"; reason: string };
export type ImportReport = { rows: PreviewRow[]; counts: { fresh: number; file: number; db: number; invalid: number } };
export type ImportOutcome = { inserted: number; skipped: number; invalid: number };
export type ImportError = { error: string };

type Prepared = { line: number; text: ImportRow; issue: keyof typeof ISSUE_LABEL | null };

function prepare(input: unknown): Prepared[] | ImportError {
  if (!Array.isArray(input) || input.length === 0) return { error: "Nessuna riga da importare." };
  if (input.length > IMPORT_MAX_ROWS) return { error: `Massimo ${IMPORT_MAX_ROWS} righe per volta.` };
  const out: Prepared[] = [];
  let size = 0;
  for (let i = 0; i < input.length; i++) {
    const row = normalizeRow(input[i]);
    if ("error" in row) return { error: `Riga ${i + 1}: ${row.error}` };
    size += JSON.stringify(row.text).length;
    if (size > IMPORT_MAX_BYTES) return { error: "I dati superano 700 KB. Dividi il file." };
    out.push({ line: i + 1, text: row.text, issue: row.issue });
  }
  return out;
}

async function existingLabel(id: string): Promise<string> {
  const r = await db().execute({ sql: "SELECT business_name, source, archived FROM crm_contacts WHERE id = ?", args: [id] });
  const row = r.rows[0];
  if (!row) return "contatto già in rubrica";
  const name = String(row.business_name).slice(0, 80);
  const where = Number(row.archived) === 1 ? "archiviato" : isSource(row.source) ? SOURCE_LABEL[row.source] : "rubrica";
  return `${name}, ${where}`;
}

/** Classifies every row. Does not write. */
export async function previewImport(input: unknown): Promise<ImportReport | ImportError> {
  const prepared = prepare(input);
  if ("error" in prepared) return prepared;
  await ensureCrmSchema();
  const rows: PreviewRow[] = [];
  const accepted: ReturnType<typeof dedupeKeys>[] = [];
  const counts = { fresh: 0, file: 0, db: 0, invalid: 0 };
  for (const row of prepared) {
    const name = (row.text.businessName ?? "").slice(0, 80);
    const email = (row.text.email ?? "").slice(0, 80);
    if (row.issue) {
      counts.invalid++;
      rows.push({ line: row.line, name, email, status: "invalid", reason: ISSUE_LABEL[row.issue] });
      continue;
    }
    const keys = dedupeKeys(row.text);
    if (!hasKeys(keys)) {
      counts.invalid++;
      rows.push({ line: row.line, name, email, status: "invalid", reason: ISSUE_LABEL.chiave });
      continue;
    }
    if (accepted.some((k) => sameContact(k, keys))) {
      counts.file++;
      rows.push({ line: row.line, name, email, status: "file", reason: "Ripetuto nel file: resta solo la prima riga" });
      continue;
    }
    const id = await findDuplicate(row.text);
    if (id) {
      counts.db++;
      rows.push({ line: row.line, name, email, status: "db", reason: `Già presente (${await existingLabel(id)}): non viene modificato` });
      continue;
    }
    accepted.push(keys);
    counts.fresh++;
    rows.push({ line: row.line, name, email, status: "new", reason: "Nuovo, in Rubrica, senza punteggio" });
  }
  return { rows, counts };
}

/** Re-checks, then inserts only rows that are still new. Nothing else is updated. */
export async function confirmImport(input: unknown, createdBy: string): Promise<ImportOutcome | ImportError> {
  const report = await previewImport(input);
  if ("error" in report) return report;
  const prepared = prepare(input);
  if ("error" in prepared) return prepared;
  let inserted = 0, skipped = 0, invalid = 0;
  for (let i = 0; i < report.rows.length; i++) {
    const status = report.rows[i].status;
    if (status === "invalid") { invalid++; continue; }
    if (status !== "new") { skipped++; continue; }
    const text = prepared[i].text;
    const created = await createContact({
      businessName: text.businessName ?? "",
      type: text.type ?? null, contactName: text.contactName ?? null, email: text.email ?? null, phone: text.phone ?? null,
      website: text.website ?? null, address: text.address ?? null, city: text.city ?? null, region: text.region ?? null, notes: text.notes ?? null,
      source: "manuale", stage: "nuovo", score: null, scoreReasons: null, ownerUserId: null, valueEur: null, nextAction: null, nextActionAt: null,
    }, createdBy);
    if (created.duplicate) skipped++;
    else inserted++;
  }
  return { inserted, skipped, invalid };
}
