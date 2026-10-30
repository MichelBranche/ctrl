import Image from "next/image";
import Link from "next/link";
import { HomeMotion } from "@/components/home-motion";
import { ArrowIcon, ServiceIcon } from "@/components/icons";
import { ProjectCard } from "@/components/project-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT_EMAIL, projects, services } from "@/lib/content";
import { dict, localize, type Locale } from "@/lib/i18n";

export function HomePage({ lang }: { lang: Locale }) {
  const t = dict[lang];
  const h = t.home;
  return (
    <>
      <SiteHeader />
      <HomeMotion>
        <main>
          <section className="hero" data-hero id="top">
            <div className="hero-copy">
              <p className="kicker" data-load="kicker">
                {h.kicker}
              </p>
              <h1 className="hero-title">
                {h.title.map((line) => (
                  <span className="line-mask" key={line}>
                    <span data-mask="hero">{line}</span>
                  </span>
                ))}
              </h1>
              <p className="hero-lead" data-load="lead">
                {h.lead}
              </p>
              <div className="hero-actions" data-load="cta">
                <span className="magnetic" data-magnetic>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="cta-button">
                    <span>{t.cta}</span>
                    <ArrowIcon />
                  </a>
                </span>
                <Link href={localize("/#work", lang)} className="text-link">
                  {h.secondary}
                  <ArrowIcon />
                </Link>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-media" data-parallax>
                <Image
                  src="/images/hero.jpg"
                  alt={h.heroAlt}
                  fill
                  priority
                  sizes="(max-width: 860px) 100vw, 48vw"
                />
              </div>

              <div className="poster-slot">
                <div className="poster-float" data-float>
                  <figure className="poster" data-load="poster">
                    <Image src="/images/mountain.jpg" alt="" fill priority sizes="320px" />
                    <span className="poster-rule" aria-hidden="true" />
                    <div className="poster-copy poster-copy-top">
                      {h.posterTop.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                    <div className="poster-copy poster-copy-bottom">
                      {h.posterBottom.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  </figure>
                </div>
              </div>

              <a href="#services" className="scroll-hint" data-load="scroll">
                <span>{h.scroll}</span>
                <i />
              </a>
            </div>
          </section>

          <section className="services" id="services">
            <div className="services-head">
              <p className="kicker kicker-ink" data-reveal>
                {h.servicesKicker}
              </p>
              <h2>
                {h.servicesTitle.map((line) => (
                  <span className="line-mask" key={line}>
                    <span data-mask="scroll">{line}</span>
                  </span>
                ))}
              </h2>
              <span className="draw-rule" data-draw />
              <p className="services-lead" data-reveal>
                {h.servicesLead}
              </p>
            </div>

            <div className="service-grid">
              {services.map((service) => (
                <Link
                  key={service.slug}
                  href={localize(`/services/${service.slug}`, lang)}
                  className="service-cell"
                >
                  <div className="service-meta">
                    <span>{service.index}</span>
                    <ServiceIcon name={service.icon} />
                  </div>
                  <h3>{service.title[lang]}</h3>
                  <p>{service.text[lang]}</p>
                  <span className="service-go">
                    {h.view}
                    <ArrowIcon />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="work" id="work" data-work>
            <div className="work-viewport">
              <div className="work-head">
                <p className="kicker">{h.workKicker}</p>
                <span className="magnetic" data-magnetic>
                  <Link href={localize("/work", lang)} className="text-link">
                    {h.allProjects}
                    <ArrowIcon />
                  </Link>
                </span>
              </div>
              <div className="work-track" data-work-track>
                {projects.map((project, index) => (
                  <ProjectCard key={project.slug} project={project} index={index} lang={lang} />
                ))}
              </div>
            </div>
          </section>
        </main>
      </HomeMotion>
      <SiteFooter />
    </>
  );
}
