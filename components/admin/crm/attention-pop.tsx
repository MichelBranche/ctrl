"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { RollValue } from "@/components/admin/crm/oggi-motion";

/**
 * The two Oggi attention figures. The list opens over the card, so the row beside it keeps its height.
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

function AttentionItem({ id, open, count, rollId, label, onToggle, children }: {
  id: string; open: boolean; count: string; rollId: string; label: string; onToggle: () => void; children: ReactNode;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef(onToggle);
  toggle.current = onToggle;
  const labelId = useId();
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
      if (!(target instanceof Element)) return;
      if (target.closest(".crm-attn-backdrop")) { toggle.current(); return; }
      if (btn.current?.closest(".crm-attn-item")?.contains(target)) return;
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
      <div className="crm-attn-backdrop" hidden={!open} />
      <div ref={panel} id={id} className="crm-attn-pop" role="dialog" aria-labelledby={labelId} tabIndex={-1} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
