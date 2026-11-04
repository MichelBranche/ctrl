import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { requireSection } from "@/lib/admin";
import { canAccess } from "@/lib/team-types";
import { ensureDeskSchema, ensureEmailSchema } from "@/lib/migrate";
import { db } from "@/lib/db";
import { DeskForm, DeskAction } from "@/components/admin/desk-controls";
import { MAIL_STATUSES, isMailStatus } from "@/lib/mail/workflow-types";

export default function DeskPage(){return <main className="adm-main"><Suspense fallback={<p className="adm-muted" role="status">Preparo la tua scrivania…</p>}><Body/></Suspense></main>;}
async function Body(){
  const me=await requireSection("desk");
  await Promise.all([ensureDeskSchema(),ensureEmailSchema()]);
  const emailAccess=canAccess(me,"email");
  const [items,mail]=await Promise.all([
    db().execute({sql:"SELECT id,kind,title,body,due,done,pinned FROM desk_items WHERE user_id=? ORDER BY done,pinned DESC,due IS NULL,due,created_at DESC",args:[me.id]}),
    emailAccess ? db().execute({sql:`SELECT c.message_key,r.subject,r.sender,COALESCE(w.status,'todo') AS status FROM email_claims c LEFT JOIN email_references r ON r.message_key=c.message_key LEFT JOIN email_workflow w ON w.message_key=c.message_key WHERE c.user_id=? ORDER BY c.claimed_at DESC`,args:[me.id]}) : Promise.resolve({rows:[]}),
  ]);
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const tasks=items.rows.filter(row=>row.kind==='task'),notes=items.rows.filter(row=>row.kind==='note');
  const dueToday=tasks.filter(row=>!row.done && row.due && String(row.due)<=today).length;
  const activeEmails=mail.rows.filter(row=>row.status!=='done');
  const renderItem=(row:typeof items.rows[number])=>{
    const task=row.kind==='task', done=Number(row.done)===1, due=row.due ? String(row.due) : "";
    return <li key={String(row.id)} className="desk-item" data-done={done || undefined}>
      <div className="desk-item-head"><strong>{row.pinned && !task ? "★ " : ""}{String(row.title)}</strong>{due ? <span className={due<today && !done ? "adm-error" : "adm-muted"}>{due<today && !done ? "Scaduta · " : due===today && !done ? "Oggi · " : ""}{new Date(due+'T12:00:00Z').toLocaleDateString('it-IT',{timeZone:'Europe/Rome',day:'numeric',month:'short',year:'numeric'})}</span> : null}</div>
      {row.body ? <p className="desk-note-body">{String(row.body)}</p> : null}
      <div className="adm-row-actions"><DeskAction id={String(row.id)} operation={task ? done ? 'reopen':'done' : done ? 'restore':'archive'}>{task ? done ? 'Riapri':'Completa' : done ? 'Ripristina':'Archivia'}</DeskAction>
      {!task && !done ? <DeskAction id={String(row.id)} operation={row.pinned ? 'unpin':'pin'}>{row.pinned ? 'Non fissare più':'Fissa in alto'}</DeskAction> : null}</div>
      <details className="desk-editor"><summary>Modifica</summary><DeskForm kind={task?'task':'note'} item={{id:String(row.id),title:String(row.title),body:String(row.body),due}}/></details>
    </li>;
  };
  const renderMail=(row:typeof mail.rows[number])=><li key={String(row.message_key)} className="desk-item"><Link className="desk-mail-link" href={(`/admin/desk/email?key=${row.message_key}`) as Route}>{String(row.subject || "Email presa in carico")}</Link><div className="desk-item-head"><span className="adm-muted">{String(row.sender || "Apri la casella per recuperare il riferimento")}</span><span className="mail-workflow-badge" data-status={String(row.status)}>{isMailStatus(row.status) ? MAIL_STATUSES[row.status] : MAIL_STATUSES.todo}</span></div></li>;
  return <>
    <header className="adm-top"><div><p className="adm-muted">Il tuo spazio personale</p><h1 className="adm-h1">La mia scrivania</h1><p className="adm-muted">Ciao {me.name}, qui trovi quello di cui occuparti.</p></div></header>
    <div className="desk-summary" aria-label="Riepilogo personale"><span><strong>{dueToday}</strong> attività per oggi o scadute</span><span><strong>{tasks.filter(row=>!row.done).length}</strong> attività aperte</span>{emailAccess ? <span><strong>{activeEmails.length}</strong> email da seguire</span> : null}</div>
    <div className="desk-grid"><section className="adm-panel"><div className="adm-panel-head"><h2 className="adm-h2">Da fare</h2><span className="adm-muted">Solo tu</span></div><details className="desk-add"><summary>+ Nuova attività</summary><DeskForm kind="task"/></details>
      <ul className="desk-list">{tasks.filter(row=>!row.done).map(renderItem)}</ul>{!tasks.some(row=>!row.done) ? <p className="adm-muted">Nessuna attività aperta. Aggiungi il prossimo passo o una consegna da ricordare.</p> : null}
      {tasks.some(row=>row.done) ? <details><summary>Completate ({tasks.filter(row=>row.done).length})</summary><ul className="desk-list">{tasks.filter(row=>row.done).map(renderItem)}</ul></details> : null}</section>
    <section className="adm-panel"><div className="adm-panel-head"><h2 className="adm-h2">Le mie email</h2>{emailAccess ? <Link href="/admin/email">Apri casella →</Link> : null}</div>
      {!emailAccess ? <p className="adm-muted">L’accesso alla casella condivisa non è attivo per il tuo account.</p> : <><ul className="desk-list">{activeEmails.map(renderMail)}</ul>{!activeEmails.length ? <p className="adm-muted">Nessuna email da seguire. Premi “Prendi in carico” nella casella per ritrovarla qui.</p> : null}{mail.rows.some(row=>row.status==='done') ? <details><summary>Concluse ({mail.rows.length-activeEmails.length})</summary><ul className="desk-list">{mail.rows.filter(row=>row.status==='done').map(renderMail)}</ul></details> : null}</>}
    </section>
    <section className="adm-panel desk-notes"><div className="adm-panel-head"><h2 className="adm-h2">Note personali</h2><span className="adm-muted">Private · Solo tu</span></div><details className="desk-add"><summary>+ Nuova nota</summary><DeskForm kind="note"/></details><ul className="desk-list">{notes.filter(row=>!row.done).map(renderItem)}</ul>{!notes.some(row=>!row.done) ? <p className="adm-muted">Appunti, idee e riferimenti da tenere a portata di mano.</p> : null}{notes.some(row=>row.done) ? <details><summary>Archiviate ({notes.filter(row=>row.done).length})</summary><ul className="desk-list">{notes.filter(row=>row.done).map(renderItem)}</ul></details> : null}</section></div>
  </>;
}
