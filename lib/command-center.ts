import "server-only";
import { searchAdmin } from "@/lib/admin-search";
import { crmOverview, recentCrmEvents, dueActions, priorityContacts, type CrmEvent } from "@/lib/crm";
import { listActivities } from "@/lib/crm-activity";
import { irisNoticeText } from "@/lib/crm-iris-core";
import { currentIrisNotice } from "@/lib/crm-iris";
import { kpiSeries, recordOggiKpis, romeDay, shiftDay, liveKpiCounts } from "@/lib/crm-kpi";
import { romeWall } from "@/lib/crm-nav";
import { db, dbConfigured } from "@/lib/db";
import { delta, latestDeploy, traffic, type Range } from "@/lib/dashboard-data";
import { ensureCrmSchema, ensureShopSchema } from "@/lib/migrate";
import { SOLD } from "@/lib/shop-orders";
import { analytics, vercelConfigured } from "@/lib/vercel";
import { canAccess, isFounder, type Perms } from "@/lib/team-types";
import type { CommandActivity, CommandKpi, CommandModel, CommandNotice, CommandRange, CommandShortcut, CommandTodo, CommandTone, SeriesPoint } from "@/lib/command-types";
import { commandFixturesOn, fixtureCommand, fixtureNotices, fixtureSearch } from "@/lib/command-fixtures";
import type { SearchHit } from "@/lib/search-types";

export type { CommandModel, CommandNotice } from "@/lib/command-types";
export { commandFixturesOn, fixtureSearch };

type Person = Perms & { id: string; name: string };

const countFmt = new Intl.NumberFormat("it-IT");

/** Greeting for the Europe/Rome clock: morning, afternoon, evening. */
export function romeGreeting(name: string, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "numeric", hourCycle: "h23" }).format(now));
  const hello = hour >= 5 && hour < 13 ? "Buongiorno" : hour >= 13 && hour < 18 ? "Buon pomeriggio" : "Buonasera";
  const first = name.trim().split(/\s+/).filter(Boolean)[0];
  return first ? `${hello}, ${first}.` : `${hello}.`;
}

/** One operational line. Null metrics are omitted. Zero and one get their own wording. */
export function commandLead(input: { todos: number | null; deals: number | null; views: number | null; range: number }): string {
  const bits: string[] = [];
  if (input.todos !== null) {
    bits.push(input.todos === 0 ? "Niente da fare oggi" : input.todos === 1 ? "1 cosa da fare oggi" : `${countFmt.format(input.todos)} cose da fare oggi`);
  }
  if (input.deals !== null) {
    bits.push(input.deals === 0 ? "Nessuna opportunità aperta" : input.deals === 1 ? "1 opportunità aperta" : `${countFmt.format(input.deals)} opportunità aperte`);
  }
  if (input.views !== null) {
    const span = `negli ultimi ${input.range} giorni`;
    bits.push(input.views === 0 ? `Nessuna visita ${span}` : input.views === 1 ? `1 visita ${span}` : `${countFmt.format(input.views)} visite ${span}`);
  }
  return bits.join(" · ");
}

function withVoice(model: CommandModel, name: string): CommandModel {
  const views = model.kpis.find((card) => card.id === "views");
  const deals = model.kpis.find((card) => card.id === "deals");
  return {
    ...model,
    greeting: romeGreeting(name),
    lead: commandLead({
      todos: model.todos.total,
      deals: deals && !deals.unavailable ? deals.value : null,
      views: views && !views.unavailable ? views.value : null,
      range: model.range,
    }),
  };
}

const region = new Intl.DisplayNames(["it"], { type: "region" });

export function commandDateLabel(now = new Date()) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(now).toLocaleUpperCase("it-IT");
}

export function shortAgo(iso: string, now = Date.now()) {
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(min)) return "";
  const m = Math.max(0, min);
  if (m < 1) return "ora";
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} g fa`;
  return new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" });
}

function percentDelta(now: number, before: number, range: number): { text: string; tone: CommandTone } | null {
  if (before <= 0) return now > 0 ? { text: "nuovo rispetto al periodo prec.", tone: "up" } : null;
  const d = delta(now, before);
  if (d === null || d === 0) return { text: `invariato vs ${range} giorni prec.`, tone: "flat" };
  const n = Math.round(d * 100);
  const sign = n > 0 ? "+" : "−";
  return { text: `${sign}${Math.abs(n)}% vs ${range} giorni prec.`, tone: n > 0 ? "up" : "down" };
}

function weekText(now: number | null, then: number | null): { text: string; tone: CommandTone } | null {
  if (now === null || then === null) return null;
  const d = now - then;
  if (d === 0) return { text: "invariato rispetto alla settimana prec.", tone: "flat" };
  return { text: `${d > 0 ? "+" : "−"}${Math.abs(d)} rispetto alla settimana prec.`, tone: d > 0 ? "up" : "down" };
}

const DAY = 86_400_000;
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

function countryLabel(code: string) {
  if (code === "altri") return "Altri";
  try {
    return region.of(code) ?? code;
  } catch {
    return code;
  }
}

async function systems(me: Person): Promise<CommandModel["systems"]> {
  const href = canAccess(me, "status") ? "/admin/status" : "/admin/settings";
  if (!vercelConfigured()) return { tone: "muted", label: "Sistemi non verificati", title: "Vercel non è configurato", href };
  const deploy = await latestDeploy();
  if (!deploy) return { tone: "muted", label: "Sistemi non verificati", title: "Nessun deploy di produzione trovato", href };
  switch (deploy.state) {
    case "READY":
      return { tone: "ok", label: "Sistemi operativi", title: "Produzione online", href };
    case "ERROR":
      return { tone: "bad", label: "Sistemi in errore", title: deploy.message || "L'ultimo deploy di produzione è in errore", href };
    case "CANCELED":
      return { tone: "muted", label: "Deploy annullato", title: "L'ultimo deploy di produzione è stato annullato", href };
    case "BUILDING":
    case "QUEUED":
    case "INITIALIZING":
      return { tone: "busy", label: "Sistemi in aggiornamento", title: "Un deploy di produzione è in corso", href };
    default:
      return { tone: "muted", label: "Sistemi non verificati", title: deploy.state || "Stato produzione sconosciuto", href };
  }
}

async function shopRevenue(range: CommandRange): Promise<{ value: number; prev: number; spark: number[]; confirmed: number; pending: number } | null> {
  if (!dbConfigured) return null;
  await ensureShopSchema();
  const end = Date.now();
  const since = dayKey(end - (range - 1) * DAY);
  const prevSince = dayKey(end - (range * 2 - 1) * DAY);
  const marks = SOLD.map(() => "?").join(",");
  const [days, prev, pending] = await db().batch([
    { sql: `SELECT substr(created_at, 1, 10) AS d, SUM(total) AS revenue, COUNT(*) AS n FROM shop_orders WHERE status IN (${marks}) AND substr(created_at, 1, 10) >= ? GROUP BY d`, args: [...SOLD, since] },
    { sql: `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS n FROM shop_orders WHERE status IN (${marks}) AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) < ?`, args: [...SOLD, prevSince, since] },
    { sql: "SELECT COUNT(*) AS n FROM shop_orders WHERE status = 'richiesta'", args: [] },
  ], "read");
  const byDay = new Map(days.rows.map((row) => [String(row.d), Number(row.revenue)]));
  const spark = Array.from({ length: range }, (_, i) => byDay.get(dayKey(end - (range - 1 - i) * DAY)) ?? 0);
  const value = spark.reduce((a, b) => a + b, 0);
  return {
    value: Math.round(value * 100) / 100,
    prev: Number(prev.rows[0]?.revenue ?? 0),
    spark,
    confirmed: days.rows.reduce((a, row) => a + Number(row.n), 0),
    pending: Number(pending.rows[0]?.n ?? 0),
  };
}

function kpi(partial: Omit<CommandKpi, "money" | "unavailable" | "note" | "delta" | "tone"> & Partial<CommandKpi>): CommandKpi {
  return { money: false, unavailable: null, note: null, delta: null, tone: null, ...partial };
}

async function analyticsBlock(me: Person, range: Range) {
  const emptyStats = { kpis: [] as CommandKpi[], traffic: null, pages: [] as CommandModel["pages"], pagesEmpty: null as string | null, countries: [] as CommandModel["countries"], countriesEmpty: null as string | null, statsHref: null as string | null };
  if (!canAccess(me, "stats")) return emptyStats;
  const statsHref = `/admin/stats?range=${range}#analisi`;
  const configured = vercelConfigured();
  const missing = configured ? "Dati non disponibili" : "Statistiche non configurate";
  if (!configured) {
    return { ...emptyStats, kpis: [
      kpi({ id: "views", label: "Visualizzazioni sito", href: "/admin/settings", value: 0, unavailable: missing, spark: [] }),
      kpi({ id: "visitors", label: "Visitatori unici", href: "/admin/settings", value: 0, unavailable: missing, spark: [] }),
    ], traffic: { points: [], empty: missing }, pagesEmpty: missing, countriesEmpty: missing, statsHref };
  }
  let series: { current: SeriesPoint[]; previous: SeriesPoint[] } | null = null;
  try {
    series = await traffic(range);
  } catch {
    series = null;
  }
  const viewsUnavailable = series ? null : missing;
  const current = series?.current ?? [];
  const previous = series?.previous ?? [];
  const viewsNow = current.reduce((a, p) => a + p.pageviews, 0);
  const viewsPrev = previous.reduce((a, p) => a + p.pageviews, 0);
  const visNow = current.reduce((a, p) => a + p.visitors, 0);
  const visPrev = previous.reduce((a, p) => a + p.visitors, 0);
  const viewDelta = series ? percentDelta(viewsNow, viewsPrev, range) : null;
  const visDelta = series ? percentDelta(visNow, visPrev, range) : null;
  const kpis: CommandKpi[] = [
    kpi({ id: "views", label: "Visualizzazioni sito", href: statsHref, value: viewsNow, delta: viewDelta?.text ?? null, tone: viewDelta?.tone ?? null, spark: current.map((p) => p.pageviews), unavailable: viewsUnavailable }),
    kpi({ id: "visitors", label: "Visitatori unici", href: statsHref, value: visNow, delta: visDelta?.text ?? null, tone: visDelta?.tone ?? null, spark: current.map((p) => p.visitors), unavailable: viewsUnavailable }),
  ];
  const quietChart = !series ? missing : current.every((p) => p.pageviews === 0 && p.visitors === 0) ? `Nessuna visita negli ultimi ${range} giorni.` : null;
  let pages: CommandModel["pages"] = [];
  let countries: CommandModel["countries"] = [];
  let broke = !series && !configured ? false : !series;
  if (configured) {
    try {
      const [pageRows, countryRows] = await Promise.all([
        analytics("requestPath", range, 5),
        analytics("country", range, 12),
      ]);
      pages = (pageRows ?? []).filter((row) => row.key);
      const named = (countryRows ?? []).filter((row) => row.key).map((row) => ({ ...row, label: countryLabel(row.key) }));
      const top = named.slice(0, 3);
      const rest = named.slice(3);
      countries = rest.length
        ? [...top, { key: "altri", label: "Altri", pageviews: rest.reduce((a, r) => a + r.pageviews, 0), visitors: rest.reduce((a, r) => a + r.visitors, 0) }]
        : top;
      broke = false;
    } catch {
      broke = true;
    }
  }
  return {
    kpis,
    traffic: { points: current, empty: quietChart },
    pages,
    pagesEmpty: pages.length ? null : broke ? missing : "Nessuna pagina vista nel periodo.",
    countries,
    countriesEmpty: countries.length ? null : broke ? missing : "Nessun dato sui paesi.",
    statsHref,
  };
}

async function dealKpi(me: Person): Promise<CommandKpi | null> {
  if (!canAccess(me, "crm")) return null;
  const href = "/admin/crm/pipeline";
  try {
    const counts = await recordOggiKpis().catch(() => liveKpiCounts(romeDay()));
    const today = romeDay();
    const then = shiftDay(today, -7);
    const cells = await db().execute({
      sql: "SELECT day, opportunities_active AS value FROM crm_kpi_daily WHERE day IN (?, ?)",
      args: [today, then],
    });
    const cell = (day: string) => {
      const row = cells.rows.find((item) => String(item.day) === day);
      if (!row || row.value === null || row.value === undefined) return null;
      return Number(row.value);
    };
    const week = weekText(cell(today), cell(then));
    const series = await kpiSeries("opportunities_active", today, 14).catch(() => []);
    return kpi({
      id: "deals", label: "Opportunità attive", href, value: counts.opportunitiesActive, money: false,
      delta: week?.text ?? null, tone: week?.tone ?? null, spark: series.map((point) => point.v),
    });
  } catch {
    return kpi({ id: "deals", label: "Opportunità attive", href, value: 0, unavailable: "CRM non disponibile", spark: [] });
  }
}

async function revenueKpi(me: Person, range: CommandRange): Promise<{ kpi: CommandKpi; pending: number } | null> {
  if (!canAccess(me, "shop")) return null;
  const href = "/admin/shop";
  try {
    const shop = await shopRevenue(range);
    if (!shop) return { kpi: kpi({ id: "revenue", label: "Fatturato (shop)", href, value: 0, money: true, unavailable: "Shop non disponibile", spark: [] }), pending: 0 };
    const change = shop.confirmed > 0 ? percentDelta(shop.value, shop.prev, range) : null;
    return {
      pending: shop.pending,
      kpi: kpi({
        id: "revenue", label: "Fatturato (shop)", href, value: shop.value, money: true, spark: shop.spark,
        delta: change?.text ?? null, tone: change?.tone ?? null,
        note: shop.confirmed === 0 ? "· Nessun ordine confermato" : null,
      }),
    };
  } catch {
    return { kpi: kpi({ id: "revenue", label: "Fatturato (shop)", href, value: 0, money: true, unavailable: "Ordini non disponibili", spark: [] }), pending: 0 };
  }
}

async function todosFor(me: Person, pendingShop: number): Promise<CommandModel["todos"]> {
  const open: CommandTodo[] = [];
  const done: CommandTodo[] = [];
  const founder = isFounder(me);
  const href = canAccess(me, "crm") ? "/admin/crm" : canAccess(me, "shop") ? "/admin/shop?tab=ordini" : canAccess(me, "journal") ? "/admin/journal" : "/admin";
  if (canAccess(me, "crm") && dbConfigured) {
    try {
      await ensureCrmSchema();
      const today = romeDay();
      const yesterday = shiftDay(today, -1);
      const viewer = { id: me.id, founder };
      const scope = founder ? "team" as const : "mine" as const;
      const start = romeWall(today, "00:00") ?? `${today}T00:00:00.000Z`;
      const [fresh, freshCountRow, quotes, follow, overdue, todayActs, doneActs] = await Promise.all([
        db().execute("SELECT id, business_name FROM crm_contacts WHERE archived = 0 AND stage = 'nuovo' ORDER BY created_at DESC LIMIT 1"),
        db().execute("SELECT COUNT(*) AS n FROM crm_contacts WHERE archived = 0 AND stage = 'nuovo'"),
        db().execute(`SELECT o.title, c.business_name, c.id AS contact_id FROM crm_opportunities o
          JOIN crm_contacts c ON c.id = o.contact_id
          WHERE c.archived = 0 AND o.closed_at IS NULL AND o.stage = 'preventivo'
          ORDER BY o.updated_at DESC LIMIT 4`),
        dueActions(founder ? null : me.id, today),
        listActivities({ scope, until: yesterday, stato: "aperte" }, viewer),
        listActivities({ scope, giorno: today, stato: "aperte" }, viewer),
        db().execute({
          sql: `SELECT a.id, a.title, a.version, a.contact_id FROM crm_activities a
            WHERE a.done_at >= ? AND ${founder ? "1 = 1" : "(a.assignee_user_id = ? OR (a.assignee_user_id IS NULL AND a.created_by = ?))"}
            ORDER BY a.done_at DESC LIMIT 2`,
          args: founder ? [start] : [start, me.id, me.id],
        }),
      ]);
      const freshCount = Number(freshCountRow.rows[0]?.n ?? 0);
      if (freshCount === 1 && fresh.rows[0]) {
        open.push({ id: `new-${fresh.rows[0].id}`, title: `Rispondi a ${fresh.rows[0].business_name}`, tag: "CRM", href: `/admin/crm/${fresh.rows[0].id}`, done: false, check: null });
      } else if (freshCount > 1) {
        open.push({ id: "new-contacts", title: `Rispondi a ${freshCount} nuovi contatti`, tag: "CRM", href: "/admin/crm/rubrica?fase=nuovo", done: false, check: null });
      }
      for (const row of overdue.slice(0, 4)) {
        open.push({
          id: `act-${row.id}`, title: row.title, tag: row.opportunityId ? "Pipeline" : "CRM",
          href: row.contactId ? `/admin/crm/${row.contactId}` : "/admin/crm/attivita", done: false,
          check: { kind: "activity", id: row.id, version: row.version },
        });
      }
      for (const row of follow.filter((item) => item.nextActionAt.slice(0, 10) <= today).slice(0, 4)) {
        open.push({
          id: `fu-${row.id}`, title: row.nextAction || `Follow-up: ${row.businessName}`, tag: "CRM",
          href: `/admin/crm/${row.id}`, done: false, check: { kind: "followup", id: row.id, seenAt: row.nextActionAt },
        });
      }
      for (const row of todayActs.slice(0, 4)) {
        if (open.some((item) => item.id === `act-${row.id}`)) continue;
        open.push({
          id: `act-${row.id}`, title: row.title, tag: row.opportunityId ? "Pipeline" : "CRM",
          href: row.contactId ? `/admin/crm/${row.contactId}` : "/admin/crm/attivita", done: false,
          check: { kind: "activity", id: row.id, version: row.version },
        });
      }
      for (const row of quotes.rows) {
        open.push({
          id: `quote-${row.contact_id}`,
          title: row.title ? `Completa preventivo: ${row.title}` : `Completa preventivo: ${row.business_name}`,
          tag: "Pipeline", href: `/admin/crm/${row.contact_id}`, done: false, check: null,
        });
      }
      for (const row of doneActs.rows) {
        done.push({
          id: `done-${row.id}`, title: String(row.title), tag: "CRM",
          href: row.contact_id ? `/admin/crm/${row.contact_id}` : "/admin/crm/attivita", done: true,
          check: { kind: "activity", id: String(row.id), version: Number(row.version) },
        });
      }
    } catch {
      /* CRM tables missing: the other sections still render. */
    }
  }
  if (canAccess(me, "shop") && pendingShop > 0) {
    open.push({
      id: "shop-requests",
      title: pendingShop === 1 ? "Verifica richiesta shop" : `Verifica ${pendingShop} richieste shop`,
      tag: "Shop", href: "/admin/shop?tab=ordini", done: false, check: null,
    });
  }
  if (canAccess(me, "journal") && dbConfigured) {
    try {
      const count = await db().execute("SELECT COUNT(*) AS n FROM posts WHERE published = 0");
      const n = Number(count.rows[0]?.n ?? 0);
      if (n === 1) {
        const one = await db().execute("SELECT id, title FROM posts WHERE published = 0 ORDER BY updated_at DESC LIMIT 1");
        const row = one.rows[0];
        if (row) open.push({ id: `draft-${row.id}`, title: `Pubblica: ${row.title}`, tag: "Contenuti", href: `/admin/edit?id=${row.id}`, done: false, check: null });
      } else if (n > 1) {
        open.push({ id: "drafts", title: `Pubblica ${n} bozze`, tag: "Contenuti", href: "/admin/journal", done: false, check: null });
      }
    } catch {
      /* Journal table missing. */
    }
  }
  return { total: open.length, items: [...open.slice(0, 6), ...done.slice(0, 2)], href };
}

function crmFeed(event: CrmEvent): CommandActivity | null {
  const href = event.contactId ? `/admin/crm/${event.contactId}` : "/admin/crm";
  const who = event.contactName;
  const base = { id: `crm-${event.id}`, tone: "crm" as const, href, at: event.at, ago: shortAgo(event.at) };
  switch (event.action) {
    case "crm.contact_create":
      return { ...base, mark: "mail", title: who ? `Nuovo contatto: ${who}` : "Nuovo contatto" };
    case "crm.opportunity_create":
      return { ...base, mark: "users", title: who ? `Opportunità aperta: ${who}` : "Opportunità aperta" };
    case "crm.opportunity_stage":
    case "crm.opportunity_update":
      return { ...base, mark: "users", title: who ? `Opportunità aggiornata: ${who}` : "Opportunità aggiornata" };
    case "crm.stage":
      return { ...base, mark: "users", title: who ? `Fase aggiornata: ${who}` : "Fase aggiornata" };
    case "crm.activity_done":
      return { ...base, mark: "doc", title: who ? `Attività completata: ${who}` : "Attività completata" };
    case "crm.draft_sent":
      return { ...base, mark: "mail", title: "Email inviata da Radar" };
    case "crm.ingest":
      return { ...base, mark: "mail", title: "Prospect da Radar", href: "/admin/crm/radar" };
    default:
      return null;
  }
}

async function activityFor(me: Person): Promise<CommandModel["activity"]> {
  const href = canAccess(me, "audit") ? "/admin/audit" : canAccess(me, "crm") ? "/admin/crm" : canAccess(me, "journal") ? "/admin/journal" : canAccess(me, "shop") ? "/admin/shop" : null;
  const items: CommandActivity[] = [];
  let error = false;
  if (!dbConfigured) return { items, href, error: false };
  if (canAccess(me, "crm")) {
    try {
      const events = await recentCrmEvents(8);
      for (const event of events) {
        const row = crmFeed(event);
        if (row) items.push(row);
      }
    } catch {
      error = true;
    }
  }
  if (canAccess(me, "requests")) {
    try {
      const rows = await db().execute("SELECT id, name, created_at FROM contact_requests ORDER BY created_at DESC LIMIT 4");
      for (const row of rows.rows) {
        items.push({ id: `req-${row.id}`, tone: "crm", mark: "mail", title: `Nuovo contatto da /contact: ${row.name}`, href: `/admin/requests?open=${row.id}`, at: String(row.created_at), ago: shortAgo(String(row.created_at)) });
      }
    } catch {
      error = true;
    }
  }
  if (canAccess(me, "journal")) {
    try {
      const rows = await db().execute("SELECT id, title, published, created_at, updated_at FROM posts ORDER BY updated_at DESC LIMIT 4");
      for (const row of rows.rows) {
        const published = Number(row.published) === 1;
        const fresh = row.created_at === row.updated_at;
        items.push({
          id: `post-${row.id}`, tone: "post", mark: "doc",
          title: fresh && published ? `Articolo pubblicato: ${row.title}` : `Articolo aggiornato: ${row.title}`,
          href: `/admin/edit?id=${row.id}`, at: String(row.updated_at), ago: shortAgo(String(row.updated_at)),
        });
      }
    } catch {
      error = true;
    }
  }
  if (canAccess(me, "newsletter")) {
    try {
      const rows = await db().execute("SELECT email, created_at, unsubscribed_at FROM subscribers ORDER BY created_at DESC LIMIT 3");
      for (const row of rows.rows) {
        items.push({
          id: `sub-${row.email}`, tone: "newsletter", mark: "mail",
          title: row.unsubscribed_at ? `Iscrizione chiusa: ${row.email}` : `Nuovo iscritto: ${row.email}`,
          href: "/admin/newsletter", at: String(row.created_at), ago: shortAgo(String(row.created_at)),
        });
      }
    } catch {
      error = true;
    }
  }
  if (canAccess(me, "shop")) {
    try {
      await ensureShopSchema();
      const [orders, products] = await Promise.all([
        db().execute("SELECT number, customer_name, created_at FROM shop_orders ORDER BY created_at DESC LIMIT 3"),
        db().execute("SELECT slug, title_it, updated_at FROM shop_products WHERE published = 1 ORDER BY updated_at DESC LIMIT 3"),
      ]);
      for (const row of orders.rows) {
        items.push({ id: `ord-${row.number}`, tone: "shop", mark: "bag", title: `Ordine #${row.number} · ${row.customer_name}`, href: "/admin/shop?tab=ordini", at: String(row.created_at), ago: shortAgo(String(row.created_at)) });
      }
      for (const row of products.rows) {
        items.push({ id: `prod-${row.slug}`, tone: "shop", mark: "bag", title: `Prodotto pubblicato: ${row.title_it}`, href: "/admin/shop?tab=prodotti", at: String(row.updated_at), ago: shortAgo(String(row.updated_at)) });
      }
    } catch {
      error = true;
    }
  }
  items.sort((a, b) => b.at.localeCompare(a.at));
  return { items: items.slice(0, 6), href, error: error && items.length === 0 };
}

function shortcuts(me: Person, range: CommandRange): CommandShortcut[] {
  const all: (CommandShortcut & { section: "crm" | "shop" | "journal" | "stats" })[] = [
    { id: "crm", section: "crm", href: "/admin/crm", title: "CRM & Pipeline", text: "Contatti, opportunità e conversazioni in un unico spazio." },
    { id: "shop", section: "shop", href: "/admin/shop", title: "Shop & Vendite", text: "Ordini, prodotti, fatturato e gestione catalogo." },
    { id: "content", section: "journal", href: "/admin/journal", title: "Contenuti", text: "Articoli, pagine e media del tuo sito." },
    { id: "analytics", section: "stats", href: `/admin/stats?range=${range}`, title: "Analytics", text: "Traffico, provenienza, dispositivi e performance." },
  ];
  return all.filter((item) => canAccess(me, item.section)).map((item) => ({
    id: item.id, href: item.href, title: item.title, text: item.text,
  }));
}

export async function loadCommandCenter(me: Person, range: CommandRange, denied: boolean, emptyFixture = false, liveFixture = false): Promise<CommandModel> {
  const dateLabel = commandDateLabel();
  if (commandFixturesOn()) return withVoice({ ...fixtureCommand(range, dateLabel, emptyFixture, liveFixture), denied }, me.name);
  const [status, stats, deals, shop] = await Promise.all([
    systems(me),
    analyticsBlock(me, range),
    dealKpi(me),
    revenueKpi(me, range),
  ]);
  const [todos, activity] = await Promise.all([
    todosFor(me, shop?.pending ?? 0),
    activityFor(me),
  ]);
  const kpis = [...stats.kpis];
  if (shop) kpis.push(shop.kpi);
  if (deals) kpis.push(deals);
  return withVoice({
    range, dateLabel, greeting: "", lead: "", denied, systems: status, kpis,
    traffic: stats.traffic, todos, shortcuts: shortcuts(me, range), activity,
    pages: stats.pages, pagesEmpty: stats.pagesEmpty, countries: stats.countries, countriesEmpty: stats.countriesEmpty,
    statsHref: stats.statsHref,
  }, me.name);
}

export async function commandNotices(me: Person): Promise<CommandNotice[]> {
  if (commandFixturesOn()) return fixtureNotices(false);
  if (!canAccess(me, "crm") || !dbConfigured) return [];
  const notices: CommandNotice[] = [];
  const founder = isFounder(me);
  try {
    const today = romeDay();
    const viewer = { id: me.id, founder };
    const [iris, overview, priority, due, late] = await Promise.all([
      currentIrisNotice().catch(() => null),
      crmOverview().catch(() => null),
      priorityContacts(3).catch(() => []),
      dueActions(founder ? null : me.id, today).catch(() => []),
      listActivities({ scope: founder ? "team" : "mine", until: shiftDay(today, -1), stato: "aperte" }, viewer).catch(() => []),
    ]);
    for (const row of late.slice(0, 3)) {
      notices.push({ id: `act-${row.id}`, title: row.title, detail: "In ritardo", href: row.contactId ? `/admin/crm/${row.contactId}` : "/admin/crm/attivita" });
    }
    for (const row of due.slice(0, 3)) {
      notices.push({ id: `fu-${row.id}`, title: row.nextAction || `Follow-up: ${row.businessName}`, detail: row.businessName, href: `/admin/crm/${row.id}` });
    }
    const freeN = overview?.unassigned ?? 0;
    if (freeN > 0) notices.push({ id: "free", title: freeN === 1 ? "1 contatto non assegnato" : `${freeN} contatti non assegnati`, detail: "CRM", href: "/admin/crm" });
    if (priority.length > 0) notices.push({ id: "prio", title: priority.length === 1 ? "1 contatto prioritario" : `${priority.length} contatti prioritari`, detail: "CRM", href: "/admin/crm" });
    if (iris) notices.push({ id: `iris-${iris.id}`, title: irisNoticeText(iris), detail: "Radar", href: "/admin/crm/radar" });
  } catch {
    return notices;
  }
  return notices.slice(0, 8);
}

export async function commandSearch(me: Person, q: string): Promise<SearchHit[]> {
  const real = await searchAdmin(me, q).catch(() => []);
  if (!commandFixturesOn()) return real;
  const extra = fixtureSearch(q).filter((hit) => !real.some((row) => row.href === hit.href && row.label === hit.label));
  return [...real, ...extra];
}
