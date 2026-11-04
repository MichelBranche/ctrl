"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { saveDeskItem, changeDeskItem } from "@/app/admin/desk-actions";
export function DeskForm({kind,item}:{kind:"task"|"note";item?:{id:string;title:string;body:string;due:string}}) {
  const [state,action,pending]=useActionState(saveDeskItem,{}); const form=useRef<HTMLFormElement>(null);
  useEffect(()=>{if(state.ok && !item)form.current?.reset();},[state,item]);
  return <form ref={form} action={action} className="adm-form">
    <input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={item?.id ?? ""}/>
    <label className="adm-field"><span>{kind==='task' ? "Cosa devi fare?" : "Titolo della nota"}</span><input className="adm-input" name="title" required maxLength={180} defaultValue={item?.title} disabled={pending}/></label>
    {kind==='task' ? <label className="adm-field"><span>Scadenza (facoltativa)</span><input className="adm-input" name="due" type="date" defaultValue={item?.due} disabled={pending}/></label> : null}
    <label className="adm-field"><span>{kind==='task' ? "Dettagli (facoltativi)" : "Appunti"}</span><textarea className="adm-input" name="body" rows={3} maxLength={6000} defaultValue={item?.body} disabled={pending}/></label>
    <div className="adm-row-actions"><button className="adm-btn adm-btn-primary" disabled={pending}>{pending ? "Salvataggio…" : item ? "Salva modifiche" : kind==='task' ? "Aggiungi attività" : "Salva nota"}</button><span role="status" className={state.error ? "adm-error" : "adm-muted"}>{state.error ?? state.ok}</span></div>
  </form>;
}
export function DeskAction({id,operation,children}:{id:string;operation:string;children:React.ReactNode}) {
  const [pending,start]=useTransition(),[error,setError]=useState("");
  return <><button className="adm-btn" disabled={pending} onClick={()=>start(async()=>{try{const result=await changeDeskItem(id,operation);setError(result.error ?? "");}catch{setError("Operazione non riuscita.");}})}>{pending ? "Salvataggio…" : children}</button>{error ? <span role="alert" className="adm-error">{error}</span> : null}</>;
}
