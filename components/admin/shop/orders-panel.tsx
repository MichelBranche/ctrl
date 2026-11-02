"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { setOrderStatus, updateOrderFulfilment } from "@/app/admin/shop-actions";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/shop-data";
import type { AdminOrder } from "@/lib/shop-orders";
import { eur, STATUS_COLOR } from "./shop-charts";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const when = (iso: string, time = true) => iso ? new Date(iso).toLocaleString("it-IT", time ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }) : "";

export function OrdersPanel({ orders: initial }: { orders: AdminOrder[] }) {
  const [orders, setOrders] = useState(initial);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [, start] = useTransition();
  const [toast, setToast] = useState("");

  const counts = useMemo(() => Object.fromEntries(ORDER_STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length])) as Record<OrderStatus, number>, [orders]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => (filter === "all" || o.status === filter) && (!needle || [String(o.number), o.name, o.email, o.businessName, o.phone, ...o.items.map((i) => i.title)].some((v) => v.toLowerCase().includes(needle))));
  }, [orders, filter, q]);
  const open = orders.find((o) => o.id === openId) ?? null;

  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(""), 2200); };
  const changeStatus = (o: AdminOrder, status: OrderStatus) => {
    const before = orders;
    const at = new Date().toISOString();
    setOrders((list) => list.map((x) => x.id === o.id ? { ...x, status, timeline: x.timeline.some((t) => t.status === status) ? x.timeline : [...x.timeline, { status, at }] } : x));
    start(async () => {
      const res = await setOrderStatus(o.id, status).catch(() => ({ ok: false }));
      if (!res.ok) { setOrders(before); flash(`Aggiornamento non riuscito per l'ordine #${o.number}.`); }
      else flash(`#${o.number} → ${ORDER_STATUS_LABEL[status]}`);
    });
  };
  const patch = (id: string, p: Partial<AdminOrder>) => setOrders((list) => list.map((x) => x.id === id ? { ...x, ...p } : x));

  if (!orders.length) return <div className="shop-adm-empty shop-adm-empty-lg">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18l-2 13H5L3 8zM8 8V6a4 4 0 0 1 8 0v2" /></svg>
    <p>Nessun ordine ancora.</p>
    <span className="adm-muted">Le richieste d’ordine inviate dal checkout compariranno qui con stato “Richiesta”.</span>
  </div>;

  return <>
    <div className="shop-adm-toolbar">
      <nav className="adm-tabs" aria-label="Filtra per stato">
        <button type="button" className="adm-tab" aria-current={filter === "all" ? "page" : undefined} onClick={() => setFilter("all")}>Tutti <span className="shop-adm-count">{orders.length}</span></button>
        {ORDER_STATUSES.map((s) => <button key={s} type="button" className="adm-tab" aria-current={filter === s ? "page" : undefined} onClick={() => setFilter(s)}>
          <i className="shop-adm-dot" style={{ background: STATUS_COLOR[s] }} />{ORDER_STATUS_LABEL[s]} <span className="shop-adm-count">{counts[s]}</span>
        </button>)}
      </nav>
      <label className="shop-adm-search"><span className="adm-sr">Cerca ordini</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" /></svg>
        <input className="adm-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Numero, cliente, email, prodotto…" />
      </label>
    </div>
    {shown.length === 0 ? <p className="adm-note">Nessun ordine corrisponde ai filtri.</p> : <div className="adm-table-wrap">
      <table className="adm-table shop-adm-orders">
        <thead><tr><th>Ordine</th><th>Data</th><th>Cliente</th><th>Articoli</th><th className="adm-num">Totale</th><th>Stato</th><th><span className="adm-sr">Azioni</span></th></tr></thead>
        <tbody>
          {shown.map((o, i) => <tr key={o.id} className="adm-rise" style={{ "--i": Math.min(i, 10) } as React.CSSProperties} onClick={(e) => { if (!(e.target as HTMLElement).closest("select,button,a")) setOpenId(o.id); }}>
            <td className="adm-mono">#{o.number}</td>
            <td className="adm-muted">{when(o.createdAt, false)}</td>
            <td><strong className="shop-adm-name">{o.name}</strong><span className="adm-muted shop-adm-sub">{o.businessName || o.email}</span></td>
            <td className="adm-muted">{o.items.reduce((n, i) => n + i.quantity, 0)} pz · {o.items.map((i) => i.title).join(", ")}</td>
            <td className="adm-num">{eur.format(o.total)}</td>
            <td><StatusSelect value={o.status} onChange={(s) => changeStatus(o, s)} label={`Stato ordine #${o.number}`} /></td>
            <td><button type="button" className="adm-btn adm-btn-sm" onClick={() => setOpenId(o.id)}>Dettagli</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>}
    <AnimatePresence>{open ? <OrderDrawer key={open.id} order={open} onClose={() => setOpenId(null)} onStatus={(s) => changeStatus(open, s)} onSaved={(p) => { patch(open.id, p); flash(`Ordine #${open.number} salvato.`); }} /> : null}</AnimatePresence>
    <div className="shop-adm-toast" role="status" aria-live="polite" data-show={toast ? "" : undefined}>{toast}</div>
  </>;
}

function StatusSelect({ value, onChange, label }: { value: OrderStatus; onChange: (s: OrderStatus) => void; label: string }) {
  return <span className="shop-adm-status" style={{ "--c": STATUS_COLOR[value] } as React.CSSProperties}>
    <i aria-hidden="true" />
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as OrderStatus)}>
      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
    </select>
  </span>;
}

function OrderDrawer({ order: o, onClose, onStatus, onSaved }: { order: AdminOrder; onClose: () => void; onStatus: (s: OrderStatus) => void; onSaved: (p: Partial<AdminOrder>) => void }) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [saving, start] = useTransition();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  const copy = async (what: string, value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(what); window.setTimeout(() => setCopied(""), 1600); } catch { setCopied(""); }
  };
  const supplierBlock = [o.name, o.address, o.phone].filter(Boolean).join("\n");
  const cost = o.items.every((i) => i.supplierCost !== null) ? o.items.reduce((s, i) => s + (i.supplierCost ?? 0) * i.quantity, 0) : null;
  const save = (form: FormData) => start(async () => {
    setError("");
    const input = { trackingNumber: String(form.get("trackingNumber") ?? ""), trackingUrl: String(form.get("trackingUrl") ?? ""), notes: String(form.get("notes") ?? "") };
    const res = await updateOrderFulfilment(o.id, input).catch(() => ({ ok: false, error: "Salvataggio non riuscito." }));
    if (!res.ok) setError(res.error ?? "Salvataggio non riuscito.");
    else onSaved({ trackingNumber: input.trackingNumber.trim(), trackingUrl: input.trackingUrl.trim(), notes: input.notes.trim() });
  });
  const reached = new Map(o.timeline.map((t) => [t.status, t.at]));
  const flow: OrderStatus[] = o.status === "annullata" ? [...o.timeline.map((t) => t.status)] : ["richiesta", "confermata", "ordinata", "spedita", "consegnata"];
  return <>
    <motion.div className="shop-adm-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.25 }} />
    <motion.aside ref={panel} tabIndex={-1} className="shop-adm-drawer" role="dialog" aria-modal="true" aria-label={`Ordine #${o.number}`}
      initial={reduce ? { opacity: 0 } : { x: "100%" }} animate={reduce ? { opacity: 1 } : { x: 0 }} exit={reduce ? { opacity: 0 } : { x: "100%" }} transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}>
      <header className="shop-adm-drawer-head">
        <div><p className="adm-kicker">Ordine #{o.number}</p><h2 className="adm-h2">{o.name}</h2><p className="adm-muted">{when(o.createdAt)} · {o.lang.toUpperCase()}</p></div>
        <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Chiudi dettagli"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      </header>
      <div className="shop-adm-drawer-body">
        <section>
          <div className="shop-adm-row"><h3>Stato</h3><StatusSelect value={o.status} onChange={onStatus} label={`Stato ordine #${o.number}`} /></div>
          <ol className="shop-adm-timeline">
            {flow.map((s, i) => <motion.li key={s} data-done={reached.has(s) || undefined} data-current={o.status === s || undefined} style={{ "--c": STATUS_COLOR[s] } as React.CSSProperties}
              initial={reduce ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.15 + i * 0.06, ease: EASE }}>
              <i aria-hidden="true" /><span>{ORDER_STATUS_LABEL[s]}</span><time className="adm-muted">{reached.has(s) ? when(reached.get(s)!) : "—"}</time>
            </motion.li>)}
          </ol>
        </section>
        <section>
          <h3>Articoli</h3>
          <ul className="shop-adm-items">
            {o.items.map((i) => <li key={i.slug}><span><strong>{i.title}</strong><span className="adm-muted"> × {i.quantity} · {eur.format(i.unitPrice)}</span></span><span className="adm-num">{eur.format(i.lineTotal)}</span>
              <span className="adm-muted shop-adm-cost">{i.supplierCost === null ? "Costo fornitore non impostato" : `Costo ${eur.format(i.supplierCost * i.quantity)} · margine ${eur.format(i.lineTotal - i.supplierCost * i.quantity)}`}</span></li>)}
          </ul>
          <dl className="shop-adm-sum"><div><dt>Totale</dt><dd>{eur.format(o.total)}</dd></div>{cost !== null ? <><div><dt>Costo fornitore</dt><dd>{eur.format(cost)}</dd></div><div className="is-strong"><dt>Margine lordo stimato</dt><dd>{eur.format(o.total - cost)}</dd></div></> : null}</dl>
        </section>
        <section>
          <div className="shop-adm-row"><h3>Cliente e spedizione</h3><button type="button" className="adm-btn adm-btn-sm shop-adm-copy" data-done={copied === "addr" || undefined} onClick={() => copy("addr", supplierBlock)}>{copied === "addr" ? "Copiato ✓" : "Copia indirizzo per il fornitore"}</button></div>
          <dl className="adm-dl shop-adm-dl">
            <dt>Email</dt><dd><a className="adm-link" href={`mailto:${o.email}?subject=${encodeURIComponent(`Ordine CTRL #${o.number}`)}`}>{o.email}</a></dd>
            {o.phone ? <><dt>Telefono</dt><dd><a className="adm-link" href={`tel:${o.phone.replace(/\s/g, "")}`}>{o.phone}</a></dd></> : null}
            <dt>Indirizzo</dt><dd className="shop-adm-pre">{o.address}</dd>
            {o.businessName ? <><dt>Attività</dt><dd>{o.businessName}</dd></> : null}
            {o.reviewUrl ? <><dt>Link recensioni</dt><dd><a className="adm-link" href={o.reviewUrl} target="_blank" rel="noopener noreferrer nofollow">{o.reviewUrl}</a> <button type="button" className="adm-btn adm-btn-sm" onClick={() => copy("url", o.reviewUrl)}>{copied === "url" ? "Copiato ✓" : "Copia"}</button></dd></> : null}
            {o.customerNote ? <><dt>Note cliente</dt><dd className="shop-adm-pre">{o.customerNote}</dd></> : null}
          </dl>
        </section>
        <form action={save} className="adm-form">
          <h3>Tracking e note interne</h3>
          <div className="adm-grid2">
            <label className="adm-field"><span>Numero di tracking</span><input className="adm-input" name="trackingNumber" defaultValue={o.trackingNumber} maxLength={120} /></label>
            <label className="adm-field"><span>Link di tracking</span><input className="adm-input" name="trackingUrl" type="url" defaultValue={o.trackingUrl} maxLength={500} placeholder="https://" /></label>
          </div>
          {o.trackingUrl ? <p><a className="adm-link" href={o.trackingUrl} target="_blank" rel="noopener noreferrer">Apri il tracking ↗</a></p> : null}
          <label className="adm-field"><span>Note interne (non visibili al cliente)</span><textarea className="adm-input" name="notes" rows={4} defaultValue={o.notes} maxLength={4000} /></label>
          {error ? <p className="adm-error" role="alert">{error}</p> : null}
          <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</button>
        </form>
      </div>
    </motion.aside>
  </>;
}
