"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { moveOpportunityAction } from "@/app/admin/crm-opportunity-actions";
import { STAGES, STAGE_HINT, STAGE_LABEL, type Stage } from "@/lib/crm-core";

export type DealCard = {
  id: string; version: number; contactId: string; name: string; title: string; city: string | null;
  value: string; valueEur: number | null; score: number | null; stage: Stage; href: string; active: boolean; priority: string | null;
};

const level = (s: number) => (s >= 70 ? "alto" : s >= 40 ? "medio" : "basso");
const eurSum = (list: DealCard[]) => {
  const n = list.reduce((sum, c) => sum + (c.valueEur ?? 0), 0);
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
};

/**
 * Opportunity board. Drag with a mouse, drag with a finger, or the «Sposta in» select and the arrow keys.
 * A move changes the deal only. The version on the card is sent to the server, so a stale card does not overwrite.
 */
export function OpportunityBoard({ cards: initial, showLost, expandLost, addHref, vista }: {
  cards: DealCard[]; showLost: boolean; expandLost: string; addHref: Record<Stage, string>; vista: "kanban" | "lista";
}) {
  const router = useRouter();
  const signature = initial.map((c) => `${c.id}:${c.version}:${c.stage}`).join("|");
  const [seen, setSeen] = useState(signature);
  const [cards, setCards] = useState(initial);
  if (seen !== signature) {
    setSeen(signature);
    setCards(initial);
  }
  const [over, setOver] = useState<Stage | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [ask, setAsk] = useState<{ card: DealCard; stage: Stage } | null>(null);
  const [hand, setHand] = useState(false);
  const [, start] = useTransition();
  const touch = useRef<{ id: string; pointerId: number; moved: boolean; x: number; y: number } | null>(null);

  function move(card: DealCard, stage: Stage) {
    if (card.stage === stage) return;
    const previous = card;
    setCards((cs) => cs.map((c) => c.id === card.id ? { ...c, stage, version: c.version + 1 } : c));
    start(async () => {
      const r = await moveOpportunityAction(card.id, stage, previous.version).catch(() => ({ error: "Spostamento non riuscito. Riprova." }));
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

  function request(card: DealCard, stage: Stage) {
    if (card.stage === stage) return;
    if (stage === "vinto" || stage === "perso") setAsk({ card, stage });
    else move(card, stage);
  }

  const shift = (card: DealCard, dir: -1 | 1) => {
    const next = STAGES[STAGES.indexOf(card.stage) + dir];
    if (next) request(card, next);
  };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)");
    const sync = () => setHand(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(t);
  }, [message]);

  return (
    <>
      {message ? <p className="crm-pipe-toast" data-ok={message.ok ? "1" : undefined} role="status">{message.text}</p> : null}
      {ask ? (
        <div className="crm-pipe-confirm" role="alertdialog" aria-labelledby="crm-pipe-confirm-title">
          <p id="crm-pipe-confirm-title">{ask.stage === "perso" ? `Segnare «${ask.card.name}» come perso?` : `Segnare «${ask.card.name}» come vinto?`}</p>
          <p className="adm-muted">Cambia solo la fase della trattativa.</p>
          <div>
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => setAsk(null)}>Annulla</button>
            <button type="button" className="adm-btn adm-btn-sm adm-btn-primary" onClick={() => { const next = ask; setAsk(null); move(next.card, next.stage); }}>Conferma</button>
          </div>
        </div>
      ) : null}
      {vista === "lista" ? (
        <div className="crm-import-scroll">
          <table className="adm-table crm-deal-table">
            <caption className="adm-sr">Opportunità, la fase è della trattativa</caption>
            <thead><tr><th>Azienda</th><th>Trattativa</th><th>Fase</th><th>Valore</th><th>Priorità</th></tr></thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} data-active={c.active || undefined}>
                  <td><Link href={c.href as Route} data-row-link={c.contactId}>{c.name}</Link>{c.city ? <span className="adm-muted"> · {c.city}</span> : null}</td>
                  <td>{c.title}</td>
                  <td>
                    <select className="adm-input" aria-label={`Sposta ${c.name} in`} value={c.stage} onChange={(e) => request(c, e.target.value as Stage)}>
                      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td>{c.value || "n/d"}</td>
                  <td>{c.priority ?? "n/d"}</td>
                </tr>
              ))}
              {!cards.length ? <tr><td colSpan={5}>Nessuna opportunità con questi filtri.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
      {vista === "kanban" ? <div className="crm-board">
        {STAGES.map((stage) => {
          const list = cards.filter((c) => c.stage === stage);
          if (stage === "perso" && !showLost) {
            return (
              <section key={stage} className="crm-col is-collapsed" data-stage={stage} data-over={over === stage || undefined} aria-label={STAGE_LABEL[stage]}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== stage) setOver(stage); }}
                onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); const card = cards.find((c) => c.id === id); if (card) request(card, stage); }}>
                <header className="crm-col-head"><h2>{STAGE_LABEL[stage]} <span className="crm-pipe-count">{list.length}</span></h2></header>
                <p className="adm-muted crm-col-sub">{STAGE_HINT[stage]}</p>
                <Link className="adm-btn adm-btn-sm" href={expandLost as Route}>Mostra</Link>
              </section>
            );
          }
          return (
            <section key={stage} className="crm-col" data-stage={stage} data-over={over === stage || undefined} aria-label={`${STAGE_LABEL[stage]}, ${STAGE_HINT[stage]}`}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== stage) setOver(stage); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); const card = cards.find((c) => c.id === id); if (card) request(card, stage); }}>
              <header className="crm-col-head"><h2>{STAGE_LABEL[stage]} <span className="crm-pipe-count">{list.length}</span></h2><span className="crm-col-sum" title="Somma dei valori delle trattative in colonna">{eurSum(list)}</span></header>
              <p className="adm-muted crm-col-sub">{STAGE_HINT[stage]}</p>
              <ul className="crm-cards">
                {list.map((c) => (
                  <li key={c.id} className="crm-card" data-active={c.active || undefined} draggable={!hand} tabIndex={0}
                    aria-keyshortcuts="ArrowLeft ArrowRight"
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "ArrowRight") { e.preventDefault(); shift(c, 1); }
                      if (e.key === "ArrowLeft") { e.preventDefault(); shift(c, -1); }
                    }}
                    onDragStart={(e) => { if (hand) { e.preventDefault(); return; } e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => setOver(null)}
                    onPointerDown={(e) => {
                      if (hand || e.pointerType === "mouse" || (e.target as HTMLElement).closest("a,select,button")) return;
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
                      if (target && card && !hand) request(card, target);
                    }}
                    onPointerCancel={(e) => { touch.current = null; delete e.currentTarget.dataset.dragging; setOver(null); }}>
                    <div className="crm-card-head">
                      <Link href={c.href as Route} data-row-link={c.contactId}>{c.name}</Link>
                      {c.score !== null ? <span className="adm-badge crm-score" data-level={level(c.score)} title="Punteggio del contatto, non della trattativa">{c.score}</span> : null}
                    </div>
                    {c.title !== c.name ? <p>{c.title}</p> : null}
                    <p className="crm-card-meta"><span className="adm-muted">{[c.city, c.value].filter(Boolean).join(" · ") || "\u00a0"}</span><span className="crm-stage" data-stage={c.stage}>{STAGE_LABEL[c.stage]}</span></p>
                    <label className="crm-move">
                      <select className="adm-input" aria-label={`Sposta ${c.name} in`} value={c.stage} onChange={(e) => request(c, e.target.value as Stage)}>
                        {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
              <Link className="crm-col-add" href={addHref[stage] as Route}>+ Aggiungi opportunità</Link>
            </section>
          );
        })}
      </div> : null}
    </>
  );
}
