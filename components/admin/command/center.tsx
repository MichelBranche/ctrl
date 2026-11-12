"use client";

import { ActivityCheck } from "@/components/admin/crm/activity-check";
import { FollowUpDone } from "@/components/admin/crm/follow-up-client";
import { AreaChart, BarList, CountUp, Donut, Sparkline } from "@/components/admin/charts";
import type { CommandKpi, CommandModel, CommandRange, CommandShortcut, CommandTodo } from "@/lib/command-types";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const PEOPLE = "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
const BAG = "M6 7h12l-1 14H7L6 7zM9 7V5a3 3 0 0 1 6 0v2";
const DOC = "M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h4";
const MAIL = "M4 6h16v12H4zM4 7l8 6 8-6";
const EYE = "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";
const TARGET = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z";

const KPI_ICON: Record<CommandKpi["id"], string> = {
  views: EYE,
  visitors: PEOPLE,
  revenue: BAG,
  deals: TARGET,
};

const SHORTCUT_ICON: Record<CommandShortcut["id"], string> = {
  crm: PEOPLE,
  shop: BAG,
  content: DOC,
  analytics: "M4 19V9M10 19V5M16 19v-6M22 19H2",
};

const MARK_ICON = { mail: MAIL, bag: BAG, doc: DOC, users: PEOPLE } as const;

function PeriodMenu({ range }: { range: CommandRange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="cc-period" ref={ref}>
      <button type="button" className="cc-chip" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((value) => !value)}>
        <Icon d="M4 5h16v15H4zM4 9h16M8 3v4M16 3v4" />
        Ultimi {range} giorni
      </button>
      {open ? (
        <ul className="cc-period-menu" role="listbox" aria-label="Periodo">
          {([7, 30, 90] as const).map((item) => (
            <li key={item}>
              <Link href={`/admin?range=${item}`} scroll={false} role="option" aria-selected={item === range} onClick={() => setOpen(false)}>
                Ultimi {item} giorni
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TodoCheck({ item }: { item: CommandTodo }) {
  const check = item.check;
  if (!check) return <span className={`cc-box${item.done ? " is-on" : ""}`} aria-hidden="true" />;
  switch (check.kind) {
    case "activity":
      return <ActivityCheck id={check.id} version={check.version} done={item.done} label={item.title} />;
    case "followup":
      return <FollowUpDone id={check.id} seenAt={check.seenAt} label={item.title} />;
    default: {
      const never: never = check;
      return never;
    }
  }
}

export function CommandCenter({ model }: { model: CommandModel }) {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".cc-hero-art", { autoAlpha: 0, duration: 0.9, ease: "power2.out" });
      gsap.from("[data-cc-hero] > *", { y: 14, autoAlpha: 0, duration: 0.65, stagger: 0.07, ease: "power3.out" });
      gsap.utils.toArray<HTMLElement>("[data-cc-block]").forEach((block) => {
        const kids = block.querySelectorAll<HTMLElement>(":scope > *");
        const row = block.matches(".cc-kpis, .cc-shortcuts");
        gsap.from(kids.length ? kids : block, {
          ...(row ? {} : { y: 16 }),
          autoAlpha: 0,
          duration: 0.6,
          stagger: 0.06,
          ease: "power3.out",
          clearProps: "transform",
          onComplete() { block.querySelectorAll<HTMLElement>(":scope > *").forEach((el) => { el.style.transform = ""; }); },
          scrollTrigger: { trigger: block, start: "top 92%", once: true },
        });
      });
    });
  }, { scope: root });

  return (
    <main className="adm-main cc" ref={root}>
      <header className="cc-hero">
        <picture className="cc-hero-art">
          <source type="image/avif" srcSet="/command/hero-wave-960.avif 960w, /command/hero-wave-1440.avif 1440w, /command/hero-wave-2172.avif 2172w" sizes="(max-width: 700px) 100vw, 58vw" />
          <source type="image/webp" srcSet="/command/hero-wave-960.webp 960w, /command/hero-wave-1440.webp 1440w, /command/hero-wave-2172.webp 2172w" sizes="(max-width: 700px) 100vw, 58vw" />
          <img src="/command/hero-wave-1440.webp" alt="" width={2172} height={724} decoding="async" fetchPriority="low" />
        </picture>
        <div className="cc-hero-copy" data-cc-hero>
          <p className="cc-date">{model.dateLabel}</p>
          <h1>{model.greeting}</h1>
          {model.lead ? <p className="cc-lead">{model.lead}</p> : null}
          <div className="cc-chips">
            <Link href={model.systems.href} className={`cc-chip is-${model.systems.tone}`} title={model.systems.title}>
              <span className="cc-live" aria-hidden="true" />
              {model.systems.label}
            </Link>
            <PeriodMenu range={model.range} />
          </div>
          {model.denied ? <p className="adm-error" role="status">Questa sezione non rientra nella tua area.</p> : null}
        </div>
      </header>

      <section className="cc-kpis" aria-label="Indicatori" data-cc-block>
        {model.kpis.map((card) => (
          <Link key={card.id} href={card.href} className="cc-card cc-kpi">
            <span className="cc-kpi-top">
              <Icon d={KPI_ICON[card.id]} />
              <span className="cc-kpi-label">{card.label}</span>
            </span>
            <span className="cc-kpi-spark"><Sparkline data={card.spark.length > 1 ? card.spark : [0, 0, 0, 0, 0, 0, 0]} label={`Andamento ${card.label}`} /></span>
            {card.unavailable ? (
              <span className="cc-kpi-num cc-kpi-note">{card.unavailable}</span>
            ) : (
              <CountUp value={card.value} className="cc-kpi-num" money={card.money} />
            )}
            <span className={`cc-kpi-delta${card.tone ? ` is-${card.tone}` : ""}`}>
              {card.delta ? (
                <>
                  {card.tone === "up" ? <Icon d="M6 14l6-6 6 6" /> : card.tone === "down" ? <Icon d="M6 10l6 6 6-6" /> : null}
                  {card.delta}
                </>
              ) : card.note ?? ""}
            </span>
          </Link>
        ))}
      </section>

      <div className="cc-split">
        {model.traffic ? (
          <section className="cc-card cc-chart" aria-labelledby="cc-traffic" data-cc-block>
            <div className="cc-card-head">
              <h2 id="cc-traffic">Traffico del sito</h2>
              <span className="cc-legend">
                <span><i className="cc-dot is-views" /> Visualizzazioni</span>
                <span><i className="cc-dot is-visitors" /> Visitatori</span>
              </span>
            </div>
            {model.traffic.empty ? <p className="cc-empty">{model.traffic.empty}</p> : <AreaChart data={model.traffic.points} height={286} />}
          </section>
        ) : null}
        <section className="cc-card cc-todo-card" aria-labelledby="cc-todo" data-cc-block>
          <div className="cc-card-head">
            <h2 id="cc-todo">
              Da fare oggi
              {model.todos.total > 0 ? <span className="cc-count">{model.todos.total}</span> : null}
            </h2>
            <Link href={model.todos.href} className="cc-more">Vedi tutte →</Link>
          </div>
          {model.todos.items.length === 0 ? (
            <p className="cc-empty">Niente in scadenza oggi.</p>
          ) : (
            <ul className="cc-todos">
              {model.todos.items.map((item) => (
                <li key={item.id} className={`cc-row cc-todo${item.done ? " is-done" : ""}`}>
                  <span className="cc-check"><TodoCheck item={item} /></span>
                  <Link href={item.href} className="cc-todo-title">{item.title}</Link>
                  <Link href={item.href} className="cc-tag">{item.tag}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {model.shortcuts.length ? (
        <nav className="cc-shortcuts" aria-label="Collegamenti" data-cc-block>
          {model.shortcuts.map((item) => (
            <Link key={item.id} href={item.href} className="cc-card cc-shortcut">
              <span className="cc-shortcut-icon"><Icon d={SHORTCUT_ICON[item.id]} /></span>
              <span className="cc-go" aria-hidden="true"><Icon d="M7 17 17 7M9 7h8v8" /></span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="cc-bottom">
        <section className="cc-card" aria-labelledby="cc-activity" data-cc-block>
          <div className="cc-card-head">
            <h2 id="cc-activity">Attività recente</h2>
            {model.activity.href ? <Link href={model.activity.href} className="cc-more">Vedi tutta →</Link> : null}
          </div>
          {model.activity.error ? <p className="adm-error" role="alert">Attività non disponibile.</p> : null}
          {model.activity.items.length === 0 && !model.activity.error ? <p className="cc-empty">Ancora nessuna attività.</p> : null}
          {model.activity.items.length ? (
            <ol className="cc-feed">
              {model.activity.items.map((item) => (
                <li key={item.id} className="cc-row">
                  <span className={`cc-act-icon is-${item.mark}`}><Icon d={MARK_ICON[item.mark]} /></span>
                  <Link href={item.href}>{item.title}</Link>
                  <time dateTime={item.at}>{item.ago}</time>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
        {model.statsHref ? (
          <section className="cc-card cc-pages" aria-labelledby="cc-pages" data-cc-block>
            <div className="cc-card-head">
              <h2 id="cc-pages">Pagine più viste</h2>
              <Link href={model.statsHref} className="cc-more">Vedi analisi →</Link>
            </div>
            <BarList rows={model.pages} empty={model.pagesEmpty ?? "Nessuna pagina vista nel periodo."} />
          </section>
        ) : null}
        {model.statsHref ? (
          <section className="cc-card cc-donut" aria-labelledby="cc-origin" data-cc-block>
            <div className="cc-card-head">
              <h2 id="cc-origin">Provenienza</h2>
            </div>
            <Donut rows={model.countries} empty={model.countriesEmpty ?? "Nessun dato sui paesi."} centerLabel="Visualizzazioni" showShare />
          </section>
        ) : null}
      </div>
    </main>
  );
}
