"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import gsap from "gsap";
import { CtrlMascot } from "@/components/ctrl-mascot";
import { useLocale } from "@/components/use-locale";
import type { ChatLink, ChatMessage } from "@/lib/assistant";

type Msg = ChatMessage & { links?: ChatLink[] };

const copy = {
  it: {
    open: "Apri l'assistente di CTRL®",
    close: "Chiudi assistente",
    status: "Online · risposte dal sito",
    greeting: "Ciao! Sono l'assistente di CTRL®. Chiedimi dei nostri servizi, dei progetti o di come lavoriamo.",
    chips: ["Servizi", "Prezzi / Preventivo", "Tempi", "Contatti"],
    placeholder: "Scrivi un messaggio…",
    send: "Invia",
    thinking: "Sto pensando",
    error: "Qualcosa è andato storto. Riprova tra poco.",
  },
  en: {
    open: "Open the CTRL® assistant",
    close: "Close assistant",
    status: "Online · answers from the site",
    greeting: "Hi! I'm the CTRL® assistant. Ask me about our services, our projects or how we work.",
    chips: ["Services", "Pricing / Quote", "Timing", "Contact"],
    placeholder: "Type a message…",
    send: "Send",
    thinking: "Thinking",
    error: "Something went wrong. Please try again shortly.",
  },
};

export function CtrlAssistant() {
  const { lang } = useLocale();
  const c = copy[lang];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // open / close animation from the mascot origin
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.killTweensOf(el);
    if (open) {
      gsap.set(el, { visibility: "visible" });
      gsap.fromTo(
        el,
        { opacity: 0, scale: reduce ? 1 : 0.6, y: reduce ? 0 : 16 },
        { opacity: 1, scale: 1, y: 0, duration: reduce ? 0.15 : 0.45, ease: "expo.out" },
      );
      field.current?.focus({ preventScroll: true });
    } else {
      gsap.to(el, {
        opacity: 0,
        scale: reduce ? 1 : 0.7,
        y: reduce ? 0 : 12,
        duration: reduce ? 0.1 : 0.25,
        ease: "power2.in",
        onComplete: () => void gsap.set(el, { visibility: "hidden" }),
      });
    }
  }, [open]);

  // Esc closes, Tab stays inside the panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        launcher.current?.focus();
      } else if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const [res] = await Promise.all([
        fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lang, messages: next.map(({ role, content }) => ({ role, content })) }),
        }),
        new Promise((r) => setTimeout(r, 600)), // let the "thinking" state read
      ]);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { reply: string; links: ChatLink[] };
      setMsgs((m) => [...m, { role: "assistant", content: data.reply, links: data.links }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: c.error }]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className="ca-root" data-lenis-prevent>
      <div
        ref={panel}
        className="ca-panel"
        role="dialog"
        aria-modal="false"
        aria-label="CTRL Assistant"
        aria-hidden={!open}
        style={{ visibility: "hidden", opacity: 0 }}
      >
        <header className="ca-head">
          <CtrlMascot mini className="ca-head-mascot" />
          <div className="ca-head-text">
            <p className="ca-name">CTRL Assistant</p>
            <p className="ca-status">
              <span className="ca-dot" aria-hidden="true" />
              {c.status}
            </p>
          </div>
          <button type="button" className="ca-close" aria-label={c.close} onClick={() => setOpen(false)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        </header>

        <div ref={list} className="ca-list" aria-live="polite">
          <div className="ca-msg is-assistant">{c.greeting}</div>
          {msgs.map((m, i) => (
            <div key={i} className={`ca-msg is-${m.role}`}>
              {m.content}
              {m.links && m.links.length > 0 && (
                <span className="ca-links">
                  {m.links.map((l) =>
                    l.href.startsWith("mailto:") ? (
                      <a key={l.href} href={l.href}>{l.label}</a>
                    ) : (
                      <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
                    ),
                  )}
                </span>
              )}
            </div>
          ))}
          {busy && (
            <div className="ca-msg is-assistant ca-typing" aria-label={c.thinking}>
              <i /><i /><i />
            </div>
          )}
        </div>

        <div className="ca-chips">
          {c.chips.map((chip) => (
            <button key={chip} type="button" className="ca-chip" disabled={busy} onClick={() => void send(chip)}>
              {chip}
            </button>
          ))}
        </div>

        <form className="ca-form" onSubmit={onSubmit}>
          <input
            ref={field}
            className="ca-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={c.placeholder}
            aria-label={c.placeholder}
            maxLength={500}
          />
          <button type="submit" className="ca-send" aria-label={c.send} disabled={busy || !input.trim()}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        </form>
      </div>

      <button
        ref={launcher}
        type="button"
        className={`ca-launcher ${open ? "is-open" : ""}`}
        aria-label={open ? c.close : c.open}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <CtrlMascot thinking={busy} />
      </button>
    </div>
  );
}
