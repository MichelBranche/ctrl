/*
 * Azienda or persona. The column is nullable: an empty value is deduced, never guessed from a paid service.
 * Stored kind wins. Otherwise a record whose only name is the person's (same business name and contact name, no sector)
 * is a persona. A business name on its own, or a business name plus a different referent, is an azienda.
 */

export type ContactKind = "azienda" | "persona";

const fold = (value: string) => value.trim().toLowerCase();

export function resolveKind(row: {
  kind?: string | null;
  businessName: string;
  contactName?: string | null;
  type?: string | null;
}): ContactKind {
  if (row.kind === "azienda" || row.kind === "persona") return row.kind;
  const company = row.businessName.trim();
  const person = (row.contactName ?? "").trim();
  const sector = (row.type ?? "").trim();
  if (person && fold(company) === fold(person) && !sector) return "persona";
  if (company) return "azienda";
  return "persona";
}

/** Same rule as resolveKind, for the list filters. `c` is the crm_contacts alias. */
export const KIND_SQL = `CASE
  WHEN c.kind IN ('azienda','persona') THEN c.kind
  WHEN c.contact_name IS NOT NULL AND trim(c.contact_name) <> ''
    AND lower(trim(c.business_name)) = lower(trim(c.contact_name))
    AND (c.type IS NULL OR trim(c.type) = '') THEN 'persona'
  WHEN trim(c.business_name) <> '' THEN 'azienda'
  ELSE 'persona'
END`;
