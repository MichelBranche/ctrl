"use client";

import { UserAvatar } from "@/components/admin/user-avatar";
import Image from "next/image";
import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
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
  if (!people.readBy.length && (!showClaim || !people.claimedBy)) return null;
  return <span className="adm-mail-chips mail-people">
    {showClaim && people.claimedBy ? <span className="adm-badge adm-mail-claim" data-mine={people.claimedBy.id === meId || undefined}><UserAvatar name={people.claimedBy.name} src={people.claimedBy.avatarUrl} small /> In carico: {people.claimedBy.id === meId ? "tu" : people.claimedBy.name}</span> : null}
    {people.readBy.length ? <span className="mail-readers-stack" aria-label={`Aperta da ${people.readBy.map((reader) => reader.name).join(", ")}`}>
      {people.readBy.map((reader) => <ReaderAvatar key={`${reader.id}:${reader.avatarUrl ?? ""}`} reader={reader} me={reader.id === meId} />)}
    </span> : null}
  </span>;
}

export function MailTeamStatus({ mkey, initial, meId }: { mkey: string; initial?: Collab; meId: string }) {
  const people = usePeople(mkey, initial);
  const claimed = people.claimedBy;
  return <div className="adm-mail-team">
    <div className="mail-team-people">
      <span className="adm-muted">{claimed ? <span className="adm-person"><UserAvatar name={claimed.name} src={claimed.avatarUrl} small />In carico a <strong>{claimed.id === meId ? "te" : claimed.name}</strong></span> : "Nessuno l’ha presa in carico"}</span>
      <div className="mail-opened-by"><span className="adm-muted">Aperta da</span><MailPeople mkey={mkey} initial={initial} meId={meId} showClaim={false} /></div>
    </div>
    <ClaimButton mkey={mkey} mine={claimed?.id === meId} other={claimed && claimed.id !== meId ? claimed.name : null} />
  </div>;
}
