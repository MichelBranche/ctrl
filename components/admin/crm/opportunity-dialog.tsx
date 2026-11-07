"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createOpportunityAction, searchDealContactsAction } from "@/app/admin/crm-opportunity-actions";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import { DEAL_PRIORITIES, DEAL_PRIORITY_LABEL, STAGES, STAGE_LABEL, type Stage } from "@/lib/crm-core";
import { PIPELINE, pipelineSearch, type PipelineQuery } from "@/lib/crm-nav";

const PLUS = "M12 5v14M5 12h14";

/**
 * Explicit deal. The company is chosen here; nothing is written until «Apri opportunità».
 * Closing drops the draft. The idempotency key stops a double click from opening two deals.
 */
export function OpportunityDialog({ query, stage, owners, me, preset }: {
  query: PipelineQuery;
  stage: Stage;
  owners: { id: string; name: string }[];
  me: string;
  preset: { id: string; name: string; city: string | null } | null;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const key = useRef(crypto.randomUUID());
  const leaving = useRef(false);
  const [contact, setContact] = useState(preset);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [owner, setOwner] = useState(me);
  const [priority, setPriority] = useState("");
  const [phase, setPhase] = useState<Stage>(stage);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const reset = () => {
    key.current = crypto.randomUUID();
    setContact(preset); setQ(""); setHits([]); setTitle(""); setValue(""); setOwner(me); setPriority(""); setPhase(stage); setError(""); setPending(false);
  };
  const close = () => { leaving.current = true; dialog.current?.close(); };
  const open = () => { reset(); dialog.current?.showModal(); };

  useEffect(() => {
    const node = dialog.current;
    if (query.nuova && node && !node.open) node.showModal();
  }, [query.nuova]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => { void searchDealContactsAction(q).then(setHits).catch(() => setHits([])); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const submit = async () => {
    if (pending) return;
    setError("");
    if (!contact) { setError("Scegli l'azienda. Da qui non si crea un contatto nuovo."); return; }
    setPending(true);
    const result = await createOpportunityAction({
      contactId: contact.id, title, stage: phase, valueEur: value, ownerUserId: owner, priority: priority || null, idempotencyKey: key.current,
    }).catch(() => ({ error: "Non salvata. Riprova: se era già aperta non viene duplicata." }));
    setPending(false);
    if (!("id" in result) || !result.id) {
      setError("error" in result && result.error ? result.error : "Non salvata. Riprova.");
      return;
    }
    close();
    const next = pipelineSearch(query, { nuova: false, apri: "", contatto: "", c: contact.id, o: result.id, tab: "dettagli", tipo: "opportunita" });
    router.push(`${PIPELINE}${next}` as Route);
    router.refresh();
  };

  return (
    <>
      <button type="button" className="adm-btn adm-btn-primary" onClick={open}><CrmIcon d={PLUS} />Nuova opportunità</button>
      <dialog ref={dialog} className="crm-deal-dialog" aria-labelledby="crm-deal-dialog-title" onClose={() => {
        if (leaving.current) { leaving.current = false; return; }
        reset();
        if (query.nuova) router.push(`${PIPELINE}${pipelineSearch(query, { nuova: false, apri: "" })}` as Route);
      }}>
        <header className="crm-import-head">
          <h2 id="crm-deal-dialog-title" className="adm-h2">Nuova opportunità</h2>
          <button type="button" className="crm-icon-btn" onClick={close} aria-label="Chiudi">×</button>
        </header>
        <p className="adm-muted crm-import-lead">Si apre solo questa trattativa. Il contatto resta com&apos;è: niente email, niente punteggio, niente fase cambiata.</p>
        {error ? <p className="adm-error" role="alert">{error}</p> : null}
        <label className="adm-field">Azienda
          {contact ? (
            <span className="crm-deal-picked">{contact.name}{contact.city ? ` · ${contact.city}` : ""} <button type="button" className="adm-btn adm-btn-sm" onClick={() => { setContact(null); setQ(""); }}>Cambia</button></span>
          ) : (
            <>
              <input className="adm-input" value={q} placeholder="Cerca per nome, almeno 2 lettere" onChange={(e) => setQ(e.target.value)} aria-label="Cerca azienda" />
              {hits.length ? (
                <ul className="crm-deal-hits">
                  {hits.map((h) => <li key={h.id}><button type="button" onClick={() => { setContact(h); setHits([]); }}>{h.name}{h.city ? ` · ${h.city}` : ""}</button></li>)}
                </ul>
              ) : q.trim().length >= 2 ? <p className="adm-muted crm-hint">Nessuna azienda con questo nome.</p> : null}
            </>
          )}
        </label>
        <label className="adm-field">Nome della trattativa
          <input className="adm-input" value={title} maxLength={200} placeholder="Es. Sito nuovo, non il nome dell'azienda" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="crm-deal-grid">
          <label className="adm-field">Fase
            <select className="adm-input" value={phase} onChange={(e) => setPhase(e.target.value as Stage)}>
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="adm-field">Valore (euro)
            <input className="adm-input" inputMode="decimal" value={value} placeholder="Facoltativo" onChange={(e) => setValue(e.target.value)} />
          </label>
          <label className="adm-field">Priorità
            <select className="adm-input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">Nessuna</option>
              {DEAL_PRIORITIES.map((p) => <option key={p} value={p}>{DEAL_PRIORITY_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="adm-field">Responsabile
            <select className="adm-input" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Non assegnato</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        </div>
        <div className="adm-row-actions">
          <button type="button" className="adm-btn" onClick={close}>Annulla</button>
          <button type="button" className="adm-btn adm-btn-primary" disabled={pending} onClick={() => void submit()}>{pending ? "Apro…" : "Apri opportunità"}</button>
        </div>
      </dialog>
    </>
  );
}
