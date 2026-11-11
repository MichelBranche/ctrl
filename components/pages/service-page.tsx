import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PArrow } from "@/components/projects/arrow";
import { ProjectsMotion } from "@/components/projects/projects-motion";
import { Crumbs } from "@/components/seo/crumbs";
import { FaqList } from "@/components/seo/faq";
import { JsonLd } from "@/components/seo/json-ld";
import { getServiceDetail } from "@/components/pages/service-detail-copy";
import { getService, services } from "@/lib/content";
import { dict, localize, type Locale } from "@/lib/i18n";
import { breadcrumbNode, faqNode, publicMeta, schemaName, serviceNode } from "@/lib/seo";
import "@/components/projects/projects.css";
import "@/components/services/webapp.css";
import "./service-detail.css";

export function serviceMetadata(slug: string, lang: Locale): Metadata {
  const service = getService(slug);
  const detail = getServiceDetail(slug, lang);
  if (!service || !detail) return { title: dict[lang].services.fallback };
  const path = `/services/${service.slug}`;
  return publicMeta(lang, { title: detail.metaTitle, description: detail.metaDescription, itPath: path, images: [detail.image] });
}

export function ServiceView({ slug, lang }: { slug: string; lang: Locale }) {
  const service = getService(slug);
  const detail = getServiceDetail(slug, lang);
  if (!service || !detail) notFound();
  const t = dict[lang];
  const home = lang === "it" ? "Home" : "Home";
  const servicesLabel = t.nav.services;
  const crumbLabel = lang === "it" ? "Percorso" : "Breadcrumbs";
  const path = `/services/${service.slug}`;
  const crumbs = [
    { name: home, path: "/" },
    { name: servicesLabel, path: "/services" },
    { name: service.title[lang], path },
  ];
  const others = services.filter((item) => item.slug !== service.slug);

  return (
    <>
      <JsonLd data={[breadcrumbNode(lang, crumbs), serviceNode(lang, { name: schemaName(detail.metaTitle), description: detail.metaDescription, path, serviceType: detail.serviceType }), faqNode(detail.faqs)]} />
      <SiteHeader />
      <main className="p-root wa-root" data-motion-root>
        <section className="p-hero wa-hero">
          <span className="p-hero-frame wa-hero-frame" aria-hidden="true">
            <Image className="p-hero-img wa-hero-img" src={detail.image} alt="" fill priority sizes="(max-width: 760px) 100vw, 70vw" />
          </span>
          <div className="p-hero-copy">
            <Crumbs
              label={crumbLabel}
              items={crumbs.map((item) => ({ name: item.name, href: localize(item.path, lang) }))}
            />
            <p className="p-tag p-mono" data-p-fade>{detail.tag}</p>
            <h1 className="p-title p-title-cat" data-p-split>{detail.title}</h1>
            <p className="p-lead" data-p-fade>{detail.lead}</p>
          </div>
        </section>

        <section className="wa-wrap sd-split" aria-labelledby="sd-what">
          <h2 className="wa-h2" id="sd-what">{detail.whatTitle}</h2>
          <div>
            {detail.what.map((paragraph) => (
              <p className="sd-prose" key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="wa-wrap sd-split" aria-labelledby="sd-for">
          <h2 className="wa-h2" id="sd-for">{detail.forTitle}</h2>
          <ul className="sd-for">
            {detail.forWhom.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="wa-wrap" aria-labelledby="sd-included">
          <h2 className="wa-h2" id="sd-included">{detail.includedTitle}</h2>
          <ul className="sd-included">
            {detail.included.map((item) => (
              <li key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="wa-wrap wa-process" aria-labelledby="sd-process">
          <div>
            <p className="p-kicker p-mono">{detail.processKicker}</p>
            <h2 className="wa-h2" id="sd-process">{detail.processTitle}</h2>
          </div>
          <ol className="wa-steps">
            {detail.steps.map((step, index) => (
              <li key={step.title} className="wa-step">
                <span className="wa-step-dot" aria-hidden="true" />
                <span className="p-mono wa-step-n">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="wa-step-title">{step.title}</h3>
                <p className="wa-step-text">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="wa-wrap sd-split" aria-labelledby="sd-timing">
          <h2 className="wa-h2" id="sd-timing">{detail.timingTitle}</h2>
          <div>
            <p className="sd-prose">{detail.timing}</p>
            <div className="sd-links">
              {detail.related.map((link) => (
                <Link key={link.href} href={localize(link.href, lang) as Route} className="p-mono">
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="sd-links">
              <Link href={localize("/contact", lang) as Route} className="p-btn p-btn-fill">
                <span className="p-mono">{detail.cta}</span>
                <PArrow />
              </Link>
            </div>
          </div>
        </section>

        <div className="wa-wrap">
          <FaqList id="sd-faq" title={detail.faqTitle} items={detail.faqs} />
        </div>

        <section className="p-others" aria-labelledby="sd-others">
          <h2 className="p-kicker p-mono" id="sd-others">{lang === "it" ? "Altri servizi" : "Other services"}</h2>
          <ul className="p-others-grid">
            {others.map((item) => (
              <li key={item.slug}>
                <Link href={localize(`/services/${item.slug}`, lang) as Route} className="p-other">
                  <span className="p-other-label">
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
