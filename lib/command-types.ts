/** Serializable Panoramica model. The server fills it from real sources; the client only renders it. */

export type CommandRange = 7 | 30 | 90;

export type CommandTone = "up" | "down" | "flat";

export type CommandTodo = {
  id: string;
  title: string;
  tag: "CRM" | "Shop" | "Pipeline" | "Contenuti";
  href: string;
  done: boolean;
  check:
    | { kind: "activity"; id: string; version: number }
    | { kind: "followup"; id: string; seenAt: string }
    | null;
};

export type CommandActivity = {
  id: string;
  tone: "crm" | "shop" | "post" | "newsletter";
  title: string;
  href: string;
  at: string;
  ago: string;
};

export type CommandKpi = {
  id: "views" | "visitors" | "revenue" | "deals";
  label: string;
  href: string;
  value: number;
  money: boolean;
  delta: string | null;
  tone: CommandTone | null;
  note: string | null;
  spark: number[];
  unavailable: string | null;
};

export type SeriesPoint = { date: string; pageviews: number; visitors: number };

export type CommandShortcut = {
  id: "crm" | "shop" | "content" | "analytics";
  href: string;
  title: string;
  text: string;
};

export type CommandModel = {
  range: CommandRange;
  dateLabel: string;
  denied: boolean;
  systems: { tone: "ok" | "busy" | "bad" | "muted"; label: string; title: string; href: string };
  kpis: CommandKpi[];
  traffic: { points: SeriesPoint[]; empty: string | null } | null;
  todos: { total: number; items: CommandTodo[]; href: string };
  shortcuts: CommandShortcut[];
  activity: { items: CommandActivity[]; href: string | null; error: boolean };
  pages: { key: string; pageviews: number; visitors: number }[];
  pagesEmpty: string | null;
  countries: { key: string; label: string; pageviews: number; visitors: number }[];
  countriesEmpty: string | null;
  statsHref: string | null;
};

export type CommandNotice = { id: string; title: string; detail: string | null; href: string };
