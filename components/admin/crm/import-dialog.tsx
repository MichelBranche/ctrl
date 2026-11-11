"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { confirmCsvImportAction, previewCsvImportAction } from "@/app/admin/crm-import-actions";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import {
  guessMap, IMPORT_FIELD_LABEL, IMPORT_FIELDS, IMPORT_MAX_BYTES, mapRows, parseCsv,
  type ImportField, type ImportRow, type ParsedCsv,
} from "@/lib/crm-import-core";
import { RUBRICA } from "@/lib/crm-nav";

const UPLOAD = "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4";
type Step = "file" | "map" | "preview" | "done";
type Outcome = { inserted: number; skipped: number; invalid: number };
type Preview = { rows: { line: number; name: string; email: string; status: string; reason: string }[]; counts: { fresh: number; file: number; db: number; invalid: number } };

/**
 * CSV import opened from Radar or Rubrica. The file is read in the browser. The server sees only the mapped
 * rows, and only the confirm step writes. Closing the dialog drops the rows from memory.
 */
export function ImportDialog({ autoOpen = false }: { autoOpen?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const payload = useRef<ImportRow[] | null>(null);
  const [step, setStep] = useState<Step>("file");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [map, setMap] = useState<(ImportField | "")[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const reset = () => {
    payload.current = null;
    setStep("file"); setParsed(null); setMap([]); setPreview(null); setOutcome(null); setError(""); setPending(false);
  };
  const close = () => { dialog.current?.close(); reset(); };
  const open = () => { reset(); dialog.current?.showModal(); };

  useEffect(() => {
    const node = dialog.current;
    if (autoOpen && node && !node.open) node.showModal();
  }, [autoOpen]);

  const onFile = async (file: File | undefined) => {
    setError(""); setPreview(null); setOutcome(null); payload.current = null;
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) { setParsed(null); setError("Il file supera 700 KB. Dividilo e riprova."); return; }
    const parsedFile = parseCsv(await file.text());
    if ("error" in parsedFile) { setParsed(null); setError(parsedFile.error); return; }
    setParsed(parsedFile);
    setMap(guessMap(parsedFile.headers));
    setStep("map");
  };

  const check = async () => {
    if (!parsed || pending) return;
    const built = mapRows(parsed.rows, map);
    if ("error" in built) { setError(built.error); return; }
    setError(""); setPending(true);
    const report = await previewCsvImportAction(built).catch(() => ({ error: "Controllo non riuscito. Niente è stato salvato. Riprova." }));
    setPending(false);
    if ("error" in report) { setError(report.error); return; }
    payload.current = built;
    setPreview(report);
    setStep("preview");
  };

  const confirm = async () => {
    const rows = payload.current;
    if (!rows || pending || !preview?.counts.fresh) return;
    setError(""); setPending(true);
    const result = await confirmCsvImportAction(rows).catch(() => ({ error: "Import interrotto. I contatti già presenti non sono stati modificati; un nuovo tentativo non li duplica." }));
    setPending(false);
    payload.current = null;
    if ("error" in result) { setError(result.error); return; }
    setOutcome(result);
    setStep("done");
  };

  const setField = (index: number, field: ImportField | "") => {
    setMap((curr) => curr.map((value, i) => i === index ? field : value));
    setError("");
  };

  return (
    <>
      <button type="button" className="adm-btn" onClick={open}><CrmIcon d={UPLOAD} />Importa</button>
      <dialog ref={dialog} className="crm-import-dialog" aria-labelledby="crm-import-title" onClose={reset}>
        <header className="crm-import-head">
          <h2 id="crm-import-title" className="adm-h2">Importa CSV</h2>
          <button type="button" className="crm-icon-btn" onClick={close} aria-label="Chiudi import">×</button>
        </header>
        <p className="adm-muted crm-import-lead">I contatti entrano in Rubrica come fonte Manuale, senza punteggio Iris e senza responsabile. Non parte nessuna email e non si crea nessuna opportunità. Chi è già presente, per email, telefono o dominio aziendale, non viene modificato.</p>
        <ol className="crm-import-steps" aria-label="Passi">
          {(["File", "Colonne", "Anteprima"] as const).map((label, i) => {
            const names: Step[] = ["file", "map", "preview"];
            const current = step === "done" ? 3 : names.indexOf(step);
            return <li key={label} aria-current={current === i ? "step" : undefined}>{i + 1}. {label}</li>;
          })}
        </ol>
        {error ? <p className="adm-error" role="alert">{error}</p> : null}

        {step === "file" ? (
          <label className="adm-field">
            <span>File CSV</span>
            <input className="adm-input" type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void onFile(e.currentTarget.files?.[0])} />
            <span className="adm-muted crm-hint">La prima riga è l&apos;intestazione. Vanno bene virgola, punto e virgola o tabulazione, anche con campi su più righe. Il file resta in questo browser fino alla conferma.</span>
          </label>
        ) : null}

        {step === "map" && parsed ? (
          <>
            <p className="adm-muted crm-hint">Abbina le colonne. Punteggio, fase, responsabile e opportunità non hanno un campo: quelle colonne restano ignorate e non diventano un&apos;analisi Iris.</p>
            <div className="crm-import-maps">
              {parsed.headers.map((header, i) => (
                <label key={`${header}-${i}`} className="crm-import-map">
                  <span>{header || `Colonna ${i + 1}`}</span>
                  <select className="adm-input" value={map[i] ?? ""} aria-label={`Campo per ${header || `colonna ${i + 1}`}`} onChange={(e) => setField(i, e.currentTarget.value as ImportField | "")}>
                    <option value="">Ignora</option>
                    {IMPORT_FIELDS.map((field) => <option key={field} value={field}>{IMPORT_FIELD_LABEL[field]}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="adm-row-actions">
              <button type="button" className="adm-btn" onClick={() => { setStep("file"); setError(""); }}>Cambia file</button>
              <button type="button" className="adm-btn adm-btn-primary" disabled={pending} onClick={() => void check()}>{pending ? "Controllo…" : "Controlla anteprima"}</button>
            </div>
          </>
        ) : null}

        {step === "preview" && preview ? (
          <>
            <p className="crm-import-counts" role="status">{preview.counts.fresh} nuovi · {preview.counts.db} già presenti · {preview.counts.file} ripetuti nel file · {preview.counts.invalid} da correggere</p>
            <div className="crm-import-scroll">
              <table className="adm-table crm-import-table">
                <caption className="adm-sr">Anteprima, niente è ancora salvato</caption>
                <thead><tr><th>Riga</th><th>Azienda</th><th>Email</th><th>Esito</th></tr></thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.line} data-import={row.status}>
                      <td>{row.line}</td>
                      <td>{row.name || "—"}</td>
                      <td>{row.email || "—"}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adm-row-actions">
              <button type="button" className="adm-btn" onClick={() => { setStep("map"); setError(""); }}>Torna alle colonne</button>
              <button type="button" className={preview.counts.fresh ? "adm-btn adm-btn-primary" : "adm-btn"} disabled={pending || preview.counts.fresh === 0} onClick={() => void confirm()}>
                {pending ? "Importo…" : preview.counts.fresh ? `Importa ${preview.counts.fresh}` : "Niente da importare"}
              </button>
            </div>
          </>
        ) : null}

        {step === "done" && outcome ? (
          <>
            <p className="adm-ok" role="status">
              Importati {outcome.inserted} in Rubrica, senza punteggio e senza responsabile.
              {" "}{outcome.skipped} non importati perché già presenti, nel file o in rubrica.
              {" "}{outcome.invalid} righe scartate.
            </p>
            <div className="adm-row-actions">
              {outcome.inserted ? <Link className="adm-btn adm-btn-primary" href={`${RUBRICA}?fonte=manuale` as Route} onClick={close}>Apri la Rubrica</Link> : null}
              <button type="button" className="adm-btn" onClick={close}>Chiudi</button>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
