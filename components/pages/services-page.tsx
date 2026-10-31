import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ServicesMotion } from "@/components/pages/services-motion";
import { servicesCopy } from "@/components/pages/services-copy";
import { services } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";
import "./services.css";

export function servicesMetadata(lang: Locale): Metadata {
  const c = servicesCopy[lang];
  return { title: c.metaTitle, description: c.metaDescription };
}

function Arrow({ className = "s-arrow" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="s-check" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 12.5l4.5 4.5L19.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.5 5.5l3 3L9 18l-4 1 1-4 9.5-9.5zM13.5 7.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M8 13.5h2M11 13.5h2M14 13.5h2M8 16.5h2M11 16.5h2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function MountainMark({ label }: { label: string }) {
  return (
    <svg className="s-mark" viewBox="0 0 400 300" role="img" aria-label={label}>
      <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="miter">
        <path data-draw d="M14 300 L160 18 L222 18 L386 300" />
        <path data-draw d="M110 300 L196 120 L300 300" />
      </g>
      <g className="s-spark" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <path d="M370 14v32M354 30h32M358.7 18.7l22.6 22.6M381.3 18.7l-22.6 22.6" />
      </g>
    </svg>
  );
}

export function ServicesView({ lang }: { lang: Locale }) {
  const c = servicesCopy[lang];
  const contact = localize("/contact", lang);
  const plans = [
    { key: "custom", plan: c.custom, Icon: PencilIcon, filled: false },
    { key: "subscription", plan: c.subscription, Icon: CalendarIcon, filled: true },
  ] as const;

  return (
    <>
      <SiteHeader />
      <main className="s-root" data-motion-root>
        <ServicesMotion />
        <section className="s-hero">
          <Image className="s-hero-img" src="/images/hero.jpg" alt="" fill priority sizes="100vw" data-s-hero-img />
          <div className="s-hero-copy">
            <p className="s-tag" data-s-fade>{c.tag}</p>
            <h1 className="s-title" data-s-split aria-label={c.title}>
              {c.title.split("®").map((part, i) => (
                <span key={part + i}>
                  {i > 0 ? <sup className="s-reg">®</sup> : null}
                  {part}
                </span>
              ))}
            </h1>
            <p className="s-lead" data-s-fade>{c.lead}</p>
            <a href="#servizi" className="s-discover" data-s-fade>
              <span className="s-circle" data-magnetic aria-hidden="true">
                <Arrow />
              </span>
              <span className="s-mono">{c.discover}</span>
              <Arrow className="s-arrow s-arrow-small" />
            </a>
          </div>
        </section>

        <section className="s-grid-wrap" id="servizi" aria-label={c.gridLabel}>
          <ul className="s-grid">
            {services.map((s) => (
              <li className="s-cell" key={s.slug} data-s-cell>
                <Link href={localize(`/services/${s.slug}`, lang)} className="s-cell-link">
                  <span className="s-mono s-index">{s.index}</span>
                  <h2 className="s-cell-title">{s.title[lang]}</h2>
                  <p className="s-cell-text">{s.text[lang]}</p>
                  <p className="s-cell-summary">{s.summary[lang]}</p>
                  <ul className="s-points">
                    {s.points[lang].map((point) => (
                      <li key={point}>
                        <Arrow />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="s-sr">{c.details}</span>
                </Link>
              </li>
            ))}
            <li className="s-cell s-cell-mark" data-s-cell>
              <MountainMark label={c.graphicAlt} />
            </li>
          </ul>
          <span className="s-rule s-rule-v s-rule-v1" aria-hidden="true" data-s-rule="y" />
          <span className="s-rule s-rule-v s-rule-v2" aria-hidden="true" data-s-rule="y" />
          <span className="s-rule s-rule-h s-rule-h1" aria-hidden="true" data-s-rule="x" />
        </section>

        <section className="s-modes">
          <div className="s-modes-intro" data-s-fade-scroll>
            <p className="s-mono s-kicker">{c.modesKicker}</p>
            <h2 className="s-h2">
              {c.modesTitle.map((line) => (
                <span key={line}>{line} </span>
              ))}
            </h2>
            <p className="s-modes-text">{c.modesText}</p>
          </div>
          {plans.map(({ key, plan, Icon, filled }) => (
            <article className="s-card" key={key} data-s-card>
              <div className="s-card-head">
                <span className="s-card-icon" aria-hidden="true">
                  <Icon />
                </span>
                <h3 className="s-card-title">{plan.title}</h3>
              </div>
              <p className="s-card-text">{plan.text}</p>
              <ul className="s-checks">
                {plan.checks.map((item) => (
                  <li key={item} data-s-check>
                    <Check />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href={contact} className={`s-btn ${filled ? "s-btn-fill" : "s-btn-line"}`} data-magnetic>
                <span className="s-btn-label s-mono">{plan.cta}</span>
                <Arrow />
              </Link>
            </article>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
