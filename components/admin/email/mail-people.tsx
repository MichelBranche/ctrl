"use client";

import { InternalNotes, MailStatusSelect } from "@/components/admin/email/mail-workflow";
import { MailIcon } from "@/components/admin/email/mailbox-ui";
import { useMailBox } from "@/components/admin/email/mail-box";
import { assignMail } from "@/app/admin/email-actions";
import type { Assignee } from "@/lib/mail/assignees";
import { MAIL_STATUSES } from "@/lib/mail/workflow-types";
import { UserAvatar } from "@/components/admin/user-avatar";
import Image from "next/image";
import { createContext, useContext, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { ClaimButton } from "@/components/admin/email/mail-client";
import type { Collab } from "@/lib/mail/types";

const PeopleContext = createContext<Map<string, Collab> | null>(null);
const EMPTY: Collab = { readBy: [], claimedBy: null };

/** Collaboration updates use the database, without fetching email bodies from Gmail. */
export function MailPeopleProvider({ initial, children }: { initial: [string, Collab][]; children: ReactNode }) {
  const [updates, setUpdates] = useState<{ keys: string; values: Map<string, Collab> } | null>(null);
  const keys = initial.map(([key]) => key).sort().join(",");
  const values = updates?.keys === keys ? updates.values : new Map(initial);
  useEffect(() => {
    if (!keys) return;
    let active: AbortController | undefined;
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || active) return;
      const request = new AbortController(); active = request;
      try {
        const response = await fetch(`/admin/email/collaboration?keys=${keys}`, { cache: "no-store", signal: request.signal });
        if (!response.ok) return;
        const body = await response.json() as { entries: [string, Collab][] };
        if (alive) setUpdates({ keys, values: new Map(body.entries) });
      } catch { /* A transient failure keeps the last known collaboration state. */ }
      finally { if (active === request) active = undefined; }
    };
    const onChange = () => { active?.abort(); active = undefined; void refresh(); };
    const timer = setInterval(() => { void refresh(); }, 8_000);
    document.addEventListener("visibilitychange", onChange);
    window.addEventListener("ctrl-mail-changed", onChange);
    return () => { alive = false; active?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", onChange); window.removeEventListener("ctrl-mail-changed", onChange); };
  }, [keys]);
  return <PeopleContext.Provider value={values}>{children}</PeopleContext.Provider>;
}

function usePeople(mkey: string, initial?: Collab) { return useContext(PeopleContext)?.get(mkey) ?? initial ?? EMPTY; }
const initials = (name: string) => name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

function ReaderAvatar({ reader, me }: { reader: Collab["readBy"][number]; me: boolean }) {
  const id = useId();
  const [failed, setFailed] = useState(false);
  const label = `${reader.name}${me ? " (tu)" : ""}`;
  return <span className="mail-reader" tabIndex={0} aria-label={`Aperta da ${label}`} aria-describedby={id} title={label}>
    {reader.avatarUrl && !failed ? <Image src={reader.avatarUrl} alt="" width={28} height={28} unoptimized onError={() => setFailed(true)} /> : <span className="mail-reader-initials" aria-hidden="true">{initials(reader.name)}</span>}
    <span id={id} className="mail-reader-tooltip" role="tooltip">{label}</span>
  </span>;
}

export function MailPeople({ mkey, initial, meId, showClaim = true }: { mkey: string; initial?: Collab; meId: string; showClaim?: boolean }) {
  const people = usePeople(mkey, initial);
  if (!showClaim && !people.readBy.length) return null;
  return <span className="adm-mail-chips mail-people">
    {/* In the list only a status someone set is shown; an untouched message stays quiet. */}
    {showClaim && people.status ? <span className="mail-workflow-badge" data-status={people.status}>{MAIL_STATUSES[people.status]}</span> : null}
    {showClaim && people.noteCount ? <span className="adm-muted">{people.noteCount} note</span> : null}
    {showClaim && people.claimedBy ? <span className="adm-badge adm-mail-claim" data-mine={people.claimedBy.id === meId || undefined}><UserAvatar name={people.claimedBy.name} src={people.claimedBy.avatarUrl} small /> In carico: {people.claimedBy.id === meId ? "tu" : people.claimedBy.name}</span> : null}
    {people.readBy.length ? <span className="mail-readers-stack" aria-label={`Aperta da ${people.readBy.map((reader) => reader.name).join(", ")}`}>
      {people.readBy.map((reader) => <ReaderAvatar key={`${reader.id}:${reader.avatarUrl ?? ""}`} reader={reader} me={reader.id === meId} />)}
    </span> : null}
  </span>;
}

/** "Non assegnata ▾": hands the message to a teammate (same row as "Prendi in carico"). */
function MailAssign({ mkey, claimed, assignees, meId }: { mkey: string; claimed: Collab["claimedBy"]; assignees: Assignee[]; meId: string }) {
  const box = useMailBox();
  const ref = useRef<HTMLDetailsElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  useEffect(() => {
    const close = (e: Event) => { const el = ref.current; if (el?.open && (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node))) el.open = false; };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  const pick = (id: string | null) => start(async () => {
    setError(""); if (ref.current) ref.current.open = false;
    try { const r = await assignMail(mkey, id, box); if (r.error) setError(r.error); else window.dispatchEvent(new Event("ctrl-mail-changed")); }
    catch { setError("Connessione interrotta. Riprova."); }
  });
  return <details ref={ref} className="mail-menu mail-assign" aria-busy={pending}>
    <summary className="mail-chip-btn" aria-label="Assegna a">
      {claimed ? <UserAvatar name={claimed.name} src={claimed.avatarUrl} small /> : <MailIcon name="user" size={15} />}
      <span>{pending ? "Salvataggio…" : claimed ? (claimed.id === meId ? "Assegnata a te" : claimed.name) : "Non assegnata"}</span>
      <MailIcon name="chevron" size={13} />
    </summary>
    <div className="mail-menu-pop">
      <strong className="mail-menu-title">Assegna a</strong>
      <button type="button" className="mail-menu-item" aria-pressed={!claimed} onClick={() => pick(null)}><MailIcon name="user" size={15} />Nessuno (non assegnata)</button>
      {assignees.map((a) => <button key={a.id} type="button" className="mail-menu-item" aria-pressed={claimed?.id === a.id} onClick={() => pick(a.id)}><UserAvatar name={a.name} src={a.avatarUrl} small />{a.name}{a.id === meId ? " (tu)" : ""}</button>)}
    </div>
    {error ? <span className="adm-error" role="alert">{error}</span> : null}
  </details>;
}

/** Status bar of an opened message: status, assignee, internal notes, who opened it, "Prendi in carico". */
export function MailTeamStatus({ mkey, initial, meId, assignees = [] }: { mkey: string; initial?: Collab; meId: string; assignees?: Assignee[] }) {
  const people = usePeople(mkey, initial);
  const claimed = people.claimedBy;
  const [notes, setNotes] = useState(false);
  const count = people.noteCount ?? 0;
  return <section className="mail-status-card" aria-label="Lavorazione del team">
    <div className="mail-status-bar">
      <MailStatusSelect key={`${mkey}:${people.status ?? "todo"}`} mkey={mkey} status={people.status ?? "todo"} />
      <MailAssign mkey={mkey} claimed={claimed} assignees={assignees} meId={meId} />
      <button type="button" className="mail-chip-btn" aria-expanded={notes} aria-controls={`notes-${mkey}`} onClick={() => setNotes((v) => !v)}><MailIcon name="note" size={15} />Note interne ({count})</button>
      {people.readBy.length ? <span className="mail-opened-by"><span className="adm-muted">Aperta da</span><MailPeople mkey={mkey} initial={initial} meId={meId} showClaim={false} /></span> : null}
      <span className="mail-status-spacer" />
      <ClaimButton mkey={mkey} mine={claimed?.id === meId} other={claimed && claimed.id !== meId ? claimed.name : null} />
    </div>
    <InternalNotes key={mkey} mkey={mkey} count={count} open={notes} />
  </section>;
}
