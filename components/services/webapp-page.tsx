import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PArrow } from "@/components/projects/arrow";
import { ProjectsMotion } from "@/components/projects/projects-motion";
import { WebappCarousel } from "@/components/services/webapp-carousel";
import { webappCopy } from "@/components/services/webapp-copy";
import { JsonLd } from "@/components/seo/json-ld";
import { localize, type Locale } from "@/lib/i18n";
import { alternates, breadcrumbNode, openGraph, serviceNode } from "@/lib/seo";
import "@/components/projects/projects.css";
import "./webapp.css";

const PATH = "/services/webapp";

export function webappMetadata(lang: Locale): Metadata {
  const c = webappCopy[lang];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: alternates(PATH, lang),
    openGraph: openGraph(lang, { title: c.metaTitle, description: c.metaDescription, images: ["/images/projects/webapps.webp"] }),
  };
}

const ICONS = {
  layers: "M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2.5",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14a6 6 0 0 1 3.5 6",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
} as const;

export function WebappView({ lang }: { lang: Locale }) {
  const c = webappCopy[lang];
  const crumbs = [
    { name: lang === "it" ? "Home" : "Home", path: "/" },
    { name: c.crumbs[0], path: "/services" },
    { name: c.crumbs[1], path: PATH },
  ];
  return (
    <>
      <JsonLd data={[breadcrumbNode(lang, crumbs), serviceNode(lang, { name: c.metaTitle, description: c.metaDescription, path: PATH, serviceType: "Web application development" })]} />
      <SiteHeader />
      <main className="p-root wa-root" data-motion-root>
        <section className="p-hero wa-hero">
          <span className="p-hero-frame wa-hero-frame" aria-hidden="true">
            <Image className="p-hero-img wa-hero-img" src="/images/projects/webapps.webp" alt="" fill priority sizes="(max-width: 760px) 100vw, 70vw" data-p-hero-img />
          </span>
          <div className="p-hero-copy">
            <nav className="p-back p-mono wa-crumbs" aria-label="Breadcrumb" data-p-fade>
              <Link href={localize("/services", lang)} className="wa-crumb-back" aria-label={c.back}>
                <PArrow className="p-arrow p-arrow-back" />
              </Link>
              <Link href={localize("/services", lang)}>{c.crumbs[0]}</Link>
              <span aria-hidden="true">›</span>
              <span aria-current="page" className="wa-crumb-here">{c.crumbs[1]}</span>
            </nav>
            <p className="p-tag p-mono" data-p-fade>{c.tag}</p>
            <h1 className="p-title p-title-cat" data-p-split aria-label={c.title.join(" ")}>
              {c.title.map((line) => (
                <span key={line}>{line} </span>
              ))}
            </h1>
            <p className="p-lead" data-p-fade>{c.lead}</p>
          </div>
        </section>

        <section className="wa-wrap wa-service" aria-labelledby="wa-service-title">
          <div className="wa-service-head" data-p-fade-scroll>
            <p className="p-kicker p-mono">{c.serviceKicker}</p>
            <h2 className="wa-h2" id="wa-service-title">
              {c.serviceTitle.map((l) => <span key={l}>{l}</span>)}
            </h2>
          </div>
          <div className="wa-service-copy" data-p-fade-scroll>
            <p>{c.serviceText}</p>
            <Link href={localize("/contact", lang)} className="p-btn p-btn-fill" data-magnetic>
              <span className="p-mono">{c.consult}</span>
              <PArrow />
            </Link>
          </div>
        </section>

        <ul className="wa-wrap wa-features">
          {c.features.map((f) => (
            <li key={f.title} className="wa-feature" data-p-card>
              <span className="wa-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"><path d={ICONS[f.icon]} /></svg>
              </span>
              <h3 className="wa-feature-title">{f.title}</h3>
              <p className="wa-feature-text">{f.text}</p>
            </li>
          ))}
        </ul>

        <section className="wa-wrap" aria-label={c.slidesLabel}>
          <WebappCarousel slides={c.slides.map((s) => (s.external ? s : { ...s, href: localize(s.href, lang) }))} label={c.slidesLabel} prev={c.prev} next={c.next} goTo={c.slides.map((_, n) => c.goTo(n + 1))} newTab={c.newTab} />
        </section>

        <section className="wa-wrap wa-process" aria-labelledby="wa-process-title">
          <div data-p-fade-scroll>
            <p className="p-kicker p-mono">{c.processKicker}</p>
            <h2 className="wa-h2" id="wa-process-title">
              {c.processTitle.map((l) => <span key={l}>{l}</span>)}
            </h2>
          </div>
          <ol className="wa-steps">
            {c.steps.map((s, n) => (
              <li key={s.title} className="wa-step" data-p-card>
                <span className="wa-step-dot" aria-hidden="true" />
                <span className="p-mono wa-step-n">{String(n + 1).padStart(2, "0")}</span>
                <h3 className="wa-step-title">{s.title}</h3>
                <p className="wa-step-text">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <ProjectsMotion />
      </main>
      <SiteFooter />
    </>
  );
}
