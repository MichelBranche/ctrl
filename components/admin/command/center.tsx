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

const KPI_ICON: Record<CommandKpi["id"], string> = {
  views: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  visitors: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 11h-4M20 9v4",
  revenue: "M3 8h18l-2 13H5L3 8zM8 8V6a4 4 0 0 1 8 0v2",
  deals: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v2M12 19v2M3 12h2M19 12h2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
};

const SHORTCUT_ICON: Record<CommandShortcut["id"], string> = {
  crm: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 8v6M22 11h-6",
  shop: "M3 8h18l-2 13H5L3 8zM8 8V6a4 4 0 0 1 8 0v2",
  content: "M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4",
  analytics: "M4 20V10M10 20V4M16 20v-7M22 20H2",
};

const ACT_ICON = {
  crm: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  shop: "M3 8h18l-2 13H5L3 8zM8 8V6a4 4 0 0 1 8 0v2",
  post: "M5 4h11l3 3v13H5zM9 9h6M9 13h6",
  newsletter: "M4 6h16v12H4zM4 7l8 6 8-6",
} as const;

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
  if (!check) {
    if (!item.done) return <span className="cc-check-gap" aria-hidden="true" />;
    return <input type="checkbox" defaultChecked disabled aria-label={`${item.title}, completata`} />;
  }
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
        gsap.from(kids.length ? kids : block, {
          y: 16,
          autoAlpha: 0,
          duration: 0.6,
          stagger: 0.06,
          ease: "power3.out",
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
          <h1>Il tuo workspace, a colpo d&apos;occhio.</h1>
          <p className="cc-lead">Monitora la tua azienda, gestisci le priorità e fai crescere i tuoi progetti.</p>
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
              {card.spark.length > 1 ? <span className="cc-kpi-spark"><Sparkline data={card.spark} label={`Andamento ${card.label}`} /></span> : null}
            </span>
            {card.unavailable ? (
              <span className="cc-kpi-note">{card.unavailable}</span>
            ) : (
              <CountUp value={card.value} className="cc-kpi-num" money={card.money} />
            )}
            {card.delta ? (
              <span className={`cc-kpi-delta${card.tone ? ` is-${card.tone}` : ""}`}>
                {card.tone === "up" ? <Icon d="M6 14l6-6 6 6" /> : card.tone === "down" ? <Icon d="M6 10l6 6 6-6" /> : null}
                {card.delta}
              </span>
            ) : card.note ? <span className="cc-kpi-note">{card.note}</span> : null}
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
                  <span className={`cc-act-icon is-${item.tone}`}><Icon d={ACT_ICON[item.tone]} /></span>
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
