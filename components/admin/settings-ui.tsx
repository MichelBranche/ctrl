"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";

/** One aligned settings row: label and hint on the left, the control on the right (stacked on a phone). */
export function SettingRow({ label, hint, htmlFor, children, as = "label" }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode; as?: "label" | "div" }) {
  const Tag = as;
  return (
    <Tag className="st-row" {...(as === "label" && htmlFor ? { htmlFor } : {})}>
      <span className="st-row-label"><b>{label}</b>{hint ? <small>{hint}</small> : null}</span>
      <span className="st-row-control">{children}</span>
    </Tag>
  );
}

const OK = "M5 12l5 5L20 7";
const ERR = "M12 8v5M12 16.5h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z";

/** Card footer: save state on the left (saved in green, error in red), the action on the right. */
export function SaveBar({ pending, ok, error, label, pendingLabel, hint, danger = false }: {
  pending: boolean; ok?: string; error?: string; label: string; pendingLabel: string; hint?: string; danger?: boolean;
}) {
  const tone = error ? "error" : ok ? "ok" : undefined;
  return (
    <div className="st-foot">
      <p role="status" aria-live="polite" className="st-status" data-tone={tone}>
        {tone ? <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={tone === "ok" ? OK : ERR} /></svg> : null}
        <span>{error ?? ok ?? hint ?? ""}</span>
      </p>
      <button className={danger ? "rb-btn st-danger-btn" : "rb-cta rb-cta-sm"} disabled={pending}>{pending ? pendingLabel : label}</button>
    </div>
  );
}

export type NavItem = { id: string; href: string; label: string; icon: string; group: string };

/** Settings navigation: a left column on desktop, a scrolling tab bar on a phone. Anchors follow the scroll. */
export function SettingsNav({ items, current, label }: { items: NavItem[]; current: string; label: string }) {
  const [active, setActive] = useState(current);
  useEffect(() => {
    const anchors = items.filter((i) => i.href.startsWith("#")).map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => Boolean(el));
    if (!anchors.length) return;
    let frame = 0;
    // Active = the last section whose top has passed the topbar; at the very bottom, the last section.
    const pick = () => {
      frame = 0;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const passed = anchors.filter((el) => el.getBoundingClientRect().top <= 140);
      setActive((atEnd ? anchors[anchors.length - 1] : passed[passed.length - 1] ?? anchors[0]).id);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(pick); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [items]);
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <nav className="st-nav" aria-label={label}>
      {groups.map((g) => (
        <div key={g} className="st-nav-group">
          <p className="st-nav-title">{g}</p>
          <ul>
            {items.filter((i) => i.group === g).map((i) => (
              <li key={i.id}>
                {i.href.startsWith("#")
                  ? <a href={i.href} aria-current={active === i.id ? "true" : undefined} onClick={() => setActive(i.id)}><NavIcon d={i.icon} /><span>{i.label}</span></a>
                  : <Link href={i.href as Route} aria-current={active === i.id ? "true" : undefined}><NavIcon d={i.icon} /><span>{i.label}</span></Link>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavIcon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
