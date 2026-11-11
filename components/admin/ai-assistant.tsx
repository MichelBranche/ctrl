"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CtrlMascot } from "@/components/ctrl-mascot";
import { AI_MSG } from "@/lib/ai/messages";

type Turn = { role: "user" | "assistant"; content: string };

const GREETING = "Buongiorno. Chiedimi dei contatti, della pipeline o delle attività di oggi. Non modifico nulla.";
const CHIPS = ["Quante trattative per fase?", "Cosa c'è da fare oggi?", "Attività recenti"];

/**
 * CRM assistant on every signed-in admin page. The mascot is the same cloud used on the public site.
 * Questions go to /api/admin/ai/chat. The panel stays in the corner so the page behind it stays usable.
 */
export function CrmAssistant() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const launcher = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const lock = useRef(false);

  useEffect(() => {
    let stop = false;
    void fetch("/api/admin/ai/status", { cache: "no-store" })
      .then((res) => res.ok ? res.json() as Promise<{ configured?: boolean; remaining?: number | null }> : null)
      .then((data) => {
        if (stop || !data) return;
        setConfigured(data.configured === true);
        setRemaining(typeof data.remaining === "number" ? data.remaining : null);
      })
      .catch(() => { if (!stop) setConfigured(null); });
    return () => { stop = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcher.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [turns, busy, open]);

  const send = (text: string) => {
    const content = text.trim();
    if (!content || lock.current || busy || configured === false) return;
    lock.current = true;
    const next: Turn[] = [...turns, { role: "user" as const, content }].slice(-8);
    setTurns(next);
    setInput("");
    setBusy(true);
    void fetch("/api/admin/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: next }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as { reply?: string; error?: string; code?: string };
        if (data.code === "unconfigured") setConfigured(false);
        const reply = data.reply || data.error || AI_MSG.down;
        setTurns((current) => [...current, { role: "assistant" as const, content: reply }].slice(-8));
        if (res.ok) {
          const status = await fetch("/api/admin/ai/status", { cache: "no-store" }).then((r) => r.ok ? r.json() as Promise<{ remaining?: number | null }> : null).catch(() => null);
          if (status && typeof status.remaining === "number") setRemaining(status.remaining);
        }
      })
      .catch(() => setTurns((current) => [...current, { role: "assistant" as const, content: AI_MSG.down }]))
      .finally(() => { lock.current = false; setBusy(false); });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
  };

  const unavailable = configured === false;
  const status = unavailable
    ? AI_MSG.unconfigured
    : remaining === null
      ? "Solo domande sul CRM"
      : `Solo domande sul CRM · ${remaining} richieste oggi`;

  return (
    <div className={`crm-ai${open ? " is-open" : ""}`}>
      {open ? (
        <section className="crm-ai-panel" id={panelId} role="dialog" aria-modal="false" aria-label="Assistente CRM">
          <header className="crm-ai-head">
            <CtrlMascot mini />
            <div>
              <p className="crm-ai-name">Assistente CRM</p>
              <p className="crm-ai-status">{status}</p>
            </div>
            <button type="button" className="crm-ai-close" aria-label="Chiudi assistente" onClick={() => { setOpen(false); launcher.current?.focus(); }}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </header>
          <div ref={list} className="crm-ai-log" aria-live="polite">
            <p className="crm-ai-msg is-assistant">{unavailable ? AI_MSG.unconfigured : GREETING}</p>
            {turns.map((turn, index) => <p key={`${turn.role}-${index}`} className={`crm-ai-msg is-${turn.role}`}>{turn.content}</p>)}
            {busy ? <p className="crm-ai-msg is-assistant crm-ai-typing" aria-label="Sto pensando"><i /><i /><i /></p> : null}
          </div>
          {unavailable ? null : (
            <div className="crm-ai-chips">
              {CHIPS.map((chip) => (
                <button key={chip} type="button" className="crm-ai-chip" disabled={busy} onClick={() => send(chip)}>{chip}</button>
              ))}
            </div>
          )}
          <form className="crm-ai-form" onSubmit={onSubmit}>
            <textarea
              ref={field}
              className="crm-ai-input"
              rows={2}
              value={input}
              maxLength={500}
              disabled={unavailable || busy}
              placeholder={unavailable ? AI_MSG.unconfigured : "Chiedi del CRM…"}
              aria-label="Messaggio per l'assistente CRM"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(input);
                }
              }}
            />
            <button type="submit" className="adm-btn adm-btn-sm adm-btn-primary" disabled={unavailable || busy || !input.trim()}>Invia</button>
          </form>
        </section>
      ) : null}
      <button
        ref={launcher}
        type="button"
        className={`crm-ai-launcher${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? "Chiudi assistente CRM" : "Apri assistente CRM"}
        onClick={() => setOpen((value) => !value)}
      >
        <CtrlMascot thinking={busy} />
      </button>
    </div>
  );
}
