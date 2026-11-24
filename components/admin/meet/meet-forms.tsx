"use client";

import { useState, useTransition } from "react";
import { disconnectGoogleAction, quickCallAction, type MeetState } from "@/app/admin/meet-actions";

export const MEET_NEW = "https://meet.new";

export type MemberOption = { id: string; name: string; email: string };

function Msg({ s }: { s: MeetState }) {
  return s.error
    ? <p className="mt-msg" data-tone="error" role="alert">{s.error}</p>
    : s.ok ? <p className="mt-msg" data-tone="ok" role="status">{s.ok}{s.url ? <> <a href={s.url} target="_blank" rel="noopener noreferrer">Entra ora</a></> : null}</p> : null;
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
