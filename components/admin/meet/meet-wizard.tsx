"use client";

import { type FormEvent, type ReactNode, useRef, useState, useTransition } from "react";
import { createMeetingAction, inviteClientAction, type MeetState } from "@/app/admin/meet-actions";
import { CopyLink, MEET_NEW, type MemberOption } from "@/components/admin/meet/meet-forms";
import { Icon, MI } from "@/components/admin/meet/meet-icons";
import { DURATIONS, durationLabel, EMAIL_SIMPLE, longDay, romeNow, splitEmails } from "@/lib/meet-dates";

/*
 * Guided creation, one step at a time. All steps live in ONE form and stay mounted (inactive ones are `hidden`), so
 * going back and forth never loses a value. The form is submitted by hand (no React form action), so a server error
 * keeps every field as typed. Each step validates its own fields (native constraints + a small check) before moving on.
 */

export type ContactOption = { id: string; label: string; name: string; email: string };

type Step = { label: string; icon: string; body: ReactNode; check?: (fd: FormData) => string | null };
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function Shell({ kind, heading, lead, steps, summary, submit, action, notice, blocked }: {
  kind: "team" | "cliente"; heading: string; lead: string; steps: Step[]; summary: (fd: FormData) => ReactNode;
  submit: [string, string]; action: (s: MeetState, fd: FormData) => Promise<MeetState>; notice?: ReactNode; blocked?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [snap, setSnap] = useState<FormData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<MeetState | null>(null);
  const [pending, start] = useTransition();
  const all = [...steps, { label: kind === "team" ? "Riepilogo" : "Riepilogo e invio", icon: MI.check, body: null }];
  const last = all.length - 1;

  const valid = (i: number, report: boolean) => {
    const f = form.current; if (!f) return false;
    const fields = f.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-step="${i}"] :is(input, select, textarea)`);
    for (const el of fields) if (!el.checkValidity()) { if (report) requestAnimationFrame(() => el.reportValidity()); return false; }
    const msg = all[i].check?.(new FormData(f)) ?? null;
    if (msg && report) setErr(msg);
    return !msg;
  };
  const go = (to: number) => {
    if (to > step) for (let i = step; i < to; i++) if (!valid(i, true)) { setStep(i); return; }
    setErr(null);
    setStep(to);
    setReached((r) => Math.max(r, to));
    if (to === last && form.current) setSnap(new FormData(form.current));
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(`[data-step="${to}"] h2`)?.focus());
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < last) return go(step + 1);
    for (let i = 0; i < last; i++) if (!valid(i, false)) { setStep(i); requestAnimationFrame(() => valid(i, true)); return; }
    if (blocked) return setErr(blocked);
    const fd = new FormData(form.current!);
    start(async () => {
      const r = await action({}, fd);
      if (r.error) setErr(r.error); else { setErr(null); setDone(r); }
    });
  };
  const again = () => { form.current?.reset(); setDone(null); setSnap(null); setStep(0); setReached(0); setErr(null); };

  return (
    <section className="mt-card mt-wiz" data-kind={kind} aria-labelledby="mt-wiz-h">
      <div className="mt-card-head">
        <span className="mt-head-icon" data-kind={kind}><Icon d={kind === "team" ? MI.users : MI.client} /></span>
        <div><h1 id="mt-wiz-h">{heading}</h1><p>{lead}</p></div>
      </div>

      {done ? (
        <div className="mt-done" role="status">
          <span className="mt-done-icon"><Icon d={MI.check} size={26} /></span>
          <h2>{kind === "team" ? "Riunione creata" : "Invito inviato"}</h2>
          <p>{done.ok}</p>
          <div className="mt-done-actions">
            {done.url ? <><a className="rb-cta" href={done.url} target="_blank" rel="noopener noreferrer"><Icon d={MI.video} />Entra nella riunione</a><CopyLink url={done.url} /></> : null}
            <a className="rb-btn" href="/admin/riunioni#calendario"><Icon d={MI.cal} />Vai al calendario</a>
            <button type="button" className="rb-btn rb-btn-quiet" onClick={again}><Icon d={MI.plus} />Creane un&apos;altra</button>
          </div>
        </div>
      ) : null}

      <div hidden={Boolean(done)}>
        <div className="mt-progress" aria-hidden="true"><span style={{ ["--p" as string]: last ? step / last : 0 }} /></div>
        <ol className="mt-stepper" aria-label={`Passo ${step + 1} di ${all.length}`}>
          {all.map((s, i) => (
            <li key={s.label} data-state={i === step ? "current" : i < step || i <= reached ? "done" : "todo"}>
              <button type="button" onClick={() => go(i)} disabled={i > reached && i > step + 1} aria-current={i === step ? "step" : undefined}>
                <span className="mt-step-n">{i < step ? <Icon d={MI.check} size={13} /> : i + 1}</span>
                <span className="mt-step-l">{s.label}</span>
              </button>
            </li>
          ))}
        </ol>
        {notice}
        <form ref={form} className="mt-form mt-wiz-form" noValidate onSubmit={onSubmit} onClick={(e) => { const t = (e.target as HTMLElement).closest<HTMLElement>("[data-goto]"); if (t) go(Number(t.dataset.goto)); }}>
          {all.map((s, i) => (
            <fieldset key={s.label} className="mt-wiz-step" data-step={i} hidden={i !== step}>
              <legend className="mt-sr">{s.label}</legend>
              <h2 tabIndex={-1}><span className="mt-wiz-k">Passo {i + 1} di {all.length}</span><span className="mt-wiz-t"><Icon d={s.icon} size={18} />{s.label}</span></h2>
              {i === last ? (snap ? summary(snap) : null) : s.body}
            </fieldset>
          ))}
          {err ? <p className="mt-msg mt-wiz-err" data-tone="error" role="alert"><Icon d={MI.alert} size={14} />{err}</p> : null}
          <div className="mt-wiz-foot">
            {step > 0 ? <button type="button" className="rb-btn" onClick={() => go(step - 1)}><Icon d={MI.back} />Indietro</button> : <a className="rb-btn rb-btn-quiet" href="/admin/riunioni">Annulla</a>}
            <span className="mt-wiz-count">{step + 1} / {all.length}</span>
            {step < last
              ? <button type="submit" className="rb-cta mt-next-btn">Avanti<Icon d={MI.arrow} /></button>
              : <button type="submit" className="rb-cta" disabled={pending || Boolean(blocked)}>{pending ? submit[1] : submit[0]}<Icon d={MI.check} /></button>}
          </div>
        </form>
      </div>
    </section>
  );
}

/* ---------- Shared steps ---------- */

function WhenStep({ today, time }: { today: string; time: string }) {
  return (
    <>
      <div className="mt-pair">
        <label className="rb-field"><span>Data</span><input name="date" type="date" min={today} defaultValue={today} required /></label>
        <label className="rb-field"><span>Ora (Italia)</span><input name="time" type="time" step={300} defaultValue={time} required /></label>
      </div>
      <fieldset className="mt-people">
        <legend>Durata</legend>
        <div className="mt-chips">
          {DURATIONS.map((m) => <label key={m} className="mt-chip"><input type="radio" name="minutes" value={m} defaultChecked={m === 30} /><span>{durationLabel(m)}</span></label>)}
        </div>
      </fieldset>
    </>
  );
}
const checkWhen = (fd: FormData) => {
  const date = str(fd, "date"), time = str(fd, "time");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return "Scegli data e ora.";
  return `${date}T${time}` < romeNow(Date.now() - 10 * 60_000) ? "La riunione è nel passato: scegli un orario futuro." : null;
};
function Sum({ label, icon, step, children }: { label: string; icon: string; step: number; children: ReactNode }) {
  return (
    <div className="mt-sum-row">
      <span className="mt-sum-icon"><Icon d={icon} size={15} /></span>
      <div><small>{label}</small><div>{children}</div></div>
      <button type="button" className="rb-btn rb-btn-quiet mt-act" data-goto={step}>Modifica</button>
    </div>
  );
}
const whenText = (fd: FormData) => `${longDay(str(fd, "date"))}, ${str(fd, "time")} · ${durationLabel(Number(fd.get("minutes")))}`;

/* ---------- Team ---------- */

const TITLE_IDEAS = ["Allineamento progetto", "Revisione design", "Pianificazione settimana", "Standup"];

export function TeamWizard({ members, today, time, title, external, live }: { members: MemberOption[]; today: string; time: string; title?: string; external?: string; live: boolean }) {
  const titleRef = useRef<HTMLInputElement>(null);
  const steps: Step[] = [
    { label: "Argomento", icon: MI.title, check: (fd) => (str(fd, "title").length < 2 ? "Dai un titolo alla riunione." : null), body: (
      <>
        <label className="rb-field"><span>Titolo della riunione</span><input ref={titleRef} name="title" minLength={2} maxLength={120} required defaultValue={title} placeholder="Es. Allineamento progetto sito" autoFocus /></label>
        <div className="mt-ideas"><span>Idee rapide</span>{TITLE_IDEAS.map((t) => <button key={t} type="button" className="mt-idea" onClick={() => { if (titleRef.current) titleRef.current.value = t; }}>{t}</button>)}</div>
      </>
    ) },
    { label: "Data e ora", icon: MI.clock, check: checkWhen, body: <WhenStep today={today} time={time} /> },
    { label: "Partecipanti", icon: MI.users, check: (fd) => {
      const bad = splitEmails(str(fd, "external")).filter((e) => !EMAIL_SIMPLE.test(e));
      return bad.length ? `Email non valide: ${bad.slice(0, 3).join(", ")}` : null;
    }, body: (
      <>
        <fieldset className="mt-people">
          <legend>Membri del team (tu sei sempre incluso)</legend>
          <div className="mt-chips">
            {members.map((m) => <label key={m.id} className="mt-chip"><input type="checkbox" name="members" value={m.id} /><span>{m.name}</span></label>)}
            {!members.length ? <span className="mt-hint">Nessun altro membro attivo.</span> : null}
          </div>
        </fieldset>
        <label className="rb-field"><span>Ospiti esterni (email separate da virgola, facoltativo)</span><input name="external" defaultValue={external} placeholder="cliente@azienda.it, altro@esempio.it" autoComplete="off" /></label>
      </>
    ) },
    { label: "Note", icon: MI.note, body: (
      <>
        <label className="rb-field"><span>Note per gli invitati (facoltativo)</span><textarea name="notes" rows={5} maxLength={2000} placeholder="Ordine del giorno, link utili…" /></label>
        <p className="mt-hint">Google Calendar crea il link Meet e manda l&apos;invito a tutti, te compreso.</p>
      </>
    ) },
  ];
  const summary = (fd: FormData) => {
    const picked = fd.getAll("members").map(String).map((id) => members.find((m) => m.id === id)?.name).filter(Boolean);
    const ext = splitEmails(str(fd, "external"));
    return (
      <div className="mt-sum">
        <Sum label="Argomento" icon={MI.title} step={0}><strong>{str(fd, "title")}</strong></Sum>
        <Sum label="Quando" icon={MI.clock} step={1}>{whenText(fd)}</Sum>
        <Sum label="Partecipanti" icon={MI.users} step={2}>{[`Tu`, ...picked, ...ext].join(", ")}</Sum>
        <Sum label="Note" icon={MI.note} step={3}>{str(fd, "notes") || <span className="mt-dim">Nessuna nota</span>}</Sum>
      </div>
    );
  };
  return (
    <Shell kind="team" heading="Nuova riunione team" lead="Una videochiamata Google Meet con il team ed eventuali ospiti." steps={steps} summary={summary}
      submit={["Crea riunione", "Creo la riunione…"]} action={createMeetingAction}
      blocked={live ? undefined : "Google Calendar non è collegato: la riunione team non può essere creata. Usa Meet veloce o collega Google."}
      notice={live ? undefined : <p className="mt-notice" data-tone="warn"><Icon d={MI.alert} /><span>Google Calendar non è collegato: puoi preparare la riunione, ma per crearla serve il collegamento. Nel frattempo c&apos;è <a href={MEET_NEW} target="_blank" rel="noopener noreferrer">Meet veloce</a>.</span></p>} />
  );
}

/* ---------- Cliente ---------- */

export function ClientWizard({ contacts, today, time, live, preset }: { contacts: ContactOption[]; today: string; time: string; live: boolean; preset?: ContactOption | null }) {
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [contactId, setContactId] = useState(preset?.id ?? "");
  const pick = (id: string) => {
    setContactId(id);
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    if (nameRef.current) nameRef.current.value = c.name;
    if (emailRef.current) emailRef.current.value = c.email;
    if (titleRef.current && !titleRef.current.value) titleRef.current.value = "Videochiamata con Ctrl Agency";
  };
  const steps: Step[] = [
    { label: "Cliente", icon: MI.client, check: (fd) => (str(fd, "client_name").length < 2 ? "Indica il nome del cliente." : !EMAIL_SIMPLE.test(str(fd, "client_email")) ? "Email del cliente non valida." : null), body: (
      <>
        {contacts.length ? (
          <label className="rb-field"><span>Contatto dal CRM (facoltativo)</span>
            <select name="contact_id" value={contactId} onChange={(e) => pick(e.target.value)}>
              <option value="">Nessuno, inserisco a mano</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        ) : null}
        <div className="mt-pair">
          <label className="rb-field"><span>Nome del cliente</span><input ref={nameRef} name="client_name" minLength={2} maxLength={120} required defaultValue={preset?.name} placeholder="Es. Mario Rossi" autoComplete="off" /></label>
          <label className="rb-field"><span>Email del cliente</span><input ref={emailRef} name="client_email" type="email" maxLength={254} required defaultValue={preset?.email} placeholder="mario@azienda.it" autoComplete="off" /></label>
        </div>
        {contacts.length ? <p className="mt-hint">Scegliendo un contatto, la scheda CRM riceve una nota e la prossima azione.</p> : null}
      </>
    ) },
    { label: "Argomento", icon: MI.title, check: (fd) => (str(fd, "title").length < 2 ? "Dai un titolo alla riunione." : null), body: (
      <label className="rb-field"><span>Titolo (compare nell&apos;email al cliente)</span><input ref={titleRef} name="title" minLength={2} maxLength={120} required defaultValue={preset ? "Videochiamata con Ctrl Agency" : undefined} placeholder="Es. Presentazione proposta sito web" /></label>
    ) },
    { label: "Data e ora", icon: MI.clock, check: checkWhen, body: <WhenStep today={today} time={time} /> },
    { label: "Dettagli", icon: MI.note, body: (
      <>
        <label className="rb-field"><span>Ordine del giorno (finisce nell&apos;email al cliente, facoltativo)</span><textarea name="agenda" rows={5} maxLength={2000} placeholder="Punti da discutere, materiali da preparare…" /></label>
        {!live ? (
          <label className="rb-field"><span>Link Google Meet</span>
            <input name="meet_url" type="url" required pattern="https://meet\.google\.com/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}(\?[\w=&\-]*)?" placeholder="https://meet.google.com/abc-defg-hij" autoComplete="off" />
            <small className="mt-hint">Google Calendar non è collegato: crea il link da <a href={MEET_NEW} target="_blank" rel="noopener noreferrer">meet.new</a> e incollalo qui.</small>
          </label>
        ) : <p className="mt-hint">Il link Meet viene creato in automatico su Google Calendar.</p>}
      </>
    ) },
  ];
  const summary = (fd: FormData) => (
    <div className="mt-sum">
      <Sum label="Cliente" icon={MI.client} step={0}><strong>{str(fd, "client_name")}</strong> · {str(fd, "client_email")}{str(fd, "contact_id") ? <span className="mt-dim"> · collegato al CRM</span> : null}</Sum>
      <Sum label="Argomento" icon={MI.title} step={1}>{str(fd, "title")}</Sum>
      <Sum label="Quando" icon={MI.clock} step={2}>{whenText(fd)}</Sum>
      <Sum label="Dettagli" icon={MI.note} step={3}>{str(fd, "agenda") || <span className="mt-dim">Nessun ordine del giorno</span>}{!live ? <><br />{str(fd, "meet_url")}</> : null}</Sum>
      <p className="mt-hint mt-sum-foot"><Icon d={MI.mail} size={14} />Il cliente riceve un invito professionale con la tua firma, il file per il calendario e il pulsante per entrare.</p>
    </div>
  );
  return <Shell kind="cliente" heading="Nuova riunione cliente" lead="Invito Google Meet per un cliente, con email intestata Ctrl Agency in italiano." steps={steps} summary={summary} submit={["Invia invito al cliente", "Invio l'invito…"]} action={inviteClientAction} />;
}
