import Image from "next/image";
import Link from "next/link";
import { HeroReviews } from "@/components/hero-reviews";
import { HomeFilm } from "@/components/home-film";
import { HomeHeader } from "@/components/home/home-header";
import { HomeMotionV2 } from "@/components/home/home-motion-v2";
import { HomePlates } from "@/components/home/home-plates";
import { HomeTestimonials } from "@/components/home/home-testimonials";
import { SiteFooter } from "@/components/site-footer";
import { homeFeatured, LE_VELE, services } from "@/lib/content";
import { showTestimonials } from "@/lib/testimonials";
import { presentReviews } from "@/lib/google-reviews-core";
import { getGoogleReviews } from "@/lib/google-reviews";
import { dict, localize, type Locale } from "@/lib/i18n";
import "./home-v2.css";

function ArrowUpRight() {
  return (
    <svg className="hv-arrow" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Marquee({ text, tone = "dark" }: { text: string; tone?: "dark" | "light" }) {
  const items = Array.from({ length: 6 }, (_, i) => i);
  return (
    <section className="hv-marquee" data-tone={tone} aria-label={text}>
      <div className="hv-marquee-track" aria-hidden="true">
        {[0, 1].map((copy) => (
          <p className="hv-marquee-set" key={copy}>
            {items.map((i) => (
              <span key={i} className="hv-marquee-item">
                {text}
                <i className="hv-marquee-sep" />
              </span>
            ))}
          </p>
        ))}
      </div>
    </section>
  );
}

export async function HomePage({ lang }: { lang: Locale }) {
  const t = dict[lang];
  const h = t.home;
  const b = t.bookings;
  const reviews = await getGoogleReviews();
  const reviewStrip = reviews?.reviews.length ? presentReviews(reviews, lang) : null;

  return (
    <>
      <HomeHeader
        menus={[
          {
            id: "work",
            label: t.nav.work,
            groups: [
              [
                { label: LE_VELE.client, href: localize(LE_VELE.path, lang) },
                ...homeFeatured.map((item) => ({ label: item.title[lang], href: localize(item.href, lang) })),
              ],
              [{ label: h.allProjects, href: localize("/projects", lang) }],
            ],
          },
          {
            id: "services",
            label: t.nav.services,
            groups: [
              services.map((service) => ({ label: service.title[lang], href: localize(`/services/${service.slug}`, lang) })),
              [{ label: h.navAllServices, href: localize("/services", lang) }],
            ],
          },
          {
            id: "more",
            label: h.navMore,
            groups: [
              [
                { label: t.nav.journal, href: localize("/journal", lang) },
                { label: t.nav.contact, href: localize("/contact", lang) },
              ],
              [{ label: h.navTalk, href: localize("/bookings", lang) }],
            ],
          },
        ]}
      />
      <HomeMotionV2>
        <main className="hv">
          {/* 1. HERO */}
          <section className="hv-hero" id="top" data-hv-hero>
            <div className="hv-card hv-hero-card">
              <div className="hv-hero-top">
                <h1 className="hv-hero-title">
                  <span data-hv-words>{h.title[0]}</span> <span data-hv-words>{h.title[1]}</span>
                </h1>
                <p className="hv-hero-line">
                  <span data-hv-words>{h.heroLine[0]}</span> <span data-hv-words>{h.heroLine[1]}</span>
                </p>
              </div>

              <div className="hv-hero-object">
                <HomePlates label={h.platesAlt} />
              </div>

              <div className="hv-hero-bottom">
                <div className="hv-pill" data-hv-pill>
                  <span className="hv-pill-name">{h.heroPill}</span>
                  <Link href={localize("/projects", lang)} className="hv-cta">
                    {h.heroCta}
                    <ArrowUpRight />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* 2. MARQUEE */}
          <Marquee text={h.marquee} />

          {/* 3. COSA FACCIAMO */}
          <section className="hv-block hv-services" id="services">
            <div className="hv-card hv-services-card">
              <div className="hv-services-head">
                <p className="hv-kicker">{h.servicesKicker}</p>
                <h2 className="hv-h2" data-hv-title>
                  {h.servicesTitle[0]}
                </h2>
                <p className="hv-services-sub" data-hv-rise>
                  {h.servicesIntro}
                </p>
              </div>
              <ul className="hv-services-grid" data-hv-stagger>
                {services.map((service) => (
                  <li key={service.slug}>
                    <Link href={localize(`/services/${service.slug}`, lang)} className="hv-service">
                      <h3>
                        {service.title[lang]}
                        <ArrowUpRight />
                      </h3>
                      <p>{service.text[lang]}</p>
                      <span className="hv-service-more">
                        {h.servicesMore}
                        <ArrowUpRight />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {/* SEO line that used to sit in the hero: same words, now under the services. */}
              <p className="hv-services-note">{h.lead}</p>
            </div>
          </section>

          {/* 4. STUDIO FILM: player grande + fila video del canale (lib/ctrl-videos.ts) */}
          {/* No visible title: the player and its poster speak for themselves; the name stays for screen readers. */}
          <section className="hv-block hv-film" aria-label={h.filmTitle}>
            <div className="hv-card hv-film-card">
              <p className="hv-kicker hv-film-kicker">CTRL® / {h.filmKicker}</p>
              <div className="hv-film-frame" data-hv-rise>
                <HomeFilm lang={lang} />
              </div>
            </div>
          </section>

          {/* 5. RECENSIONI: bento a pagine (dati in lib/testimonials.ts) */}
          {showTestimonials() ? <HomeTestimonials /> : null}

          {/* 7. PERCHE CTRL */}
          <section className="hv-block hv-why" aria-labelledby="hv-why-title">
            <div className="hv-card hv-why-card">
              <div className="hv-why-bg" aria-hidden="true">
                <Image src="/images/home/perche.jpg" alt="" fill sizes="100vw" quality={70} />
              </div>
              <div className="hv-why-left">
                <p className="hv-kicker">{h.whyKicker}</p>
                <h2 className="hv-why-words" id="hv-why-title" data-hv-title>
                  {h.whyWords.join(" ")}
                </h2>
              </div>
              <div className="hv-why-right">
                <p className="hv-why-lead" data-hv-rise>
                  {h.whyLead}
                </p>
                <dl className="hv-stats" data-hv-stagger>
                  {h.stats.map((s) => (
                    <div className="hv-stat" key={s.value}>
                      <dt>{s.value}</dt>
                      <dd>
                        <span>{s.label[0]}</span>
                        <span>{s.label[1]}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          {reviewStrip ? (
            <section className="hv-block hv-reviews-wrap">
              <div className="hv-card hv-reviews-card">
                <HeroReviews data={reviewStrip} />
              </div>
            </section>
          ) : null}

          {/* 8. PARLIAMONE */}
          <Marquee text={h.talkMarquee} />
          <section className="hv-block hv-talk" aria-labelledby="hv-talk-title">
            <div className="hv-card hv-talk-card">
              <p className="hv-kicker">{b.tag}</p>
              <h2 className="hv-talk-title" id="hv-talk-title" data-hv-title>
                {b.title}
              </h2>
              <p className="hv-talk-lead">
                {b.lead[0]} {b.lead[1]}
              </p>
              <div className="hv-talk-actions">
                <Link href={localize("/bookings", lang)} className="hv-cta hv-cta-lg">
                  {b.bookCta}
                  <ArrowUpRight />
                </Link>
                <Link href={localize("/contact", lang)} className="hv-ghost">
                  {b.fallback}
                </Link>
              </div>
            </div>
          </section>
        </main>
      </HomeMotionV2>
      <SiteFooter />
    </>
  );
}
