"use client";
import { useRef, useState, useTransition, type RefObject } from "react";
import Link, { useLinkStatus } from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { bulkContactsAction, type BulkChange } from "@/app/admin/crm-actions";
import { CrmIcon, day, mapsUrl, MapPin, ScoreBadge } from "@/components/admin/crm/crm-ui";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/crm-core";
import type { RubricaSort } from "@/lib/crm-nav";

export type RubricaRow = {
  id: string; version: number; name: string; type: string | null; stage: Stage; city: string | null; address: string | null; region: string | null;
  source: string; score: number | null; nextAction: string | null; nextActionAt: string | null; href: string;
};
export type SortHead = { href: string; dir: "asc" | "desc" | null };
export type Pager = { from: number; to: number; total: number; prev: string | null; next: string | null };

const COLS: { key: RubricaSort | null; label: string; cls?: string }[] = [
  { key: "nome", label: "Nome" }, { key: "fase", label: "Fase" }, { key: "citta", label: "Città", cls: "crm-col-city" }, { key: null, label: "Fonte", cls: "crm-col-src" },
  { key: "punteggio", label: "Punteggio", cls: "crm-col-score" }, { key: "azione", label: "Prossima azione", cls: "crm-col-next" },
];
const CAL = "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4";
const BULK_MAX = 100;

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function NextCell({ row, today }: { row: RubricaRow; today: string }) {
  if (!row.nextActionAt) return row.nextAction ? <span className="crm-next-cell" title={row.nextAction}>{row.nextAction}</span> : <span className="adm-muted">—</span>;
  const d = row.nextActionAt.slice(0, 10);
  const open = row.stage !== "vinto" && row.stage !== "perso";
  const label = d === today ? "Oggi" : d === addDays(today, 1) ? "Domani" : d < today ? `In ritardo · ${day(d)}` : day(d);
  return (
    <span className="crm-next-cell" data-due={open && d <= today ? "" : undefined} title={row.nextAction ?? undefined}>
      <CrmIcon d={CAL} />{label}
    </span>
  );
}

/**
 * Rubrica list. Selection lives only here and resets when the query changes (the page keys this component by query).
 * Bulk changes go through the server with each contact's version; no email is ever sent from a selection.
 */
export function RubricaTable({ rows, activeId, sort, pager, owners, today }: {
  rows: RubricaRow[]; activeId: string; sort: Record<RubricaSort, SortHead>; pager: Pager; owners: { id: string; name: string }[]; today: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const all = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const run = (change: BulkChange, menu: RefObject<HTMLDetailsElement | null>) => {
    const items = rows.filter((r) => picked.has(r.id)).map((r) => ({ id: r.id, version: r.version }));
    menu.current?.removeAttribute("open");
    start(async () => {
      const r = await bulkContactsAction(items, change);
      setMsg({ ok: r.ok, error: r.error });
      if (r.updated || r.changed) { setPicked(new Set()); router.refresh(); }
    });
  };

  return (
    <div className="crm-list">
      <div className="crm-table-wrap">
        <table className="adm-table crm-table">
          <thead>
            <tr>
              <th className="crm-col-check"><input type="checkbox" className="crm-cb" aria-label="Seleziona tutti i contatti della pagina" checked={all} disabled={!rows.length}
                onChange={() => setPicked(all ? new Set() : new Set(rows.slice(0, BULK_MAX).map((r) => r.id)))} /></th>
              {COLS.map((c) => {
                const s = c.key ? sort[c.key] : null;
                return (
                  <th key={c.label} className={c.cls} aria-sort={s?.dir ? (s.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {s ? <Link className="crm-sort" href={s.href as Route} scroll={false}>{c.label}<span aria-hidden="true">{s.dir === "asc" ? " ↑" : s.dir === "desc" ? " ↓" : ""}</span></Link> : c.label}
                  </th>
                );
              })}
              <th className="crm-col-more"><span className="adm-sr">Azioni</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-active={r.id === activeId ? "" : undefined} data-picked={picked.has(r.id) ? "" : undefined}>
                <td className="crm-col-check"><input type="checkbox" className="crm-cb" aria-label={`Seleziona ${r.name}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="crm-col-name">
                  <Link href={r.href as Route} scroll={false} data-row-link={r.id} aria-current={r.id === activeId ? "true" : undefined}>{r.name}<Opening /></Link>
                  {r.type ? <span className="crm-sub">{r.type}</span> : null}
                </td>
                <td><span className="crm-stage" data-stage={r.stage}>{STAGE_LABEL[r.stage]}</span></td>
                <td className="crm-col-city">{r.city || r.address ? <a className="crm-city" href={mapsUrl({ businessName: r.name, address: r.address, city: r.city, region: r.region })} target="_blank" rel="noopener noreferrer" title="Apri su Google Maps"><MapPin />{r.city ?? r.address}</a> : <span className="adm-muted">—</span>}</td>
                <td className="crm-col-src">{r.source}</td>
                <td className="crm-col-score">{r.score === null ? <span className="adm-muted">—</span> : <ScoreBadge score={r.score} />}</td>
                <td className="crm-col-next"><NextCell row={r} today={today} /></td>
                <td className="crm-col-more"><Link className="crm-icon-btn" href={`/admin/crm/${r.id}` as Route} aria-label={`Apri la scheda completa di ${r.name}`} title="Scheda completa"><CrmIcon d="M5 12h.01M12 12h.01M19 12h.01" /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="crm-bulkbar">
        <span className="crm-bulk-count" aria-live="polite">{picked.size ? `${picked.size} ${picked.size === 1 ? "selezionato" : "selezionati"}` : "Nessuno selezionato"}</span>
        <div className="crm-bulk-actions" role="group" aria-label="Azioni rapide sui selezionati">
          <span className="adm-muted crm-bulk-label">Azioni rapide:</span>
          <BulkMenu label="Cambia fase" icon="M5 12h14M13 6l6 6-6 6" disabled={!picked.size || pending}>
            {(menu) => (
              <form onSubmit={(e) => { e.preventDefault(); run({ kind: "stage", stage: String(new FormData(e.currentTarget).get("stage")) }, menu); }}>
                <label className="adm-field"><span>Nuova fase</span><select className="adm-input" name="stage" defaultValue="contattato">{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
                <button className="adm-btn adm-btn-sm adm-btn-primary">Applica a {picked.size}</button>
              </form>
            )}
          </BulkMenu>
          <BulkMenu label="Pianifica follow-up" icon={CAL} disabled={!picked.size || pending}>
            {(menu) => (
              <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run({ kind: "followup", at: String(f.get("at")), text: String(f.get("text") ?? "") || null }, menu); }}>
                <label className="adm-field"><span>Entro il</span><input className="adm-input" type="date" name="at" required defaultValue={addDays(today, 1)} min={today} /></label>
                <label className="adm-field"><span>Cosa fare</span><input className="adm-input" name="text" maxLength={300} placeholder="Ricontattare" /></label>
                <button className="adm-btn adm-btn-sm adm-btn-primary">Applica a {picked.size}</button>
              </form>
            )}
          </BulkMenu>
          <BulkMenu label="Assegna" icon="M3 12V4h8l10 10-8 8zM7.5 8.5h.01" disabled={!picked.size || pending}>
            {(menu) => (
              <form onSubmit={(e) => { e.preventDefault(); const o = String(new FormData(e.currentTarget).get("owner")); run({ kind: "owner", owner: o || null }, menu); }}>
                <label className="adm-field"><span>Responsabile</span><select className="adm-input" name="owner" defaultValue={owners[0]?.id ?? ""}><option value="">Non assegnato</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                <button className="adm-btn adm-btn-sm adm-btn-primary">Applica a {picked.size}</button>
              </form>
            )}
          </BulkMenu>
        </div>
        <nav className="crm-pager" aria-label="Pagine">
          <span>{pager.total ? `${pager.from}–${pager.to} di ${pager.total}` : "0 contatti"}</span>
          {pager.prev ? <Link className="crm-icon-btn" href={pager.prev as Route} scroll={false} aria-label="Pagina precedente">‹</Link> : <span className="crm-icon-btn" aria-disabled="true">‹</span>}
          {pager.next ? <Link className="crm-icon-btn" href={pager.next as Route} scroll={false} aria-label="Pagina successiva">›</Link> : <span className="crm-icon-btn" aria-disabled="true">›</span>}
        </nav>
      </div>
      <div className="crm-live" aria-live="polite">
        {pending ? <p className="adm-muted">Aggiorno i contatti selezionati…</p> : msg.error ? <p className="adm-error" role="alert">{msg.error}</p> : msg.ok ? <p className="adm-ok">{msg.ok}</p> : null}
      </div>
    </div>
  );
}

/** Inline hint while the panel of a just-clicked row loads (the list stays usable meanwhile). */
function Opening() {
  const { pending } = useLinkStatus();
  return pending ? <span className="crm-opening" role="status"><span className="adm-sr">Apro la scheda…</span></span> : null;
}

function BulkMenu({ label, icon, disabled, children }: { label: string; icon: string; disabled: boolean; children: (menu: RefObject<HTMLDetailsElement | null>) => React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  if (disabled) return <button type="button" className="adm-btn adm-btn-sm" disabled><CrmIcon d={icon} />{label}</button>;
  return (
    <details ref={ref} className="crm-menu crm-menu-up">
      <summary className="adm-btn adm-btn-sm"><CrmIcon d={icon} />{label}</summary>
      <div className="crm-menu-list crm-menu-form">{children(ref)}</div>
    </details>
  );
}
