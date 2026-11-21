"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, useActionState, useOptimistic, type ReactNode } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { createMailLabel, organizeMail } from "@/app/admin/email-actions";
import type { FolderId, MailLabel, MailMutation } from "@/lib/mail/types";
import { useMailBox } from "@/components/admin/email/mail-box";
import { labelColor } from "@/lib/mail/label-color";

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
  back: "M19 12H5m6-6-6 6 6 6",
  prev: "m15 6-6 6 6 6",
  next: "m9 6 6 6-6 6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  chevron: "m6 9 6 6 6-6",
  filter: "M4 5h16l-6 8v6l-4-2v-4L4 5Z",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.5a7.3 7.3 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7.3 7.3 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7.3 7.3 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  reply: "M10 8 5 12l5 4M5 12h9a6 6 0 0 1 6 6",
  replyAll: "M8 8l-5 4 5 4M13 8l-5 4 5 4M8 12h7a6 6 0 0 1 6 6",
  forward: "m14 8 5 4-5 4M19 12h-9a6 6 0 0 0-6 6",
  clip: "M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  note: "M5 4h14v12l-4 4H5V4Zm10 16v-4h4M8 9h8M8 13h5",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  primary: "M4 4h16l2 12v4H2v-4L4 4Zm-2 12h6l2 3h4l2-3h6",
  promotions: "M3 3h9l9 9-9 9-9-9V3Zm4 4h.01",
  social: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6",
  updates: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14v.01M12 11v6",
  forums: "M4 4h16v11H8l-4 4V4Z",
  everything: "M3 3h18v18H3V3ZM7 8h10M7 12h10M7 16h6",
  send: "m22 2-7 20-4-9-9-4 20-7ZM11 13l11-11",
  image: "M3 4h18v16H3V4Zm0 12 5-5 5 5 3-3 5 5M15 9h.01",
  emoji: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
  bold: "M7 4h6a4 4 0 0 1 0 8H7V4Zm0 8h7a4 4 0 0 1 0 8H7v-8Z",
  italic: "M10 4h8M6 20h8M14 4l-4 16",
  underline: "M7 4v7a5 5 0 0 0 10 0V4M5 20h14",
  ul: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  ol: "M10 6h10M10 12h10M10 18h10M4 4v4M3 18h3l-3 3h3M3 11h2l-2 3h3",
  close: "M6 6l12 12M18 6 6 18",
} as const;
export function MailIcon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name as keyof typeof paths] ?? paths.label} /></svg>;
}

type RowMeta = { uid: number; seen: boolean; starred: boolean };
type Selection = { selected: Set<number>; toggle: (uid: number) => void; all: number[]; rows: RowMeta[]; set: (uids: number[]) => void; folder: FolderId; labels: MailLabel[] };
const EMPTY_LABELS: string[] = [];
const SelectionContext = createContext<Selection | null>(null);
export function MailSelection({ folder, uids, rows, labels, children }: { folder: FolderId; uids: number[]; rows?: RowMeta[]; labels: MailLabel[]; children: ReactNode }) {
  const [selected, setSelected] = useState(new Set<number>());

  return <SelectionContext.Provider value={{ selected, toggle: (uid) => setSelected((old) => { const next = new Set(old); if (next.has(uid)) next.delete(uid); else next.add(uid); return next; }), all: uids, rows: rows ?? [], set: (ids) => setSelected(new Set(ids)), folder, labels }}>{children}</SelectionContext.Provider>;
}

export function MailRowCheck({ uid, subject }: { uid: number; subject: string }) {
  const ctx = useContext(SelectionContext)!;
  return <input type="checkbox" className="mail-check" aria-label={`Seleziona ${subject || "messaggio senza oggetto"}`} checked={ctx.selected.has(uid)} onChange={() => ctx.toggle(uid)} />;
}

/** Closes a <details> menu on outside click or Escape. */
function useMenu(ref: React.RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const close = (event: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !el.contains(event.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [ref]);
}

function Menu({ label, icon, text, children, className = "", align = "left" }: { label: string; icon?: string; text?: string; children: ReactNode; className?: string; align?: "left" | "right" }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useMenu(ref);
  return <details ref={ref} className={`mail-menu ${className}`} data-align={align}>
    <summary className="mail-tool" aria-label={label} title={label}>{icon ? <MailIcon name={icon} size={16} /> : null}{text ? <span>{text}</span> : null}{text ? <MailIcon name="chevron" size={13} /> : null}</summary>
    <div className="mail-menu-pop" onClick={(event) => { if ((event.target as HTMLElement).closest("button[data-close]")) ref.current?.removeAttribute("open"); }}>{children}</div>
  </details>;
}

function OperationButton({ icon, text, disabled, run, labelled }: { icon: string; text: string; disabled: boolean; run: () => void; labelled?: boolean }) {
  return <button type="button" className="mail-tool" data-labelled={labelled || undefined} title={text} aria-label={text} disabled={disabled} onClick={run}><MailIcon name={icon} size={16} />{labelled ? <span>{text}</span> : null}</button>;
}

function MenuItem({ icon, text, disabled, run }: { icon: string; text: string; disabled: boolean; run: () => void }) {
  return <button type="button" className="mail-menu-item" data-close disabled={disabled} onClick={run}><MailIcon name={icon} size={15} />{text}</button>;
}

function useOrganize(folder: FolderId, uids: number[], applied: string[] | undefined, onDone?: () => void, backHref?: string) {
  const router = useRouter();
  const box = useMailBox();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [labelValues, updateLabels] = useOptimistic(applied ?? EMPTY_LABELS, (values, change: { label: string; add: boolean }) => change.add ? [...new Set([...values, change.label])] : values.filter((value) => value !== change.label));
  const run = (operation: MailMutation, label?: string) => start(async () => {
    setError("");
    if (label && (operation === "label" || operation === "unlabel")) updateLabels({ label, add: operation === "label" });
    try {
      const result = await organizeMail(folder, uids, operation, label, box);
      if (result.error) { setError(result.error); return; }
      onDone?.();
      if (backHref && ["archive", "trash", "spam", "inbox"].includes(operation)) router.replace(backHref as Route);
      else router.refresh();
      window.dispatchEvent(new Event("ctrl-mail-changed"));
    } catch { setError("Connessione interrotta. Riprova tra poco."); }
  });
  return { pending, error, labelValues, run, busy: pending || !uids.length };
}

function LabelsMenu({ labels, applied, values, busy, run, text }: { labels: MailLabel[]; applied?: string[]; values: string[]; busy: boolean; run: (op: MailMutation, label?: string) => void; text?: string }) {
  return <Menu label="Gestisci etichette" icon={text ? undefined : "label"} text={text} className="mail-label-menu">
    <strong className="mail-menu-title">Applica etichetta</strong>
    {labels.length ? labels.map((label) => applied ? <label key={label.id} className="mail-menu-check"><input type="checkbox" disabled={busy} checked={values.includes(label.name)} onChange={(event) => run(event.target.checked ? "label" : "unlabel", label.name)} /><LabelDot name={label.name} />{label.name}</label> : <div className="mail-bulk-label" key={label.id}><LabelDot name={label.name} /><span>{label.name}</span><button type="button" disabled={busy} onClick={() => run("label", label.name)} aria-label={`Applica ${label.name}`}>+</button><button type="button" disabled={busy} onClick={() => run("unlabel", label.name)} aria-label={`Rimuovi ${label.name}`}>−</button></div>) : <p className="adm-muted">Crea prima un’etichetta dalla barra laterale.</p>}
  </Menu>;
}

/**
 * Message toolbar. "icons": the detail view (Archivia, Cestina, Non letta, Etichette, Altro).
 * "text": labelled buttons, used above the composer (Archivia, Spam, Segna non letta, Etichette, Altro).
 */
export function MailMessageActions({ folder, uids, labels, starred, applied, onDone, backHref, variant = "icons" }: { backHref?: string; folder: FolderId; uids: number[]; labels: MailLabel[]; starred?: boolean; applied?: string[]; onDone?: () => void; variant?: "icons" | "text" }) {
  const { pending, error, labelValues, run, busy } = useOrganize(folder, uids, applied, onDone, backHref);
  const text = variant === "text";
  const canArchive = folder !== "trash" && folder !== "spam" && folder !== "drafts";
  return <div className="mail-action-area" aria-busy={pending}>
    <div className="mail-tools" data-variant={variant}>
      {canArchive ? <OperationButton icon="archive" text="Archivia" labelled={text} disabled={busy} run={() => run("archive")} /> : null}
      {text ? (folder !== "spam" ? <OperationButton icon="spam" text="Spam" labelled disabled={busy} run={() => run("spam")} /> : null)
        : (folder !== "trash" ? <OperationButton icon="trash" text="Cestina" disabled={busy} run={() => run("trash")} /> : null)}
      <OperationButton icon="unread" text="Segna non letta" labelled={text} disabled={busy} run={() => run("unread")} />
      <LabelsMenu labels={labels} applied={applied} values={labelValues} busy={busy} run={run} text={text ? "Etichette" : undefined} />
      <Menu label="Altre azioni" icon={text ? "more" : "more"} text={text ? "Altro" : undefined}>
        {folder !== "inbox" ? <MenuItem icon="inbox" text="Sposta in arrivo" disabled={busy} run={() => run("inbox")} /> : null}
        {!text && folder !== "spam" ? <MenuItem icon="spam" text="Segnala spam" disabled={busy} run={() => run("spam")} /> : null}
        {text && folder !== "trash" ? <MenuItem icon="trash" text="Cestina" disabled={busy} run={() => run("trash")} /> : null}
        <MenuItem icon="read" text="Segna come letta" disabled={busy} run={() => run("read")} />
        <MenuItem icon="star" text={starred ? "Rimuovi da Speciali" : "Aggiungi a Speciali"} disabled={busy} run={() => run(starred ? "unstar" : "star")} />
      </Menu>
      {pending ? <span className="mail-operation-state" role="status">Salvataggio…</span> : null}
    </div>
    {error ? <p className="adm-error" role="alert">{error}</p> : null}
  </div>;
}

/** List toolbar, always visible: selection menu, bulk actions and the page range on the right. */
export function MailSelectionBar({ pager }: { pager?: ReactNode }) {
  const ctx = useContext(SelectionContext)!;
  const check = useRef<HTMLInputElement>(null);
  const uids = [...ctx.selected];
  const { pending, error, labelValues, run, busy } = useOrganize(ctx.folder, uids, undefined, () => ctx.set([]));
  useEffect(() => { if (check.current) check.current.indeterminate = ctx.selected.size > 0 && ctx.selected.size < ctx.all.length; }, [ctx.selected, ctx.all.length]);
  const pick = (test: (row: RowMeta) => boolean) => ctx.set(ctx.rows.filter(test).map((row) => row.uid));
  const canArchive = ctx.folder !== "trash" && ctx.folder !== "spam" && ctx.folder !== "drafts";
  return <div className="mail-toolbar" aria-busy={pending}>
    <div className="mail-toolbar-select">
      <input ref={check} type="checkbox" className="mail-check" aria-label="Seleziona tutti i messaggi della pagina" checked={ctx.all.length > 0 && ctx.selected.size === ctx.all.length} disabled={!ctx.all.length} onChange={() => ctx.set(ctx.selected.size === ctx.all.length ? [] : ctx.all)} />
      <Menu label="Selezione" icon="chevron" className="mail-select-menu">
        <button type="button" className="mail-menu-item" data-close onClick={() => ctx.set(ctx.all)}>Tutti</button>
        <button type="button" className="mail-menu-item" data-close onClick={() => ctx.set([])}>Nessuno</button>
        <button type="button" className="mail-menu-item" data-close onClick={() => pick((row) => row.seen)}>Letti</button>
        <button type="button" className="mail-menu-item" data-close onClick={() => pick((row) => !row.seen)}>Non letti</button>
        <button type="button" className="mail-menu-item" data-close onClick={() => pick((row) => row.starred)}>Speciali</button>
      </Menu>
    </div>
    {canArchive ? <OperationButton icon="archive" text="Archivia" labelled disabled={busy} run={() => run("archive")} /> : null}
    <OperationButton icon="read" text="Segna come letto" labelled disabled={busy} run={() => run("read")} />
    <OperationButton icon="unread" text="Segna non letta" labelled disabled={busy} run={() => run("unread")} />
    <LabelsMenu labels={ctx.labels} values={labelValues} busy={busy} run={run} text="Etichette" />
    <Menu label="Altre azioni" text="Altro">
      {ctx.folder !== "inbox" ? <MenuItem icon="inbox" text="Sposta in arrivo" disabled={busy} run={() => run("inbox")} /> : null}
      {ctx.folder !== "spam" ? <MenuItem icon="spam" text="Segnala spam" disabled={busy} run={() => run("spam")} /> : null}
      {ctx.folder !== "trash" ? <MenuItem icon="trash" text="Cestina" disabled={busy} run={() => run("trash")} /> : null}
      <MenuItem icon="star" text="Aggiungi a Speciali" disabled={busy} run={() => run("star")} />
      <MenuItem icon="star" text="Rimuovi da Speciali" disabled={busy} run={() => run("unstar")} />
    </Menu>
    {ctx.selected.size ? <span className="mail-selected-count">{ctx.selected.size} selezionati</span> : null}
    {pending ? <span className="mail-operation-state" role="status">Salvataggio…</span> : null}
    {error ? <span className="adm-error" role="alert">{error}</span> : null}
    <div className="mail-toolbar-pager">{pager}</div>
  </div>;
}

export function MailStar({ folder, uid, starred = false }: { folder: FolderId; uid: number; starred?: boolean }) {
  const [value, setValue] = useOptimistic(starred, (_old, next: boolean) => next);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const box = useMailBox();

  return <span className="mail-star-wrap"><button type="button" className="mail-star" data-starred={value || undefined} aria-label={value ? "Rimuovi da Speciali" : "Aggiungi a Speciali"} aria-pressed={value} disabled={pending} onClick={() => {
    const next = !value; setError("");
    start(async () => {
      setValue(next);
      try {
        const result = await organizeMail(folder, [uid], next ? "star" : "unstar", undefined, box);
        if (result.error) setError(result.error);
        else router.refresh();
      } catch { setError("Connessione interrotta. Riprova."); }
    });
  }}><MailIcon name="star" size={16} /></button>{error ? <span className="mail-star-error" role="alert">{error}</span> : null}</span>;
}

export function LabelDot({ name }: { name: string }) {
  return <span className="mail-label-dot" style={{ background: labelColor(name) }} aria-hidden="true" />;
}

/** "+" beside "Etichette": a small form that creates a Gmail label. */
export function MailLabelCreate() {
  const [state, action, pending] = useActionState(createMailLabel, {});
  const router = useRouter();
  const box = useMailBox();
  const form = useRef<HTMLFormElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  useMenu(details);
  useEffect(() => { if (state.ok) { form.current?.reset(); if (details.current) details.current.open = false; router.refresh(); } }, [state, router]);
  return <details ref={details} className="mail-create-label">
    <summary aria-label="Nuova etichetta" title="Nuova etichetta">+</summary>
    <form ref={form} action={action} className="mail-menu-pop">
      <input type="hidden" name="box" value={box} />
      <label className="adm-field"><span>Nome etichetta</span><input className="adm-input" name="name" required maxLength={100} placeholder="Es. Clienti" /></label>
      <button className="adm-btn adm-btn-sm" disabled={pending}>{pending ? "Creazione…" : "Crea"}</button>
      {state.error ? <p role="alert" className="adm-error">{state.error}</p> : null}
    </form>
  </details>;
}
