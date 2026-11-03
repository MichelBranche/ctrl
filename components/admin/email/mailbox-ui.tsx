"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, useActionState, useOptimistic, type ReactNode } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { createMailLabel, organizeMail } from "@/app/admin/email-actions";
import type { FolderId, MailLabel, MailMutation } from "@/lib/mail/types";

const paths = {
  inbox: "M4 4h16l2 12v4H2v-4L4 4Zm-2 12h6l2 3h4l2-3h6",
  archive: "M3 3h18v5H3zM5 8v13h14V8M10 12h4",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z",
  read: "m3 8 9 6 9-6M3 8l9-6 9 6v13H3V8Z",
  unread: "M3 5h18v15H3V5Zm0 0 9 8 9-8",
  label: "M3 3h9l9 9-9 9-9-9V3Zm4 4h.01",
  spam: "m8 2 8 0 6 6v8l-6 6H8l-6-6V8l6-6ZM12 7v6m0 4h.01",
  search: "M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  sent: "m22 2-7 20-4-9L2 9 22 2ZM11 13l11-11",
  drafts: "M6 3h10l4 4v14H4V3h2Zm9 0v6h5M8 13h8M8 17h5",
  all: "M3 3h18v18H3V3ZM7 8h10M7 12h10M7 16h6",
  write: "m16 3 5 5M4 20l5-1L21 7l-5-5L4 14v6Z",
} as const;
export function MailIcon({ name }: { name: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name as keyof typeof paths] ?? paths.label} /></svg>;
}

type Selection = { selected: Set<number>; toggle: (uid: number) => void; all: number[]; set: (uids: number[]) => void; folder: FolderId; labels: MailLabel[] };
const EMPTY_LABELS: string[] = [];
const SelectionContext = createContext<Selection | null>(null);
export function MailSelection({ folder, uids, labels, children }: { folder: FolderId; uids: number[]; labels: MailLabel[]; children: ReactNode }) {
  const [selected, setSelected] = useState(new Set<number>());

  return <SelectionContext.Provider value={{ selected, toggle: (uid) => setSelected((old) => { const next = new Set(old); if (next.has(uid)) next.delete(uid); else next.add(uid); return next; }), all: uids, set: (ids) => setSelected(new Set(ids)), folder, labels }}>{children}</SelectionContext.Provider>;
}

export function MailRowCheck({ uid, subject }: { uid: number; subject: string }) {
  const ctx = useContext(SelectionContext)!;
  return <input type="checkbox" className="mail-check" aria-label={`Seleziona ${subject || "messaggio senza oggetto"}`} checked={ctx.selected.has(uid)} onChange={() => ctx.toggle(uid)} />;
}

function OperationButton({ icon, text, disabled, run }: { icon: string; text: string; disabled: boolean; run: () => void }) {
  return <button type="button" className="mail-tool" title={text} aria-label={text} disabled={disabled} onClick={run}><MailIcon name={icon} /><span>{text}</span></button>;
}

export function MailMessageActions({ folder, uids, labels, starred, applied, onDone, backHref }: { backHref?: string; folder: FolderId; uids: number[]; labels: MailLabel[]; starred?: boolean; applied?: string[]; onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [labelValues, updateLabels] = useOptimistic(applied ?? EMPTY_LABELS, (values, change: { label: string; add: boolean }) => change.add ? [...new Set([...values, change.label])] : values.filter((value) => value !== change.label));
  const busy = pending || !uids.length;
  const run = (operation: MailMutation, label?: string) => start(async () => {
    setError("");
    if (label && (operation === "label" || operation === "unlabel")) updateLabels({ label, add: operation === "label" });
    try {
      const result = await organizeMail(folder, uids, operation, label);
      if (result.error) { setError(result.error); return; }
      onDone?.();
      if (backHref && ["archive", "trash", "spam", "inbox"].includes(operation)) router.replace(backHref as Route);
      else router.refresh();
      window.dispatchEvent(new Event("ctrl-mail-changed"));
    } catch { setError("Connessione interrotta. Riprova tra poco."); }
  });
  return <div className="mail-action-area" aria-busy={pending}>
    <div className="mail-tools">
      {folder !== "trash" && folder !== "spam" && folder !== "drafts" ? <OperationButton icon="archive" text="Archivia" disabled={busy} run={() => run("archive")} /> : null}
      {folder !== "inbox" ? <OperationButton icon="inbox" text="Sposta in arrivo" disabled={busy} run={() => run("inbox")} /> : null}
      {folder !== "spam" ? <OperationButton icon="spam" text="Segnala spam" disabled={busy} run={() => run("spam")} /> : null}
      {folder !== "trash" ? <OperationButton icon="trash" text="Cestina" disabled={busy} run={() => run("trash")} /> : null}
      <span className="mail-tool-separator" />
      <OperationButton icon="read" text="Segna letta" disabled={busy} run={() => run("read")} />
      <OperationButton icon="unread" text="Segna non letta" disabled={busy} run={() => run("unread")} />
      <OperationButton icon="star" text={starred ? "Rimuovi speciale" : "Segna speciale"} disabled={busy} run={() => run(starred ? "unstar" : "star")} />
      <details className="mail-label-menu">
        <summary aria-label="Gestisci etichette"><MailIcon name="label" /><span>Etichette</span></summary>
        <div className="mail-label-popover">
          <strong>Applica etichetta</strong>
          {labels.length ? labels.map((label) => applied ? <label key={label.id}><input type="checkbox" disabled={busy} checked={labelValues.includes(label.name)} onChange={(event) => run(event.target.checked ? "label" : "unlabel", label.name)} />{label.name}</label> : <div className="mail-bulk-label" key={label.id}><span>{label.name}</span><button type="button" disabled={busy} onClick={() => run("label", label.name)} aria-label={`Applica ${label.name}`}>+</button><button type="button" disabled={busy} onClick={() => run("unlabel", label.name)} aria-label={`Rimuovi ${label.name}`}>−</button></div>) : <p>Crea prima un’etichetta dalla barra laterale.</p>}
        </div>
      </details>
      {pending ? <span className="mail-operation-state" role="status">Salvataggio…</span> : null}
    </div>
    {error ? <p className="adm-error" role="alert">{error}</p> : null}
  </div>;
}

export function MailSelectionBar() {
  const ctx = useContext(SelectionContext)!;
  const check = useRef<HTMLInputElement>(null);
  useEffect(() => { if (check.current) check.current.indeterminate = ctx.selected.size > 0 && ctx.selected.size < ctx.all.length; }, [ctx.selected, ctx.all.length]);
  return <div className="mail-selection-bar">
    <input ref={check} type="checkbox" className="mail-check" aria-label="Seleziona tutti i messaggi della pagina" checked={ctx.all.length > 0 && ctx.selected.size === ctx.all.length} disabled={!ctx.all.length} onChange={() => ctx.set(ctx.selected.size === ctx.all.length ? [] : ctx.all)} />
    {ctx.selected.size ? <><span className="mail-selected-count">{ctx.selected.size} selezionati</span><MailMessageActions folder={ctx.folder} uids={[...ctx.selected]} labels={ctx.labels} onDone={() => ctx.set([])} /></> : <span className="adm-muted">Seleziona i messaggi per organizzarli</span>}
  </div>;
}

export function MailStar({ folder, uid, starred = false }: { folder: FolderId; uid: number; starred?: boolean }) {
  const [value, setValue] = useOptimistic(starred, (_old, next: boolean) => next);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  return <span className="mail-star-wrap"><button type="button" className="mail-star" data-starred={value || undefined} aria-label={value ? "Rimuovi da Speciali" : "Aggiungi a Speciali"} aria-pressed={value} disabled={pending} onClick={() => {
    const next = !value; setError("");
    start(async () => {
      setValue(next);
      try {
        const result = await organizeMail(folder, [uid], next ? "star" : "unstar");
        if (result.error) setError(result.error);
        else router.refresh();
      } catch { setError("Connessione interrotta. Riprova."); }
    });
  }}><MailIcon name="star" /></button>{error ? <span className="mail-star-error" role="alert">{error}</span> : null}</span>;
}

export function MailLabelCreate() {
  const [state, action, pending] = useActionState(createMailLabel, {});
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (state.ok) { form.current?.reset(); if (details.current) details.current.open = false; router.refresh(); } }, [state, router]);
  return <details ref={details} className="mail-create-label">
    <summary>+ Nuova etichetta</summary>
    <form ref={form} action={action}>
      <label className="adm-field"><span>Nome etichetta</span><input className="adm-input" name="name" required maxLength={100} placeholder="Es. Clienti" /></label>
      <button className="adm-btn adm-btn-sm" disabled={pending}>{pending ? "Creazione…" : "Crea"}</button>
      {state.error ? <p role="alert" className="adm-error">{state.error}</p> : null}
    </form>
  </details>;
}
