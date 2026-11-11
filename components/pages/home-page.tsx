import { CtaLink } from "@/components/cta-link";
import Image from "next/image";
import Link from "next/link";
import { HeroReviews } from "@/components/hero-reviews";
import { HomeFilm } from "@/components/home-film";
import { HomeMotion } from "@/components/home-motion";
import { MaskedLine } from "@/components/masked-line";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HoverProjects } from "@/components/hover-projects";
import { homeFeatured, LE_VELE, services } from "@/lib/content";
import { presentReviews } from "@/lib/google-reviews-core";
import { getGoogleReviews } from "@/lib/google-reviews";
import { dict, localize, type Locale } from "@/lib/i18n";
import "./home.css";

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-arrow ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}


export async function HomePage({ lang }: { lang: Locale }) {
  const h = dict[lang].home;
  const reviews = await getGoogleReviews();
  const reviewStrip = reviews?.reviews.length ? presentReviews(reviews, lang) : null;

  return (
    <>
      <SiteHeader />
      <HomeMotion>
        <main className="h-root">
          {/* 1. HERO */}
          <section className="h-hero" data-hero id="top" data-reviews={reviewStrip ? "" : undefined}>
            <div className="h-hero-copy">
              <p className="h-label" data-load="kicker">
                <span>{h.kicker[0]}</span>
                <span>{h.kicker[1]}</span>
                <i className="h-bar" aria-hidden="true" />
              </p>
              <h1 className="h-hero-title">
                {h.title.map((line) => (
                  <MaskedLine key={line} text={line} mask="hero" />
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
                  quality={75}
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
            {reviewStrip ? <HeroReviews data={reviewStrip} /> : null}
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
                    <MaskedLine key={line} text={line} mask="scroll" />
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

          {/* 3. VIDEO DI PRESENTAZIONE */}
          <section className="h-film" aria-label={lang === "it" ? "Video di presentazione CTRL" : "CTRL introduction video"}>
            <div className="h-film-head">
              <p className="h-label">
                <span>CTRL® / Studio film</span>
                <i className="h-bar" aria-hidden="true" />
              </p>
              <a
                href="https://www.youtube.com/watch?v=upTqsodkdo4"
                target="_blank"
                rel="noopener noreferrer"
                className="h-small h-film-link"
              >
                {lang === "it" ? "Guarda su YouTube" : "Watch on YouTube"} <Arrow />
              </a>
            </div>
            <HomeFilm
              title={lang === "it" ? "Presentazione di CTRL®" : "Introducing CTRL®"}
              play={lang === "it" ? "Riproduci il video" : "Play the video"}
            />
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
              openLabel={lang === "it" ? "Apri il progetto" : "Open project"}
              hint={lang === "it" ? "Passa sopra un progetto" : "Hover a project"}
              items={homeFeatured.map((item) => ({
                key: item.index,
                index: item.index,
                label: item.title[lang],
                category: item.category[lang],
                href: localize(item.href, lang),
                image: item.image,
                tint: item.tint,
              }))}
            />
            <aside className="h-proof" aria-labelledby="h-proof-title">
              <p className="h-label">
                <span>{h.proofKicker}</span>
                <i className="h-bar" aria-hidden="true" />
              </p>
              <div className="h-proof-copy">
                <h2 className="h-proof-title" id="h-proof-title">{h.proofTitle}</h2>
                <p>{h.proofText}</p>
                <Link href={localize(LE_VELE.path, lang)} className="h-small h-link">
                  {h.proofCta} <Arrow />
                </Link>
              </div>
            </aside>
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
                  <MaskedLine key={w} text={w} mask="scroll" />
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
