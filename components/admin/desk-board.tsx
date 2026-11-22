"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { changeDeskItem } from "@/app/admin/desk-actions";
import { useAdminLocale } from "@/components/admin/locale-provider";
import { DeskAction, DeskForm } from "@/components/admin/desk-controls";
import { PopDismiss } from "@/components/admin/crm/rubrica-tools";
import { StageBadge, DueChip } from "@/components/ds/status";
import { formatAdminDate, interpolate } from "@/lib/admin-i18n";
import type { MailStatus } from "@/lib/mail/workflow-types";
import { SEGS, DUES, PRIOS, type Seg, type Due, type Prio, type DeskQuery } from "@/lib/desk-query";

export type DeskRow =
  | { kind: "task"; id: string; title: string; body: string; due: string | null; done: boolean }
  | { kind: "note"; id: string; title: string; body: string; done: boolean; pinned: boolean }
  | { kind: "mail"; id: string; title: string; sender: string; status: MailStatus; statusLabel: string; href: string }
  | { kind: "crm"; id: string; title: string; next: string; due: string; stage: string; stageLabel: string; owner: string | null; href: string };

const SEG_KIND: Record<Exclude<Seg, "tutto">, DeskRow["kind"]> = { attivita: "task", email: "mail", crm: "crm", note: "note" };

const ICON = {
  task: "M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9",
  note: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  crm: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
};
const SEARCH = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3";
const FUNNEL = "M3 5h18l-7 8v6l-4 2v-8z";
const CHECK = "M5 12l5 5L20 7";
const UNDO = "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3";
const ARCHIVE = "M3 4h18v4H3zM5 8v12h14V8M10 12h4";
const PIN = "M12 17v5M8 3h8l-1 7 3 3H6l3-3z";
const EDIT = "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z";
const ARROW = "M7 17L17 7M8 7h9v9";
const X = "M18 6L6 18M6 6l12 12";

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}
function dueOf(row: DeskRow): string | null {
  return row.kind === "task" ? row.due : row.kind === "crm" ? row.due : null;
}
function isDone(row: DeskRow) {
  return row.kind === "mail" ? row.status === "done" : row.kind === "crm" ? false : row.done;
}
/** No priority column exists: priority is derived from the due date, so it never disagrees with it. */
function prioOf(row: DeskRow, today: string): Exclude<Prio, ""> | null {
  if (row.kind !== "task" && row.kind !== "crm") return null;
  const due = dueOf(row);
  if (!due) return "bassa";
  const d = daysBetween(today, due);
  return d <= 0 ? "alta" : d <= 3 ? "media" : "bassa";
}
function dueBucket(row: DeskRow, today: string): Exclude<Due, ""> | null {
  if (row.kind !== "task" && row.kind !== "crm") return null;
  const due = dueOf(row);
  if (!due) return "senza";
  const d = daysBetween(today, due);
  return d < 0 ? "ritardo" : d === 0 ? "oggi" : d <= 7 ? "settimana" : null;
}

export function DeskBoard({ rows, today, emailAccess, crmAccess, initial }: { rows: DeskRow[]; today: string; emailAccess: boolean; crmAccess: boolean; initial: DeskQuery }) {
  const { t, lang } = useAdminLocale();
  const router = useRouter();
  const [state, setState] = useState<DeskQuery>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const put = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
    put("seg", state.seg === "tutto" ? "" : state.seg);
    put("q", state.q.trim());
    put("scadenza", state.due);
    put("priorita", state.prio);
    put("fatte", state.done ? "1" : "");
    const s = p.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  }, [state]);

  const set = (patch: Partial<typeof state>) => { setState((s) => ({ ...s, ...patch })); setSelected(new Set()); };
  const segs = SEGS.filter((s) => s !== "email" || emailAccess).filter((s) => s !== "crm" || crmAccess);
  const segLabel: Record<Seg, string> = { tutto: t.desk.segAll, attivita: t.desk.segTasks, email: t.desk.segMail, crm: t.desk.segCrm, note: t.desk.segNotes };
  const dueLabelOf: Record<Exclude<Due, "">, string> = { ritardo: t.desk.dueLate, oggi: t.desk.today, settimana: t.desk.dueWeek, senza: t.desk.dueNone };
  const prioLabel: Record<Exclude<Prio, "">, string> = { alta: t.desk.prioHigh, media: t.desk.prioMid, bassa: t.desk.prioLow };

  const live = useMemo(() => rows.filter((r) => state.done || !isDone(r)), [rows, state.done]);
  const counts = useMemo(() => {
    const c: Record<Seg, number> = { tutto: live.length, attivita: 0, email: 0, crm: 0, note: 0 };
    for (const r of live) for (const [s, k] of Object.entries(SEG_KIND)) if (r.kind === k) c[s as Seg] += 1;
    return c;
  }, [live]);
  const strip = useMemo(() => {
    const c: Record<Exclude<Due, "">, number> = { ritardo: 0, oggi: 0, settimana: 0, senza: 0 };
    for (const r of rows) {
      if (isDone(r)) continue;
      const b = dueBucket(r, today);
      if (b) c[b] += 1;
    }
    return c;
  }, [rows, today]);

  const q = state.q.trim().toLocaleLowerCase();
  const visible = live.filter((r) => {
    if (state.seg !== "tutto" && r.kind !== SEG_KIND[state.seg]) return false;
    if (state.due && dueBucket(r, today) !== state.due) return false;
    if (state.prio && prioOf(r, today) !== state.prio) return false;
    if (!q) return true;
    const hay = [r.title, r.kind === "task" || r.kind === "note" ? r.body : "", r.kind === "mail" ? r.sender : "", r.kind === "crm" ? `${r.next} ${r.owner ?? ""}` : ""].join(" ").toLocaleLowerCase();
    return hay.includes(q);
  });
  // Most urgent first: dated tasks and follow-ups by date, then open email, undated tasks, notes (pinned first); done last.
  const rank = (r: DeskRow) => (isDone(r) ? 5 : dueOf(r) ? 0 : r.kind === "mail" ? 1 : r.kind === "task" ? 2 : r.kind === "note" && r.pinned ? 3 : 4);
  visible.sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? String(dueOf(a)).localeCompare(String(dueOf(b))) : 0));
  const selectable = visible.filter((r) => r.kind === "task" || r.kind === "note");
  const picked = selectable.filter((r) => selected.has(r.id));

  const dueText = (due: string) => {
    const d = daysBetween(today, due);
    const date = formatAdminDate(`${due}T12:00:00Z`, lang, { day: "numeric", month: "short" });
    if (d < -1) return interpolate(t.desk.dueDaysAgo, { n: -d });
    if (d === -1) return t.desk.dueYesterday;
    if (d === 0) return t.desk.today;
    if (d === 1) return t.desk.dueTomorrow;
    if (d <= 7) return interpolate(t.desk.dueInDays, { n: d });
    return date;
  };

  const bulk = (op: (r: DeskRow) => string | null) => start(async () => {
    const jobs = picked.flatMap((r) => { const o = op(r); return o ? [{ r, op: o }] : []; });
    let ok = 0;
    for (const j of jobs) {
      try { const res = await changeDeskItem(j.r.id, j.op); if (!res.error) ok += 1; } catch { /* counted as failed */ }
    }
    const fail = jobs.length - ok;
    setNotice(fail ? interpolate(t.desk.bulkPartial, { ok, fail }) : interpolate(t.desk.bulkDone, { n: ok }));
    setSelected(new Set());
    router.refresh();
  });
  const openTasks = picked.filter((r) => r.kind === "task" && !r.done).length;
  const openNotes = picked.filter((r) => r.kind === "note" && !r.done).length;
  const doneTasks = picked.filter((r) => r.kind === "task" && r.done).length;
  const doneNotes = picked.filter((r) => r.kind === "note" && r.done).length;

  const filtersOn = [state.due, state.prio].filter(Boolean).length;
  const chips = [
    ...(state.q.trim() ? [{ key: "q", label: t.desk.chipSearch, value: `“${state.q.trim()}”`, clear: { q: "" } }] : []),
    ...(state.due ? [{ key: "due", label: t.desk.dueFilter, value: dueLabelOf[state.due], clear: { due: "" as Due } }] : []),
    ...(state.prio ? [{ key: "prio", label: t.desk.priority, value: prioLabel[state.prio], clear: { prio: "" as Prio }, prio: state.prio }] : []),
  ];
  const stripTotal = DUES.reduce((n, k) => n + strip[k], 0);
  const allPicked = selectable.length > 0 && picked.length === selectable.length;

  return (
    <>
      <section className="dk-strip" aria-label={t.desk.dueStrip}>
        <div className="dk-strip-bar" aria-hidden="true">
          {DUES.map((k) => strip[k] ? <i key={k} data-due={k} style={{ flexGrow: strip[k] }} /> : null)}
          {stripTotal === 0 ? <i data-due="empty" /> : null}
        </div>
        <div className="dk-strip-tiles">
          {DUES.map((k) => (
            <button key={k} type="button" className="dk-tile" data-due={k} aria-pressed={state.due === k} onClick={() => set({ due: state.due === k ? "" : k })}>
              <span className="dk-tile-label"><i aria-hidden="true" />{dueLabelOf[k]}</span>
              <strong>{strip[k]}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="dk-list-card">
        <div className="rb-toolbar">
          <PopDismiss />
          <div className="rb-toolbar-top">
            <nav className="rb-segs" aria-label={t.desk.segments}>
              {segs.map((s) => (
                <button key={s} type="button" aria-current={state.seg === s ? "page" : undefined} onClick={() => set({ seg: s })}>
                  {segLabel[s]}<span>{counts[s]}</span>
                </button>
              ))}
            </nav>
            <div className="rb-toolbar-end dk-links">
              {emailAccess ? <Link className="rb-btn rb-btn-quiet" href="/admin/email">{t.desk.openInbox}<Icon d={ARROW} size={14} /></Link> : null}
              {crmAccess ? <Link className="rb-btn rb-btn-quiet" href={"/admin/crm/pipeline" as Route}>{t.desk.openPipeline}<Icon d={ARROW} size={14} /></Link> : null}
            </div>
          </div>
          <form className="rb-filters" role="search" aria-label={t.desk.search} onSubmit={(e) => e.preventDefault()}>
            <label className="rb-search">
              <Icon d={SEARCH} />
              <span className="adm-sr">{t.desk.search}</span>
              <input name="q" value={state.q} onChange={(e) => set({ q: e.target.value })} placeholder={t.desk.searchPlaceholder} autoComplete="off" type="search" />
            </label>
            <details className="rb-pop rb-filter-pop">
              <summary className="rb-btn" data-on={filtersOn ? "" : undefined}><Icon d={FUNNEL} /><span>{t.desk.filters}</span>{filtersOn ? <span className="rb-badge">{filtersOn}</span> : null}</summary>
              <div className="rb-pop-panel">
                <p className="rb-pop-title">{t.desk.filtersTitle}</p>
                <div className="rb-pop-grid">
                  <label className="rb-field"><span>{t.desk.dueFilter}</span>
                    <select value={state.due} onChange={(e) => set({ due: e.target.value as Due })}>
                      <option value="">{t.desk.dueAll}</option>{DUES.map((k) => <option key={k} value={k}>{dueLabelOf[k]}</option>)}
                    </select>
                  </label>
                  <label className="rb-field"><span>{t.desk.priority}</span>
                    <select value={state.prio} onChange={(e) => set({ prio: e.target.value as Prio })}>
                      <option value="">{t.desk.prioAll}</option>{PRIOS.map((k) => <option key={k} value={k}>{prioLabel[k]}</option>)}
                    </select>
                  </label>
                </div>
                <p className="rb-pop-empty">{t.desk.prioHint}</p>
                <label className="rb-switch"><input type="checkbox" checked={state.done} onChange={(e) => set({ done: e.target.checked })} /><span aria-hidden="true" />{t.desk.showDone}</label>
              </div>
            </details>
            <label className="rb-switch dk-done-switch"><input type="checkbox" checked={state.done} onChange={(e) => set({ done: e.target.checked })} /><span aria-hidden="true" />{t.desk.showDone}</label>
          </form>
          {chips.length ? (
            <div className="rb-chips">
              {chips.map((c) => (
                <button key={c.key} type="button" className="rb-chip" data-prio={"prio" in c ? c.prio : undefined} onClick={() => set(c.clear)} aria-label={interpolate(t.desk.removeFilter, { label: c.label })}>
                  <span>{c.label}</span><b>{c.value}</b><Icon d={X} size={13} />
                </button>
              ))}
              {chips.length > 1 ? <button type="button" className="rb-chip-clear" onClick={() => set({ q: "", due: "", prio: "" })}>{t.desk.clearAll}</button> : null}
            </div>
          ) : null}
        </div>

        {selectable.length ? (
          <div className="dk-list-head">
            <label className="rb-cb"><input type="checkbox" checked={allPicked} onChange={() => setSelected(allPicked ? new Set() : new Set(selectable.map((r) => r.id)))} aria-label={t.desk.selectAll} /><span aria-hidden="true" /></label>
            <span>{t.desk.selectAll}</span>
          </div>
        ) : null}

        {visible.length ? (
          <ul className="dk-rows">
            {visible.map((r, i) => {
              const due = dueOf(r);
              const done = isDone(r);
              const prio = prioOf(r, today);
              const d = due ? daysBetween(today, due) : null;
              const canPick = r.kind === "task" || r.kind === "note";
              return (
                <li key={`${r.kind}:${r.id}`} className="dk-row" data-kind={r.kind} data-done={done || undefined} data-picked={selected.has(r.id) || undefined} style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}>
                  <div className="dk-row-main">
                    <span className="dk-pick">
                      {canPick ? (
                        <label className="rb-cb"><input type="checkbox" checked={selected.has(r.id)} onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} aria-label={interpolate(t.desk.selectRow, { title: r.title })} /><span aria-hidden="true" /></label>
                      ) : null}
                    </span>
                    <span className="dk-kind" data-kind={r.kind} title={{ task: t.desk.kindTask, note: t.desk.kindNote, mail: t.desk.kindMail, crm: t.desk.kindCrm }[r.kind]}><Icon d={ICON[r.kind]} /></span>
                    <div className="dk-text">
                      {r.kind === "mail" || r.kind === "crm"
                        ? <Link className="dk-title" href={r.href as Route}>{r.title}</Link>
                        : <strong className="dk-title">{r.kind === "note" && r.pinned ? <span className="dk-pin" title={t.desk.pinned}><Icon d={PIN} size={13} /></span> : null}{r.title}</strong>}
                      <span className="dk-sub">
                        {r.kind === "mail" ? r.sender : r.kind === "crm" ? `${r.next}${r.owner ? ` · ${r.owner}` : ""}` : r.body || (r.kind === "task" ? t.desk.kindTask : t.desk.kindNote)}
                      </span>
                    </div>
                    <div className="dk-meta">
                      {r.kind === "crm" ? <StageBadge stage={r.stage} label={r.stageLabel} /> : null}
                      {r.kind === "mail" ? <span className="dk-mail" data-status={r.status}><i aria-hidden="true" />{r.statusLabel}</span> : null}
                      {prio && !done ? <span className="dk-prio" data-prio={prio} title={t.desk.prioHint}><Bars level={prio} />{prioLabel[prio]}</span> : null}
                      {due && !done ? <DueChip label={dueText(due)} overdue={(d ?? 0) < 0} today={d === 0} /> : null}
                      {due && done ? <span className="dk-date">{formatAdminDate(`${due}T12:00:00Z`, lang, { day: "numeric", month: "short" })}</span> : null}
                    </div>
                    <div className="dk-actions">
                      {r.kind === "task" ? (
                        <DeskAction id={r.id} operation={r.done ? "reopen" : "done"} icon={<Icon d={r.done ? UNDO : CHECK} size={15} />} quiet={r.done}>
                          <span className="dk-act-label">{r.done ? t.desk.reopen : t.desk.complete}</span>
                        </DeskAction>
                      ) : null}
                      {r.kind === "note" && !r.done ? (
                        <DeskAction id={r.id} operation={r.pinned ? "unpin" : "pin"} quiet icon={<Icon d={PIN} size={15} />} label={r.pinned ? t.desk.unpin : t.desk.pin}>{null}</DeskAction>
                      ) : null}
                      {r.kind === "note" ? (
                        <DeskAction id={r.id} operation={r.done ? "restore" : "archive"} quiet={r.done} icon={<Icon d={r.done ? UNDO : ARCHIVE} size={15} />}>
                          <span className="dk-act-label">{r.done ? t.desk.restore : t.desk.archive}</span>
                        </DeskAction>
                      ) : null}
                      {r.kind === "mail" || r.kind === "crm" ? (
                        <Link className="rb-btn rb-btn-quiet dk-act" href={r.href as Route}><span className="dk-act-label">{t.desk.openItem}</span><Icon d={ARROW} size={14} /></Link>
                      ) : null}
                      {canPick ? (
                        <details className="dk-edit">
                          <summary className="rb-btn rb-btn-quiet dk-act" aria-label={t.desk.edit} title={t.desk.edit}><Icon d={EDIT} size={15} /></summary>
                          <div className="dk-edit-panel">
                            <DeskForm kind={r.kind} item={{ id: r.id, title: r.title, body: r.body, due: r.kind === "task" ? r.due ?? "" : "" }} />
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="dk-empty">
            <p>{rows.length ? t.desk.noResults : `${t.desk.tasksEmpty} ${t.desk.notesEmpty}`}</p>
            {chips.length ? <button type="button" className="rb-btn" onClick={() => set({ q: "", due: "", prio: "" })}>{t.desk.clearAll}</button> : null}
          </div>
        )}
        {!emailAccess ? <p className="dk-foot">{t.desk.noEmailAccess}</p> : null}
        <p className="dk-foot" role="status">{notice}</p>
      </section>

      {picked.length ? (
        <div className="rb-floatbar dk-floatbar" role="region" aria-label={t.desk.selection}>
          <span className="rb-floatbar-n">{picked.length === 1 ? t.desk.selected1 : interpolate(t.desk.selectedN, { n: picked.length })}</span>
          {openTasks ? <button type="button" className="rb-cta rb-cta-sm" disabled={pending} onClick={() => bulk((r) => (r.kind === "task" && !r.done ? "done" : null))}><Icon d={CHECK} size={15} />{interpolate(t.desk.bulkComplete, { n: openTasks })}</button> : null}
          {openNotes ? <button type="button" className="rb-btn" disabled={pending} onClick={() => bulk((r) => (r.kind === "note" && !r.done ? "archive" : null))}><Icon d={ARCHIVE} size={15} />{interpolate(t.desk.bulkArchive, { n: openNotes })}</button> : null}
          {doneTasks ? <button type="button" className="rb-btn" disabled={pending} onClick={() => bulk((r) => (r.kind === "task" && r.done ? "reopen" : null))}><Icon d={UNDO} size={15} />{interpolate(t.desk.bulkReopen, { n: doneTasks })}</button> : null}
          {doneNotes ? <button type="button" className="rb-btn" disabled={pending} onClick={() => bulk((r) => (r.kind === "note" && r.done ? "restore" : null))}><Icon d={UNDO} size={15} />{interpolate(t.desk.bulkRestore, { n: doneNotes })}</button> : null}
          <button type="button" className="rb-icon-btn rb-floatbar-x" onClick={() => setSelected(new Set())} aria-label={t.desk.bulkClose}><Icon d={X} size={15} /></button>
        </div>
      ) : null}
    </>
  );
}

function Bars({ level }: { level: "alta" | "media" | "bassa" }) {
  const n = level === "alta" ? 3 : level === "media" ? 2 : 1;
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      {[0, 1, 2].map((i) => <rect key={i} x={1 + i * 4} y={8 - i * 3} width="2.4" height={3 + i * 3} rx="0.6" fill="currentColor" opacity={i < n ? 1 : 0.28} />)}
    </svg>
  );
}
