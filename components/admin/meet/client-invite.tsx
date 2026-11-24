"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { cancelClientMeetingAction, inviteClientAction, type MeetState } from "@/app/admin/meet-actions";
import { CopyLink } from "@/components/admin/meet/meet-forms";

export type ContactOption = { id: string; label: string; name: string; email: string };

const DURATIONS = [15, 30, 45, 60, 90, 120];
const durLabel = (m: number) => (m < 60 ? `${m} minuti` : m === 60 ? "1 ora" : m === 90 ? "1 ora e mezza" : `${m / 60} ore`);

export function ClientInviteForm({ contacts, today, time, live, preset }: { contacts: ContactOption[]; today: string; time: string; live: boolean; preset?: ContactOption | null }) {
  const [state, action, pending] = useActionState(inviteClientAction, {});
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [contactId, setContactId] = useState(preset?.id ?? "");
  const pick = (id: string) => {
    setContactId(id);
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    if (nameRef.current) nameRef.current.value = c.name;
    if (emailRef.current) emailRef.current.value = c.email;
    if (titleRef.current && !titleRef.current.value) titleRef.current.value = `Videochiamata con Ctrl Agency`;
  };
  return (
    <form action={action} className="mt-form">
      {contacts.length ? (
        <label className="rb-field"><span>Contatto dal CRM (facoltativo)</span>
          <select name="contact_id" value={contactId} onChange={(e) => pick(e.target.value)}>
            <option value="">Nessuno, inserisco a mano</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      ) : null}
      <div className="mt-pair">
        <label className="rb-field"><span>Nome del cliente</span><input ref={nameRef} name="client_name" maxLength={120} required defaultValue={preset?.name} placeholder="Es. Mario Rossi" autoComplete="off" /></label>
        <label className="rb-field"><span>Email del cliente</span><input ref={emailRef} name="client_email" type="email" maxLength={254} required defaultValue={preset?.email} placeholder="mario@azienda.it" autoComplete="off" /></label>
      </div>
      <label className="rb-field"><span>Titolo</span><input ref={titleRef} name="title" maxLength={120} required defaultValue={preset ? "Videochiamata con Ctrl Agency" : undefined} placeholder="Es. Presentazione proposta sito web" /></label>
      <div className="mt-when">
        <label className="rb-field"><span>Data</span><input name="date" type="date" min={today} defaultValue={today} required /></label>
        <label className="rb-field"><span>Ora (Italia)</span><input name="time" type="time" step={300} defaultValue={time} required /></label>
        <label className="rb-field"><span>Durata</span>
          <select name="minutes" defaultValue="30">{DURATIONS.map((m) => <option key={m} value={m}>{durLabel(m)}</option>)}</select>
        </label>
      </div>
      <label className="rb-field"><span>Ordine del giorno (finisce nell&apos;email al cliente)</span><textarea name="agenda" rows={3} maxLength={2000} placeholder="Punti da discutere, materiali da preparare…" /></label>
      {!live ? (
        <label className="rb-field"><span>Link Google Meet</span><input name="meet_url" type="url" required placeholder="https://meet.google.com/abc-defg-hij" autoComplete="off" />
          <small className="mt-hint">Google Calendar non è collegato: crea il link da <a href="https://meet.new" target="_blank" rel="noopener noreferrer">meet.new</a> e incollalo qui.</small>
        </label>
      ) : null}
      <div className="mt-form-foot">
        <p className="mt-hint">{live ? "Creiamo l'evento con link Meet nel calendario dell'agenzia e il cliente riceve un invito professionale con la tua firma, il file per il calendario e il pulsante per entrare." : "Il cliente riceve un invito professionale con la tua firma, il file per il calendario e il pulsante per entrare."}</p>
        <button className="rb-cta" disabled={pending}>{pending ? "Invio l'invito…" : "Invia invito al cliente"}</button>
      </div>
      {state.error ? <p className="mt-msg" data-tone="error" role="alert">{state.error}</p> : state.ok ? <p className="mt-msg" data-tone="ok" role="status">{state.ok}{state.url ? <> <a href={state.url} target="_blank" rel="noopener noreferrer">Apri Meet</a></> : null}</p> : null}
    </form>
  );
}

export function ClientMeetingActions({ id, url }: { id: string; url: string }) {
  const [state, setState] = useState<MeetState>({});
  const [pending, start] = useTransition();
  return (
    <span className="mt-actions">
      <a className="rb-cta rb-cta-sm mt-act" href={url} target="_blank" rel="noopener noreferrer">Entra</a>
      <CopyLink url={url} />
      <button type="button" className="rb-btn rb-btn-quiet mt-act mt-danger" disabled={pending} onClick={() => {
        if (!confirm("Annullare la riunione con il cliente?")) return;
        const notify = confirm("Vuoi avvisare il cliente con un'email di annullamento?");
        start(async () => setState(await cancelClientMeetingAction(id, notify)));
      }}>{pending ? "Annullo…" : "Annulla"}</button>
      {state.error ? <span className="mt-msg" data-tone="error" role="alert">{state.error}</span> : null}
    </span>
  );
}
