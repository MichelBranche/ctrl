"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { MailIcon } from "@/components/admin/email/mailbox-ui";
import type { MailboxId, MailboxInfo } from "@/lib/mail/mailbox-types";

type Switching = { pending: boolean; target: MailboxId | null; go: (box: MailboxId, href: string) => void };
const SwitchContext = createContext<Switching>({ pending: false, target: null, go: () => {} });

/**
 * Wraps the Posta page: runs the mailbox change in a transition, dims the list with a spinner
 * while the new mailbox loads, then shows a short "Casella: …" toast.
 */
export function MailSwitchFrame({ box, boxes, children }: { box: MailboxId; boxes: MailboxInfo[]; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<MailboxId | null>(null);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  // Mailbox changed (new server render): announce it once. State adjusted during render, no effect needed.
  const [seen, setSeen] = useState(box);
  if (seen !== box) {
    setSeen(box);
    const info = boxes.find((b) => b.id === box);
    if (info) setToast((t) => ({ text: `Casella: ${info.address}`, n: (t?.n ?? 0) + 1 }));
  }
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  // Every <details> menu of the page (filters, settings, "Altro"…) closes on outside click, Esc, or picking an item.
  useEffect(() => {
    const menus = () => Array.from(document.querySelectorAll<HTMLDetailsElement>("details.mail-menu[open], details.mail-create-label[open]"));
    const onDown = (e: PointerEvent) => { for (const d of menus()) if (!d.contains(e.target as Node)) d.open = false; };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") for (const d of menus()) d.open = false; };
    const onClick = (e: MouseEvent) => {
      const item = (e.target as HTMLElement).closest("a.mail-menu-item, button.mail-menu-item");
      const menu = item?.closest<HTMLDetailsElement>("details.mail-menu");
      if (menu) menu.open = false;
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); document.removeEventListener("click", onClick); };
  }, []);
  const go = (next: MailboxId, href: string) => {
    if (next === box) return;
    setTarget(next);
    start(() => router.push(href as Route));
  };
  return (
    <SwitchContext.Provider value={{ pending, target: pending ? target : null, go }}>
      <div className="mail-switch-frame" data-switching={pending || undefined} aria-busy={pending || undefined}>
        {children}
        {pending ? <div className="mail-switch-loading" role="status"><span className="mail-spinner" aria-hidden="true" />Apertura della casella…</div> : null}
      </div>
      {toast ? <p key={toast.n} className="mail-toast" role="status">{toast.text}</p> : null}
    </SwitchContext.Provider>
  );
}

/** "Casella condivisa dell'agenzia · hello@… ▾": closes on pick, outside click and Esc; active item has a check. */
export function MailboxSwitch({ box, boxes, hrefs }: { box: MailboxId; boxes: MailboxInfo[]; hrefs: Record<string, string> }) {
  const { pending, target, go } = useContext(SwitchContext);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLButtonElement>("button")?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  // While loading, the trigger already shows the chosen mailbox.
  const shown = boxes.find((b) => b.id === (target ?? box)) ?? boxes[0];
  return (
    <div ref={root} className="mail-box-switch" data-box={shown.id}>
      <button type="button" className="mail-box-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="mail-box-mark" aria-hidden="true">{shown.label.slice(0, 1)}</span>
        <span className="mail-box-name">{shown.label}</span>
        <span className="mail-box-address">{shown.address}</span>
        {shown.id === "admin" ? <span className="mail-founder-badge">Solo founder</span> : null}
        {pending ? <span className="mail-spinner" aria-label="Caricamento" /> : <MailIcon name="chevron" size={14} />}
      </button>
      {open ? (
        <div className="mail-menu-pop" role="menu" aria-label="Caselle">
          <strong className="mail-menu-title">Caselle</strong>
          {boxes.map((b) => {
            const active = b.id === (target ?? box);
            return (
              <button key={b.id} type="button" role="menuitemradio" aria-checked={active} className="mail-menu-item mail-box-option" data-box={b.id}
                onClick={() => { setOpen(false); go(b.id, hrefs[b.id]); }}>
                <span className="mail-box-mark" aria-hidden="true">{b.label.slice(0, 1)}</span>
                <span><strong>{b.label}{b.id === "admin" ? <span className="mail-founder-badge">Solo founder</span> : null}</strong><small>{b.address}</small></span>
                <span className="mail-box-check" aria-hidden="true">{active ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg> : null}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
