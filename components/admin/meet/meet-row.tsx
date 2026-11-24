import { Icon, MI } from "@/components/admin/meet/meet-icons";
import type { AgendaItem } from "@/lib/meet-agenda";
import { addDays, dayNum, durationLabel, monthShort, weekday } from "@/lib/meet-dates";

type When = "live" | "today" | "tomorrow" | "later" | "past";
export function whenOf(it: Pick<AgendaItem, "start" | "end">, now: string): When {
  if (it.end <= now) return "past";
  if (it.start <= now) return "live";
  const day = it.start.slice(0, 10), today = now.slice(0, 10);
  return day === today ? "today" : day === addDays(today, 1) ? "tomorrow" : "later";
}
export const WHEN_LABEL: Record<When, string> = { live: "In corso", today: "Oggi", tomorrow: "Domani", later: "", past: "Conclusa" };

export function DateTile({ day, kind }: { day: string; kind: string }) {
  return <span className="mt-date" data-kind={kind}><small>{weekday(day)}</small><b>{dayNum(day)}</b><small>{monthShort(day)}</small></span>;
}
export function WhenPill({ when }: { when: When }) {
  return when !== "later" ? <span className="mt-when-pill" data-when={when}><i aria-hidden="true" />{WHEN_LABEL[when]}</span> : null;
}

/** One meeting in the list: date tile, title and state, time and who, quick "Entra" and the way to its detail. */
export function MeetRow({ it, now, i, past }: { it: AgendaItem; now: string; i: number; past?: boolean }) {
  const when = whenOf(it, now);
  return (
    <li className="mt-row" data-kind={it.kind} data-when={when} style={{ ["--i" as string]: Math.min(i, 10) }}>
      <DateTile day={it.start.slice(0, 10)} kind={it.kind} />
      <a className="mt-row-main" href={it.href}>
        <span className="mt-row-title"><strong>{it.title}</strong><WhenPill when={when} /></span>
        <span className="mt-row-meta">
          <span><Icon d={it.kind === "team" ? MI.users : MI.client} size={13} />{it.kind === "team" ? `Team · ${it.who}` : it.who}</span>
          <span><Icon d={MI.clock} size={13} />{it.start.slice(11)}–{it.end.slice(11)} · {durationLabel(it.minutes)}</span>
        </span>
      </a>
      <span className="mt-actions">
        {!past && when !== "past" && it.meetUrl ? <a className="rb-cta rb-cta-sm mt-act" href={it.meetUrl} target="_blank" rel="noopener noreferrer">Entra</a> : null}
        <a className="rb-icon-btn mt-open" href={it.href} aria-label={`Dettagli: ${it.title}`}><Icon d={MI.right} /></a>
      </span>
    </li>
  );
}
