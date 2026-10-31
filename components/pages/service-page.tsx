import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PArrow } from "@/components/projects/arrow";
import { ProjectsMotion } from "@/components/projects/projects-motion";
import { getService, services } from "@/lib/content";
import { dict, localize, type Locale } from "@/lib/i18n";
import "@/components/projects/projects.css";
import "./service-wip.css";

/* Service detail pages are a work-in-progress state for now, in the same visual language as the empty
 * Projects category pages. The long copy (summary, points) stays in lib/content.ts for when they return. */

export function serviceMetadata(slug: string, lang: Locale): Metadata {
  const service = getService(slug);
  if (!service) return { title: dict[lang].services.fallback };
  const path = `/services/${service.slug}`;
  return {
    title: service.title[lang],
    description: service.text[lang],
    alternates: { canonical: localize(path, lang), languages: { it: path, en: `/en${path}` } },
    robots: { index: false, follow: true },
  };
}

export function ServiceView({ slug, lang }: { slug: string; lang: Locale }) {
  const service = getService(slug);
  if (!service) notFound();
  const t = dict[lang].services;
  const others = services.filter((item) => item.slug !== service.slug);

  return (
    <>
      <SiteHeader />
      <main className="p-root sw-root" data-motion-root>
        <section className="p-hero sw-hero">
          <div className="p-hero-copy">
            <Link href={localize("/services", lang)} className="p-back p-mono" data-p-fade>
              <PArrow className="p-arrow p-arrow-back" />
              {t.back}
            </Link>
            <p className="p-tag p-mono sw-index" data-p-fade>{service.index}</p>
            <h1 className="p-title p-title-cat" data-p-split>
              {service.title[lang]}
            </h1>
            <p className="p-lead" data-p-fade>{service.text[lang]}</p>
          </div>
        </section>

        <section className="p-works" aria-labelledby="sw-wip-title">
          <div className="p-empty sw-empty" data-p-fade-scroll>
            <span className="p-empty-mark" aria-hidden="true">
              <i />
            </span>
            <p className="p-kicker p-mono">{t.wipKicker}</p>
            <h2 className="p-empty-title" id="sw-wip-title">{t.wipTitle}</h2>
            <span className="sw-progress" aria-hidden="true">
              <i />
            </span>
            <p className="p-empty-text">{t.wipText}</p>
            <div className="sw-actions">
              <Link href={localize("/contact", lang)} className="p-btn p-btn-fill" data-magnetic>
                <span className="p-mono">{t.wipContact}</span>
                <PArrow />
              </Link>
              <Link href={localize("/services", lang)} className="p-btn">
                <span className="p-mono">{t.back}</span>
                <PArrow />
              </Link>
            </div>
          </div>
        </section>

        <section className="p-others" aria-labelledby="sw-others-title">
          <h2 className="p-kicker p-mono" id="sw-others-title" data-p-fade-scroll>{t.wipOthers}</h2>
          <ul className="p-others-grid sw-others">
            {others.map((item) => (
              <li key={item.slug}>
                <Link href={localize(`/services/${item.slug}`, lang)} className="p-other sw-other" data-p-card>
                  <span className="p-mono sw-other-index">{item.index}</span>
                  <span className="p-other-label sw-other-label">
                    {item.title[lang]}
                    <PArrow className="p-arrow p-card-arrow" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <ProjectsMotion />
      </main>
      <SiteFooter />
    </>
  );
}
