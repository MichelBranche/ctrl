import "server-only";
import { projectCategories, projects, services, categoryPath } from "@/lib/content";
import { STAGE_LABEL, isStage, isSource } from "@/lib/crm-core";
import { listActivities } from "@/lib/crm-activity";
import { db, dbConfigured } from "@/lib/db";
import { ensureClientMeetSchema, ensureCrmSchema, ensureDeskSchema, ensureEmailSchema, ensureShopSchema } from "@/lib/migrate";
import { ORDER_STATUS_LABEL, isOrderStatus } from "@/lib/shop-data";
import type { SearchHit } from "@/lib/search-types";
import { canAccess, isFounder, type Perms } from "@/lib/team-types";

export type { SearchHit } from "@/lib/search-types";

type Searcher = Perms & { id: string };

const likeOf = (term: string) => `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

type PageHit = { title: string; path: string; blob: string };

let pagesCache: PageHit[] | null = null;

/** Public pages the studio actually ships. Titles come from the content catalog, not from a sample list. */
function sitePages(): PageHit[] {
  if (pagesCache) return pagesCache;
  const rows: PageHit[] = [
    ["Home", "/"],
    ["Progetti", "/projects"],
    ["Servizi", "/services"],
    ["Team", "/team"],
    ["Journal", "/journal"],
    ["Shop", "/shop"],
    ["Contatto", "/contact"],
    ["Prenotazioni", "/bookings"],
    ["Privacy", "/privacy"],
    ["Cookie", "/cookie"],
    ["Agenzia web Valle d'Aosta", "/agenzia-web-valle-d-aosta"],
    ["Webapp", "/services/webapp"],
    ["Sicurezza web", "/services/web-security"],
    ["Agenda Easy", "/projects/webapps/agenda-easy"],
  ].map(([title, path]) => ({ title, path, blob: `${title} ${path}`.toLowerCase() }));
  for (const service of services) {
    rows.push({ title: service.title.it, path: `/services/${service.slug}`, blob: `${service.title.it} ${service.slug} servizi`.toLowerCase() });
  }
  for (const category of projectCategories) {
    const path = categoryPath(category);
    rows.push({ title: category.label.it, path, blob: `${category.label.it} ${path} progetti`.toLowerCase() });
  }
  for (const project of projects) {
    const path = `/projects/${project.category}/${project.slug}`;
    rows.push({ title: project.title.it, path, blob: `${project.title.it} ${project.client} ${project.slug}`.toLowerCase() });
  }
  const seen = new Set<string>();
  pagesCache = rows.filter((row) => {
    if (seen.has(row.path)) return false;
    seen.add(row.path);
    return true;
  });
  return pagesCache;
}

function pageHits(needle: string): SearchHit[] {
  return sitePages()
    .filter((page) => page.blob.includes(needle))
    .slice(0, 6)
    .map((page) => ({ label: page.title, hint: `Pagina · ${page.path}`, href: page.path, group: "pagine" as const }));
}

async function quietly(run: () => Promise<SearchHit[]>): Promise<SearchHit[]> {
  try {
    return await run();
  } catch {
    return [];
  }
}

/** Every admin entity the signed-in person is allowed to open. Empty query is refused by the route. */
export async function searchAdmin(me: Searcher, raw: string): Promise<SearchHit[]> {
  const term = raw.trim().slice(0, 80);
  if (term.length < 2) return [];
  const needle = term.toLowerCase();
  const like = likeOf(term);
  const founder = isFounder(me);
  const viewer = { id: me.id, founder };

  const [contacts, deals, activities, articles, media, subscribers, orders, products, requests, meetings, email, team, desk, radar] = await Promise.all([
    canAccess(me, "crm") ? quietly(async () => {
      await ensureCrmSchema();
      const r = await db().execute({
        sql: `SELECT id, business_name, city, stage, source FROM crm_contacts
          WHERE archived = 0 AND (business_name LIKE ? ESCAPE '\\' OR contact_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')
          ORDER BY updated_at DESC LIMIT 6`,
        args: [like, like, like, like, like],
      });
      return r.rows.map((row) => {
        const stage = isStage(row.stage) ? STAGE_LABEL[row.stage] : "CRM";
        const radarHint = isSource(row.source) && row.source === "radar" ? " · Radar" : "";
        const city = row.city ? ` · ${row.city}` : "";
        return { label: String(row.business_name), hint: `Contatto · ${stage}${radarHint}${city}`, href: `/admin/crm/${row.id}`, group: "contatti" as const };
      });
    }) : [],
    canAccess(me, "crm") ? quietly(async () => {
      await ensureCrmSchema();
      const r = await db().execute({
        sql: `SELECT o.title, o.stage, c.id AS contact_id, c.business_name FROM crm_opportunities o
          JOIN crm_contacts c ON c.id = o.contact_id
          WHERE c.archived = 0 AND (o.title LIKE ? ESCAPE '\\' OR c.business_name LIKE ? ESCAPE '\\')
          ORDER BY o.updated_at DESC LIMIT 6`,
        args: [like, like],
      });
      return r.rows.map((row) => ({
        label: String(row.title),
        hint: `Opportunità · ${row.business_name}${isStage(row.stage) ? ` · ${STAGE_LABEL[row.stage]}` : ""}`,
        href: `/admin/crm/${row.contact_id}`,
        group: "opportunita" as const,
      }));
    }) : [],
    canAccess(me, "crm") ? quietly(async () => {
      const rows = await listActivities({ q: term, scope: founder ? "team" : "mine", stato: "tutte" }, viewer);
      return rows.slice(0, 6).map((row) => ({
        label: row.title,
        hint: `Attività${row.contactName ? ` · ${row.contactName}` : ""}`,
        href: row.contactId ? `/admin/crm/${row.contactId}` : "/admin/crm/attivita",
        group: "attivita" as const,
      }));
    }) : [],
    canAccess(me, "journal") && dbConfigured ? quietly(async () => {
      const r = await db().execute({
        sql: "SELECT id, title, lang, published FROM posts WHERE title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 6",
        args: [like, like],
      });
      return r.rows.map((row) => ({
        label: String(row.title),
        hint: `Articolo ${String(row.lang).toUpperCase()} · ${Number(row.published) ? "pubblicato" : "bozza"}`,
        href: `/admin/edit?id=${row.id}`,
        group: "articoli" as const,
      }));
    }) : [],
    canAccess(me, "media") && dbConfigured ? quietly(async () => {
      const r = await db().execute({
        sql: "SELECT id, title, cover_alt FROM posts WHERE cover_url IS NOT NULL AND cover_alt LIKE ? ESCAPE '\\' AND title NOT LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 4",
        args: [like, like],
      });
      return r.rows.map((row) => ({
        label: String(row.cover_alt || row.title),
        hint: "Media · copertina",
        href: `/admin/edit?id=${row.id}`,
        group: "media" as const,
      }));
    }) : [],
    canAccess(me, "newsletter") && dbConfigured ? quietly(async () => {
      const r = await db().execute({
        sql: "SELECT email FROM subscribers WHERE email LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 5",
        args: [like],
      });
      return r.rows.map((row) => ({
        label: String(row.email),
        hint: "Iscritto newsletter",
        href: `/admin/newsletter?q=${encodeURIComponent(String(row.email))}`,
        group: "iscritti" as const,
      }));
    }) : [],
    canAccess(me, "shop") ? quietly(async () => {
      await ensureShopSchema();
      const r = await db().execute({
        sql: `SELECT number, customer_name, status FROM shop_orders
          WHERE customer_name LIKE ? ESCAPE '\\' OR customer_email LIKE ? ESCAPE '\\' OR CAST(number AS TEXT) LIKE ? ESCAPE '\\'
          ORDER BY created_at DESC LIMIT 6`,
        args: [like, like, like],
      });
      return r.rows.map((row) => ({
        label: `#${row.number} · ${row.customer_name}`,
        hint: `Ordine · ${isOrderStatus(row.status) ? ORDER_STATUS_LABEL[row.status] : "Shop"}`,
        href: "/admin/shop?tab=ordini",
        group: "ordini" as const,
      }));
    }) : [],
    canAccess(me, "shop") ? quietly(async () => {
      await ensureShopSchema();
      const r = await db().execute({
        sql: "SELECT title_it, published FROM shop_products WHERE title_it LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 6",
        args: [like, like, like],
      });
      return r.rows.map((row) => ({
        label: String(row.title_it),
        hint: `Prodotto · ${Number(row.published) ? "pubblicato" : "bozza"}`,
        href: "/admin/shop?tab=prodotti",
        group: "prodotti" as const,
      }));
    }) : [],
    canAccess(me, "requests") && dbConfigured ? quietly(async () => {
      const r = await db().execute({
        sql: "SELECT id, name, email, subject FROM contact_requests WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR subject LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 5",
        args: [like, like, like],
      });
      return r.rows.map((row) => ({
        label: String(row.name),
        hint: `Richiesta · ${row.subject || row.email}`,
        href: `/admin/requests?open=${row.id}`,
        group: "richieste" as const,
      }));
    }) : [],
    canAccess(me, "meetings") ? quietly(async () => {
      await ensureClientMeetSchema();
      const r = await db().execute({
        sql: `SELECT title, client_name FROM client_meetings
          WHERE cancelled_at IS NULL AND (title LIKE ? ESCAPE '\\' OR client_name LIKE ? ESCAPE '\\' OR client_email LIKE ? ESCAPE '\\')
          ORDER BY start_local DESC LIMIT 5`,
        args: [like, like, like],
      });
      return r.rows.map((row) => ({
        label: String(row.title),
        hint: `Riunione · ${row.client_name}`,
        href: "/admin/riunioni",
        group: "riunioni" as const,
      }));
    }) : [],
    canAccess(me, "email") ? quietly(async () => {
      await ensureEmailSchema();
      const r = await db().execute({
        sql: "SELECT subject, sender FROM email_references WHERE subject LIKE ? ESCAPE '\\' OR sender LIKE ? ESCAPE '\\' LIMIT 5",
        args: [like, like],
      });
      return r.rows.map((row) => ({
        label: String(row.subject || row.sender),
        hint: "Email",
        href: "/admin/email",
        group: "email" as const,
      }));
    }) : [],
    founder && dbConfigured ? quietly(async () => {
      const r = await db().execute({
        sql: "SELECT id, name, email FROM admin_users WHERE removed_at IS NULL AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\') ORDER BY name LIMIT 5",
        args: [like, like],
      });
      return r.rows.map((row) => ({
        label: String(row.name),
        hint: "Team",
        href: `/admin/team/${row.id}`,
        group: "team" as const,
      }));
    }) : [],
    dbConfigured ? quietly(async () => {
      await ensureDeskSchema();
      const r = await db().execute({
        sql: "SELECT title, kind FROM desk_items WHERE user_id = ? AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT 5",
        args: [me.id, like, like],
      });
      return r.rows.map((row) => ({
        label: String(row.title),
        hint: row.kind === "note" ? "Nota di scrivania" : "Attività di scrivania",
        href: "/admin/desk",
        group: "scrivania" as const,
      }));
    }) : [],
    canAccess(me, "crm") ? quietly(async () => {
      await ensureCrmSchema();
      const r = await db().execute({
        sql: "SELECT params FROM crm_iris_requests WHERE params LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 8",
        args: [like],
      });
      const hits: SearchHit[] = [];
      for (const row of r.rows) {
        let zone = "";
        try {
          const params = JSON.parse(String(row.params)) as { zone?: string; sectors?: string[] };
          const blob = `${params.zone ?? ""} ${(params.sectors ?? []).join(" ")}`.toLowerCase();
          if (!blob.includes(needle)) continue;
          zone = params.zone?.trim() || "Ricerca Radar";
        } catch {
          continue;
        }
        hits.push({ label: zone, hint: "Ricerca Radar", href: "/admin/crm/radar", group: "radar" });
        if (hits.length >= 4) break;
      }
      return hits;
    }) : [],
  ]);

  return [...contacts, ...deals, ...activities, ...articles, ...pageHits(needle), ...media, ...subscribers, ...orders, ...products, ...requests, ...meetings, ...email, ...team, ...desk, ...radar];
}
