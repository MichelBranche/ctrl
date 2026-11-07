"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { moveStageAction } from "@/app/admin/crm-actions";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/crm-core";

export type ContactCard = {
  id: string; version: number; name: string; city: string | null; stage: Stage; score: number | null;
  href: string; historyHref: string; emailHref: string | null; active: boolean;
  owner: string; touch: string; source: string;
};

const HINT: Record<Stage, string> = {
  nuovo: "Ancora da lavorare",
  contattato: "Fase del contatto: non dice chi ha scritto",
  call: "In conversazione",
  preventivo: "Preventivo sul contatto",
  vinto: "Chiuso vinto",
  perso: "Chiuso perso",
};
const level = (s: number) => (s >= 70 ? "alto" : s >= 40 ? "medio" : "basso");

/**
 * Contact board. A move changes crm_contacts.stage with the version on the card.
 * It does not open an opportunity and it does not invent who sent the email.
 */
export function ContactBoard({ cards: initial, vista }: { cards: ContactCard[]; vista: "kanban" | "lista" }) {
  const router = useRouter();
  const signature = initial.map((c) => `${c.id}:${c.version}:${c.stage}:${c.touch}`).join("|");
  const [seen, setSeen] = useState(signature);
  const [cards, setCards] = useState(initial);
  if (seen !== signature) {
    setSeen(signature);
    setCards(initial);
  }
  const [over, setOver] = useState<Stage | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();
  const touch = useRef<{ id: string; pointerId: number; moved: boolean; x: number; y: number } | null>(null);

  function move(card: ContactCard, stage: Stage) {
    if (card.stage === stage) return;
    const previous = card;
    setCards((cs) => cs.map((c) => c.id === card.id ? { ...c, stage, version: c.version + 1 } : c));
    start(async () => {
      const r = await moveStageAction(card.id, stage, previous.version).catch(() => ({ error: "Spostamento non riuscito. Riprova." }));
      if ("error" in r && r.error) {
        setCards((cs) => cs.map((c) => c.id === card.id ? previous : c));
        setMessage({ ok: false, text: r.error });
      } else {
        setMessage({ ok: true, text: "ok" in r && r.ok ? r.ok : `${card.name}: ${STAGE_LABEL[stage]}` });
        router.refresh();
      }
    });
  }

  const columnAt = (x: number, y: number): Stage | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-stage]");
    const s = el?.dataset.stage;
    return s && (STAGES as readonly string[]).includes(s) ? (s as Stage) : null;
  };
  const shift = (card: ContactCard, dir: -1 | 1) => {
    const next = STAGES[STAGES.indexOf(card.stage) + dir];
    if (next) move(card, next);
  };

  return (
    <>
      <p className="crm-live" role="status" aria-live="polite">{message ? <span className={message.ok ? "adm-ok" : "adm-error"}>{message.text}</span> : null}</p>
      {vista === "lista" ? (
        <div className="crm-import-scroll">
          <table className="adm-table crm-deal-table">
            <caption className="adm-sr">Contatti per fase. Il responsabile non è chi ha inviato l&apos;email.</caption>
            <thead><tr><th>Azienda</th><th>Fase</th><th>Responsabile</th><th>Chi ha contattato</th></tr></thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} data-active={c.active || undefined}>
                  <td><Link href={c.href as Route} data-row-link={c.id}>{c.name}</Link>{c.city ? <span className="adm-muted"> · {c.city}</span> : null}</td>
                  <td>
                    <select className="adm-input" aria-label={`Sposta ${c.name} in`} value={c.stage} onChange={(e) => move(c, e.target.value as Stage)}>
                      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td>{c.owner}</td>
                  <td>{c.touch}</td>
                </tr>
              ))}
              {!cards.length ? <tr><td colSpan={4}>Nessun contatto con questi filtri.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="crm-board">
          {STAGES.map((stage) => {
            const list = cards.filter((c) => c.stage === stage);
            return (
              <section key={stage} className="crm-col" data-stage={stage} data-over={over === stage || undefined} aria-label={`${STAGE_LABEL[stage]}, ${HINT[stage]}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== stage) setOver(stage); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
                onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); const card = cards.find((c) => c.id === id); if (card) move(card, stage); }}>
                <header className="crm-col-head"><h2>{STAGE_LABEL[stage]}</h2><span className="adm-muted">{list.length}</span></header>
                <p className="adm-muted crm-col-sub">{HINT[stage]}</p>
                <ul className="crm-cards">
                  {list.map((c) => (
                    <li key={c.id} className="crm-card" data-active={c.active || undefined} draggable tabIndex={0}
                      aria-keyshortcuts="ArrowLeft ArrowRight"
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "ArrowRight") { e.preventDefault(); shift(c, 1); }
                        if (e.key === "ArrowLeft") { e.preventDefault(); shift(c, -1); }
                      }}
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
                        const card = cards.find((item) => item.id === t.id);
                        if (target && card) move(card, target);
                      }}
                      onPointerCancel={(e) => { touch.current = null; delete e.currentTarget.dataset.dragging; setOver(null); }}>
                      <div className="crm-card-head">
                        <Link href={c.href as Route} data-row-link={c.id}>{c.name}</Link>
                        {c.score !== null ? <span className="adm-badge crm-score" data-level={level(c.score)} title={`Punteggio ${c.score} su 100`}>{c.score}</span> : null}
                      </div>
                      <p className="adm-muted">{[c.city, c.source].filter(Boolean).join(" · ") || "\u00a0"}</p>
                      <p className="crm-card-who"><span>Responsabile</span><strong>{c.owner}</strong></p>
                      <p className="crm-card-who"><span>Chi ha scritto</span><strong>{c.touch}</strong></p>
                      <p className="crm-card-links">
                        <Link href={c.historyHref as Route}>Storico</Link>
                        {c.emailHref ? <Link href={c.emailHref as Route}>Conversazione</Link> : null}
                      </p>
                      <label className="crm-move">
                        <select className="adm-input" aria-label={`Sposta ${c.name} in`} value={c.stage} onChange={(e) => move(c, e.target.value as Stage)}>
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
      )}
    </>
  );
}
