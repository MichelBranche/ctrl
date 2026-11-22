import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ServicesMotion } from "@/components/pages/services-motion";
import { servicesCopy } from "@/components/pages/services-copy";
import { services } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";
import { publicMeta } from "@/lib/seo";
import { ArrowUpRight } from "@/components/ds/arrow-up-right";
import "./services.css";

export function servicesMetadata(lang: Locale): Metadata {
  const c = servicesCopy[lang];
  return publicMeta(lang, { title: c.metaTitle, description: c.metaDescription, itPath: "/services" });
}

function Check() {
  return (
    <svg className="sv-check" viewBox="0 0 24 24" aria-hidden="true">
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
    <svg className="sv-mark" viewBox="0 0 400 300" role="img" aria-label={label}>
      <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="miter">
        <path data-draw d="M14 300 L160 18 L222 18 L386 300" />
        <path data-draw d="M110 300 L196 120 L300 300" />
      </g>
      <g className="sv-spark" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
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
      <main className="sv" data-motion-root>
        <ServicesMotion />

        {/* 1. HERO: one card inside the 10px frame, photo behind, title bottom left. */}
        <section className="sv-hero" data-sv-hero>
          <div className="sv-card sv-hero-card">
            <Image className="sv-hero-img" src="/images/hero.jpg" alt="" fill priority sizes="100vw" data-sv-hero-img />
            <div className="sv-hero-copy">
              <p className="sv-tag" data-sv-fade>
                <i aria-hidden="true" />
                {c.tag}
              </p>
              <h1 className="sv-title" data-sv-words aria-label={c.title}>
                {c.title.split("®").map((part, i) => (
                  <span key={part + i}>
                    {i > 0 ? <sup className="sv-reg">®</sup> : null}
                    {part}
                  </span>
                ))}
              </h1>
            </div>
            <div className="sv-hero-side">
              <p className="sv-lead" data-sv-fade>{c.lead}</p>
              <a href="#servizi" className="sv-cta" data-sv-fade>
                {c.discover}
                <ArrowUpRight className="sv-arrow sv-arrow-down" />
              </a>
            </div>
          </div>
        </section>

        {/* 2. SERVICES: five light cards and the mountain mark, bento 3 + 3. */}
        <section className="sv-block" id="servizi" aria-label={c.gridLabel}>
          <ul className="sv-grid" data-sv-stagger>
            {services.map((s) => (
              <li className="sv-card sv-service" key={s.slug}>
                <Link href={localize(`/services/${s.slug}`, lang) as Route} className="sv-service-body">
                  <span className="sv-index">{s.index}</span>
                  <h2 className="sv-service-title">
                    {s.title[lang]}
                    <ArrowUpRight className="sv-arrow" />
                  </h2>
                  <p className="sv-service-text">{s.text[lang]}</p>
                  <p className="sv-service-summary">{s.summary[lang]}</p>
                  <ul className="sv-points">
                    {s.points[lang].map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </Link>
                {s.sub ? (
                  <Link href={localize(s.sub.href, lang) as Route} className="sv-sub">
                    <span className="sv-sub-dot" aria-hidden="true" />
                    <span className="sv-sub-copy">
                      <span className="sv-sub-label">{s.sub.label[lang]}</span>
                      <span className="sv-sub-note">{s.sub.note[lang]}</span>
                    </span>
                    <ArrowUpRight className="sv-arrow" />
                  </Link>
                ) : null}
              </li>
            ))}
            <li className="sv-card sv-mark-card">
              <MountainMark label={c.graphicAlt} />
            </li>
          </ul>
        </section>

        {/* 3. SOFTWARE: intro and the ready-made products in one dark card. */}
        <section className="sv-block" aria-labelledby="sv-soft-title">
          <div className="sv-card sv-soft">
            <div className="sv-head">
              <p className="sv-kicker">{c.software.kicker}</p>
              <h2 className="sv-h2" id="sv-soft-title" data-sv-title>{c.software.title}</h2>
              <p className="sv-text" data-sv-rise>{c.software.text}</p>
            </div>
            <ul className="sv-products" data-sv-stagger>
              {c.software.products.map((p) => (
                <li key={p.name} className="sv-product">
                  <span className="sv-product-media">
                    <Image src={p.image} alt={p.alt} fill sizes="(max-width: 900px) 100vw, 40vw" className="sv-product-img" />
                  </span>
                  <div className="sv-product-body">
                    <p className="sv-badge"><i aria-hidden="true" />{c.software.available}</p>
                    <h3 className="sv-h3">{p.name}</h3>
                    <p className="sv-text">{p.text}</p>
                    <p className="sv-price"><strong>{p.price}</strong> {c.software.perMonth}</p>
                    <Link href={localize(p.href, lang) as Route} className="sv-cta">
                      {p.cta}
                      <ArrowUpRight className="sv-arrow" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. LOCAL: one slim card. */}
        <section className="sv-block" aria-labelledby="sv-local-title">
          <div className="sv-card sv-local" data-sv-rise>
            <div>
              <p className="sv-kicker">{c.local.kicker}</p>
              <h2 className="sv-h2" id="sv-local-title">{c.local.title}</h2>
              <p className="sv-text">{c.local.text}</p>
            </div>
            <Link href={localize("/agenzia-web-valle-d-aosta", lang) as Route} className="sv-ghost">
              {c.local.cta}
              <ArrowUpRight className="sv-arrow" />
            </Link>
          </div>
        </section>

        {/* 5. MODES: intro card and the two plans side by side. */}
        <section className="sv-block" aria-labelledby="sv-modes-title">
          <div className="sv-modes" data-sv-stagger>
            <div className="sv-card sv-modes-intro">
              <p className="sv-kicker">{c.modesKicker}</p>
              <h2 className="sv-h2" id="sv-modes-title">
                {c.modesTitle.map((line) => (
                  <span key={line}>{line} </span>
                ))}
              </h2>
              <p className="sv-text">{c.modesText}</p>
            </div>
            {plans.map(({ key, plan, Icon, filled }) => (
              <article className={`sv-card sv-plan${filled ? " sv-plan-fill" : ""}`} key={key}>
                <div className="sv-plan-head">
                  <span className="sv-plan-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <h3 className="sv-h3">{plan.title}</h3>
                </div>
                <p className="sv-text">{plan.text}</p>
                <ul className="sv-checks">
                  {plan.checks.map((item) => (
                    <li key={item}>
                      <Check />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href={contact} className={filled ? "sv-cta" : "sv-ghost sv-ghost-ink"}>
                  {plan.cta}
                  <ArrowUpRight className="sv-arrow" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
