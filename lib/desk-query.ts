/** Desk filter state carried in the URL. Shared by the server page (first render) and the client board. */
export type Seg = "tutto" | "attivita" | "email" | "crm" | "note";
export type Due = "" | "ritardo" | "oggi" | "settimana" | "senza";
export type Prio = "" | "alta" | "media" | "bassa";
export const SEGS: Seg[] = ["tutto", "attivita", "email", "crm", "note"];
export const DUES: Exclude<Due, "">[] = ["ritardo", "oggi", "settimana", "senza"];
export const PRIOS: Exclude<Prio, "">[] = ["alta", "media", "bassa"];

export type DeskQuery = { seg: Seg; q: string; due: Due; prio: Prio; done: boolean };
/** Reads the desk filters from the URL (server side), so the first render already matches. */
export function deskQuery(p: Record<string, string | string[] | undefined>): DeskQuery {
  const one = (k: string) => { const v = p[k]; return typeof v === "string" ? v : ""; };
  const seg = one("seg") as Seg;
  const due = one("scadenza") as Due;
  const prio = one("priorita") as Prio;
  return {
    seg: SEGS.includes(seg) ? seg : "tutto",
    q: one("q").slice(0, 200),
    due: DUES.includes(due as Exclude<Due, "">) ? due : "",
    prio: PRIOS.includes(prio as Exclude<Prio, "">) ? prio : "",
    done: one("fatte") === "1",
  };
}
