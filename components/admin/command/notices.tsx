"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CommandNotice } from "@/lib/command-types";

const BELL = "M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0";

export function NoticeBell({ notices }: { notices: CommandNotice[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(path);
  const root = useRef<HTMLDivElement>(null);
  if (seen !== path) {
    setSeen(path);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = notices.length;
  return (
    <div className="cc-bell" ref={root}>
      <button
        type="button"
        className="adm-icon-btn cc-bell-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count ? `Notifiche, ${count} da vedere` : "Notifiche"}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={BELL} />
        </svg>
        {count ? <span className="cc-bell-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="cc-bell-pop" role="dialog" aria-label="Notifiche CRM">
          {count === 0 ? (
            <p className="cc-bell-empty">Nessuna notifica.</p>
          ) : (
            <ul>
              {notices.map((notice) => (
                <li key={notice.id}>
                  <Link href={notice.href} onClick={() => setOpen(false)}>
                    <span>{notice.title}</span>
                    {notice.detail ? <span className="adm-muted">{notice.detail}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
