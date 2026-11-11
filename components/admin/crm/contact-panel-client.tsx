"use client";
import { createContext, useActionState, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { panelFollowUpAction, panelOwnerAction, panelStageAction, setEstimateAction, setKindAction, type CrmState } from "@/app/admin/crm-actions";
import type { ContactKind } from "@/lib/crm-kind";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/crm-core";

const MOBILE = "(max-width: 1279px)";
const PANEL_WIDTH = "ctrl:crm-panel-w";
/** Quick forms remount when the contact's version changes (fresh values after a save or a conflict): their result lives here. */
const Flash = createContext<(s: CrmState) => void>(() => {});
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Side panel on desktop, modal sheet on small screens. Its open state is the `c` query param, so closing is a navigation
 * (back/forward stay consistent). Focus moves to the title on open and back to the row that opened it on close.
 */
export function PanelShell({ contactId, closeHref, labelId, children }: { contactId: string; closeHref: string; labelId: string; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  const [modal, setModal] = useState(false);
  const [wide, setWide] = useState(false);
  const [flash, setFlash] = useState<CrmState>({});

  useEffect(() => {
    const saved = sessionStorage.getItem(PANEL_WIDTH);
    const px = saved === "420" ? 420 : saved === "380" ? 380 : 400;
    setWide(px === 420);
    document.documentElement.style.setProperty("--crm-panel-w", `${px}px`);
  }, []);

  useEffect(() => {
    if (!flash.ok) return;
    const t = setTimeout(() => setFlash({}), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const sync = () => setModal(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`#${labelId}`)?.focus({ preventScroll: true });
    return () => {
      // The row link of the contact that was open (still in the list when the panel closes or switches).
      document.querySelector<HTMLElement>(`[data-row-link="${contactId}"]`)?.focus({ preventScroll: true });
    };
  }, [contactId, labelId]);

  useEffect(() => {
    if (!modal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [modal]);

  const leave = (href: string) => {
    const node = ref.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!node || reduce || !node.closest(".crm-rubrica-page, .crm-pipeline-page")) { router.push(href as Route, { scroll: false }); return; }
    node.classList.add("is-closing");
    window.setTimeout(() => router.push(href as Route, { scroll: false }), 180);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        const open = document.querySelector("details[open].crm-menu");
        if (open) { open.removeAttribute("open"); return; }
        e.preventDefault();
        leave(closeHref);
        return;
      }
      if (e.key !== "Tab" || !modal || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (!ref.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeHref, modal, router]);

  return (
    <>
      {modal ? <div className="crm-sheet-backdrop" aria-hidden="true" onClick={() => leave(closeHref)} /> : null}
      <section ref={ref} className="crm-panel" role="dialog" aria-modal={modal || undefined} aria-labelledby={labelId}
        onClick={(e) => {
          const link = (e.target as HTMLElement).closest("a.crm-panel-close");
          if (!link || !ref.current?.closest(".crm-rubrica-page, .crm-pipeline-page")) return;
          e.preventDefault();
          leave(link.getAttribute("href") || closeHref);
        }}>
        {modal ? null : (
          <button type="button" className="crm-panel-size" aria-pressed={wide} aria-label={wide ? "Restringi il pannello" : "Allarga il pannello"}
            onClick={() => {
              const next = wide ? 380 : 420;
              setWide(next === 420);
              try { sessionStorage.setItem(PANEL_WIDTH, String(next)); } catch { /* private mode */ }
              document.documentElement.style.setProperty("--crm-panel-w", `${next}px`);
            }} />
        )}
        <Flash.Provider value={setFlash}>{children}</Flash.Provider>
        <div className="crm-panel-flash" aria-live="polite">
          {flash.error ? <p className="adm-error" role="alert">{flash.error}</p> : flash.ok ? <p className="adm-ok">{flash.ok}</p> : null}
        </div>
      </section>
    </>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button type="button" className="crm-icon-btn" aria-label={done ? "Copiato" : label} title={done ? "Copiato" : label}
      onClick={() => navigator.clipboard?.writeText(text).then(() => setDone(true), () => {})}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {done ? <path d="M5 12l5 5 9-10" /> : <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>}
      </svg>
      <span className="adm-sr" role="status">{done ? "Email copiata" : ""}</span>
    </button>
  );
}

/** Server action result shown next to a quick form; on error the form goes back to the saved values. */
function useQuickAction(fn: (s: CrmState, f: FormData) => Promise<CrmState>) {
  const form = useRef<HTMLFormElement>(null);
  const flash = useContext(Flash);
  const [, action, pending] = useActionState<CrmState, FormData>(async (prev, f) => {
    flash({});
    const r = await fn(prev, f);
    if (r.error) form.current?.reset();
    flash(r);
    return r;
  }, {});
  return { form, action, pending };
}

type Versioned = { id: string; version: number };

/** A readable value. The existing editor opens only after a click. */
export function Peek({ text, label, children }: { text: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <div className="crm-peek is-open">
        {children}
        <button type="button" className="crm-textbtn" onClick={() => setOpen(false)}>Chiudi</button>
      </div>
    );
  }
  return (
    <button type="button" className="crm-peek" onClick={() => setOpen(true)}>
      <span>{text}</span>
      <span className="crm-peek-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
      </span>
      <span className="adm-sr">{label}</span>
    </button>
  );
}

export function StageQuick({ contact, stage }: { contact: Versioned; stage: Stage }) {
  const { form, action, pending } = useQuickAction(panelStageAction);
  return (
    <form ref={form} action={action} className="crm-quick-field">
      <input type="hidden" name="id" value={contact.id} /><input type="hidden" name="version" value={contact.version} />
      <label htmlFor="crm-panel-stage">Fase</label>
      <span className="crm-select-dot" data-stage={stage}>
        <select id="crm-panel-stage" className="adm-input" name="stage" defaultValue={stage} disabled={pending} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
      </span>
    </form>
  );
}

const romeDay = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};
const PRESETS = [["oggi", "Oggi", 0], ["domani", "Domani", 1], ["3g", "Tra 3 giorni", 3], ["7g", "Tra una settimana", 7]] as const;

/** Legacy follow-up (the only follow-up source until the Attività phase): a date preset or a custom date, optional text. */
export function FollowUpQuick({ contact, text, at, compact = false, label = "Prossima azione" }: { contact: Versioned; text: string | null; at: string | null; compact?: boolean; label?: string }) {
  const { form, action, pending } = useQuickAction(panelFollowUpAction);
  const current = at?.slice(0, 10) ?? "";
  const preset = PRESETS.find(([, , n]) => romeDay(n) === current)?.[0] ?? (current ? "data" : "");
  const [choice, setChoice] = useState<string>(preset);
  const [date, setDate] = useState(current);
  const pick = (v: string) => {
    setChoice(v);
    const p = PRESETS.find(([k]) => k === v);
    if (p) setDate(romeDay(p[2]));
    if (v === "") setDate("");
  };
  return (
    <form ref={form} action={action} className="crm-quick-field" onReset={() => { setChoice(preset); setDate(current); }}>
      <input type="hidden" name="id" value={contact.id} /><input type="hidden" name="version" value={contact.version} />
      <label htmlFor={`crm-fu-${compact ? "c" : "f"}`}>{label}</label>
      <select id={`crm-fu-${compact ? "c" : "f"}`} className="adm-input" value={choice} disabled={pending} onChange={(e) => pick(e.currentTarget.value)}>
        <option value="">Nessuna</option>
        {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        <option value="data">Scegli data…</option>
      </select>
      {choice === "data" ? <input className="adm-input" type="date" aria-label="Data follow-up" value={date} onChange={(e) => setDate(e.currentTarget.value)} required /> : null}
      <input type="hidden" name="next_action_at" value={choice ? date : ""} />
      {choice ? null : <input type="hidden" name="clear" value="1" />}
      {compact ? <input type="hidden" name="next_action" value={text ?? ""} /> : <input className="adm-input" name="next_action" defaultValue={text ?? ""} maxLength={300} placeholder="Cosa fare (es. richiamare)" aria-label="Descrizione follow-up" />}
      {choice !== preset || date !== current || !compact
        ? <button className="adm-btn adm-btn-sm" disabled={pending}>{pending ? "Salvo…" : choice ? "Salva follow-up" : "Rimuovi follow-up"}</button>
        : null}
    </form>
  );
}

export function OwnerQuick({ contact, ownerId, owners, former }: { contact: Versioned; ownerId: string | null; owners: { id: string; name: string }[]; former: string | null }) {
  const { form, action, pending } = useQuickAction(panelOwnerAction);
  return (
    <form ref={form} action={action} className="crm-quick-field">
      <input type="hidden" name="id" value={contact.id} /><input type="hidden" name="version" value={contact.version} />
      <label htmlFor="crm-panel-owner">Responsabile</label>
      <select id="crm-panel-owner" className="adm-input" name="owner_user_id" defaultValue={ownerId ?? ""} disabled={pending} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="">Non assegnato</option>
        {former && ownerId ? <option value={ownerId}>{former}</option> : null}
        {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </form>
  );
}

/** Proposed value in whole euros. Empty clears it. Anyone who can open the CRM can change it. */
export function EstimateField({ contact, cents, note }: { contact: Versioned; cents: number | null; note: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [euros, setEuros] = useState(cents === null ? "" : String(Math.round(cents / 100)));
  const [text, setText] = useState(note ?? "");
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const shown = cents === null ? "Nessuna stima" : `€ ${Math.round(cents / 100).toLocaleString("it-IT")}`;
  if (!editing) {
    return (
      <button type="button" className="crm-panel-amount" onClick={() => setEditing(true)}>
        {shown}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
        <span className="adm-sr">Modifica la stima</span>
      </button>
    );
  }
  return (
    <form className="crm-quick-field crm-estimate" onSubmit={(e) => {
      e.preventDefault();
      setMsg("");
      start(async () => {
        const r = await setEstimateAction(contact.id, euros, text, contact.version);
        setMsg(r.error ?? r.ok ?? "");
        if (r.ok) router.refresh();
      });
    }}>
      <span>Valore stimato</span>
      <label className="adm-sr" htmlFor={`crm-estimate-${contact.id}`}>Valore stimato in euro</label>
      <input id={`crm-estimate-${contact.id}`} className="adm-input" inputMode="numeric" value={euros} disabled={pending} placeholder="Euro, vuoto se non c'è"
        onChange={(e) => setEuros(e.target.value)} />
      <label className="adm-sr" htmlFor={`crm-estimate-note-${contact.id}`}>Nota sul valore stimato</label>
      <input id={`crm-estimate-note-${contact.id}`} className="adm-input" value={text} disabled={pending} maxLength={200} placeholder="Nota breve, facoltativa"
        onChange={(e) => setText(e.target.value)} />
      <button className="adm-btn adm-btn-sm" type="submit" disabled={pending}>Salva stima</button>
      <button className="crm-textbtn" type="button" onClick={() => setEditing(false)}>Chiudi</button>
      {msg ? <span className="adm-muted">{msg}</span> : null}
    </form>
  );
}

/** Stored kind. Empty keeps the deduction (company name, or a person when the two names match). */
export function KindField({ contact, stored }: { contact: Versioned; stored: ContactKind | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(stored ?? "");
  return (
    <label className="crm-quick-field">
      <span>Tipo</span>
      <select className="adm-input" value={value} disabled={pending} aria-label="Tipo di contatto"
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          start(async () => {
            await setKindAction(contact.id, next || null, contact.version);
            router.refresh();
          });
        }}>
        <option value="">Automatico</option>
        <option value="azienda">Azienda</option>
        <option value="persona">Persona</option>
      </select>
    </label>
  );
}
