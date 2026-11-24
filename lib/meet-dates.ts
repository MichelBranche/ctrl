/* Calendar arithmetic on plain "YYYY-MM-DD" days (UTC noon, so DST never shifts a day). Shared by server and client. */
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const at = (day: string) => new Date(`${day}T12:00:00Z`);
export const addDays = (day: string, n: number) => new Date(at(day).getTime() + n * 86_400_000).toISOString().slice(0, 10);
/** Monday of the week containing day. */
export const weekStart = (day: string) => addDays(day, -((at(day).getUTCDay() + 6) % 7));
export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
export const addMonths = (day: string, n: number) => {
  const d = at(monthStart(day)); d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const f = (day: string, o: Intl.DateTimeFormatOptions) => at(day).toLocaleDateString("it-IT", { timeZone: "UTC", ...o }).replace(".", "");
export const weekday = (day: string) => f(day, { weekday: "short" });
export const dayNum = (day: string) => f(day, { day: "numeric" });
export const monthShort = (day: string) => f(day, { month: "short" });
export const monthLong = (day: string) => f(day, { month: "long", year: "numeric" });
export const longDay = (day: string) => f(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const durationLabel = (m: number) => (m < 60 ? `${m} minuti` : m === 60 ? "1 ora" : m === 90 ? "1 ora e mezza" : `${m / 60} ore`);
export const DURATIONS = [15, 30, 45, 60, 90, 120] as const;
/** Rome wall time now, "YYYY-MM-DDTHH:MM" (browser or server). */
export const romeNow = (ms = Date.now()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
export const EMAIL_SIMPLE = /^[^\s@<>(),;:"]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
export const splitEmails = (raw: string) => raw.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
