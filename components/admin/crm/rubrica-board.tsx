"use client";
import { memo, useCallback, useEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { bulkContactsAction, moveStageAction, type BulkChange } from "@/app/admin/crm-actions";
import { CrmIcon } from "@/components/admin/crm/crm-ui";
import { DueChip, ScoreMeter, StageBadge, ToneAvatar } from "@/components/ds/status";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/crm-core";
import type { RubricaSort } from "@/lib/crm-nav";

export type BoardRow = {
  id: string; version: number; name: string; category: string | null; person: string | null; city: string | null;
  stage: Stage; score: number | null; tone: number; letters: string;
  owner: { name: string; letters: string; tone: number; active: boolean } | null; updated: string;
  href: string; planHref: string; mailHref: string | null;
  next: { title: string; relative: string; overdue: boolean; today: boolean } | null;
};
export type SortHead = { href: string; dir: "asc" | "desc" | null };
export type Pager = { from: number; to: number; total: number; prev: string | null; next: string | null };

const BULK_MAX = 100;
const MAIL = "M4 6h16v12H4zM4 7l8 6 8-6";
const USER = "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z";
const CAL = "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4";
const MOVE = "M5 12h14M13 6l6 6-6 6";
const PLUS = "M12 5v14M5 12h14";
const CHEVRON = "M6 9l6 6 6-6";
const PIN = "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z";
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
    <div className="rb-results" data-layout={layout}>
      {layout === "griglia" ? (
        <>
          <div className="rb-gridhead">
            <label className="rb-cb"><input type="checkbox" aria-label="Seleziona tutti i contatti della pagina" checked={all} disabled={!rows.length}
              onChange={() => setPicked(all ? new Set() : new Set(rows.slice(0, BULK_MAX).map((r) => r.id)))} /><span aria-hidden="true" /></label>
            <span>Seleziona la pagina</span>
          </div>
          <ul className="rb-grid">
            {rows.map((r, i) => <Card key={r.id} i={i} row={r} active={r.id === activeId} picked={picked.has(r.id)} pending={pending} onToggle={toggle} onStage={setStage} />)}
          </ul>
        </>
      ) : (
        <div className="rb-table-wrap">
          <table className="rb-table">
            <thead>
              <tr>
                <th className="rb-c-check"><label className="rb-cb"><input type="checkbox" aria-label="Seleziona tutti i contatti della pagina" checked={all} disabled={!rows.length}
                  onChange={() => setPicked(all ? new Set() : new Set(rows.slice(0, BULK_MAX).map((r) => r.id)))} /><span aria-hidden="true" /></label><span className="rb-th-all" aria-hidden="true">Seleziona la pagina</span></th>
                <Sortable label="Contatto" head={sort.nome} cls="rb-c-name" />
                <Sortable label="Fase" head={sort.fase} cls="rb-c-stage" />
                <Sortable label="Punteggio" head={sort.punteggio} cls="rb-c-score" />
                <Sortable label="Città" head={sort.citta} cls="rb-c-city" />
                <th className="rb-c-owner">Responsabile</th>
                <Sortable label="Prossima azione" head={sort.azione} cls="rb-c-next" />
                <Sortable label="Aggiornato" head={sort.aggiornato} cls="rb-c-upd" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => <Person key={r.id} i={i} row={r} active={r.id === activeId} picked={picked.has(r.id)} pending={pending} onToggle={toggle} onStage={setStage} />)}
            </tbody>
          </table>
        </div>
      )}

      <nav className="rb-pager" aria-label="Pagine">
        <span>{pager.total ? <><b>{pager.from}–{pager.to}</b> di {pager.total.toLocaleString("it-IT")}</> : "0 contatti"}</span>
        <span className="rb-pager-btns">
          {pager.prev ? <Link className="rb-icon-btn" href={pager.prev as Route} scroll={false} aria-label="Pagina precedente">‹</Link> : <span className="rb-icon-btn" aria-disabled="true">‹</span>}
          {pager.next ? <Link className="rb-icon-btn" href={pager.next as Route} scroll={false} aria-label="Pagina successiva">›</Link> : <span className="rb-icon-btn" aria-disabled="true">›</span>}
        </span>
      </nav>

      {picked.size ? (
        <div className="rb-floatbar" role="toolbar" aria-label="Azioni sui selezionati">
          <span className="rb-floatbar-n"><b>{picked.size}</b> {picked.size === 1 ? "selezionato" : "selezionati"}</span>
          {chosen.length === 1 && chosen[0]?.mailHref
            ? <Link className="rb-btn rb-btn-quiet" href={chosen[0].mailHref as Route}><CrmIcon d={MAIL} /><span>Invia email</span></Link>
            : <button type="button" className="rb-btn rb-btn-quiet" disabled title={mailTitle}><CrmIcon d={MAIL} /><span>Invia email</span></button>}
          <BulkMenu label="Assegna" icon={USER} disabled={pending}>
            {(menu) => (
              <form onSubmit={(e) => { e.preventDefault(); const owner = String(new FormData(e.currentTarget).get("owner")); run({ kind: "owner", owner: owner || null }, menu); }}>
                <label className="rb-field"><span>Responsabile</span>
                  <select name="owner" defaultValue=""><option value="">Non assegnato</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                </label>
                <button className="rb-cta rb-cta-sm">Applica a {picked.size}</button>
              </form>
            )}
          </BulkMenu>
          <BulkMenu label="Pianifica" icon={CAL} disabled={pending}>
            {(menu) => (
              <form onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); run({ kind: "followup", at: String(form.get("at")), text: String(form.get("text") ?? "") || null }, menu); }}>
                <label className="rb-field"><span>Entro il</span><input type="date" name="at" required defaultValue={addDays(today, 1)} min={today} /></label>
                <label className="rb-field"><span>Cosa fare</span><input name="text" maxLength={300} placeholder="Ricontattare" /></label>
                <button className="rb-cta rb-cta-sm">Applica a {picked.size}</button>
              </form>
            )}
          </BulkMenu>
          <BulkMenu label="Cambia fase" icon={MOVE} disabled={pending}>
            {(menu) => (
              <form onSubmit={(e) => { e.preventDefault(); run({ kind: "stage", stage: String(new FormData(e.currentTarget).get("stage")) }, menu); }}>
                <label className="rb-field"><span>Nuova fase</span>
                  <select name="stage" defaultValue="contattato">{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
                </label>
                <button className="rb-cta rb-cta-sm">Applica a {picked.size}</button>
              </form>
            )}
          </BulkMenu>
          <button type="button" className="rb-icon-btn rb-floatbar-x" aria-label="Chiudi la selezione" onClick={() => setPicked(new Set())}>×</button>
        </div>
      ) : null}
      <div className="rb-live" aria-live="polite">
        {pending ? <p className="rb-note">Aggiorno i contatti…</p> : msg.error ? <p className="rb-note" data-tone="error" role="alert">{msg.error}</p> : msg.ok ? <p className="rb-note" data-tone="ok">{msg.ok}</p> : null}
      </div>
    </div>
  );
}

type LineProps = { i: number; row: BoardRow; active: boolean; picked: boolean; pending: boolean; onToggle: (id: string) => void; onStage: (row: BoardRow, stage: Stage, menu: HTMLDetailsElement | null) => void };

const rowStyle = (i: number) => ({ ["--i" as string]: Math.min(i, 14) });

const Person = memo(function Person({ i, row, active, picked, pending, onToggle, onStage }: LineProps) {
  return (
    <tr data-active={active ? "" : undefined} data-picked={picked ? "" : undefined} style={rowStyle(i)}>
      <td className="rb-c-check"><label className="rb-cb"><input type="checkbox" aria-label={`Seleziona ${row.name}`} checked={picked} onChange={() => onToggle(row.id)} /><span aria-hidden="true" /></label></td>
      <td className="rb-c-name">
        <Link href={row.href as Route} scroll={false} data-row-link={row.id} className="rb-person">
          <ToneAvatar letters={row.letters} tone={row.tone} />
          <span className="rb-person-text">
            <span className="rb-person-name">{row.name}</span>
            <Sub row={row} />
          </span>
        </Link>
      </td>
      <td className="rb-c-stage"><StagePill row={row} pending={pending} onPick={onStage} /></td>
      <td className="rb-c-score"><ScoreMeter score={row.score} /></td>
      <td className="rb-c-city">{row.city ? <span className="rb-city">{row.city}</span> : <span className="rb-nil">—</span>}</td>
      <td className="rb-c-owner"><Owner row={row} /></td>
      <td className="rb-c-next"><NextBit row={row} /></td>
      <td className="rb-c-upd"><span className="rb-upd">{row.updated}</span></td>
    </tr>
  );
});

const Card = memo(function Card({ i, row, active, picked, pending, onToggle, onStage }: LineProps) {
  return (
    <li className="rb-card" data-stage={row.stage} data-active={active ? "" : undefined} data-picked={picked ? "" : undefined} style={rowStyle(i)}>
      <div className="rb-card-top">
        <Link href={row.href as Route} scroll={false} data-row-link={row.id} className="rb-person">
          <ToneAvatar letters={row.letters} tone={row.tone} size="lg" />
          <span className="rb-person-text">
            <span className="rb-person-name">{row.name}</span>
            <Sub row={row} />
          </span>
        </Link>
        <label className="rb-cb"><input type="checkbox" aria-label={`Seleziona ${row.name}`} checked={picked} onChange={() => onToggle(row.id)} /><span aria-hidden="true" /></label>
      </div>
      <div className="rb-card-mid">
        <StagePill row={row} pending={pending} onPick={onStage} />
        <ScoreMeter score={row.score} compact />
      </div>
      <dl className="rb-card-meta">
        <div><dt>Città</dt><dd>{row.city ? <><CrmIcon d={PIN} />{row.city}</> : <span className="rb-nil">—</span>}</dd></div>
        <div><dt>Responsabile</dt><dd><Owner row={row} /></dd></div>
      </dl>
      <div className="rb-card-next"><NextBit row={row} /></div>
    </li>
  );
});

function Sub({ row }: { row: BoardRow }) {
  const bits = [row.category, row.person].filter(Boolean) as string[];
  if (!bits.length) return null;
  return <span className="rb-person-sub">{bits.join(" · ")}</span>;
}

function Owner({ row }: { row: BoardRow }) {
  if (!row.owner) return <span className="rb-nil">Nessuno</span>;
  return (
    <span className="rb-owner" data-inactive={row.owner.active ? undefined : ""} title={row.owner.active ? row.owner.name : `${row.owner.name} non è più nel team`}>
      <ToneAvatar letters={row.owner.letters} tone={row.owner.tone} size="sm" />
      <span>{row.owner.name.split(/\s+/)[0]}</span>
    </span>
  );
}

function Sortable({ label, head, cls }: { label: string; head: SortHead; cls?: string }) {
  return (
    <th className={cls} aria-sort={head.dir ? (head.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link className="rb-th" data-on={head.dir ? "" : undefined} href={head.href as Route} scroll={false}>{label}<span aria-hidden="true">{head.dir === "asc" ? "↑" : head.dir === "desc" ? "↓" : "↕"}</span></Link>
    </th>
  );
}

function NextBit({ row }: { row: BoardRow }) {
  if (!row.next) {
    return <Link className="rb-plan" href={row.planHref as Route} title="Pianifica la prossima azione"><CrmIcon d={PLUS} />Pianifica</Link>;
  }
  return (
    <span className="rb-next">
      <DueChip label={row.next.relative} overdue={row.next.overdue} today={row.next.today} />
      <span className="rb-next-title">{row.next.title}</span>
    </span>
  );
}

function StagePill({ row, pending, onPick }: { row: BoardRow; pending: boolean; onPick: (row: BoardRow, stage: Stage, menu: HTMLDetailsElement | null) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="rb-stage-menu">
      <summary aria-label={`Fase: ${STAGE_LABEL[row.stage]}. Cambia fase`}><StageBadge stage={row.stage} label={STAGE_LABEL[row.stage]}><CrmIcon d={CHEVRON} /></StageBadge></summary>
      <div className="rb-menu" role="menu">
        {STAGES.map((stage) => (
          <button type="button" key={stage} role="menuitem" data-stage={stage} aria-current={stage === row.stage ? "true" : undefined} disabled={pending || stage === row.stage} onClick={() => onPick(row, stage, ref.current)}>
            <i aria-hidden="true" />{STAGE_LABEL[stage]}
          </button>
        ))}
      </div>
    </details>
  );
}

function BulkMenu({ label, icon, disabled, children }: { label: string; icon: string; disabled: boolean; children: (menu: RefObject<HTMLDetailsElement | null>) => ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  if (disabled) return <button type="button" className="rb-btn rb-btn-quiet" disabled><CrmIcon d={icon} /><span>{label}</span></button>;
  return (
    <details ref={ref} className="rb-pop rb-pop-up">
      <summary className="rb-btn rb-btn-quiet"><CrmIcon d={icon} /><span>{label}</span></summary>
      <div className="rb-pop-panel">{children(ref)}</div>
    </details>
  );
}
