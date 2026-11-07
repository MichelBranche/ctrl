"use client";
import { useActionState, useState, useTransition } from "react";
import { discardDraftAction, saveDraftAction, sendDraftAction, type CrmState } from "@/app/admin/crm-actions";
import { OutreachDialog } from "@/components/admin/crm/outreach-dialog";

export type DraftView = { id: string; contactId: string; subject: string; bodyText: string; bodyHtml: string | null; status: "bozza" | "inviata" | "scartata"; sentAt: string | null };

/** View/edit one draft. Sending happens only on the explicit "Invia" click, after a confirm. */
export function DraftEditor({ draft, to, canSend }: { draft: DraftView; to: string | null; canSend: boolean }) {
  const [state, action, saving] = useActionState<CrmState, FormData>(saveDraftAction, {});
  const [result, setResult] = useState<CrmState>({});
  const [busy, start] = useTransition();
  const editable = draft.status === "bozza";
  /** Consent from the CRM warning dialog; the server checks it against the contact's current state at send time. */
  const [consent, setConsent] = useState("");
  const [warningOpen, setWarningOpen] = useState(false);
  const run = (fn: () => Promise<CrmState>) => start(async () => {
    const r = await fn().catch(() => ({ error: "Operazione non riuscita. Riprova." }) as CrmState);
    if (r.warning) { setConsent(""); setWarningOpen(true); }
    setResult(r);
  });
  return (
    <div className="crm-draft">
      {warningOpen && result.warning ? (
        <OutreachDialog key={result.warning.ack} warning={result.warning}
          onContinue={() => { setConsent(result.warning!.ack); setWarningOpen(false); }}
          onCancel={() => setWarningOpen(false)} />
      ) : null}
      <form action={action} className="adm-form">
        <input type="hidden" name="id" value={draft.id} />
        <input type="hidden" name="contact_id" value={draft.contactId} />
        <label className="adm-field"><span>Oggetto</span><input className="adm-input" name="subject" defaultValue={draft.subject} maxLength={300} required readOnly={!editable} /></label>
        <label className="adm-field"><span>Testo</span><textarea className="adm-input" name="body_text" rows={10} defaultValue={draft.bodyText} maxLength={20000} required readOnly={!editable} /></label>
        {draft.bodyHtml ? (
          <details><summary>Anteprima HTML proposta</summary>
            <iframe className="crm-preview" sandbox="" srcDoc={draft.bodyHtml} title="Anteprima bozza" />
            <p className="adm-muted">L&apos;invio usa il testo qui sopra nel modello grafico dell&apos;agenzia.</p>
          </details>
        ) : null}
        {state.error ? <p className="adm-error" role="alert">{state.error}</p> : null}
        {state.ok ? <p className="adm-ok" role="status">{state.ok}</p> : null}
        {result.error ? <p className="adm-error" role="alert">{result.error}</p> : null}
        {result.warning && !consent ? <p className="adm-error" role="alert">Non inviata: leggi l&apos;avviso sul contatto.</p> : null}
        {result.ok ? <p className="adm-ok" role="status">{result.ok}</p> : null}
        {editable ? (
          <div className="adm-row-actions">
            <button className="adm-btn adm-btn-sm" disabled={saving || busy}>{saving ? "Salvo…" : "Salva bozza"}</button>
            <button type="button" className="adm-btn adm-btn-sm adm-btn-primary" disabled={!to || !canSend || saving || busy}
              title={!canSend ? "Serve l'accesso alla casella Email" : to ? `Invia a ${to}` : "Il contatto non ha un indirizzo email"}
              onClick={() => { if (to && canSend && window.confirm(`Inviare l'email a ${to}? Salva prima le modifiche.`)) run(() => sendDraftAction(draft.id, consent || null)); }}>
              {busy ? "Invio…" : consent ? "Invia comunque" : "Invia"}
            </button>
            <button type="button" className="adm-btn adm-btn-sm adm-btn-danger" disabled={saving || busy} onClick={() => { if (window.confirm("Scartare questa bozza?")) run(() => discardDraftAction(draft.id)); }}>Scarta</button>
            {!canSend ? <span className="adm-muted">Per inviare serve l&apos;accesso alla casella Email dell&apos;agenzia.</span> : null}
          </div>
        ) : <p className="adm-muted">{draft.status === "inviata" ? `Inviata${draft.sentAt ? ` il ${new Date(draft.sentAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}` : ""}.` : "Bozza scartata."}</p>}
      </form>
    </div>
  );
}
