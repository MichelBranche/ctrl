import Image from "next/image";
import Link from "next/link";
import { HomeMotion } from "@/components/home-motion";
import { SiteHeader } from "@/components/site-header";
import { CtrlMark } from "@/components/letter-hover";
import { TiltCard } from "@/components/tilt-card";
import { CONTACT_EMAIL, homeFeatured, services } from "@/lib/content";
import { dict, localize, type Locale } from "@/lib/i18n";
import "./home.css";

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-arrow ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

const socials = [
  {
    label: "LinkedIn",
    icon: (
      <path d="M4 9h3v11H4zM5.5 4a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM10 9h2.9v1.5h.1c.4-.8 1.4-1.7 3-1.7 3.1 0 3.7 2 3.7 4.7V20h-3v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V20h-3z" fill="currentColor" />
    ),
  },
  {
    label: "Instagram",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="4" width="16" height="16" rx="4.5" />
        <circle cx="12" cy="12" r="3.8" />
        <circle cx="17" cy="7" r=".6" fill="currentColor" />
      </g>
    ),
  },
  {
    label: "Behance",
    icon: (
      <path d="M3 6h5.2c2 0 3.3 1 3.3 2.7 0 1.1-.6 1.9-1.5 2.3 1.3.3 2 1.3 2 2.7 0 2-1.6 3.3-3.8 3.3H3zm2.4 2v2.6h2.5c.9 0 1.4-.5 1.4-1.3S8.8 8 7.9 8zm0 4.5v3h2.8c1 0 1.6-.6 1.6-1.5s-.6-1.5-1.6-1.5zM14.5 7h5v1.3h-5zm2.6 2.4c2.4 0 3.8 1.7 3.6 4.3h-5.4c.1 1.3.9 2 2 2 .8 0 1.3-.4 1.6-.9h1.7c-.5 1.5-1.7 2.4-3.4 2.4-2.3 0-3.7-1.6-3.7-3.9s1.5-3.9 3.6-3.9zm-1.7 3h3.4c-.1-1-.7-1.6-1.7-1.6s-1.6.6-1.7 1.6z" fill="currentColor" />
    ),
  },
];

export function HomePage({ lang }: { lang: Locale }) {
  const h = dict[lang].home;
  const [featured, ...rest] = homeFeatured;
  const total = String(homeFeatured.length).padStart(2, "0");

  return (
    <>
      <SiteHeader />
      <HomeMotion>
        <main className="h-root">
          {/* 1. HERO */}
          <section className="h-hero" data-hero id="top">
            <div className="h-hero-copy">
              <p className="h-label" data-load="kicker">
                <span>{h.kicker[0]}</span>
                <span>{h.kicker[1]}</span>
                <i className="h-bar" aria-hidden="true" />
              </p>
              <h1 className="h-hero-title">
                {h.title.map((line) => (
                  <span className="line-mask" key={line}>
                    <span data-mask="hero">{line}</span>
                  </span>
                ))}
              </h1>
              <p className="h-hero-lead" data-load="lead">
                {h.lead}
              </p>
              <Link href={localize("/about", lang)} className="h-round-link" data-load="cta">
                <span className="h-circle">
                  <Arrow />
                </span>
                <span className="h-small">{h.approach}</span>
              </Link>
              <p className="h-counter h-small" data-load="cta">
                01 <span>/ 05</span>
              </p>
            </div>
            <div className="h-hero-visual">
              <div className="h-hero-media" data-parallax>
                <Image
                  src="/images/home/hero.jpg"
                  alt={h.heroAlt}
                  fill
                  priority
                  sizes="100vw"
                  quality={90}
                  className="h-img h-img-hero"
                />
              </div>
              <p className="h-tag h-tag-top h-small">
                {h.heroTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </p>
              <p className="h-tag h-tag-bottom h-small">
                {h.place.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </p>
            </div>
          </section>

          {/* 2. COSA FACCIAMO */}
          <section className="h-what" id="services">
            <div className="h-what-top">
              <div className="h-portrait" data-reveal>
                <div className="h-portrait-img">
                  <Image
                    src="/images/home/cosa-facciamo.jpg"
                    alt={h.portraitAlt}
                    fill
                    sizes="(max-width: 900px) 100vw, 40vw"
                    className="h-img h-img-portrait"
                  />
                </div>
              </div>
              <div className="h-what-head">
                <p className="h-label" data-reveal>
                  <span>{h.servicesKicker}</span>
                  <i className="h-bar" aria-hidden="true" />
                </p>
                <h2 className="h-h2">
                  {h.servicesTitle.map((line) => (
                    <span className="line-mask" key={line}>
                      <span data-mask="scroll">{line}</span>
                    </span>
                  ))}
                </h2>
              </div>
              <p className="h-what-lead" data-reveal>
                {h.servicesLead}
              </p>
            </div>
            <div className="h-pillars" data-pillars>
              {services.map((service, i) => (
                <Link
                  key={service.slug}
                  href={localize(`/services/${service.slug}`, lang)}
                  className="h-pillar"
                  data-pillar
                >
                  <span className="h-small h-num">{service.index}</span>
                  <h3>{h.pillars[i]?.title ?? service.title[lang]}</h3>
                  <p>{h.pillars[i]?.text ?? service.text[lang]}</p>
                  <Arrow className="h-pillar-arrow" />
                </Link>
              ))}
            </div>
          </section>

          {/* 3. PROGETTI RECENTI */}
          <section className="h-work" id="work">
            <div className="h-row-head">
              <p className="h-label">
                <span>{h.workKicker}</span>
                <i className="h-bar" aria-hidden="true" />
              </p>
              <Link href={localize("/work", lang)} className="h-small h-link">
                {h.allProjects} <Arrow />
              </Link>
            </div>
            <div className="h-feature">
              <Link href={localize(featured.href, lang)} className="h-feature-media" data-reveal>
                {featured.image ? (
                  <Image src={featured.image} alt="" fill sizes="55vw" className="h-img" />
                ) : (
                  <span className="h-placeholder" aria-hidden="true" />
                )}
              </Link>
              <div className="h-feature-copy" data-reveal>
                <p className="h-small h-counter-inline">
                  {featured.index} <span>/ {total}</span>
                </p>
                <h3 className="h-feature-title">{featured.title[lang]}</h3>
                <p className="h-feature-cat h-small">{featured.category[lang]}</p>
                <p className="h-feature-text">{featured.description[lang]}</p>
                <Link href={localize(featured.href, lang)} className="h-small h-link">
                  {h.discover} <Arrow />
                </Link>
              </div>
            </div>
            <div className="h-cards">
              {rest.map((item) => (
                <TiltCard key={item.index}>
                  <Link href={localize(item.href, lang)} className="h-card">
                    <div className="work-media h-card-media">
                      {item.image ? (
                        <Image src={item.image} alt="" fill sizes="33vw" className="h-img" />
                      ) : (
                        <span className="h-placeholder" aria-hidden="true" />
                      )}
                    </div>
                    <span className="h-small h-card-num">
                      {item.index} <span>/ {total}</span>
                    </span>
                    <div className="work-caption h-card-caption">
                      <strong>{item.title[lang]}</strong>
                      <span className="h-small">{item.category[lang]}</span>
                    </div>
                  </Link>
                </TiltCard>
              ))}
            </div>
          </section>

          {/* 4. PERCHE CTRL */}
          <section className="h-why">
            <div className="h-why-bg" aria-hidden="true">
              <Image src="/images/home/perche.jpg" alt="" fill sizes="(max-width: 900px) 100vw, 60vw" className="h-img h-img-why" />
            </div>
            <div className="h-why-left">
              <p className="h-label" data-reveal>
                <span>{h.whyKicker}</span>
                <i className="h-bar" aria-hidden="true" />
              </p>
              <h2 className="h-why-words">
                {h.whyWords.map((w) => (
                  <span className="line-mask" key={w}>
                    <span data-mask="scroll">{w}</span>
                  </span>
                ))}
              </h2>
            </div>
            <div className="h-why-right">
              <p className="h-why-lead" data-reveal>
                {h.whyLead}
              </p>
              <dl className="h-stats" data-pillars>
                {h.stats.map((s) => (
                  <div className="h-stat" key={s.value} data-pillar>
                    <dt>{s.value}</dt>
                    <dd className="h-small">
                      <span>{s.label[0]}</span>
                      <span>{s.label[1]}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* 5. CLOSING */}
          <section className="h-close" id="contact">
            <i className="h-dot" aria-hidden="true" />
            <CtrlMark className="h-mark" />
            <div className="h-close-info">
              <p className="h-small h-close-kicker">
                <span>{h.closeKicker[0]}</span>
                <span>{h.closeKicker[1]}</span>
              </p>
              <p className="h-close-lead">{h.closeLead}</p>
              <p className="h-small h-close-kicker">
                <span>{h.location}</span>
                <span>© 2026 CTRL®</span>
              </p>
              {/* TODO(Michel): add real social URLs, then turn these spans into links. */}
              <ul className="h-socials">
                {socials.map((s) => (
                  <li key={s.label}>
                    <span className="h-small" aria-disabled="true">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        {s.icon}
                      </svg>
                      {s.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <h2 className="h-close-title">
              <span className="line-mask">
                <span data-mask="scroll">{h.closeTitle}</span>
              </span>
            </h2>
            <i className="h-vline" aria-hidden="true" />
            <a href={`mailto:${CONTACT_EMAIL}`} className="h-circle h-circle-lg" aria-label={h.closeCta}>
              <Arrow />
            </a>
          </section>
        </main>
      </HomeMotion>
    </>
  );
}
