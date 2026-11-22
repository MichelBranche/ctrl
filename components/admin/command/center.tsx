"use client";

import { ActivityCheck } from "@/components/admin/crm/activity-check";
import { FollowUpDone } from "@/components/admin/crm/follow-up-client";
import { AreaChart, BarList, CountUp, Donut, Sparkline } from "@/components/admin/charts";
import { ArrowUpRight } from "@/components/ds/arrow-up-right";
import type { CommandActivity, CommandFunnel, CommandKpi, CommandModel, CommandShortcut, CommandTodo } from "@/lib/command-types";
import Link from "next/link";
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

const UP = "M7 17L17 7M9 7h8v8";
const DOWN = "M7 7l10 10M17 9v8H9";
const FLAT = "M5 12h14";
/** Tag colour from where the item leads, so the same area has the same colour as the feed icons. */
const tagType = (href: string) => (href.startsWith("/admin/crm/pipeline") ? "pipeline" : href.startsWith("/admin/crm") || href.startsWith("/admin/requests") ? "crm" : href.startsWith("/admin/shop") ? "shop" : href.startsWith("/admin/newsletter") ? "newsletter" : "post");
const TYPE_LABEL = { crm: "typeCrm", shop: "typeShop", post: "typePost", newsletter: "typeNewsletter" } as const;

/** Change against the previous period: green up, red down, neutral flat. Note text when there is nothing to compare. */
function Delta({ card }: { card: CommandKpi }) {
  if (!card.delta) return <span className="ov-kpi-note">{card.note ?? ""}</span>;
  const tone = card.tone ?? "flat";
  return (
    <span className="ov-delta" data-tone={tone}>
      <Icon d={tone === "up" ? UP : tone === "down" ? DOWN : FLAT} />
      {card.delta}
    </span>
  );
}

function Funnel({ funnel }: { funnel: CommandFunnel }) {
  const { t } = useAdminLocale();
  const max = Math.max(1, ...funnel.steps.map((step) => step.count));
  return (
    <section className="ov-card ov-funnel" aria-labelledby="ov-funnel">
      <div className="ov-card-head">
        <h2 id="ov-funnel">{t.command.funnelTitle}</h2>
        <Link href={funnel.href} className="ov-more">{t.command.funnelOpen}</Link>
      </div>
      <p className="ov-funnel-lead" title={t.command.funnelHint}>{interpolate(t.command.funnelTotal, { n: funnel.total })}<span className="adm-sr"> · {t.command.funnelHint}</span></p>
      {funnel.error ? <p className="adm-error" role="alert">{t.command.funnelUnavailable}</p> : null}
      {!funnel.error && funnel.total === 0 ? <p className="ov-empty">{t.command.funnelEmpty}</p> : null}
      {funnel.total > 0 ? (
        <ol className="ov-steps">
          {funnel.steps.map((step, i) => {
            const share = Math.round((step.count / funnel.total) * 100);
            return (
              <li key={step.id} data-stage={step.id} style={{ ["--i" as string]: i }}>
                <Link href={step.href}>
                  <span className="ov-step-label"><i aria-hidden="true" />{step.label}</span>
                  <span className="ov-step-track" aria-hidden="true"><span style={{ width: `${Math.max(3, (step.count / max) * 100)}%` }} /></span>
                  <span className="ov-step-n">{step.count}</span>
                  <span className="ov-step-share">{share}%</span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : null}
      {funnel.total > 0 ? (
        <p className="ov-funnel-foot" data-stage="perso"><i aria-hidden="true" />{t.command.funnelLost} <b>{funnel.lost}</b></p>
      ) : null}
    </section>
  );
}

function Feed({ items }: { items: CommandActivity[] }) {
  return (
    <ol className="ov-feed">
      {items.map((item, i) => (
        <li key={item.id} style={{ ["--i" as string]: i }}>
          <span className="ov-act" data-type={item.tone}><Icon d={MARK_ICON[item.mark]} /></span>
          <Link href={item.href}>{item.title}</Link>
          <time dateTime={item.at}>{item.ago}</time>
        </li>
      ))}
    </ol>
  );
}

export function CommandCenter({ model }: { model: CommandModel }) {
  const { t } = useAdminLocale();
  const types = [...new Set(model.activity.items.map((item) => item.tone))];

  return (
    <main className="ds-page rb ov">
      <header className="rb-head ov-head">
        <div className="rb-head-row">
          <div className="rb-head-title">
            <p className="rb-kicker">{model.dateLabel}</p>
            <h1>{model.greeting}</h1>
            {model.lead ? <p className="ov-lead">{model.lead}</p> : null}
          </div>
          <div className="ov-head-tools">
            <Link href={model.systems.href} className="rb-btn ov-sys" data-tone={model.systems.tone} title={model.systems.title}>
              <span className="ov-live" aria-hidden="true" />
              {model.systems.label}
            </Link>
            <nav className="rb-segs ov-range" aria-label={t.command.period}>
              {([7, 30, 90] as const).map((item) => (
                <Link key={item} href={`/admin?range=${item}`} scroll={false} aria-current={item === model.range ? "page" : undefined}>
                  {interpolate(t.command.lastDays, { n: item })}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        {model.denied ? <p className="adm-error ov-denied" role="status">{t.command.denied}</p> : null}
      </header>

      <section className="ov-kpis" aria-label={t.command.kpis}>
        {model.kpis.map((card, i) => (
          <Link key={card.id} href={card.href} className="ov-kpi" data-kpi={card.id} style={{ ["--i" as string]: i }}>
            <span className="ov-kpi-label"><i aria-hidden="true" /><Icon d={KPI_ICON[card.id]} /><span>{card.label}</span></span>
            {card.unavailable ? (
              <span className="ov-kpi-num ov-kpi-off">{card.unavailable}</span>
            ) : (
              <CountUp value={card.value} className="ov-kpi-num" money={card.money} />
            )}
            <Delta card={card} />
            <span className="ov-kpi-spark"><Sparkline data={card.spark.length > 1 ? card.spark : [0, 0, 0, 0, 0, 0, 0]} label={interpolate(t.command.spark, { label: card.label })} /></span>
          </Link>
        ))}
      </section>

      <div className={model.traffic && model.funnel ? "ov-row2" : "ov-row1"}>
        {model.traffic ? (
          <section className="ov-card ov-chart" aria-labelledby="ov-traffic">
            <div className="ov-card-head">
              <h2 id="ov-traffic">{t.command.traffic}</h2>
              <span className="ov-legend">
                <span><i className="ov-dot" data-tone="views" /> {t.command.views}</span>
                <span><i className="ov-dot" data-tone="visitors" /> {t.command.visitors}</span>
              </span>
            </div>
            {model.traffic.empty ? <p className="ov-empty">{model.traffic.empty}</p> : <div className="ov-chart-body"><AreaChart data={model.traffic.points} height={268} /></div>}
          </section>
        ) : null}
        {model.funnel ? <Funnel funnel={model.funnel} /> : null}
      </div>

      <div className="ov-row2 ov-row-even">
        <section className="ov-card ov-todo-card" aria-labelledby="ov-todo">
          <div className="ov-card-head">
            <h2 id="ov-todo">
              {t.command.todoTitle}
              {model.todos.total > 0 ? <span className="rb-badge">{model.todos.total}</span> : null}
            </h2>
            <Link href={model.todos.href} className="ov-more">{t.command.seeAll}</Link>
          </div>
          {model.todos.items.length === 0 ? (
            <p className="ov-empty">{t.command.todoEmpty}</p>
          ) : (
            <ul className="ov-todos">
              {model.todos.items.map((item, i) => (
                <li key={item.id} className="ov-todo" data-done={item.done ? "" : undefined} style={{ ["--i" as string]: i }}>
                  <span className="ov-check"><TodoCheck item={item} /></span>
                  <Link href={item.href} className="ov-todo-title">{item.title}</Link>
                  <Link href={item.href} className="ov-tag" data-type={tagType(item.href)}>{item.tag}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ov-card" aria-labelledby="ov-activity">
          <div className="ov-card-head">
            <h2 id="ov-activity">{t.command.activity}</h2>
            {model.activity.href ? <Link href={model.activity.href} className="ov-more">{t.command.seeAllActivity}</Link> : null}
          </div>
          {types.length > 1 ? (
            <p className="ov-types">
              {types.map((type) => <span key={type} data-type={type}><i aria-hidden="true" />{t.command[TYPE_LABEL[type]]}</span>)}
            </p>
          ) : null}
          {model.activity.error ? <p className="adm-error" role="alert">{t.command.activityUnavailable}</p> : null}
          {model.activity.items.length === 0 && !model.activity.error ? <p className="ov-empty">{t.command.activityEmpty}</p> : null}
          {model.activity.items.length ? <Feed items={model.activity.items} /> : null}
        </section>
      </div>

      {model.shortcuts.length ? (
        <nav className="ov-shortcuts" aria-label={t.command.shortcuts}>
          {model.shortcuts.map((item) => (
            <Link key={item.id} href={item.href} className="ov-shortcut" data-short={item.id}>
              <span className="ov-shortcut-icon"><Icon d={SHORTCUT_ICON[item.id]} /></span>
              <span className="ov-shortcut-text">
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </span>
              <ArrowUpRight className="ov-go" />
            </Link>
          ))}
        </nav>
      ) : null}

      {model.statsHref ? (
        <div className="ov-row2 ov-row-even">
          <section className="ov-card ov-pages" aria-labelledby="ov-pages">
            <div className="ov-card-head">
              <h2 id="ov-pages">{t.command.topPages}</h2>
              <Link href={model.statsHref} className="ov-more">{t.command.seeAnalytics}</Link>
            </div>
            <BarList rows={model.pages} empty={model.pagesEmpty ?? t.command.pagesEmpty} />
          </section>
          <section className="ov-card ov-donut" aria-labelledby="ov-origin">
            <div className="ov-card-head">
              <h2 id="ov-origin">{t.command.origin}</h2>
            </div>
            <Donut rows={model.countries} empty={model.countriesEmpty ?? t.command.countriesEmpty} centerLabel={t.command.viewsCenter} showShare />
          </section>
        </div>
      ) : null}
    </main>
  );
}
