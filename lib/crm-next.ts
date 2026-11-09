/*
 * The next thing to do on a contact: the earliest open activity or follow-up.
 * A date in the past wins over a later one, which is the most overdue item.
 */

export type NextSource = "attivita" | "followup";
export type NextCandidate = { title: string; at: string; time?: string | null; source: NextSource };
export type NextTouch = { title: string; at: string; overdue: boolean; relative: string; source: NextSource };

const DAY = /^\d{4}-\d{2}-\d{2}/;
const CLOCK = /^(\d{2}):(\d{2})/;

const stamp = (item: NextCandidate) => {
  const day = item.at.slice(0, 10);
  const clock = item.time && CLOCK.test(item.time) ? item.time.slice(0, 5) : "99:99";
  return `${day}T${clock}`;
};

export function relativeDay(day: string, today: string): string {
  const diff = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Domani";
  if (diff === -1) return "Ieri";
  if (diff < 0) return `${-diff} giorni fa`;
  if (diff < 14) return `tra ${diff} giorni`;
  const [, month, date] = day.split("-");
  return `${Number(date)}/${month}`;
}

/** Earliest dated item. Undated text is not a plan. */
export function pickNextTouch(items: NextCandidate[], today: string): NextTouch | null {
  const dated = items.filter((item) => DAY.test(item.at));
  if (!dated.length || !DAY.test(today)) return null;
  dated.sort((a, b) => stamp(a).localeCompare(stamp(b)) || a.title.localeCompare(b.title, "it"));
  const best = dated[0]!;
  const at = best.at.slice(0, 10);
  return { title: best.title.trim() || "Attività", at, overdue: at < today, relative: relativeDay(at, today), source: best.source };
}
