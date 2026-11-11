"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addInternalNote, updateMailStatus } from "@/app/admin/email-workflow-actions";
import { MAIL_STATUSES, type MailStatus, type InternalNote } from "@/lib/mail/workflow-types";
import { UserAvatar } from "@/components/admin/user-avatar";

export function MailWorkflow({ mkey, status, count }: { mkey: string; status: MailStatus; count: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return <div className="mail-workflow">
    <label className="adm-field"><span>Stato di lavorazione</span><select className="adm-input" value={status} disabled={pending} onChange={event => {
      const next = event.target.value;
      start(async () => { setError(""); try { const result = await updateMailStatus(mkey,next); if(result.error) setError(result.error); else window.dispatchEvent(new Event("ctrl-mail-changed")); } catch { setError("Stato non salvato. Riprova."); } });
    }}>{Object.entries(MAIL_STATUSES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {pending ? <span role="status" className="adm-muted">Salvataggio…</span> : null}
    {error ? <p role="alert" className="adm-error">{error}</p> : null}
    <InternalNotes key={mkey} mkey={mkey} count={count} />
  </div>;
}

function InternalNotes({ mkey, count }: { mkey: string; count: number }) {
  const [open,setOpen] = useState(false);
  const [notes,setNotes] = useState<InternalNote[]>([]);
  const [hasMore,setHasMore] = useState(false);
  const allOlderLoaded = useRef(false);
  const [loaded,setLoaded] = useState(false);
  const [loadError,setLoadError] = useState("");
  const [error,setError] = useState("");
  const [body,setBody] = useState("");
  const requestId = useRef<string | null>(null);
  const [pending,start] = useTransition();
  const [revision,setRevision] = useState(0);
  const [olderPending,setOlderPending] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); let active = true;
    const refresh = async () => {
      if(document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/admin/email/notes?key=${mkey}`, { cache:"no-store",signal:controller.signal });
        if(!response.ok) throw new Error();
        const data = await response.json() as {notes:InternalNote[];hasMore:boolean};
        if(active) { setNotes(old => [...new Map([...old,...data.notes].map(note=>[note.id,note])).values()].sort((a,b)=>b.id-a.id)); setHasMore(!allOlderLoaded.current && data.hasMore); setLoaded(true); setLoadError(""); }
      } catch { if(active && !controller.signal.aborted) setLoadError("Note non disponibili. Riprova."); }
    };
    void refresh(); const timer=setInterval(()=>void refresh(),8000);
    document.addEventListener("visibilitychange",refresh);
    return ()=>{ active=false;controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",refresh); };
  },[mkey,open,revision,count]);
  return <details className="mail-internal-notes" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>Note interne <span className="adm-muted">{count || ""} · Solo staff</span></summary>
    {open ? <div className="mail-notes-content">
      <p className="adm-muted">Queste note restano nell’admin e non vengono inviate al cliente.</p>
      <form onSubmit={event=>{ event.preventDefault(); if(!body.trim() || pending) return; requestId.current ??= crypto.randomUUID(); const id=requestId.current;
        start(async()=>{setError("");try {const result=await addInternalNote(mkey,body,id);if(result.error){setError(result.error);return;}setBody("");requestId.current=null;setRevision(v=>v+1);window.dispatchEvent(new Event("ctrl-mail-changed"));}catch{setError("Nota non salvata. Il testo è conservato: riprova.");}});
      }}>
        <label className="adm-field"><span>Nuova nota interna</span><textarea className="adm-input" rows={3} maxLength={4000} value={body} disabled={pending} required onChange={event=>{setBody(event.target.value);requestId.current=null;}} /></label>
        <div className="adm-row-actions"><button className="adm-btn" disabled={pending || !body.trim()}>{pending ? "Salvataggio…" : "Aggiungi nota"}</button><span className="adm-muted">{body.length}/4000</span></div>
        {error ? <p role="alert" className="adm-error">{error}</p> : null}
      </form>
      {loadError ? <p role="alert" className="adm-error">{loadError} <button className="adm-btn" onClick={()=>setRevision(v=>v+1)}>Riprova</button></p> : !loaded ? <p role="status">Caricamento note…</p> : !notes.length ? <p className="adm-muted">Nessuna nota interna.</p> : null}
      <ul className="mail-notes-list">{notes.map(note=><li key={note.id}><div className="adm-person"><UserAvatar name={note.name} src={note.avatarUrl} small /><strong>{note.name}</strong><time className="adm-muted" dateTime={note.at}>{new Date(note.at).toLocaleString("it-IT",{timeZone:"Europe/Rome",dateStyle:"short",timeStyle:"short"})}</time></div><p>{note.body}</p></li>)}</ul>
      {hasMore ? <button className="adm-btn" disabled={olderPending} onClick={async()=>{setOlderPending(true);try{const response=await fetch(`/admin/email/notes?key=${mkey}&before=${notes.at(-1)?.id}`,{cache:"no-store"});if(!response.ok)throw new Error();const data=await response.json() as {notes:InternalNote[];hasMore:boolean};setNotes(old=>[...new Map([...old,...data.notes].map(note=>[note.id,note])).values()].sort((a,b)=>b.id-a.id));allOlderLoaded.current = !data.hasMore;setHasMore(data.hasMore);}catch{setLoadError("Impossibile caricare le note precedenti.");}finally{setOlderPending(false);}}}>{olderPending ? "Caricamento…" : "Note precedenti"}</button> : null}
    </div> : null}
  </details>;
}
