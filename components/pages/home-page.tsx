import Image from "next/image";
import Link from "next/link";
import { HeroReviews } from "@/components/hero-reviews";
import { HomeFilm } from "@/components/home-film";
import { HomeHeader } from "@/components/home/home-header";
import { HomeMotionV2 } from "@/components/home/home-motion-v2";
import { HomePlates } from "@/components/home/home-plates";
import { LeVeleFilm } from "@/components/projects/le-vele-film";
import { SiteFooter } from "@/components/site-footer";
import { homeFeatured, LE_VELE, LE_VELE_MEDIA, services } from "@/lib/content";
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

/** Brand colour sampled from each featured project's own site: the card's atmosphere. */
const ATMOS: Record<string, { tint: string; ink: "light" | "dark" }> = {
  "01": { tint: "#b9d64a", ink: "dark" },
  "02": { tint: "#8c2a35", ink: "light" },
  "03": { tint: "#a87a4f", ink: "light" },
  "04": { tint: "#2f6fe4", ink: "light" },
};

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
            items: [
              { label: LE_VELE.client, href: localize(LE_VELE.path, lang) },
              ...homeFeatured.map((item) => ({ label: item.title[lang], href: localize(item.href, lang) })),
              { label: h.allProjects, href: localize("/projects", lang) },
            ],
          },
          {
            id: "services",
            label: t.nav.services,
            items: [
              ...services.map((service) => ({ label: service.title[lang], href: localize(`/services/${service.slug}`, lang) })),
              { label: h.navAllServices, href: localize("/services", lang) },
            ],
          },
          {
            id: "more",
            label: h.navMore,
            items: [
              { label: t.nav.journal, href: localize("/journal", lang) },
              { label: t.nav.contact, href: localize("/contact", lang) },
              { label: h.navTalk, href: localize("/bookings", lang) },
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
                  <a href="#work" className="hv-cta">
                    {h.heroCta}
                    <ArrowUpRight />
                  </a>
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

          {/* 4. PROGETTI: caso studio Le Vele */}
          <section className="hv-block hv-work" id="work" aria-labelledby="hv-work-title">
            <div className="hv-work-head">
              <p className="hv-kicker">{h.workKicker}</p>
              <h2 className="hv-h2" id="hv-work-title" data-hv-title>
                {h.workTitle}
              </h2>
              <Link href={localize("/projects", lang)} className="hv-link">
                {h.allProjects}
                <ArrowUpRight />
              </Link>
            </div>

            <article className="hv-card hv-case" aria-labelledby="hv-case-title">
              <div className="hv-case-copy">
                <p className="hv-kicker">{h.proofKicker}</p>
                <h3 className="hv-case-title" id="hv-case-title" data-hv-title>
                  {h.proofTitle}
                </h3>
                <p className="hv-case-text">{h.proofText}</p>
                <dl className="hv-case-stats" data-hv-stagger>
                  {h.proofStats.map((s) => (
                    <div key={s.value}>
                      <dt>{s.value}</dt>
                      <dd>{s.label}</dd>
                    </div>
                  ))}
                </dl>
                <div className="hv-pill hv-pill-light">
                  <span className="hv-pill-name">{LE_VELE.client}</span>
                  <Link href={localize(LE_VELE.path, lang)} className="hv-cta">
                    {h.proofCta}
                    <ArrowUpRight />
                  </Link>
                </div>
              </div>
              <div className="hv-case-media" data-hv-rise>
                <LeVeleFilm
                  variant="fill"
                  fixedCut={LE_VELE_MEDIA.desktop}
                  labelDesktop={`${LE_VELE.client}: ${lang === "it" ? "anteprima del sito" : "website preview"}`}
                  labelMobile={`${LE_VELE.client}: ${lang === "it" ? "anteprima del sito" : "website preview"}`}
                  playLabel={lang === "it" ? "Riproduci il video" : "Play the video"}
                />
              </div>
            </article>

            {/* 5. PROGETTI: quattro lavori, ognuno con la sua tinta */}
            <div className="hv-projects">
              {homeFeatured.map((item) => {
                const atmos = ATMOS[item.index];
                return (
                  <article
                    key={item.index}
                    className="hv-card hv-project"
                    data-ink={atmos.ink}
                    style={{ "--tint": atmos.tint } as React.CSSProperties}
                  >
                    {item.image ? (
                      <div className="hv-project-media" aria-hidden="true">
                        <div className="hv-project-img" data-hv-parallax>
                          <Image src={item.image} alt="" fill sizes="(max-width: 900px) 100vw, 50vw" quality={72} />
                        </div>
                      </div>
                    ) : null}
                    <i className="hv-project-veil" aria-hidden="true" />
                    <div className="hv-project-top">
                      <h3 className="hv-project-title">{item.title[lang]}</h3>
                      <p className="hv-project-cat">
                        <span>{item.index}</span> {item.category[lang]}
                      </p>
                    </div>
                    <div className="hv-project-bottom">
                      <p className="hv-project-text">{item.description[lang]}</p>
                      <div className="hv-pill">
                        <span className="hv-pill-name">{item.title[lang]}</span>
                        <Link href={localize(item.href, lang)} className="hv-cta" aria-label={`${h.openProject}: ${item.title[lang]}`}>
                          {h.openProject}
                          <ArrowUpRight />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* 6. STUDIO FILM */}
          <section className="hv-block hv-film" aria-labelledby="hv-film-title">
            <div className="hv-card hv-film-card">
              <div className="hv-film-head">
                <div>
                  <p className="hv-kicker">CTRL® / {h.filmKicker}</p>
                  <h2 className="hv-h3" id="hv-film-title">
                    {h.filmTitle}
                  </h2>
                </div>
                <a href="https://www.youtube.com/watch?v=upTqsodkdo4" target="_blank" rel="noopener noreferrer" className="hv-link">
                  {lang === "it" ? "Guarda su YouTube" : "Watch on YouTube"}
                  <ArrowUpRight />
                </a>
              </div>
              <div className="hv-film-frame" data-hv-rise>
                <HomeFilm title={h.filmTitle} play={lang === "it" ? "Riproduci il video" : "Play the video"} />
              </div>
            </div>
          </section>

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
              <i className="hv-talk-glow" aria-hidden="true" />
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
