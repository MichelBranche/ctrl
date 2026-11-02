import "server-only";
import { db, dbConfigured } from "@/lib/db";
import { ensureShopSchema } from "@/lib/migrate";
import { isOrderStatus, type OrderStatus } from "@/lib/shop-data";

/* Admin-only order reads. Contains customer PII: import only from pages/actions behind requireAdmin()/guard(). */

export type AdminOrderItem = { slug: string; title: string; unitPrice: number; quantity: number; lineTotal: number; supplierCost: number | null };
export type AdminOrder = {
  id: string; number: number; status: OrderStatus; name: string; email: string; phone: string; address: string;
  businessName: string; reviewUrl: string; customerNote: string; lang: string; subtotal: number; total: number; supplierCostTotal: number;
  trackingNumber: string; trackingUrl: string; notes: string; createdAt: string; updatedAt: string;
  timeline: { status: OrderStatus; at: string }[]; items: AdminOrderItem[];
};

const str = (v: unknown) => (v == null ? "" : String(v));

export async function getAdminOrders(): Promise<AdminOrder[]> {
  if (!dbConfigured) return [];
  await ensureShopSchema();
  const [orders, items] = await Promise.all([
    db().execute("SELECT * FROM shop_orders ORDER BY created_at DESC LIMIT 2000"),
    db().execute("SELECT i.* FROM shop_order_items i JOIN (SELECT id FROM shop_orders ORDER BY created_at DESC LIMIT 2000) o ON o.id = i.order_id ORDER BY i.id"),
  ]);
  const byOrder = new Map<string, AdminOrderItem[]>();
  for (const r of items.rows) {
    const list = byOrder.get(str(r.order_id)) ?? [];
    list.push({ slug: str(r.slug), title: str(r.title), unitPrice: Number(r.unit_price), quantity: Number(r.quantity), lineTotal: Number(r.line_total), supplierCost: r.supplier_cost == null ? null : Number(r.supplier_cost) });
    byOrder.set(str(r.order_id), list);
  }
  return orders.rows.map((r) => {
    const timeline: { status: OrderStatus; at: string }[] = [{ status: "richiesta", at: str(r.created_at) }];
    for (const [status, col] of [["confermata", "confirmed_at"], ["ordinata", "ordered_at"], ["spedita", "shipped_at"], ["consegnata", "delivered_at"], ["annullata", "cancelled_at"]] as const) {
      if (r[col]) timeline.push({ status, at: str(r[col]) });
    }
    return {
      id: str(r.id), number: Number(r.number), status: isOrderStatus(r.status) ? r.status : "richiesta",
      name: str(r.customer_name), email: str(r.customer_email), phone: str(r.customer_phone), address: str(r.address),
      businessName: str(r.business_name), reviewUrl: str(r.review_url), customerNote: str(r.customer_note), lang: str(r.lang),
      subtotal: Number(r.subtotal), total: Number(r.total), supplierCostTotal: Number(r.supplier_cost_total),
      trackingNumber: str(r.tracking_number), trackingUrl: str(r.tracking_url), notes: str(r.notes),
      createdAt: str(r.created_at), updatedAt: str(r.updated_at), timeline: timeline.sort((a, b) => a.at.localeCompare(b.at)), items: byOrder.get(str(r.id)) ?? [],
    };
  });
}

/** Statuses that count as sales (a request is not revenue until confirmed; cancelled never is). */
export const SOLD: OrderStatus[] = ["confermata", "ordinata", "spedita", "consegnata"];
export const PERIODS = ["7", "30", "90", "all"] as const;
export type Period = (typeof PERIODS)[number];

export type ShopReport = {
  revenue: number; orders: number; average: number; margin: number; marginKnown: boolean; pending: number;
  prev: { revenue: number; orders: number } | null;
  series: { date: string; revenue: number; orders: number }[];
  byProduct: { key: string; label: string; value: number; quantity: number }[];
  byStatus: { key: OrderStatus; value: number }[];
};

const day = (iso: string) => iso.slice(0, 10);

/** Aggregates real orders only; with no orders every number is a real zero and the series are empty. */
export function buildReport(all: AdminOrder[], period: Period, now = new Date()): ShopReport {
  const days = period === "all" ? null : Number(period);
  const start = days ? new Date(now.getTime() - (days - 1) * 86_400_000) : null;
  const startDay = start ? day(start.toISOString()) : all.length ? day(all[all.length - 1].createdAt) : day(now.toISOString());
  const inRange = all.filter((o) => day(o.createdAt) >= startDay);
  const sold = inRange.filter((o) => SOLD.includes(o.status));
  const revenue = round(sold.reduce((s, o) => s + o.total, 0));
  const knownCost = sold.every((o) => o.items.every((i) => i.supplierCost !== null));
  const margin = round(sold.reduce((s, o) => s + o.total - o.supplierCostTotal, 0));
  let prev: ShopReport["prev"] = null;
  if (days && start) {
    const pStart = day(new Date(start.getTime() - days * 86_400_000).toISOString());
    const p = all.filter((o) => SOLD.includes(o.status) && day(o.createdAt) >= pStart && day(o.createdAt) < startDay);
    prev = { revenue: round(p.reduce((s, o) => s + o.total, 0)), orders: p.length };
  }
  const series: ShopReport["series"] = [];
  if (inRange.length) {
    const map = new Map<string, { revenue: number; orders: number }>();
    for (const o of sold) {
      const d = map.get(day(o.createdAt)) ?? { revenue: 0, orders: 0 };
      d.revenue += o.total; d.orders += 1; map.set(day(o.createdAt), d);
    }
    for (let t = new Date(`${startDay}T12:00:00Z`); day(t.toISOString()) <= day(now.toISOString()); t = new Date(t.getTime() + 86_400_000)) {
      const k = day(t.toISOString());
      series.push({ date: k, revenue: round(map.get(k)?.revenue ?? 0), orders: map.get(k)?.orders ?? 0 });
    }
  }
  const prod = new Map<string, { label: string; value: number; quantity: number }>();
  for (const o of sold) for (const i of o.items) {
    const p = prod.get(i.slug) ?? { label: i.title, value: 0, quantity: 0 };
    p.value += i.lineTotal; p.quantity += i.quantity; prod.set(i.slug, p);
  }
  const statusCount = new Map<OrderStatus, number>();
  for (const o of inRange) statusCount.set(o.status, (statusCount.get(o.status) ?? 0) + 1);
  return {
    revenue, orders: sold.length, average: sold.length ? round(revenue / sold.length) : 0, margin, marginKnown: knownCost,
    pending: all.filter((o) => o.status === "richiesta").length, prev, series,
    byProduct: [...prod.entries()].map(([key, v]) => ({ key, ...v, value: round(v.value) })).sort((a, b) => b.value - a.value).slice(0, 8),
    byStatus: [...statusCount.entries()].map(([key, value]) => ({ key, value })),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
