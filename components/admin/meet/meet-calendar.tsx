import { Icon, MI } from "@/components/admin/meet/meet-icons";
import type { AgendaItem } from "@/lib/meet-agenda";
import { addDays, addMonths, dayNum, monthLong, monthShort, monthStart, weekday, weekStart } from "@/lib/meet-dates";

export type CalView = "settimana" | "mese";
type When = "live" | "past" | "next";

const whenOf = (it: AgendaItem, now: string): When => (it.start <= now && now < it.end ? "live" : it.end <= now ? "past" : "next");

/** Visible range for a view, as [first day, day after last). */
export function calRange(view: CalView, anchor: string): [string, string] {
  if (view === "settimana") { const s = weekStart(anchor); return [s, addDays(s, 7)]; }
  const first = weekStart(monthStart(anchor));
  const nextMonth = addMonths(anchor, 1);
  let end = first;
  while (end < nextMonth) end = addDays(end, 7);
  return [first, end];
}

function Ev({ it, now, compact }: { it: AgendaItem; now: string; compact?: boolean }) {
  const when = whenOf(it, now);
  return (
    <li>
      <a className="mt-ev" href={it.href} data-kind={it.kind} data-when={when} title={`${it.allDay ? "Tutto il giorno" : it.start.slice(11)} · ${it.title} · ${it.who}`}>
        <i aria-hidden="true" />
        <time>{it.allDay ? "Giorno" : it.start.slice(11)}</time>
        <span>{it.title}</span>
        {!compact ? <small>{it.who}</small> : null}
      </a>
    </li>
  );
}

export function MeetCalendar({ items, view, anchor, today, now, query }: { items: AgendaItem[]; view: CalView; anchor: string; today: string; now: string; query: Record<string, string> }) {
  const href = (v: CalView, d: string) => `/admin/riunioni?${new URLSearchParams({ ...query, vista: v, data: d })}#calendario`;
  const byDay = new Map<string, AgendaItem[]>();
  const [from, to] = calRange(view, anchor);
  // An event that began before the visible range (multi-day, all-day) shows on the first visible day.
  for (const it of items) { const s = it.start.slice(0, 10); const d = s < from ? from : s; byDay.set(d, [...(byDay.get(d) ?? []), it]); }
  const days: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  const prev = view === "settimana" ? addDays(anchor, -7) : addMonths(anchor, -1);
  const next = view === "settimana" ? addDays(anchor, 7) : addMonths(anchor, 1);
  const last = addDays(to, -1);
  const title = view === "mese" ? monthLong(anchor)
    : `${dayNum(from)}${from.slice(5, 7) !== last.slice(5, 7) ? ` ${monthShort(from)}` : ""} – ${dayNum(last)} ${monthLong(last)}`;
  const inMonth = (d: string) => d.slice(0, 7) === anchor.slice(0, 7);
  const count = items.filter((it) => view === "settimana" || inMonth(it.start.slice(0, 10))).length;

  return (
    <section id="calendario" className="mt-cal" data-view={view} aria-labelledby="mt-cal-h">
      <header className="mt-cal-head">
        <div className="mt-cal-title">
          <span className="mt-head-icon" data-kind="cal"><Icon d={MI.cal} /></span>
          <div>
            <h2 id="mt-cal-h">{title}</h2>
            <p>{count ? `${count} ${count === 1 ? "riunione" : "riunioni"}` : "Nessuna riunione"} {view === "settimana" ? "questa settimana" : "nel mese"}</p>
          </div>
        </div>
        <div className="mt-cal-tools">
          <nav className="mt-cal-nav" aria-label="Sposta il calendario">
            <a className="rb-icon-btn" href={href(view, prev)} aria-label={view === "settimana" ? "Settimana precedente" : "Mese precedente"}><Icon d={MI.left} /></a>
            <a className="rb-btn rb-btn-quiet mt-today-btn" href={href(view, today)}>Oggi</a>
            <a className="rb-icon-btn" href={href(view, next)} aria-label={view === "settimana" ? "Settimana successiva" : "Mese successivo"}><Icon d={MI.right} /></a>
          </nav>
          <div className="rb-segs" role="group" aria-label="Vista">
            <a href={href("settimana", anchor)} aria-current={view === "settimana" ? "page" : undefined}>Settimana</a>
            <a href={href("mese", anchor)} aria-current={view === "mese" ? "page" : undefined}>Mese</a>
          </div>
        </div>
      </header>
      <p className="mt-legend" aria-hidden="true"><span data-kind="team"><i />Team</span><span data-kind="cliente"><i />Cliente</span><span data-kind="google"><i />Da Google Calendar</span><span data-kind="live"><i />In corso</span></p>

      {view === "settimana" ? (
        <div className="mt-week">
          {days.map((d, i) => {
            const list = byDay.get(d) ?? [];
            return (
              <div key={d} className="mt-day" data-today={d === today || undefined} data-past={d < today || undefined} style={{ ["--i" as string]: i }}>
                <div className="mt-day-head"><small>{weekday(d)}</small><b>{dayNum(d)}</b>{list.length ? <span className="mt-day-n">{list.length}</span> : null}</div>
                {list.length ? <ul className="mt-evs">{list.map((it) => <Ev key={`${it.kind}${it.id}`} it={it} now={now} />)}</ul> : <p className="mt-day-empty">Libero</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-month" role="grid" aria-label={title}>
          <div className="mt-month-row mt-month-wd" role="row">{days.slice(0, 7).map((d) => <span key={d} role="columnheader">{weekday(d)}</span>)}</div>
          {Array.from({ length: days.length / 7 }, (_, w) => (
            <div key={w} className="mt-month-row" role="row">
              {days.slice(w * 7, w * 7 + 7).map((d) => {
                const list = byDay.get(d) ?? [];
                return (
                  <div key={d} role="gridcell" className="mt-cell" data-out={!inMonth(d) || undefined} data-today={d === today || undefined} data-past={d < today || undefined} aria-label={`${dayNum(d)} ${monthShort(d)}: ${list.length} riunioni`}>
                    <a className="mt-cell-n" href={href("settimana", d)} title="Apri la settimana">{dayNum(d)}</a>
                    {list.length ? (
                      <>
                        <ul className="mt-evs">{list.slice(0, 3).map((it) => <Ev key={`${it.kind}${it.id}`} it={it} now={now} compact />)}</ul>
                        {list.length > 3 ? <a className="mt-more" href={href("settimana", d)}>+{list.length - 3} altre</a> : null}
                        <span className="mt-dots" aria-hidden="true">{list.slice(0, 4).map((it) => <i key={`${it.kind}${it.id}`} data-kind={it.kind} data-when={whenOf(it, now)} />)}</span>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
