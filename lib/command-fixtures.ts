import type { CommandModel, CommandNotice, CommandRange } from "@/lib/command-types";
import type { SearchHit } from "@/lib/search-types";
import { formatAdminCountry, interpolate, type AdminDict, type AdminLocale } from "@/lib/admin-i18n";

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

export function fixtureCommand(range: CommandRange, dateLabel: string, empty: boolean, live: boolean, t: AdminDict, lang: AdminLocale): CommandModel {
  const series = empty ? points(range).map((row) => ({ ...row, pageviews: 0, visitors: 0 })) : points(range);
  if (live && range === 7) {
    const views = [22, 28, 18, 24, 36, 58, 42];
    const visitors = [8, 10, 6, 8, 10, 14, 10];
    series.forEach((row, i) => {
      row.pageviews = views[i] ?? row.pageviews;
      row.visitors = visitors[i] ?? row.visitors;
    });
  }
  const views = sum(series.map((row) => row.pageviews));
  const visitors = sum(series.map((row) => row.visitors));
  return {
    range,
    dateLabel,
    greeting: "",
    lead: "",
    denied: false,
    systems: empty
      ? { tone: "muted", label: t.command.systemsUnchecked, title: t.command.productionUnknown, href: "/admin/status" }
      : { tone: "ok", label: t.command.systemsOk, title: t.command.productionOnline, href: "/admin/status" },
    kpis: [
      {
        id: "views", label: t.command.kpiViews, href: `/admin/stats?range=${range}`, value: views, money: false,
        delta: empty ? null : live ? interpolate(t.command.deltaPct, { sign: "−", n: 67, range }) : interpolate(t.command.deltaPct, { sign: "+", n: 64, range }), tone: empty ? null : live ? "down" : "up", note: null,
        spark: series.map((row) => row.pageviews), unavailable: null,
      },
      {
        id: "visitors", label: t.command.kpiVisitors, href: `/admin/stats?range=${range}`, value: visitors, money: false,
        delta: empty ? null : live ? interpolate(t.command.deltaPct, { sign: "−", n: 44, range }) : interpolate(t.command.deltaPct, { sign: "+", n: 37, range }), tone: empty ? null : live ? "down" : "up", note: null,
        spark: series.map((row) => row.visitors), unavailable: null,
      },
      {
        id: "revenue", label: t.command.kpiRevenue, href: "/admin/shop", value: 0, money: true,
        delta: null, tone: null, note: t.command.noConfirmedOrders,
        spark: Array.from({ length: range }, () => 0), unavailable: null,
      },
      {
        id: "deals", label: t.command.kpiDeals, href: "/admin/crm/pipeline", value: empty || live ? 0 : 7, money: false,
        delta: empty ? null : live ? t.command.weekFlat : interpolate(t.command.weekDelta, { sign: "+", n: 2 }), tone: empty ? null : live ? "flat" : "up", note: null,
        spark: empty || live ? [] : [3, 3, 4, 4, 5, 6, 7], unavailable: null,
      },
    ],
    traffic: { points: series, empty: empty ? interpolate(t.command.noVisitsRange, { n: range }) : null },
    todos: empty
      ? { total: 0, items: [], href: "/admin/crm" }
      : live
      ? { total: 1, href: "/admin/crm", items: [{ id: "new", title: interpolate(t.command.replyToContacts, { n: 254 }), tag: t.command.tagCrm, href: "/admin/crm/rubrica?fase=nuovo", done: false, check: null }] }
      : {
          total: 4,
          href: "/admin/crm",
          items: [
            { id: "new", title: interpolate(t.command.replyToContacts, { n: 2 }), tag: t.command.tagCrm, href: "/admin/crm/rubrica?fase=nuovo", done: false, check: null },
            { id: "shop", title: interpolate(t.command.reviewShopN, { n: 2 }), tag: t.command.tagShop, href: "/admin/shop?tab=ordini", done: false, check: null },
            { id: "quote", title: interpolate(t.command.completeQuote, { name: "Acme" }), tag: t.command.tagPipeline, href: "/admin/crm/pipeline", done: false, check: null },
            { id: "draft", title: t.command.publishJournalDraft, tag: t.command.tagContent, href: "/admin/journal", done: true, check: null },
          ],
        },
    shortcuts: [
      { id: "crm", href: "/admin/crm", title: t.command.shortcutCrmTitle, text: t.command.shortcutCrmText },
      { id: "shop", href: "/admin/shop", title: t.command.shortcutShopTitle, text: t.command.shortcutShopText },
      { id: "content", href: "/admin/journal", title: t.command.shortcutContentTitle, text: t.command.shortcutContentText },
      { id: "analytics", href: `/admin/stats?range=${range}`, title: t.command.shortcutAnalyticsTitle, text: t.command.shortcutAnalyticsText },
    ],
    activity: empty
      ? { items: [], href: "/admin/audit", error: false }
      : {
          href: "/admin/audit",
          error: false,
          items: [
            { id: "a1", tone: "crm", mark: "mail", title: t.command.contactFromContact, href: "/admin/requests", at: new Date().toISOString(), ago: interpolate(t.time.hoursAgo, { n: 2 }) },
            { id: "a2", tone: "shop", mark: "bag", title: interpolate(t.command.productPublished, { title: "Card recensioni Google" }), href: "/admin/shop?tab=prodotti", at: new Date().toISOString(), ago: interpolate(t.time.hoursAgo, { n: 4 }) },
            { id: "a3", tone: "post", mark: "doc", title: t.command.articleUpdated, href: "/admin/journal", at: new Date().toISOString(), ago: interpolate(t.time.daysAgo, { n: 1 }) },
            { id: "a4", tone: "crm", mark: "users", title: t.command.dealUpdated, href: "/admin/crm/pipeline", at: new Date().toISOString(), ago: interpolate(t.time.daysAgo, { n: 1 }) },
          ],
        },
    pages: empty ? [] : [
      { key: "/", pageviews: 55, visitors: 20 },
      { key: "/en", pageviews: 35, visitors: 14 },
      { key: "/projects", pageviews: 24, visitors: 11 },
      { key: "/projects/websites", pageviews: 15, visitors: 8 },
      { key: "/contact", pageviews: 10, visitors: 6 },
    ],
    pagesEmpty: empty ? t.command.pagesEmpty : null,
    countries: empty ? [] : [
      { key: "IT", label: formatAdminCountry("IT", lang, t.command.otherCountries), pageviews: 169, visitors: 40 },
      { key: "US", label: formatAdminCountry("US", lang, t.command.otherCountries), pageviews: 31, visitors: 12 },
      { key: "BR", label: formatAdminCountry("BR", lang, t.command.otherCountries), pageviews: 27, visitors: 9 },
      { key: "altri", label: t.command.otherCountries, pageviews: 14, visitors: 8 },
    ],
    countriesEmpty: empty ? t.command.countriesEmpty : null,
    statsHref: `/admin/stats?range=${range}#analisi`,
  };
}

export function fixtureNotices(empty: boolean, t: AdminDict): CommandNotice[] {
  if (empty) return [];
  return [
    { id: "free", title: interpolate(t.command.unassignedN, { n: 2 }), detail: t.command.tagCrm, href: "/admin/crm" },
    { id: "due", title: t.command.followUpDue, detail: t.command.today, href: "/admin/crm" },
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
