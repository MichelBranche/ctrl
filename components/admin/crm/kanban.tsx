"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { moveStageAction } from "@/app/admin/crm-actions";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/crm-core";

export type Card = { id: string; name: string; city: string | null; value: string; nextAction: string | null; nextDate: string | null; overdue: boolean; score: number | null; stage: Stage };

const level = (s: number) => (s >= 70 ? "alto" : s >= 40 ? "medio" : "basso");

/**
 * Pipeline board. Mouse: native HTML5 drag and drop. Touch/pen: pointer fallback (drag the card, the column under the finger gets the drop).
 * Each card also has a "Sposta in" select for keyboard users. Moves are optimistic and roll back on error.
 */
export function Kanban({ cards: initial }: { cards: Card[] }) {
  const [cards, setCards] = useState(initial);
  const [over, setOver] = useState<Stage | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();
  const touch = useRef<{ id: string; pointerId: number; moved: boolean; x: number; y: number } | null>(null);

  function move(id: string, stage: Stage) {
    const before = cards.find((c) => c.id === id);
    if (!before || before.stage === stage) return;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage } : c)));
    start(async () => {
      const r = await moveStageAction(id, stage).catch(() => ({ error: "Spostamento non riuscito. Riprova." }));
      if ("error" in r && r.error) {
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage: before.stage } : c)));
        setMessage({ ok: false, text: r.error });
      } else setMessage({ ok: true, text: `${before.name}: ${STAGE_LABEL[stage]}` });
    });
  }

  const columnAt = (x: number, y: number): Stage | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-stage]");
    const s = el?.dataset.stage;
    return s && (STAGES as readonly string[]).includes(s) ? (s as Stage) : null;
  };

  return (
    <>
      <p className="crm-live" role="status" aria-live="polite">{message ? <span className={message.ok ? "adm-ok" : "adm-error"}>{message.text}</span> : null}</p>
      <div className="crm-board">
        {STAGES.map((stage) => {
          const list = cards.filter((c) => c.stage === stage);
          return (
            <section key={stage} className="crm-col" data-stage={stage} data-over={over === stage || undefined} aria-label={STAGE_LABEL[stage]}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== stage) setOver(stage); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, stage); }}>
              <header className="crm-col-head"><h2>{STAGE_LABEL[stage]}</h2><span className="adm-muted">{list.length}</span></header>
              <ul className="crm-cards">
                {list.map((c) => (
                  <li key={c.id} className="crm-card" draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => setOver(null)}
                    onPointerDown={(e) => {
                      if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("a,select,button")) return;
                      touch.current = { id: c.id, pointerId: e.pointerId, moved: false, x: e.clientX, y: e.clientY };
                    }}
                    onPointerMove={(e) => {
                      const t = touch.current;
                      if (!t || t.pointerId !== e.pointerId) return;
                      if (!t.moved && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 12) return;
                      if (!t.moved) { t.moved = true; e.currentTarget.setPointerCapture(e.pointerId); }
                      e.currentTarget.dataset.dragging = "1";
                      setOver(columnAt(e.clientX, e.clientY));
                    }}
                    onPointerUp={(e) => {
                      const t = touch.current;
                      touch.current = null;
                      delete e.currentTarget.dataset.dragging;
                      if (!t?.moved) return;
                      const target = columnAt(e.clientX, e.clientY);
                      setOver(null);
                      if (target) move(t.id, target);
                    }}
                    onPointerCancel={(e) => { touch.current = null; delete e.currentTarget.dataset.dragging; setOver(null); }}>
                    <div className="crm-card-head">
                      <Link href={`/admin/crm/${c.id}` as Route}>{c.name}</Link>
                      {c.score !== null ? <span className="adm-badge crm-score" data-level={level(c.score)} title={`Punteggio ${c.score} su 100`}>{c.score}</span> : null}
                    </div>
                    <p className="adm-muted">{[c.city, c.value].filter(Boolean).join(" · ") || "\u00a0"}</p>
                    {c.nextAction || c.nextDate ? <p className={c.overdue ? "crm-next adm-error" : "crm-next"}>{c.nextAction ?? "Prossima azione"}{c.nextDate ? ` · ${c.nextDate}` : ""}</p> : null}
                    <label className="crm-move">
                      <select className="adm-input" aria-label={`Sposta ${c.name} in`} value={c.stage} onChange={(e) => move(c.id, e.target.value as Stage)}>
                        {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
