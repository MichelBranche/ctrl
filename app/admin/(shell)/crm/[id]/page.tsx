import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { archiveAction, stageFormAction } from "@/app/admin/crm-actions";
import { ContactForm } from "@/components/admin/crm/contact-form";
import { CrmTabs, day, eur, romeToday, ScoreBadge } from "@/components/admin/crm/crm-ui";
import { DraftEditor } from "@/components/admin/crm/draft-editor";
import { requireSection } from "@/lib/admin";
import { crmOwners, getContact, listDrafts, listNotes } from "@/lib/crm";
import { SOURCE_LABEL, STAGES, STAGE_LABEL, websiteDomain } from "@/lib/crm-core";
import { NoteForm } from "@/components/admin/crm/note-form";

/** Build-time placeholder only (an invalid id renders notFound inside Suspense); real ids render on request. */
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return <main className="adm-main"><Suspense fallback={<p className="adm-muted" aria-busy="true">Caricamento…</p>}><Body params={params} /></Suspense></main>;
}

const when = (iso: string) => new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function Body({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("crm");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await getContact(id);
  if (!c) notFound();
  const [notes, drafts, owners] = await Promise.all([listNotes(id), listDrafts([id]), crmOwners()]);
  const today = romeToday();
  const mailSearch = c.email ?? websiteDomain(c.website);
  const meet = `/admin/riunioni?${new URLSearchParams({ titolo: `Call con ${c.businessName}`.slice(0, 120), ...(c.email ? { ospite: c.email } : {}) })}`;
  const href = c.website ? (/^https?:\/\//i.test(c.website) ? c.website : `https://${c.website}`) : null;
  return (
    <>
      <header className="adm-top">
        <div><p className="adm-muted"><Link href={"/admin/crm" as Route}>CRM</Link> · {SOURCE_LABEL[c.source]}{c.archived ? " · Archiviato" : ""}</p><h1 className="adm-h1">{c.businessName} <ScoreBadge score={c.score} /></h1></div>
        <div className="adm-row-actions">
          <Link className="adm-btn adm-btn-sm" href={meet as Route}>Organizza un Meet</Link>
          {mailSearch ? <Link className="adm-btn adm-btn-sm" href={`/admin/email?search=${encodeURIComponent(mailSearch)}` as Route}>Email collegate</Link> : null}
        </div>
      </header>
      <CrmTabs current="/admin/crm" />
      <div className="adm-grid2">
        <section className="adm-panel">
          <div className="adm-panel-head"><h2 className="adm-h2">Riepilogo</h2><span className="adm-badge">{STAGE_LABEL[c.stage]}</span></div>
          <dl className="crm-dl">
            {c.contactName ? <><dt>Referente</dt><dd>{c.contactName}</dd></> : null}
            {c.email ? <><dt>Email</dt><dd><a href={`mailto:${c.email}`}>{c.email}</a></dd></> : null}
            {c.phone ? <><dt>Telefono</dt><dd><a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a></dd></> : null}
            {href ? <><dt>Sito</dt><dd><a href={href} target="_blank" rel="noopener noreferrer nofollow">{c.website}</a></dd></> : null}
            {c.city || c.address ? <><dt>Luogo</dt><dd>{[c.address, c.city, c.region].filter(Boolean).join(", ")}</dd></> : null}
            {c.valueEur !== null ? <><dt>Valore</dt><dd>{eur(c.valueEur)}</dd></> : null}
            <dt>Prossima azione</dt><dd className={c.nextActionAt && c.nextActionAt.slice(0, 10) < today ? "adm-error" : undefined}>{c.nextAction ?? "Da definire"}{c.nextActionAt ? ` · ${day(c.nextActionAt)}` : ""}</dd>
            {c.ownerName ? <><dt>Responsabile</dt><dd>{c.ownerName}</dd></> : null}
            <dt>Creato</dt><dd>{when(c.createdAt)}</dd>
          </dl>
          {c.scoreReasons.length ? <ul className="crm-reasons">{c.scoreReasons.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
          <form action={stageFormAction} className="crm-filters">
            <input type="hidden" name="id" value={c.id} />
            <select className="adm-input" name="stage" defaultValue={c.stage} aria-label="Fase">{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            <button className="adm-btn adm-btn-sm">Cambia fase</button>
          </form>
          <form action={archiveAction}>
            <input type="hidden" name="id" value={c.id} /><input type="hidden" name="archived" value={c.archived ? "0" : "1"} />
            <button className={c.archived ? "adm-btn adm-btn-sm" : "adm-btn adm-btn-sm adm-btn-danger"}>{c.archived ? "Ripristina" : "Archivia"}</button>
          </form>
        </section>
        <section className="adm-panel">
          <div className="adm-panel-head"><h2 className="adm-h2">Note</h2><span className="adm-muted">{notes.length}</span></div>
          <NoteForm contactId={c.id} />
          <ol className="desk-list crm-timeline">
            {notes.map((n) => <li key={n.id} className="desk-item"><div className="desk-item-head"><strong>{n.author ?? "Sistema"}</strong><span className="adm-muted">{when(n.createdAt)}</span></div><p className="desk-note-body">{n.body}</p></li>)}
            {c.notes ? <li className="desk-item"><div className="desk-item-head"><strong>Note iniziali</strong></div><p className="desk-note-body">{c.notes}</p></li> : null}
          </ol>
        </section>
      </div>
      {drafts.length ? (
        <section className="adm-panel"><div className="adm-panel-head"><h2 className="adm-h2">Bozze email</h2></div>
          {drafts.map((d) => <details key={d.id} open={d.status === "bozza"}><summary>{d.subject} <span className="adm-badge">{d.status}</span></summary><DraftEditor draft={d} to={c.email} /></details>)}
        </section>
      ) : null}
      <section className="adm-panel"><details><summary className="adm-h2">Modifica contatto</summary><ContactForm contact={c} owners={owners} /></details></section>
    </>
  );
}
