"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { moveStageAction } from "@/app/admin/crm-actions";
import { avatarHue, CrmIcon, eur, initials } from "@/components/admin/crm/crm-ui";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/crm-core";

export type ContactCard = {
  id: string; version: number; name: string; city: string | null; stage: Stage; score: number | null;
  href: string; historyHref: string; emailHref: string | null; active: boolean;
  owner: string; touch: string; source: string;
  /** Shown amount in cents. Null means the card has no figure. */
  valueCents: number | null;
  valueKind: "" | "reale" | "stimato";
};

const HINT: Record<Stage, string> = {
  nuovo: "Ancora da lavorare",
  contattato: "Fase del contatto: non dice chi ha scritto",
  call: "In conversazione",
  preventivo: "Preventivo sul contatto",
  vinto: "Chiuso vinto",
  perso: "Chiuso perso",
};
const PAGE = 12;
const CLOCK = "M12 8v5l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z";
const CHAT = "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z";
const TRAY = "M4 8h16v10H4zM4 8l8 6 8-6";
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** When the last board drag ended: the click that follows a drop must not open the card link. */
let draggedAt = 0;
const money = (cents: number | null) => (cents === null ? "" : eur(cents / 100));

/** Search submits the same form, about 200 ms after the last keystroke. */
export function PipelineSearch({ action, children }: { action: string; children: ReactNode }) {
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const onInput = (e: FormEvent<HTMLFormElement>) => {
    const field = e.target as HTMLInputElement;
    if (field.name !== "q") return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => field.form?.requestSubmit(), 200);
  };
  return <form className="crm-toolbar" action={action} method="get" role="search" onInput={onInput}>{children}</form>;
}

function whoOf(card: ContactCard) {
  const name = card.touch.startsWith("Autore non disponibile") ? "" : (card.touch.split(" · ")[0] ?? "");
  if (name) return { label: "Chi ha scritto", name };
  return { label: "Responsabile", name: card.owner };
}

const columnJump = (event: KeyboardEvent, { currentCoordinates }: { currentCoordinates: { x: number; y: number } }) => {
  const step = 280;
  if (event.code === "ArrowRight") return { ...currentCoordinates, x: currentCoordinates.x + step };
  if (event.code === "ArrowLeft") return { ...currentCoordinates, x: currentCoordinates.x - step };
  if (event.code === "ArrowDown") return { ...currentCoordinates, y: currentCoordinates.y + 72 };
  if (event.code === "ArrowUp") return { ...currentCoordinates, y: currentCoordinates.y - 72 };
  return currentCoordinates;
};

function flip(ids: string[]) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const before = new Map(ids.map((id) => [id, document.querySelector<HTMLElement>(`[data-card="${id}"]`)?.getBoundingClientRect()]));
  requestAnimationFrame(() => {
    for (const id of ids) {
      const node = document.querySelector<HTMLElement>(`[data-card="${id}"]`);
      const from = before.get(id);
      if (!node || !from) continue;
      const to = node.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 250, easing: EASE });
    }
  });
}

/**
 * Contact board. A move changes crm_contacts.stage with the version on the card.
 * It does not open an opportunity and it does not invent who sent the email.
 */
export function ContactBoard({ cards: initial, vista }: { cards: ContactCard[]; vista: "kanban" | "lista" }) {
  const router = useRouter();
  const signature = initial.map((c) => `${c.id}:${c.version}:${c.stage}:${c.touch}:${c.owner}:${c.valueCents ?? ""}:${c.valueKind}`).join("|");
  const [seen, setSeen] = useState(signature);
  const [cards, setCards] = useState(initial);
  if (seen !== signature) {
    setSeen(signature);
    setCards(initial);
  }
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [ask, setAsk] = useState<{ card: ContactCard; stage: Stage } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hand, setHand] = useState(false);
  const [more, setMore] = useState<Partial<Record<Stage, number>>>({});
  const boardRef = useRef<HTMLDivElement>(null);
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnJump }),
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)");
    const sync = () => setHand(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem("ctrl:crm-pipeline-scroll");
    if (saved) el.scrollLeft = Number(saved) || 0;
    const onScroll = () => sessionStorage.setItem("ctrl:crm-pipeline-scroll", String(el.scrollLeft));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [vista]);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(t);
  }, [message]);

  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const commit = useCallback((card: ContactCard, stage: Stage) => {
    if (card.stage === stage) return;
    const previous = card;
    const ids = cardsRef.current.filter((c) => c.stage === card.stage || c.stage === stage).map((c) => c.id);
    flip(ids);
    flushSync(() => setCards((cs) => cs.map((c) => c.id === card.id ? { ...c, stage, version: c.version + 1 } : c)));
    start(async () => {
      const r = await moveStageAction(card.id, stage, previous.version).catch(() => ({ error: "Spostamento non riuscito. Riprova." }));
      if ("error" in r && r.error) {
        flip([card.id]);
        flushSync(() => setCards((cs) => cs.map((c) => c.id === card.id ? previous : c)));
        setMessage({ ok: false, text: r.error });
      } else {
        setMessage({ ok: true, text: "ok" in r && r.ok ? r.ok : `${card.name}: ${STAGE_LABEL[stage]}` });
        router.refresh();
      }
    });
  }, [router]);

  const request = useCallback((card: ContactCard, stage: Stage) => {
    if (card.stage === stage) return;
    if (stage === "vinto" || stage === "perso") setAsk({ card, stage });
    else commit(card, stage);
  }, [commit]);

  const shift = useCallback((card: ContactCard, dir: -1 | 1) => {
    const next = STAGES[STAGES.indexOf(card.stage) + dir];
    if (next) request(card, next);
  }, [request]);
  const bump = useCallback((stage: Stage) => setMore((m) => ({ ...m, [stage]: (m[stage] ?? PAGE) + PAGE })), []);
  const grouped = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((stage) => [stage, [] as ContactCard[]])) as Record<Stage, ContactCard[]>;
    for (const card of cards) map[card.stage].push(card);
    return map;
  }, [cards]);

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));
  const onDragEnd = (event: DragEndEvent) => {
    draggedAt = Date.now();
    setActiveId(null);
    const stage = event.over ? String(event.over.id) : "";
    if (!(STAGES as readonly string[]).includes(stage)) return;
    const card = cards.find((c) => c.id === String(event.active.id));
    if (card) request(card, stage as Stage);
  };
  const active = cards.find((c) => c.id === activeId) ?? null;
  const openId = cards.find((c) => c.active)?.id ?? "";
  useEffect(() => {
    if (!openId) return;
    document.querySelector(`[data-row-link="${CSS.escape(openId)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [openId]);

  const confirm = ask ? (
    <div className="crm-pipe-confirm" role="alertdialog" aria-labelledby="crm-pipe-confirm-title" aria-describedby="crm-pipe-confirm-text">
      <p id="crm-pipe-confirm-title">{ask.stage === "perso" ? `Segnare «${ask.card.name}» come perso?` : `Segnare «${ask.card.name}» come vinto?`}</p>
      <p id="crm-pipe-confirm-text" className="adm-muted">La fase del contatto cambia. Non si apre e non si chiude un'opportunità.</p>
      <div>
        <button type="button" className="adm-btn adm-btn-sm" onClick={() => setAsk(null)}>Annulla</button>
        <button type="button" className="adm-btn adm-btn-sm adm-btn-primary" onClick={() => { const next = ask; setAsk(null); commit(next.card, next.stage); }}>Conferma</button>
      </div>
    </div>
  ) : null;

  const toast = message ? <p className="crm-pipe-toast" data-ok={message.ok ? "1" : undefined} role="status">{message.text}</p> : null;

  if (vista === "lista") {
    return (
      <>
        {toast}
        {confirm}
        <div className="crm-import-scroll">
          <table className="adm-table crm-deal-table">
            <caption className="adm-sr">Contatti per fase. Il responsabile non è chi ha inviato l&apos;email.</caption>
            <thead><tr><th>Azienda</th><th>Fase</th><th>Valore</th><th>Responsabile</th><th>Chi ha scritto</th></tr></thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} data-active={c.active || undefined}>
                  <td><Link href={c.href as Route} data-row-link={c.id}>{c.name}</Link>{c.city ? <span className="adm-muted"> · {c.city}</span> : null}</td>
                  <td>
                    <select className="adm-input" aria-label={`Sposta ${c.name} in`} value={c.stage} onChange={(e) => request(c, e.target.value as Stage)}>
                      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td>{c.valueCents === null ? "" : <>{money(c.valueCents)}{c.valueKind === "stimato" ? <span className="crm-pipe-est"> stimato</span> : null}</>}</td>
                  <td><strong key={c.owner} className="crm-pipe-bit">{c.owner}</strong></td>
                  <td><strong key={c.touch} className="crm-pipe-bit">{c.touch}</strong></td>
                </tr>
              ))}
              {!cards.length ? <tr><td colSpan={5}>Nessun contatto con questi filtri.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      {toast}
      {confirm}
      <DndContext id="crm-contact-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => { draggedAt = Date.now(); setActiveId(null); }}>
        <div className="crm-board" ref={boardRef}>
          {STAGES.map((stage) => (
            <Column key={stage} stage={stage} cards={grouped[stage]} shown={more[stage] ?? PAGE} hand={hand}
              onMore={bump} onMove={request} onShift={shift} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? <CardView card={active} lifted /> : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

const Column = memo(function Column({ stage, cards, shown, hand, onMore, onMove, onShift }: {
  stage: Stage; cards: ContactCard[]; shown: number; hand: boolean;
  onMore: (stage: Stage) => void; onMove: (card: ContactCard, stage: Stage) => void; onShift: (card: ContactCard, dir: -1 | 1) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const visible = cards.slice(0, shown);
  let real = 0, estimated = 0;
  for (const card of cards) {
    if (card.valueCents === null) continue;
    if (card.valueKind === "stimato") estimated += card.valueCents;
    else real += card.valueCents;
  }
  const tip = `Reale ${money(real) || "0 €"}. Stimato ${money(estimated) || "0 €"}.`;
  return (
    <section ref={setNodeRef} className="crm-col" data-stage={stage} data-over={isOver || undefined} aria-label={`${STAGE_LABEL[stage]}, ${HINT[stage]}`}>
      <header className="crm-col-head">
        <h2><span className="crm-stage-dot" data-stage={stage} />{STAGE_LABEL[stage]} <span className="crm-pipe-count">{cards.length}</span></h2>
        <span className="crm-col-sum" title={tip}>{money(real + estimated) || "0 €"}</span>
      </header>
      {cards.length ? (
        <ul className="crm-cards">
          {visible.map((c) => <Card key={c.id} card={c} hand={hand} onMove={onMove} onShift={onShift} />)}
        </ul>
      ) : (
        <p className="crm-col-empty"><CrmIcon d={TRAY} />Trascina qui…</p>
      )}
      {cards.length > visible.length ? <button type="button" className="crm-pipe-more" onClick={() => onMore(stage)}>Mostra altri {Math.min(PAGE, cards.length - visible.length)}</button> : null}
    </section>
  );
});

function Card({ card, hand, onMove, onShift }: {
  card: ContactCard; hand: boolean; onMove: (card: ContactCard, stage: Stage) => void; onShift: (card: ContactCard, dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled: hand });
  // The whole card starts a drag (8 px of movement first, so a click still opens the panel).
  // The grip keeps the keyboard drag (Space, arrows, Space) for screen readers.
  const pointer = hand ? undefined : (listeners?.onPointerDown as ((e: ReactPointerEvent<HTMLLIElement>) => void) | undefined);
  const keyDrag = listeners?.onKeyDown as ((e: ReactKeyboardEvent<HTMLButtonElement>) => void) | undefined;
  return (
    <li ref={setNodeRef} className="crm-card" data-card={card.id} data-active={card.active || undefined} data-dragging={isDragging || undefined}
      data-draggable={hand ? undefined : "1"}
      tabIndex={0} aria-keyshortcuts="ArrowLeft ArrowRight"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("select, .crm-move")) return;
        pointer?.(e);
      }}
      // Links and images inside the card must not start a native drag: it would cancel the board drag.
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (!draggedAt || Date.now() - draggedAt > 300) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "ArrowRight") { e.preventDefault(); onShift(card, 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); onShift(card, -1); }
      }}>
      <CardView card={card} />
      {hand ? null : <button type="button" className="crm-grip" aria-label={`Trascina ${card.name}`} onKeyDown={keyDrag} {...attributes} />}
      <label className="crm-move">
        <select className="adm-input" aria-label={`Sposta ${card.name} in`} value={card.stage} onChange={(e) => onMove(card, e.target.value as Stage)}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
      </label>
    </li>
  );
}

const CardView = memo(function CardView({ card, lifted = false }: { card: ContactCard; lifted?: boolean }) {
  const who = whoOf(card);
  return (
    <div className={lifted ? "crm-card-face is-lifted" : "crm-card-face"}>
      <div className="crm-card-top">
        <Link href={card.href as Route} data-row-link={card.id} draggable={false}>{card.name}</Link>
        <span className="crm-avatar" data-hue={avatarHue(card.name)} aria-hidden="true">{initials(card.name)}</span>
      </div>
      <p className="crm-card-sub">{[card.city, card.source].filter(Boolean).join(" · ") || "Senza città"}</p>
      {card.valueCents === null ? null : (
        <p className="crm-pipe-money" key={`${card.valueKind}:${card.valueCents}`}>
          <strong>{money(card.valueCents)}</strong>
          {card.valueKind === "stimato" ? <span className="crm-pipe-est">stimato</span> : null}
        </p>
      )}
      <p className="crm-card-who">
        <span className="crm-avatar crm-avatar-mini" aria-hidden="true">{initials(who.name)}</span>
        <span>{who.label}</span>
        <strong key={`${who.label}:${who.name}`} className="crm-pipe-bit">{who.name}</strong>
      </p>
      <p className="crm-card-links">
        <Link className="crm-chip" href={card.historyHref as Route} draggable={false}><CrmIcon d={CLOCK} />Storico</Link>
        {card.emailHref ? <Link className="crm-chip" href={card.emailHref as Route} draggable={false}><CrmIcon d={CHAT} />Conversazione</Link> : null}
      </p>
    </div>
  );
});
