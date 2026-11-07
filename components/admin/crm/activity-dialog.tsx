"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createActivityAction, updateActivityAction } from "@/app/admin/crm-activity-actions";
import { searchDealContactsAction } from "@/app/admin/crm-opportunity-actions";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import { ACTIVITY_KINDS, ACTIVITY_KIND_LABEL, DEAL_PRIORITIES, DEAL_PRIORITY_LABEL, type ActivityKind } from "@/lib/crm-core";
import { ATTIVITA, activitySearch, type ActivityQuery } from "@/lib/crm-nav";

const PLUS = "M12 5v14M5 12h14";

export type ActivityDraftView = {
  id: string; version: number; title: string; kind: ActivityKind; dueDate: string; dueTime: string | null;
  priority: string | null; assigneeUserId: string | null; contactId: string | null; contactName: string | null;
  opportunityId: string | null;
};

/**
 * Explicit activity. Nothing is written until the person confirms.
 * A non-founder can only assign it to themselves. Closing drops an unsaved draft.
 */
export function ActivityDialog({ query, owners, me, founder, preset, editing, deals }: {
  query: ActivityQuery;
  owners: { id: string; name: string }[];
  me: string;
  founder: boolean;
  preset: { id: string; name: string } | null;
  editing: ActivityDraftView | null;
  deals: { id: string; title: string }[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const key = useRef(crypto.randomUUID());
  const leaving = useRef(false);
  const [contact, setContact] = useState(preset ?? (editing?.contactId ? { id: editing.contactId, name: editing.contactName ?? "Contatto" } : null));
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [kind, setKind] = useState<ActivityKind>(editing?.kind ?? "followup");
  const [due, setDue] = useState(editing?.dueDate ?? "");
  const [time, setTime] = useState(editing?.dueTime ?? "");
  const [priority, setPriority] = useState(editing?.priority ?? "");
  const [assignee, setAssignee] = useState(editing?.assigneeUserId ?? me);
  const [deal, setDeal] = useState(editing?.opportunityId ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const close = () => { leaving.current = true; dialog.current?.close(); };
  const goBack = () => {
    const next = activitySearch(query, { nuova: false, a: "", contatto: "" });
    router.replace((next ? `${ATTIVITA}${next}` : ATTIVITA) as Route);
  };
  const cancel = () => { close(); goBack(); };
  const open = () => { setError(""); dialog.current?.showModal(); };

  useEffect(() => {
    const node = dialog.current;
    if ((query.nuova || editing) && node && !node.open) node.showModal();
  }, [query.nuova, editing]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => { void searchDealContactsAction(q).then(setHits).catch(() => setHits([])); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const submit = async () => {
    if (pending) return;
    setError("");
    if (!title.trim() || !due) { setError("Servono un titolo e una data."); return; }
    setPending(true);
    const common = {
      title, kind, dueDate: due, dueTime: time, priority: priority || null,
      assigneeUserId: founder ? (assignee || null) : me,
      contactId: contact?.id ?? null, opportunityId: deal || null,
    };
    const result = editing
      ? await updateActivityAction({ ...common, id: editing.id, version: editing.version }).catch(() => ({ error: "Non salvata. Riprova." }))
      : await createActivityAction({ ...common, idempotencyKey: key.current }).catch(() => ({ error: "Non salvata. Riprova: se era già creata non viene duplicata." }));
    setPending(false);
    if (!("ok" in result) || !result.ok) {
      setError("error" in result && result.error ? result.error : "Non salvata. Riprova.");
      return;
    }
    close();
    const next = activitySearch(query, { nuova: false, contatto: "", a: "", c: contact?.id ?? query.c });
    router.push(`${ATTIVITA}${next}` as Route);
    router.refresh();
  };

  return (
    <>
      <button type="button" className="adm-btn adm-btn-primary" onClick={open}><CrmIcon d={PLUS} />Nuova attività</button>
      <dialog ref={dialog} className="crm-deal-dialog" aria-labelledby="crm-activity-dialog-title" onClose={() => {
        if (leaving.current) { leaving.current = false; return; }
        goBack();
      }}>
        <h2 id="crm-activity-dialog-title" className="adm-h2">{editing ? "Modifica attività" : "Nuova attività"}</h2>
        <p className="adm-muted">Si crea solo da qui. Un follow-up già sulla scheda, un&apos;email o un punteggio Iris non diventano un&apos;attività.</p>
        <label className="adm-field">Titolo
          <input className="adm-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </label>
        <div className="crm-deal-grid">
          <label className="adm-field">Tipo
            <select className="adm-input" value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)}>
              {ACTIVITY_KINDS.map((k) => <option key={k} value={k}>{ACTIVITY_KIND_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="adm-field">Priorità
            <select className="adm-input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">Nessuna</option>
              {DEAL_PRIORITIES.map((p) => <option key={p} value={p}>{DEAL_PRIORITY_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="adm-field">Data
            <input className="adm-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
          </label>
          <label className="adm-field">Orario (Roma)
            <input className="adm-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label className="adm-field">Contatto
          {contact ? (
            <span className="crm-deal-picked"><strong>{contact.name}</strong><button type="button" className="adm-btn adm-btn-sm" onClick={() => { setContact(null); setDeal(""); }}>Togli</button></span>
          ) : (
            <>
              <input className="adm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca un'azienda già in rubrica" aria-label="Cerca contatto" />
              {hits.length ? <ul className="crm-deal-hits">{hits.map((h) => <li key={h.id}><button type="button" onClick={() => { setContact({ id: h.id, name: h.name }); setHits([]); setQ(""); }}>{h.name}{h.city ? ` · ${h.city}` : ""}</button></li>)}</ul> : null}
            </>
          )}
        </label>
        {deals.length ? (
          <label className="adm-field">Opportunità
            <select className="adm-input" value={deal} onChange={(e) => setDeal(e.target.value)}>
              <option value="">Nessuna</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </label>
        ) : <p className="adm-muted">Nessuna opportunità collegata. Da qui non se ne apre una.</p>}
        {founder ? (
          <label className="adm-field">Assegnata a
            <select className="adm-input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Non assegnata</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.id === me ? `${o.name} (tu)` : o.name}</option>)}
            </select>
          </label>
        ) : <p className="adm-muted">Resta assegnata a te. L&apos;elenco del team è riservato al founder.</p>}
        {error ? <p className="adm-error" role="alert">{error}</p> : null}
        <div className="adm-row-actions">
          <button type="button" className="adm-btn adm-btn-primary" disabled={pending} onClick={() => void submit()}>{pending ? "Salvo…" : editing ? "Salva" : "Crea attività"}</button>
          <button type="button" className="adm-btn" onClick={cancel}>Annulla</button>
        </div>
      </dialog>
    </>
  );
}
