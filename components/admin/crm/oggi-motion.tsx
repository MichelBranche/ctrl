"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const STORE = "crm-oggi-kpis";

/**
 * KPI figure. The resting position is the real digit (CSS), so the number is right before JavaScript.
 * The first view of the session rolls up from zero via the html.crm-roll-play class set before paint.
 * A later change rolls only the digits that moved.
 */
export function RollValue({ text, id }: { text: string; id: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    let map: Record<string, string> = {};
    try {
      map = JSON.parse(sessionStorage.getItem(STORE) || "{}") as Record<string, string>;
    } catch {
      map = {};
    }
    const prev = map[id];
    map[id] = text;
    try {
      sessionStorage.setItem(STORE, JSON.stringify(map));
    } catch {
      /* private mode: the figure still shows the right number */
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && prev != null && prev !== text) rollChanged(ref.current, prev, text);
    const pending = [...document.querySelectorAll(".crm-roll-digit > span")].flatMap((node) =>
      typeof node.animate === "function" ? node.getAnimations() : [],
    );
    if (pending.length === 0) {
      root.classList.remove("crm-roll-play");
      return;
    }
    let left = pending.length;
    const done = () => {
      left -= 1;
      if (left <= 0) root.classList.remove("crm-roll-play");
    };
    for (const anim of pending) anim.finished.then(done, done);
  }, [id, text]);
  return (
    <span className="crm-roll" ref={ref}>
      <span className="adm-sr">{text}</span>
      <span aria-hidden="true" className="crm-roll-row">
        {Array.from(text).map((ch, i) =>
          ch >= "0" && ch <= "9" ? (
            <span className="crm-roll-digit" key={`${text.length}-${i}`}>
              <span style={{ ["--n" as string]: Number(ch) }}>
                {Array.from("0123456789", (d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          ) : (
            <span className="crm-roll-char" key={`${text.length}-${i}`}>{ch}</span>
          ),
        )}
      </span>
    </span>
  );
}

function rollChanged(root: HTMLElement | null, prev: string, text: string) {
  if (!root) return;
  const digits = [...root.querySelectorAll<HTMLElement>(".crm-roll-digit > span")];
  let di = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch < "0" || ch > "9") continue;
    const node = digits[di++];
    if (!node) break;
    const was = prev.length === text.length ? prev[i] : undefined;
    if (was === ch) {
      node.classList.remove("is-rolling");
      continue;
    }
    node.style.setProperty("--from", was && was >= "0" && was <= "9" ? was : "0");
    node.classList.remove("is-rolling");
    void node.offsetWidth;
    node.classList.add("is-rolling");
  }
}

/** Collapses a row when its checkbox form is submitted. An error inside the row opens it again. Does not submit or save. */
export function LeavingRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onSubmit = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setLeaving(true);
    };
    const obs = new MutationObserver(() => {
      if (el.querySelector("[role='alert']")) setLeaving(false);
    });
    el.addEventListener("submit", onSubmit);
    obs.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener("submit", onSubmit);
      obs.disconnect();
    };
  }, [setLeaving]);
  return (
    <li ref={ref} className={leaving ? "crm-leave is-leaving" : "crm-leave"}>
      <div className="crm-leave-clip">{children}</div>
    </li>
  );
}
