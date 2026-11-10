"use server";
import { revalidatePath } from "next/cache";
import { guardSection } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { confirmImport, previewImport, type ImportError, type ImportOutcome, type ImportReport } from "@/lib/crm-import";
import { CRM_SECTIONS } from "@/lib/crm-nav";

function refresh() {
  for (const s of CRM_SECTIONS) revalidatePath(s.href);
}

/** Read-only duplicate and field check. Writes nothing. */
export async function previewCsvImportAction(rows: unknown): Promise<ImportReport | ImportError> {
  await guardSection("crm");
  try {
    return await previewImport(rows);
  } catch {
    return { error: "Controllo non riuscito. Niente è stato salvato. Riprova." };
  }
}

/** Inserts the rows that are still new. Does not email, assign, or open an opportunity. */
export async function confirmCsvImportAction(rows: unknown): Promise<ImportOutcome | ImportError> {
  const me = await guardSection("crm");
  try {
    const result = await confirmImport(rows, me.id);
    if (!("error" in result)) {
      await logAction("crm.import", { type: "crm" }, { inserted: result.inserted, skipped: result.skipped, invalid: result.invalid });
      if (result.inserted) refresh();
    }
    return result;
  } catch {
    return { error: "Import interrotto. I contatti già presenti non sono stati modificati; un nuovo tentativo non li duplica." };
  }
}
