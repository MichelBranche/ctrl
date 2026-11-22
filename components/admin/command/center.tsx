"use client";

import { ActivityCheck } from "@/components/admin/crm/activity-check";
import { FollowUpDone } from "@/components/admin/crm/follow-up-client";
import { AreaChart, BarList, CountUp, Donut, Sparkline } from "@/components/admin/charts";
import { ArrowUpRight } from "@/components/ds/arrow-up-right";
import type { CommandKpi, CommandModel, CommandRange, CommandShortcut, CommandTodo } from "@/lib/command-types";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAdminLocale } from "@/components/admin/locale-provider";
import { interpolate } from "@/lib/admin-i18n";

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
  const { t } = useAdminLocale();
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
    <div className="ov-period" ref={ref}>
      <button type="button" className="ov-chip" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((value) => !value)}>
        <Icon d="M4 5h16v15H4zM4 9h16M8 3v4M16 3v4" />
        {interpolate(t.command.lastDays, { n: range })}
      </button>
      {open ? (
        <ul className="ov-period-menu" role="listbox" aria-label={t.command.period}>
          {([7, 30, 90] as const).map((item) => (
            <li key={item}>
              <Link href={`/admin?range=${item}`} scroll={false} role="option" aria-selected={item === range} onClick={() => setOpen(false)}>
                {interpolate(t.command.lastDays, { n: item })}
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
  if (!check) return <span className="ov-box" data-on={item.done ? "" : undefined} aria-hidden="true" />;
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
  const { t } = useAdminLocale();

  return (
    <main className="ds-page ov">
      <header className="ds-head">
        <p className="ds-kicker">{model.dateLabel}</p>
        <h1 className="ds-title">{model.greeting}</h1>
        {model.lead ? <p className="ds-lead">{model.lead}</p> : null}
        <div className="ov-toolbar">
          <Link href={model.systems.href} className="ov-chip" data-tone={model.systems.tone} title={model.systems.title}>
            <span className="ov-live" aria-hidden="true" />
            {model.systems.label}
          </Link>
          <PeriodMenu range={model.range} />
        </div>
        {model.denied ? <p className="adm-error" role="status">{t.command.denied}</p> : null}
      </header>

      <section className="ov-kpis" aria-label={t.command.kpis}>
        {model.kpis.map((card) => (
          <Link key={card.id} href={card.href} className="ov-kpi">
            <span className="ov-kpi-top">
              <Icon d={KPI_ICON[card.id]} />
              <span className="ov-kpi-label">{card.label}</span>
            </span>
            <span className="ov-kpi-spark"><Sparkline data={card.spark.length > 1 ? card.spark : [0, 0, 0, 0, 0, 0, 0]} label={interpolate(t.command.spark, { label: card.label })} /></span>
            {card.unavailable ? (
              <span className="ov-kpi-num ov-kpi-note">{card.unavailable}</span>
            ) : (
              <CountUp value={card.value} className="ov-kpi-num" money={card.money} />
            )}
            <span className="ov-kpi-delta" data-tone={card.tone || undefined}>
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

      <div className="ov-split">
        {model.traffic ? (
          <section className="ds-card ov-chart" aria-labelledby="ov-traffic">
            <div className="ds-card-head">
              <h2 id="ov-traffic">{t.command.traffic}</h2>
              <span className="ov-legend">
                <span><i className="ov-dot" data-tone="views" /> {t.command.views}</span>
                <span><i className="ov-dot" data-tone="visitors" /> {t.command.visitors}</span>
              </span>
            </div>
            {model.traffic.empty ? <p className="ov-empty">{model.traffic.empty}</p> : <AreaChart data={model.traffic.points} height={286} />}
          </section>
        ) : null}
        <section className="ds-card ov-todo-card" aria-labelledby="ov-todo">
          <div className="ds-card-head">
            <h2 id="ov-todo">
              {t.command.todoTitle}
              {model.todos.total > 0 ? <span className="ov-count">{model.todos.total}</span> : null}
            </h2>
            <Link href={model.todos.href} className="ov-more">{t.command.seeAll}</Link>
          </div>
          {model.todos.items.length === 0 ? (
            <p className="ov-empty">{t.command.todoEmpty}</p>
          ) : (
            <ul className="ov-list">
              {model.todos.items.map((item) => (
                <li key={item.id} className="ov-row ov-todo" data-done={item.done ? "" : undefined}>
                  <span className="ov-check"><TodoCheck item={item} /></span>
                  <Link href={item.href} className="ov-todo-title">{item.title}</Link>
                  <Link href={item.href} className="ov-tag">{item.tag}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {model.shortcuts.length ? (
        <nav className="ov-shortcuts" aria-label={t.command.shortcuts}>
          {model.shortcuts.map((item) => (
            <Link key={item.id} href={item.href} className="ds-card ov-shortcut">
              <span className="ov-shortcut-icon"><Icon d={SHORTCUT_ICON[item.id]} /></span>
              <ArrowUpRight className="ov-go" />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="ov-bottom">
        <section className="ds-card" aria-labelledby="ov-activity">
          <div className="ds-card-head">
            <h2 id="ov-activity">{t.command.activity}</h2>
            {model.activity.href ? <Link href={model.activity.href} className="ov-more">{t.command.seeAllActivity}</Link> : null}
          </div>
          {model.activity.error ? <p className="adm-error" role="alert">{t.command.activityUnavailable}</p> : null}
          {model.activity.items.length === 0 && !model.activity.error ? <p className="ov-empty">{t.command.activityEmpty}</p> : null}
          {model.activity.items.length ? (
            <ol className="ov-list ov-feed">
              {model.activity.items.map((item) => (
                <li key={item.id} className="ov-row">
                  <span className="ov-act"><Icon d={MARK_ICON[item.mark]} /></span>
                  <Link href={item.href}>{item.title}</Link>
                  <time dateTime={item.at}>{item.ago}</time>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
        {model.statsHref ? (
          <section className="ds-card ov-pages" aria-labelledby="ov-pages">
            <div className="ds-card-head">
              <h2 id="ov-pages">{t.command.topPages}</h2>
              <Link href={model.statsHref} className="ov-more">{t.command.seeAnalytics}</Link>
            </div>
            <BarList rows={model.pages} empty={model.pagesEmpty ?? t.command.pagesEmpty} />
          </section>
        ) : null}
        {model.statsHref ? (
          <section className="ds-card ov-donut" aria-labelledby="ov-origin">
            <div className="ds-card-head">
              <h2 id="ov-origin">{t.command.origin}</h2>
            </div>
            <Donut rows={model.countries} empty={model.countriesEmpty ?? t.command.countriesEmpty} centerLabel={t.command.viewsCenter} showShare />
          </section>
        ) : null}
      </div>
    </main>
  );
}
