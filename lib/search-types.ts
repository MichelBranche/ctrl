/** Shared by the command palette (client) and the auth-protected search endpoint (server). */

export const SEARCH_GROUPS = [
  "sezioni",
  "azioni",
  "contatti",
  "opportunita",
  "attivita",
  "articoli",
  "pagine",
  "media",
  "iscritti",
  "ordini",
  "prodotti",
  "richieste",
  "riunioni",
  "email",
  "team",
  "scrivania",
  "radar",
] as const;

export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export const SEARCH_GROUP_LABEL: Record<SearchGroup, string> = {
  sezioni: "Sezioni",
  azioni: "Azioni",
  contatti: "Contatti",
  opportunita: "Opportunità",
  attivita: "Attività",
  articoli: "Articoli",
  pagine: "Pagine",
  media: "Media",
  iscritti: "Iscritti",
  ordini: "Ordini",
  prodotti: "Prodotti",
  richieste: "Richieste",
  riunioni: "Riunioni",
  email: "Email",
  team: "Team",
  scrivania: "Scrivania",
  radar: "Radar",
};

export type SearchHit = { label: string; hint: string; href: string; group: SearchGroup };

export const isSearchGroup = (v: unknown): v is SearchGroup =>
  (SEARCH_GROUPS as readonly string[]).includes(String(v));
