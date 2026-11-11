"use client";

import { Children, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export function MailSplitPane({ detail, children }: { detail: boolean; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [maximum, setMaximum] = useState(600);
  const [dragging, setDragging] = useState(false);
  const panes = Children.toArray(children);
  const minimum = 180;
  const actual = Math.max(minimum, Math.min(width, maximum));
  useEffect(() => {
    const element = root.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setMaximum(Math.max(minimum, Math.min(600, entry.contentRect.width - 320))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={root} className="adm-mail mail-resizable" data-detail={detail || undefined} data-dragging={dragging || undefined} style={{ "--mail-list-width": `${actual}px` } as CSSProperties}>
    {panes[0]}
    <div role="separator" aria-label="Larghezza elenco messaggi" aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={actual} tabIndex={detail ? 0 : -1} className="mail-split-handle" title="Trascina per ridimensionare. Usa le frecce da tastiera; doppio clic per ripristinare."
      onPointerDown={(event) => { event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId) && root.current) setWidth(Math.max(minimum, Math.min(maximum, event.clientX - root.current.getBoundingClientRect().left))); }}
      onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false); }}
      onLostPointerCapture={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onDoubleClick={() => setWidth(320)}
      onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); setWidth(event.key === "Home" ? minimum : event.key === "End" ? maximum : Math.max(minimum, Math.min(maximum, actual + (event.key === "ArrowRight" ? 24 : -24)))); }}
    ><span /></div>
    {panes[1]}
  </div>;
}
