"use client";

import { useActionState, useState, useTransition } from "react";
import { cancelMeetingAction, createMeetingAction, disconnectGoogleAction, quickCallAction, type MeetState } from "@/app/admin/meet-actions";

export const MEET_NEW = "https://meet.new";

export type MemberOption = { id: string; name: string; email: string };

function Msg({ s }: { s: MeetState }) {
  return s.error
    ? <p className="mt-msg" data-tone="error" role="alert">{s.error}</p>
    : s.ok ? <p className="mt-msg" data-tone="ok" role="status">{s.ok}{s.url ? <> <a href={s.url} target="_blank" rel="noopener noreferrer">Entra ora</a></> : null}</p> : null;
}

const durationLabel = (m: number) => (m < 60 ? `${m} minuti` : m === 60 ? "1 ora" : `${m / 60} ore`.replace(".5", " e mezza"));

export function NewMeetingForm({ members, today, time, title, external }: { members: MemberOption[]; today: string; time: string; title?: string; external?: string }) {
  const [state, action, pending] = useActionState(createMeetingAction, {});
  return (
    <form action={action} className="mt-form">
      <label className="rb-field"><span>Titolo</span><input name="title" maxLength={120} required defaultValue={title} placeholder="Es. Allineamento progetto sito" /></label>
      <div className="mt-when">
        <label className="rb-field"><span>Data</span><input name="date" type="date" min={today} defaultValue={today} required /></label>
        <label className="rb-field"><span>Ora</span><input name="time" type="time" step={300} defaultValue={time} required /></label>
        <label className="rb-field"><span>Durata</span>
          <select name="minutes" defaultValue="30">
            {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="mt-people">
        <legend>Partecipanti dal team</legend>
        <div className="mt-chips">
          {members.map((m) => (
            <label key={m.id} className="mt-chip"><input type="checkbox" name="members" value={m.id} /><span>{m.name}</span></label>
          ))}
          {!members.length ? <span className="mt-hint">Nessun altro membro attivo.</span> : null}
        </div>
      </fieldset>
      <label className="rb-field"><span>Ospiti esterni (email separate da virgola)</span><input name="external" defaultValue={external} placeholder="cliente@azienda.it, altro@esempio.it" autoComplete="off" /></label>
      <label className="rb-field"><span>Note (finiscono nell&apos;invito)</span><textarea name="notes" rows={3} maxLength={2000} placeholder="Ordine del giorno, link utili…" /></label>
      <div className="mt-form-foot">
        <p className="mt-hint">Google Calendar crea il link Meet e manda l&apos;invito a tutti, te compreso.</p>
        <button className="rb-cta" disabled={pending}>{pending ? "Creo la riunione…" : "Crea riunione"}</button>
      </div>
      <Msg s={state} />
    </form>
  );
}

/** Copy-to-clipboard button with a short "Copiato" confirmation. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="rb-btn rb-btn-quiet mt-act" data-done={copied || undefined} onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
      {copied ? "Copiato" : "Copia link"}
    </button>
  );
}

export function MeetingActions({ id, url }: { id: string; url: string | null }) {
  const [state, setState] = useState<MeetState>({});
  const [pending, start] = useTransition();
  return (
    <span className="mt-actions">
      {url ? <a className="rb-cta rb-cta-sm mt-act" href={url} target="_blank" rel="noopener noreferrer">Entra</a> : null}
      {url ? <CopyLink url={url} /> : null}
      <button type="button" className="rb-btn rb-btn-quiet mt-act mt-danger" disabled={pending} onClick={() => { if (confirm("Annullare la riunione? Google avvisa tutti gli invitati.")) start(async () => setState(await cancelMeetingAction(id))); }}>
        {pending ? "Annullo…" : "Annulla"}
      </button>
      {state.error ? <span className="mt-msg" data-tone="error" role="alert">{state.error}</span> : null}
    </span>
  );
}

/** Team list: instant 30-minute Meet with that member. Opens the tab first (no popup blocker), then points it to the link. */
export function CallButton({ memberId, name, connected }: { memberId: string; name: string; connected: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };
  if (!connected) return <a className="adm-btn adm-btn-sm adm-call" href={MEET_NEW} target="_blank" rel="noopener noreferrer" onClick={stop} title="Google non collegato: apre un Meet vuoto">Chiama</a>;
  return (
    <span className="adm-call-wrap" onClick={stop}>
      <button type="button" className="adm-btn adm-btn-sm adm-call" disabled={pending} title={`Riunione Meet adesso con ${name} (30 minuti)`}
        onClick={(e) => {
          e.preventDefault();
          const tab = window.open("about:blank", "_blank");
          start(async () => {
            const r = await quickCallAction(memberId);
            if (r.url) { if (tab) tab.location.href = r.url; else window.location.href = r.url; }
            else { tab?.close(); setErr(r.error ?? "Errore"); }
          });
        }}>
        {pending ? "Chiamo…" : "Chiama"}
      </button>
      {err ? <span className="adm-error">{err}</span> : null}
    </span>
  );
}

export function DisconnectGoogle() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<MeetState>({});
  return (
    <span className="mt-disconnect">
      <button type="button" className="rb-btn rb-btn-quiet mt-danger" disabled={pending} onClick={() => { if (confirm("Scollegare l'account Google? Le riunioni già create restano nel calendario.")) start(async () => setState(await disconnectGoogleAction())); }}>Scollega Google</button>
      <Msg s={state} />
    </span>
  );
}
