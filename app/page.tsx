import Image from "next/image";
import Link from "next/link";
import { HomeMotion } from "@/components/home-motion";
import { ArrowIcon, ServiceIcon } from "@/components/icons";
import { ProjectCard } from "@/components/project-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { projects, services } from "@/lib/content";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <HomeMotion>
        <main>
          <section className="hero" data-hero id="top">
            <div className="hero-copy">
              <p className="kicker" data-load="kicker">
                Creative technology company
              </p>
              <h1 className="hero-title">
                <span className="line-mask">
                  <span data-mask="hero">Design.</span>
                </span>
                <span className="line-mask">
                  <span data-mask="hero">Development.</span>
                </span>
                <span className="line-mask">
                  <span data-mask="hero">Visual Communication.</span>
                </span>
              </h1>
              <p className="hero-lead" data-load="lead">
                We&apos;re CTRL®, an independent studio that combines design,
                software development and visual communication, helping brands
                go from identity to digital products and beyond.
              </p>
              <span className="magnetic" data-magnetic>
                <Link href="/#work" className="text-link" data-load="cta" data-cursor="Work">
                  Explore our work
                  <ArrowIcon />
                </Link>
              </span>
            </div>

            <div className="hero-visual">
              <div className="hero-media" data-parallax>
                <Image
                  src="/images/hero.jpg"
                  alt="Interno in cemento attraversato da una lama di luce"
                  fill
                  priority
                  sizes="(max-width: 860px) 100vw, 48vw"
                />
              </div>

              <div className="poster-slot">
              <div className="poster-float" data-float>
              <figure className="poster" data-load="poster">
                <Image
                  src="/images/mountain.jpg"
                  alt=""
                  fill
                  priority
                  sizes="320px"
                />
                <span className="poster-rule" aria-hidden="true" />
                <div className="poster-copy poster-copy-top">
                  <span>Brands</span>
                  <span>Digital Products</span>
                  <span>Visuals</span>
                </div>
                <div className="poster-copy poster-copy-bottom">
                  <span>Ideas</span>
                  <span>Technology</span>
                  <span>Impact</span>
                </div>
              </figure>
              </div>
              </div>

              <a href="#services" className="scroll-hint" data-load="scroll">
                <span>Scroll</span>
                <i />
              </a>
            </div>
          </section>

          <section className="services" id="services">
            <div className="services-head">
              <p className="kicker kicker-ink" data-reveal>
                What we do
              </p>
              <h2>
                <span className="line-mask">
                  <span data-mask="scroll">More than a website.</span>
                </span>
                <span className="line-mask">
                  <span data-mask="scroll">A digital presence that</span>
                </span>
                <span className="line-mask">
                  <span data-mask="scroll">evolves with your brand.</span>
                </span>
              </h2>
              <span className="draw-rule" data-draw />
              <p className="services-lead" data-reveal>
                Un unico partner per progettare, costruire e far evolvere la
                presenza digitale di un&apos;azienda. Dall&apos;identità visiva ai
                prodotti digitali, uniamo creatività, tecnologia e strategia per
                creare esperienze che lasciano il segno.
              </p>
            </div>

            <div className="service-grid">
              {services.map((service) => (
                <Link
                  key={service.slug}
                  href={`/services/${service.slug}`}
                  className="service-cell"
                  data-cursor="View"
                >
                  <div className="service-meta">
                    <span>{service.index}</span>
                    <ServiceIcon name={service.icon} />
                  </div>
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                  <span className="service-go">
                    View
                    <ArrowIcon />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="work" id="work" data-work>
            <div className="work-viewport">
              <div className="work-head">
                <p className="kicker">Latest work</p>
                <span className="magnetic" data-magnetic>
                  <Link href="/work" className="text-link" data-cursor="All">
                    View all projects
                    <ArrowIcon />
                  </Link>
                </span>
              </div>
              <div className="work-track" data-work-track>
                {projects.map((project, index) => (
                  <ProjectCard key={project.slug} project={project} index={index} />
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
