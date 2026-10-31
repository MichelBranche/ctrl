import { CtaLink } from "@/components/cta-link";
import Image from "next/image";
import Link from "next/link";
import { HomeMotion } from "@/components/home-motion";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HoverProjects } from "@/components/hover-projects";
import { homeFeatured, services } from "@/lib/content";
import { dict, localize, type Locale } from "@/lib/i18n";
import "./home.css";

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-arrow ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}


export function HomePage({ lang }: { lang: Locale }) {
  const h = dict[lang].home;

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
              <CtaLink href="#services" className="h-hero-cta" data-load="cta">
                {h.approach}
              </CtaLink>
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
              {services.map((service) => (
                <Link
                  key={service.slug}
                  href={localize(`/services/${service.slug}`, lang)}
                  className="h-pillar"
                  data-pillar
                >
                  <span className="h-pillar-num">{service.index}</span>
                  <h3>{service.title[lang]}</h3>
                  <p>{service.text[lang]}</p>
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
              <Link href={localize("/projects", lang)} className="h-small h-link">
                {h.allProjects} <Arrow />
              </Link>
            </div>
            <HoverProjects
              defaultName="CTRL®"
              items={homeFeatured.map((item) => ({
                key: item.index,
                index: item.index,
                label: item.title[lang],
                href: localize(item.href, lang),
                image: item.image,
              }))}
            />
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
        </main>
      </HomeMotion>
      <SiteFooter />
    </>
  );
}
