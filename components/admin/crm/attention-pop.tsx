"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RollValue } from "@/components/admin/crm/oggi-motion";

/**
 * The two Oggi attention figures. The list opens in a portal, over the page,
 * so a transformed ancestor cannot clip it and the row beside it keeps its height.
 * One panel at a time. Escape, a click outside, or the same number again closes it.
 */
export function AttentionLists({
  freeCount, prioCount, freePanel, prioPanel,
}: {
  freeCount: string;
  prioCount: string;
  freePanel: ReactNode;
  prioPanel: ReactNode;
}) {
  const [open, setOpen] = useState<"free" | "prio" | null>(null);
  return (
    <div className="crm-attn">
      <AttentionItem id="crm-free-pop" open={open === "free"} count={freeCount} rollId="free" label="Contatti non assegnati" onToggle={() => setOpen((cur) => cur === "free" ? null : "free")}>
        {freePanel}
      </AttentionItem>
      <AttentionItem id="crm-prio-pop" open={open === "prio"} count={prioCount} rollId="prio" label="Contatti prioritari" onToggle={() => setOpen((cur) => cur === "prio" ? null : "prio")}>
        {prioPanel}
      </AttentionItem>
    </div>
  );
}

const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;
const GAP = 8;
const MARGIN = 12;
const CAP = 22 * 16;

function placePanel(panel: HTMLElement, button: HTMLElement) {
  const item = button.closest(".crm-attn-item");
  if (!(item instanceof HTMLElement)) return;
  const anchor = button.getBoundingClientRect();
  const row = item.getBoundingClientRect();
  const width = Math.max(160, Math.min(row.width, window.innerWidth - MARGIN * 2));
  const left = Math.max(MARGIN, Math.min(row.left, window.innerWidth - width - MARGIN));
  panel.style.left = `${left}px`;
  panel.style.width = `${width}px`;
  panel.style.maxHeight = "none";
  const needed = Math.min(panel.scrollHeight, CAP);
  const spaceBelow = window.innerHeight - anchor.bottom - GAP - MARGIN;
  const spaceAbove = anchor.top - GAP - MARGIN;
  const above = spaceBelow < needed && spaceAbove > spaceBelow;
  panel.style.maxHeight = `${Math.max(96, Math.min(needed, above ? spaceAbove : spaceBelow))}px`;
  if (above) {
    panel.style.top = "auto";
    panel.style.bottom = `${window.innerHeight - anchor.top + GAP}px`;
  } else {
    panel.style.bottom = "auto";
    panel.style.top = `${anchor.bottom + GAP}px`;
  }
}

function AttentionItem({ id, open, count, rollId, label, onToggle, children }: {
  id: string; open: boolean; count: string; rollId: string; label: string; onToggle: () => void; children: ReactNode;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef(onToggle);
  toggle.current = onToggle;
  const labelId = useId();
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => { setRoot(document.body); }, []);

  useIsoLayout(() => {
    if (!open) return;
    const dialog = panel.current;
    const button = btn.current;
    if (!dialog || !button) return;
    const place = () => placePanel(dialog, button);
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = panel.current;
    dialog?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        toggle.current();
        btn.current?.focus({ preventScroll: true });
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (dialog?.contains(target) || btn.current?.contains(target)) return;
      toggle.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="crm-attn-item">
      <button ref={btn} type="button" className="crm-attn-hit" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className="crm-attn-num"><RollValue id={rollId} text={count} /></span>
        <span id={labelId}>{label}</span>
      </button>
      {open && root ? createPortal(
        <div ref={panel} id={id} className="crm-attn-pop" role="dialog" aria-labelledby={labelId} tabIndex={-1}>
          {children}
        </div>,
        root,
      ) : null}
    </div>
  );
}
