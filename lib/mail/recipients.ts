/** Recipient field parsing shared by the send action and the compose-time CRM check (no server imports). */
export const EMAIL_ADDRESS = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

/** "Nome <a@b.it>, c@d.it; …" -> ["a@b.it", "c@d.it"] (not validated, not normalized). */
export const parseRecipients = (v: FormDataEntryValue | string | null | undefined): string[] =>
  String(v ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.match(/<([^>]+)>$/)?.[1]?.trim() ?? s);
