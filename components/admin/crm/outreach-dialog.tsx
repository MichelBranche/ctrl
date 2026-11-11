"use client";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef } from "react";
import type { OutreachContactWarning, OutreachWarning } from "@/lib/crm-outreach-types";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" }) : "");

function headline(c: OutreachContactWarning): string {
  switch (c.reason) {
    case "owner_other": return `Questo contatto è seguito da ${c.ownerName ?? "un collega"}${c.ownerActive === false ? " (non fa più parte del team)" : ""}`;
    case "contacted_unassigned": return "Questo contatto risulta già contattato, ma non ha un responsabile";
    case "recent": return "A questo contatto è già stata inviata un'email di recente";
    case "uncertain": return "L'ultimo invio a questo contatto ha avuto un esito incerto";
  }
}

function detail(c: OutreachContactWarning): string | null {
  if (c.reason === "uncertain") return "Potrebbe essere già partito: controlla in Posta › Inviati prima di scrivere di nuovo.";
  if (c.lastSentAt) return `Ultima email dall'agenzia: ${when(c.lastSentAt)}${c.lastSentByName && c.reason !== "contacted_unassigned" ? ` (inviata da ${c.lastSentByName})` : ""}.`;
  return null;
}

/**
 * In-app warning before writing to CRM contacts that someone else follows, were contacted already, or got an email
 * moments ago. "Continua comunque" only unlocks writing (it never sends); "Annulla" sends and assigns nothing.
 */
export function OutreachDialog({ warning, onContinue, onCancel }: { warning: OutreachWarning; onContinue: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (d?.open) d.close(); };
  }, []);
  const first = warning.contacts[0];
  const title = warning.generic
    ? "Uno o più destinatari sono già seguiti o contattati di recente da un collega"
    : warning.contacts.length === 1 ? headline(first) : `${warning.contacts.length} destinatari richiedono attenzione`;
  return (
    <dialog ref={ref} className="crm-outreach" aria-labelledby="crm-outreach-title" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      {warning.updated ? <p className="crm-outreach-updated" role="status">Avviso aggiornato: la situazione è cambiata da quando hai confermato.</p> : null}
      <h2 id="crm-outreach-title" className="adm-h2">{title}</h2>
      {warning.generic ? (
        <p className="adm-muted">Controlla con il team prima di scrivere, per non mandare più email alla stessa persona.</p>
      ) : (
        <ul className="crm-outreach-list">
          {warning.contacts.map((c) => (
            <li key={c.id}>
              {warning.contacts.length > 1 ? <strong>{c.name}: {headline(c).toLowerCase().replace(/^questo contatto /, "")}</strong> : <strong>{c.name}</strong>}
              {detail(c) ? <span className="adm-muted">{detail(c)}</span> : null}
              {warning.contacts.length > 1 ? <Link className="adm-link" href={c.mailHref as Route}>Vedi conversazione</Link> : null}
            </li>
          ))}
        </ul>
      )}
      <div className="adm-row-actions crm-outreach-actions">
        {!warning.generic && warning.contacts.length === 1 ? <Link className="adm-btn" href={first.mailHref as Route}>Vedi conversazione</Link> : null}
        <button type="button" className="adm-btn adm-btn-primary" onClick={onContinue}>Continua comunque</button>
        <button type="button" className="adm-btn" onClick={onCancel} autoFocus>Annulla</button>
      </div>
    </dialog>
  );
}
