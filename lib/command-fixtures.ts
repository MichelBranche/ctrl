import type { CommandModel, CommandNotice, CommandRange } from "@/lib/command-types";
import type { SearchHit } from "@/lib/search-types";

/** Dev-only layout fixtures. Never active in a production build, and never used as a stand-in for missing production data. */
export const commandFixturesOn = () => process.env.NODE_ENV !== "production" && process.env.COMMAND_CENTER_FIXTURES === "1";

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

function points(range: CommandRange) {
  const end = Date.now();
  const rows = Array.from({ length: range }, (_, i) => {
    const t = (i + 1) / range;
    return {
      date: iso(end - (range - 1 - i) * DAY),
      pageviews: Math.round(16 + 20 * Math.sin(t * Math.PI)),
      visitors: Math.max(1, Math.round(6 + 8 * Math.sin(t * Math.PI))),
    };
  });
  if (range === 7) {
    const views = [32, 24, 26, 20, 14, 48, 77];
    const visitors = [12, 8, 9, 7, 5, 14, 14];
    rows.forEach((row, i) => {
      row.pageviews = views[i] ?? row.pageviews;
      row.visitors = visitors[i] ?? row.visitors;
    });
  }
  return rows;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function fixtureCommand(range: CommandRange, dateLabel: string, empty: boolean): CommandModel {
  const series = empty ? points(range).map((row) => ({ ...row, pageviews: 0, visitors: 0 })) : points(range);
  const views = sum(series.map((row) => row.pageviews));
  const visitors = sum(series.map((row) => row.visitors));
  return {
    range,
    dateLabel,
    denied: false,
    systems: empty
      ? { tone: "muted", label: "Sistemi non verificati", title: "Stato produzione non disponibile", href: "/admin/status" }
      : { tone: "ok", label: "Sistemi operativi", title: "Produzione online", href: "/admin/status" },
    kpis: [
      {
        id: "views", label: "Visualizzazioni sito", href: `/admin/stats?range=${range}`, value: views, money: false,
        delta: empty ? null : `+64% vs ${range} giorni prec.`, tone: empty ? null : "up", note: null,
        spark: series.map((row) => row.pageviews), unavailable: null,
      },
      {
        id: "visitors", label: "Visitatori unici", href: `/admin/stats?range=${range}`, value: visitors, money: false,
        delta: empty ? null : `+37% vs ${range} giorni prec.`, tone: empty ? null : "up", note: null,
        spark: series.map((row) => row.visitors), unavailable: null,
      },
      {
        id: "revenue", label: "Fatturato (shop)", href: "/admin/shop", value: 0, money: true,
        delta: null, tone: null, note: "· Nessun ordine confermato",
        spark: Array.from({ length: range }, () => 0), unavailable: null,
      },
      {
        id: "deals", label: "Opportunità attive", href: "/admin/crm/pipeline", value: empty ? 0 : 7, money: false,
        delta: empty ? null : "+2 rispetto alla settimana prec.", tone: empty ? null : "up", note: null,
        spark: empty ? [] : [3, 3, 4, 4, 5, 6, 7], unavailable: null,
      },
    ],
    traffic: { points: series, empty: empty ? `Nessuna visita negli ultimi ${range} giorni.` : null },
    todos: empty
      ? { total: 0, items: [], href: "/admin/crm" }
      : {
          total: 4,
          href: "/admin/crm",
          items: [
            { id: "new", title: "Rispondi a 2 nuovi contatti", tag: "CRM", href: "/admin/crm/rubrica?fase=nuovo", done: false, check: null },
            { id: "shop", title: "Verifica richieste shop", tag: "Shop", href: "/admin/shop?tab=ordini", done: false, check: null },
            { id: "quote", title: "Completa preventivo aperto", tag: "Pipeline", href: "/admin/crm/pipeline", done: false, check: null },
            { id: "draft", title: "Pubblica bozza del journal", tag: "Contenuti", href: "/admin/journal", done: true, check: null },
          ],
        },
    shortcuts: [
      { id: "crm", href: "/admin/crm", title: "CRM & Pipeline", text: "Contatti, opportunità e conversazioni in un unico spazio." },
      { id: "shop", href: "/admin/shop", title: "Shop & Vendite", text: "Ordini, prodotti, fatturato e gestione catalogo." },
      { id: "content", href: "/admin/journal", title: "Contenuti", text: "Articoli, pagine e media del tuo sito." },
      { id: "analytics", href: `/admin/stats?range=${range}`, title: "Analytics", text: "Traffico, provenienza, dispositivi e performance." },
    ],
    activity: empty
      ? { items: [], href: "/admin/audit", error: false }
      : {
          href: "/admin/audit",
          error: false,
          items: [
            { id: "a1", tone: "crm", title: "Nuovo contatto da /contact", href: "/admin/requests", at: new Date().toISOString(), ago: "2 h fa" },
            { id: "a2", tone: "shop", title: "Prodotto pubblicato: Card recensioni Google", href: "/admin/shop?tab=prodotti", at: new Date().toISOString(), ago: "4 h fa" },
            { id: "a3", tone: "post", title: "Articolo aggiornato", href: "/admin/journal", at: new Date().toISOString(), ago: "1 g fa" },
            { id: "a4", tone: "crm", title: "Opportunità aggiornata", href: "/admin/crm/pipeline", at: new Date().toISOString(), ago: "1 g fa" },
          ],
        },
    pages: empty ? [] : [
      { key: "/", pageviews: 55, visitors: 20 },
      { key: "/en", pageviews: 35, visitors: 14 },
      { key: "/projects", pageviews: 24, visitors: 11 },
      { key: "/projects/websites", pageviews: 15, visitors: 8 },
      { key: "/contact", pageviews: 10, visitors: 6 },
    ],
    pagesEmpty: empty ? "Nessuna pagina vista nel periodo." : null,
    countries: empty ? [] : [
      { key: "IT", label: "Italia", pageviews: 169, visitors: 40 },
      { key: "US", label: "Stati Uniti", pageviews: 31, visitors: 12 },
      { key: "BR", label: "Brasile", pageviews: 27, visitors: 9 },
      { key: "altri", label: "Altri", pageviews: 14, visitors: 8 },
    ],
    countriesEmpty: empty ? "Nessun dato sui paesi." : null,
    statsHref: `/admin/stats?range=${range}#analisi`,
  };
}

export function fixtureNotices(empty: boolean): CommandNotice[] {
  if (empty) return [];
  return [
    { id: "free", title: "2 contatti non assegnati", detail: "CRM", href: "/admin/crm" },
    { id: "due", title: "Follow-up in scadenza", detail: "Oggi", href: "/admin/crm" },
  ];
}

const FIXTURE_HITS: SearchHit[] = [
  { label: "Contatto in rubrica", hint: "Contatto · Nuovo", href: "/admin/crm/rubrica", group: "contatti" },
  { label: "Opportunità in pipeline", hint: "Opportunità · Preventivo", href: "/admin/crm/pipeline", group: "opportunita" },
  { label: "Follow-up di oggi", hint: "Attività", href: "/admin/crm/attivita", group: "attivita" },
  { label: "Bozza del journal", hint: "Articolo IT · bozza", href: "/admin/journal", group: "articoli" },
  { label: "Card recensioni Google", hint: "Prodotto · pubblicato", href: "/admin/shop?tab=prodotti", group: "prodotti" },
  { label: "Richiesta dal sito", hint: "Richiesta", href: "/admin/requests", group: "richieste" },
  { label: "Iscritto newsletter", hint: "Iscritto newsletter", href: "/admin/newsletter", group: "iscritti" },
  { label: "Ordine shop", hint: "Ordine · Richiesta", href: "/admin/shop?tab=ordini", group: "ordini" },
];

export function fixtureSearch(q: string): SearchHit[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  return FIXTURE_HITS.filter((hit) => `${hit.label} ${hit.hint}`.toLowerCase().includes(needle));
}
