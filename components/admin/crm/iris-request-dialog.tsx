"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { askIrisAction } from "@/app/admin/crm-iris-actions";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import { irisNoticeText, SITE_CRITERIA, SITE_CRITERION_LABEL, type IrisNotice, type SiteCriterion } from "@/lib/crm-iris-core";
import { RADAR } from "@/lib/crm-nav";

const SEARCH = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3";

/**
 * Founder-only "Chiedi a Iris". The server checks the role, the daily credit and the single active request again.
 */
export function IrisRequestDialog({ notice }: { notice: IrisNotice | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [sectors, setSectors] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [criteria, setCriteria] = useState<SiteCriterion[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const blocked = notice?.blocked === true;

  const reset = () => { setSectors([]); setDraft(""); setCriteria([]); setError(""); setPending(false); };
  const close = () => { dialog.current?.close(); reset(); };
  const addSector = () => {
    const value = draft.trim();
    if (value.length < 2 || sectors.some((s) => s.toLocaleLowerCase("it") === value.toLocaleLowerCase("it")) || sectors.length >= 8) return;
    setSectors((cur) => [...cur, value]);
    setDraft("");
  };
  const toggle = (c: SiteCriterion) => setCriteria((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);

  const submit = async (form: FormData) => {
    if (blocked || pending) return;
    const zone = String(form.get("zone") ?? "").trim();
    const notes = String(form.get("notes") ?? "");
    const count = Number(form.get("count"));
    if (zone.length < 2) { setError("Indica il comune, la provincia o l'area."); return; }
    if (!sectors.length) { setError("Indica almeno un settore."); return; }
    if (!Number.isInteger(count) || count < 10 || count > 50) { setError("Il numero di lead va da 10 a 50."); return; }
    if (notes.trim().length > 1000) { setError("Le note superano i 1000 caratteri."); return; }
    setError(""); setPending(true);
    const result = await askIrisAction({ zone, sectors, count, siteCriteria: criteria, notes }).catch(() => ({ error: "Richiesta non inviata. Riprova." }));
    setPending(false);
    if ("error" in result) { setError(result.error); return; }
    close();
    router.refresh();
  };

  return (
    <>
      <button type="button" className="adm-btn adm-btn-primary" data-iris-open onClick={() => { reset(); dialog.current?.showModal(); }}>
        <CrmIcon d={SEARCH} />Chiedi a Iris
      </button>
      <dialog ref={dialog} className="crm-iris-dialog" aria-labelledby="crm-iris-title" onClose={reset}>
        <form action={(fd) => { void submit(fd); }}>
          <h2 id="crm-iris-title" className="adm-h2">Chiedi a Iris</h2>
          <p className="crm-hint adm-muted">Una ricerca al giorno per founder. Iris cerca i lead e li unisce al Radar, senza inviare email.</p>
          {notice ? (
            <div className="crm-iris-warn" role="status">
              <p>{irisNoticeText(notice)}</p>
              <p className="adm-muted">{notice.zone} · {notice.sectors.join(", ")}</p>
              {notice.phase === "ready" ? <Link href={`${RADAR}?iris=${notice.id}` as Route}>Vedi i lead in Radar</Link> : null}
            </div>
          ) : null}
          <label className="adm-field"><span>Zona</span>
            <input className="adm-input" name="zone" required maxLength={120} disabled={blocked} placeholder="Alba, Cuneo, Langhe" />
          </label>
          <fieldset className="adm-field" disabled={blocked}>
            <legend>Settori</legend>
            <div className="crm-iris-chips">
              {sectors.map((s) => (
                <button type="button" key={s} className="crm-iris-chip" onClick={() => setSectors((cur) => cur.filter((x) => x !== s))}>{s} <span aria-hidden="true">×</span><span className="adm-sr">Rimuovi {s}</span></button>
              ))}
            </div>
            <div className="crm-iris-add">
              <input className="adm-input" value={draft} maxLength={60} placeholder="Cantine, poi Invio" disabled={blocked}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSector(); } }} />
              <button type="button" className="adm-btn adm-btn-sm" onClick={addSector} disabled={blocked}>Aggiungi</button>
            </div>
          </fieldset>
          <label className="adm-field"><span>Numero di lead</span>
            <input className="adm-input" name="count" type="number" min={10} max={50} defaultValue={30} required disabled={blocked} />
          </label>
          <fieldset className="adm-field" disabled={blocked}>
            <legend>Criterio sito</legend>
            <div className="crm-iris-checks">
              {SITE_CRITERIA.map((c) => (
                <label key={c}><input type="checkbox" checked={criteria.includes(c)} onChange={() => toggle(c)} />{SITE_CRITERION_LABEL[c]}</label>
              ))}
            </div>
          </fieldset>
          <label className="adm-field"><span>Note <span className="adm-muted">(facoltative)</span></span>
            <textarea className="adm-input" name="notes" maxLength={1000} rows={3} disabled={blocked} placeholder="Solo cantine con sala, evita le catene" />
          </label>
          {error ? <p className="adm-error" role="alert">{error}</p> : null}
          <div className="adm-row-actions">
            <button type="button" className="adm-btn" onClick={close}>Chiudi</button>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={blocked || pending}>{pending ? "Invio…" : "Invia la richiesta"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
