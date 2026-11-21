"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { MailIcon } from "@/components/admin/email/mailbox-ui";
import type { MailboxId, MailboxInfo } from "@/lib/mail/mailbox-types";

type Switching = { pending: boolean; target: MailboxId | null; go: (box: MailboxId, href: string) => void };
const SwitchContext = createContext<Switching>({ pending: false, target: null, go: () => {} });

/**
 * Wraps the Posta page: runs the mailbox change in a transition, dims the list with a spinner
 * while the new mailbox loads, then shows a short "Casella: …" toast.
 */
export function MailSwitchFrame({ box, boxes, navKey, children }: { box: MailboxId; boxes: MailboxInfo[]; navKey: string; children: ReactNode }) {
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
  // Skeleton while a Posta link loads: "list" (folder, tab, page, mailbox) or "detail" (opening a message).
  const [loading, setLoading] = useState<{ kind: "list" | "detail"; from: string } | null>(null);
  if (loading && loading.from !== navKey) setLoading(null);
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setLoading(null), 15_000);
    return () => window.clearTimeout(timer);
  }, [loading]);
  const onClickCapture = (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== "/admin/email") return;
    if (url.search === window.location.search) return;
    const p = url.searchParams;
    setLoading({ kind: p.get("m") && !p.get("compose") ? "detail" : "list", from: navKey });
  };
  const go = (next: MailboxId, href: string) => {
    if (next === box) return;
    setTarget(next);
    setLoading({ kind: "list", from: navKey });
    start(() => router.push(href as Route));
  };
  return (
    <SwitchContext.Provider value={{ pending, target: pending ? target : null, go }}>
      <div className="mail-switch-frame" data-switching={pending || undefined} data-loading={loading?.kind} aria-busy={pending || Boolean(loading) || undefined} onClickCapture={onClickCapture}>
        {children}
        {loading?.kind === "detail" ? <MailDetailSkeleton /> : null}
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

/** Placeholder of an opening message: toolbar, subject, sender, status bar, body. */
function MailDetailSkeleton() {
  return (
    <div className="mail-detail-skeleton" role="status" aria-label="Apertura email…">
      <div className="mail-sk-row"><span className="mail-sk" style={{ width: "2.6rem", height: "2.3rem" }} /><span className="mail-sk" style={{ width: "9rem", height: "2.3rem" }} /><span className="mail-sk mail-sk-end" style={{ width: "4.6rem", height: "2.3rem" }} /></div>
      <span className="mail-sk" style={{ width: "min(36rem, 70%)", height: "1.9rem" }} />
      <div className="mail-sk-row"><span className="mail-sk" style={{ width: "2.6rem", height: "2.6rem", borderRadius: "50%" }} /><span className="mail-sk-col"><span className="mail-sk" style={{ width: "14rem", height: ".9rem" }} /><span className="mail-sk" style={{ width: "9rem", height: ".75rem" }} /></span></div>
      <span className="mail-sk" style={{ width: "100%", height: "3.6rem", borderRadius: ".8rem" }} />
      <span className="mail-sk mail-sk-light" style={{ width: "100%", height: "22rem", borderRadius: ".8rem" }} />
    </div>
  );
}

/** Gmail categories with an underline that slides to the chosen tab (moves on click, before the server answers). */
export function MailTabs({ children }: { children: ReactNode }) {
  const nav = useRef<HTMLElement>(null);
  const ink = useRef<HTMLSpanElement>(null);
  const picked = useRef<HTMLAnchorElement | null>(null);
  const place = () => {
    const root = nav.current, bar = ink.current;
    if (!root || !bar) return;
    const current = root.querySelector<HTMLAnchorElement>("a[aria-current]");
    if (picked.current && picked.current === current) picked.current = null;
    const el = picked.current ?? current;
    if (!el) { bar.style.opacity = "0"; return; }
    bar.style.opacity = "1";
    bar.style.transform = `translateX(${el.offsetLeft}px)`;
    bar.style.width = `${el.offsetWidth}px`;
    root.querySelectorAll("a").forEach((a) => a.toggleAttribute("data-picked", a === el));
  };
  useLayoutEffect(() => { place(); });
  useEffect(() => {
    const root = nav.current;
    if (!root) return;
    const ro = new ResizeObserver(() => place());
    ro.observe(root);
    return () => ro.disconnect();
  }, []);
  return (
    <nav ref={nav} className="mail-categories" aria-label="Categorie Gmail" onClickCapture={(e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a");
      if (a && !(e.metaKey || e.ctrlKey || e.shiftKey)) { picked.current = a; place(); }
    }}>
      {children}
      <span ref={ink} className="mail-tab-ink" aria-hidden="true" />
    </nav>
  );
}
