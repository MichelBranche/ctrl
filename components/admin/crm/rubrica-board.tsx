"use client";
import { memo, useCallback, useEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { bulkContactsAction, moveStageAction, type BulkChange } from "@/app/admin/crm-actions";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/crm-core";
import type { RubricaSort } from "@/lib/crm-nav";

export type BoardRow = {
  id: string; version: number; name: string; sub: string | null; stage: Stage; score: number | null;
  hue: number; letters: string; href: string; planHref: string; mailHref: string | null;
  next: { title: string; relative: string; overdue: boolean } | null;
};
export type SortHead = { href: string; dir: "asc" | "desc" | null };
export type Pager = { from: number; to: number; total: number; prev: string | null; next: string | null };

const BULK_MAX = 100;
const MAIL = "M4 6h16v12H4zM4 7l8 6 8-6";
const USER = "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z";
const CAL = "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4";
const MOVE = "M5 12h14M13 6l6 6-6 6";
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Rubrica list or grid. Selection stays on this page and resets when the query changes.
 * Bulk changes go through one server transaction. Email is never sent from the selection.
 */
export function RubricaBoard({ rows, layout, activeId, sort, pager, owners, today, canEmail }: {
  rows: BoardRow[]; layout: "lista" | "griglia"; activeId: string; sort: Record<RubricaSort, SortHead>;
  pager: Pager; owners: { id: string; name: string }[]; today: string; canEmail: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const all = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const toggle = useCallback((id: string) => setPicked((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);
  useEffect(() => {
    if (!activeId) return;
    document.querySelector(`[data-row-link="${CSS.escape(activeId)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, layout]);
  const run = (change: BulkChange, menu: RefObject<HTMLDetailsElement | null>) => {
    const items = rows.filter((r) => picked.has(r.id)).map((r) => ({ id: r.id, version: r.version }));
    menu.current?.removeAttribute("open");
    start(async () => {
      const result = await bulkContactsAction(items, change);
      setMsg({ ok: result.ok, error: result.error });
      if (result.updated || result.changed) { setPicked(new Set()); router.refresh(); }
    });
  };
  const setStage = useCallback((row: BoardRow, stage: Stage, menu: HTMLDetailsElement | null) => {
    menu?.removeAttribute("open");
    if (stage === row.stage) return;
    start(async () => {
      const result = await moveStageAction(row.id, stage, row.version);
      setMsg({ ok: result.ok, error: result.error });
      router.refresh();
    });
  }, [router]);
  const chosen = rows.filter((r) => picked.has(r.id));
  const mailTitle = !canEmail
    ? "Non hai l'accesso alla posta."
    : chosen.length !== 1
      ? "L'invio resta uno alla volta, dal compositore. Seleziona un solo contatto."
      : !chosen[0]?.mailHref
        ? "Questo contatto non ha un'email."
        : "Apri il compositore";

  return (
    <div className="crm-rubrica-results" data-layout={layout}>
      {layout === "griglia" ? (
        <ul className="crm-rubrica-grid">
          {rows.map((r) => <Card key={r.id} row={r} active={r.id === activeId} picked={picked.has(r.id)} pending={pending} onToggle={toggle} onStage={setStage} />)}
        </ul>
      ) : (
        <div className="crm-table-wrap">
          <table className="adm-table crm-table crm-rubrica-table">
            <thead>
              <tr>
                <th className="crm-col-check"><input type="checkbox" className="crm-cb" aria-label="Seleziona tutti i contatti della pagina" checked={all} disabled={!rows.length}
                  onChange={() => setPicked(all ? new Set() : new Set(rows.slice(0, BULK_MAX).map((r) => r.id)))} /></th>
                <Sortable label="Contatto" head={sort.nome} />
                <Sortable label="Fase" head={sort.fase} />
                <Sortable label="Punteggio" head={sort.punteggio} cls="crm-col-score" />
                <Sortable label="Prossima azione" head={sort.azione} cls="crm-col-next" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <Person key={r.id} row={r} active={r.id === activeId} picked={picked.has(r.id)} pending={pending} onToggle={toggle} onStage={setStage} />)}
            </tbody>
          </table>
        </div>
      )}

      <nav className="crm-pager" aria-label="Pagine">
        <span>{pager.total ? `${pager.from}–${pager.to} di ${pager.total}` : "0 contatti"}</span>
        {pager.prev ? <Link className="crm-icon-btn" href={pager.prev as Route} scroll={false} aria-label="Pagina precedente">‹</Link> : <span className="crm-icon-btn" aria-disabled="true">‹</span>}
        {pager.next ? <Link className="crm-icon-btn" href={pager.next as Route} scroll={false} aria-label="Pagina successiva">›</Link> : <span className="crm-icon-btn" aria-disabled="true">›</span>}
      </nav>

      {picked.size ? (
        <div className="crm-floatbar" role="toolbar" aria-label="Azioni sui selezionati">
          <span>{picked.size} {picked.size === 1 ? "selezionato" : "selezionati"}</span>
          {chosen.length === 1 && chosen[0]?.mailHref
            ? <Link className="adm-btn adm-btn-sm" href={chosen[0].mailHref as Route}><CrmIcon d={MAIL} />Invia email</Link>
            : <button type="button" className="adm-btn adm-btn-sm" disabled title={mailTitle}><CrmIcon d={MAIL} />Invia email</button>}
          <BulkMenu label="Assegna" icon={USER} disabled={pending}>
            {(menu) => (
              <form onSubmit={(e) => { e.preventDefault(); const owner = String(new FormData(e.currentTarget).get("owner")); run({ kind: "owner", owner: owner || null }, menu); }}>
                <label className="adm-field"><span>Responsabile</span>
                  <select className="adm-input" name="owner" defaultValue=""><option value="">Non assegnato</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                </label>
                <button className="adm-btn adm-btn-sm adm-btn-primary">Applica a {picked.size}</button>
              </form>
            )}
          </BulkMenu>
          <BulkMenu label="Pianifica" icon={CAL} disabled={pending}>
            {(menu) => (
              <form onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); run({ kind: "followup", at: String(form.get("at")), text: String(form.get("text") ?? "") || null }, menu); }}>
                <label className="adm-field"><span>Entro il</span><input className="adm-input" type="date" name="at" required defaultValue={addDays(today, 1)} min={today} /></label>
                <label className="adm-field"><span>Cosa fare</span><input className="adm-input" name="text" maxLength={300} placeholder="Ricontattare" /></label>
                <button className="adm-btn adm-btn-sm adm-btn-primary">Applica a {picked.size}</button>
              </form>
            )}
          </BulkMenu>
          <BulkMenu label="Cambia fase" icon={MOVE} disabled={pending}>
            {(menu) => (
              <form onSubmit={(e) => { e.preventDefault(); run({ kind: "stage", stage: String(new FormData(e.currentTarget).get("stage")) }, menu); }}>
                <label className="adm-field"><span>Nuova fase</span>
                  <select className="adm-input" name="stage" defaultValue="contattato">{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
                </label>
                <button className="adm-btn adm-btn-sm adm-btn-primary">Applica a {picked.size}</button>
              </form>
            )}
          </BulkMenu>
          <button type="button" className="crm-icon-btn" aria-label="Chiudi la selezione" onClick={() => setPicked(new Set())}>×</button>
        </div>
      ) : null}
      <div className="crm-live" aria-live="polite">
        {pending ? <p className="adm-muted">Aggiorno i contatti selezionati…</p> : msg.error ? <p className="adm-error" role="alert">{msg.error}</p> : msg.ok ? <p className="adm-ok">{msg.ok}</p> : null}
      </div>
    </div>
  );
}

type LineProps = { row: BoardRow; active: boolean; picked: boolean; pending: boolean; onToggle: (id: string) => void; onStage: (row: BoardRow, stage: Stage, menu: HTMLDetailsElement | null) => void };

const Person = memo(function Person({ row, active, picked, pending, onToggle, onStage }: LineProps) {
  return (
    <tr data-active={active ? "" : undefined} data-picked={picked ? "" : undefined}>
      <td className="crm-col-check"><input type="checkbox" className="crm-cb" aria-label={`Seleziona ${row.name}`} checked={picked} onChange={() => onToggle(row.id)} /></td>
      <td className="crm-col-name">
        <Link href={row.href as Route} scroll={false} data-row-link={row.id} className="crm-person">
          <Avatar row={row} />
          <span><span className="crm-person-name">{row.name}</span>{row.sub ? <span className="crm-sub">{row.sub}</span> : null}</span>
        </Link>
      </td>
      <td><StagePill row={row} pending={pending} onPick={onStage} /></td>
      <td className="crm-col-score"><ScoreRing score={row.score} /></td>
      <td className="crm-col-next"><NextBit row={row} /></td>
    </tr>
  );
});

const Card = memo(function Card({ row, active, picked, pending, onToggle, onStage }: LineProps) {
  return (
    <li data-active={active ? "" : undefined} data-picked={picked ? "" : undefined}>
      <input type="checkbox" className="crm-cb" aria-label={`Seleziona ${row.name}`} checked={picked} onChange={() => onToggle(row.id)} />
      <Link href={row.href as Route} scroll={false} data-row-link={row.id} className="crm-card-link">
        <Avatar row={row} />
        <span className="crm-card-name">{row.name}</span>
        {row.sub ? <span className="crm-sub">{row.sub}</span> : null}
      </Link>
      <StagePill row={row} pending={pending} onPick={onStage} />
      <ScoreRing score={row.score} />
      <NextBit row={row} />
    </li>
  );
});

function Sortable({ label, head, cls }: { label: string; head: SortHead; cls?: string }) {
  return (
    <th className={cls} aria-sort={head.dir ? (head.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link className="crm-sort" href={head.href as Route} scroll={false}>{label}<span aria-hidden="true">{head.dir === "asc" ? " ↑" : head.dir === "desc" ? " ↓" : ""}</span></Link>
    </th>
  );
}

function Avatar({ row }: { row: BoardRow }) {
  return <span className="crm-avatar" data-hue={row.hue} aria-hidden="true">{row.letters}</span>;
}

function ScoreRing({ score }: { score: number | null }) {
  if (score === null) return <span className="adm-muted">n/d</span>;
  const level = score >= 70 ? "alto" : score >= 40 ? "medio" : "basso";
  const turn = Math.max(0, Math.min(100, score));
  return (
    <span className="crm-ring" data-level={level} title={`Punteggio ${score} su 100`} style={{ ["--turn" as string]: `${turn * 3.6}deg` }}>
      <span>{score}</span>
    </span>
  );
}

function NextBit({ row }: { row: BoardRow }) {
  if (!row.next) {
    return (
      <span className="crm-next-empty">
        <span>Nessuna azione</span>
        <Link href={row.planHref as Route}>Pianifica</Link>
      </span>
    );
  }
  return (
    <span className="crm-next-cell" data-due={row.next.overdue ? "" : undefined}>
      <span>{row.next.title}</span>
      <span className={row.next.overdue ? "is-late" : undefined}>{row.next.relative}</span>
    </span>
  );
}

function StagePill({ row, pending, onPick }: { row: BoardRow; pending: boolean; onPick: (row: BoardRow, stage: Stage, menu: HTMLDetailsElement | null) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="crm-stage-menu">
      <summary className="crm-stage" data-stage={row.stage}>{STAGE_LABEL[row.stage]}</summary>
      <div className="crm-menu-list" role="menu">
        {STAGES.map((stage) => (
          <button type="button" key={stage} role="menuitem" disabled={pending || stage === row.stage} onClick={() => onPick(row, stage, ref.current)}>{STAGE_LABEL[stage]}</button>
        ))}
      </div>
    </details>
  );
}

function BulkMenu({ label, icon, disabled, children }: { label: string; icon: string; disabled: boolean; children: (menu: RefObject<HTMLDetailsElement | null>) => ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  if (disabled) return <button type="button" className="adm-btn adm-btn-sm" disabled><CrmIcon d={icon} />{label}</button>;
  return (
    <details ref={ref} className="crm-menu crm-menu-up">
      <summary className="adm-btn adm-btn-sm"><CrmIcon d={icon} />{label}</summary>
      <div className="crm-menu-list crm-menu-form">{children(ref)}</div>
    </details>
  );
}
