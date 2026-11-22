import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ArrowUpRight } from "@/components/ds/arrow-up-right";
import { ServicesMotion } from "@/components/pages/services-motion";
import { Crumbs } from "@/components/seo/crumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getServiceDetail } from "@/components/pages/service-detail-copy";
import { getService, services } from "@/lib/content";
import { dict, localize, type Locale } from "@/lib/i18n";
import { breadcrumbNode, faqNode, publicMeta, schemaName, serviceNode } from "@/lib/seo";
import "./service-page.css";

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
  const othersLabel = lang === "it" ? "Altri servizi" : "Other services";

  return (
    <>
      <JsonLd data={[breadcrumbNode(lang, crumbs), serviceNode(lang, { name: schemaName(detail.metaTitle), description: detail.metaDescription, path, serviceType: detail.serviceType }), faqNode(detail.faqs)]} />
      <SiteHeader />
      <main className="sx" data-motion-root>
        <ServicesMotion root=".sx" />

        {/* 1. HERO: copy card and image card side by side. */}
        <section className="sx-hero" data-sv-hero>
          <div className="sx-card sx-hero-copy">
            <Crumbs label={crumbLabel} items={crumbs.map((item) => ({ name: item.name, href: localize(item.path, lang) }))} />
            <div className="sx-hero-text">
              <p className="sx-index" data-sv-fade>{detail.tag}</p>
              <h1 className="sx-title" data-sv-words>{detail.title}</h1>
              <p className="sx-lead" data-sv-fade>{detail.lead}</p>
              <Link href={localize("/contact", lang) as Route} className="sx-cta" data-sv-fade>
                {detail.cta}
                <ArrowUpRight className="sx-arrow" />
              </Link>
            </div>
          </div>
          <div className="sx-card sx-hero-media">
            <Image src={detail.image} alt={detail.imageAlt} fill priority sizes="(max-width: 900px) 100vw, 45vw" className="sx-hero-img" data-sv-hero-img />
          </div>
        </section>

        {/* 2. WHAT + FOR WHOM: wide light card, narrow dark card. */}
        <section className="sx-block">
          <div className="sx-pair">
            <div className="sx-card sx-what" data-sv-rise>
              <h2 className="sx-h2" id="sd-what" data-sv-title>{detail.whatTitle}</h2>
              <div className="sx-prose">
                {detail.what.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="sx-card sx-for" data-sv-rise>
              <h2 className="sx-h3" id="sd-for">{detail.forTitle}</h2>
              <ul className="sx-for-list">
                {detail.forWhom.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 3. INCLUDED: one dark card, inner tiles. */}
        <section className="sx-block" aria-labelledby="sd-included">
          <div className="sx-card sx-included">
            <h2 className="sx-h2" id="sd-included" data-sv-title>{detail.includedTitle}</h2>
            <ul className="sx-tiles" data-sv-stagger style={{ "--cols": detail.included.length === 4 ? 4 : 3 } as React.CSSProperties}>
              {detail.included.map((item, index) => (
                <li key={item.title} className="sx-tile">
                  <span className="sx-tile-n">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. PROCESS: light card, steps on a line. */}
        <section className="sx-block" aria-labelledby="sd-process">
          <div className="sx-card sx-process">
            <div className="sx-process-head">
              <p className="sx-kicker">{detail.processKicker}</p>
              <h2 className="sx-h2" id="sd-process" data-sv-title>{detail.processTitle}</h2>
            </div>
            <ol className="sx-steps" data-sv-stagger>
              {detail.steps.map((step, index) => (
                <li key={step.title} className="sx-step">
                  <span className="sx-step-n">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. TIMING + CTA: the one orange card of the page. */}
        <section className="sx-block" aria-labelledby="sd-timing">
          <div className="sx-card sx-timing" data-sv-rise>
            <h2 className="sx-h2" id="sd-timing">{detail.timingTitle}</h2>
            <div className="sx-timing-body">
              <p>{detail.timing}</p>
              <div className="sx-related">
                {detail.related.map((link) => (
                  <Link key={link.href} href={localize(link.href, lang) as Route} className="sx-chip">
                    {link.label}
                  </Link>
                ))}
              </div>
              <Link href={localize("/contact", lang) as Route} className="sx-cta sx-cta-ink">
                {detail.cta}
                <ArrowUpRight className="sx-arrow" />
              </Link>
            </div>
          </div>
        </section>

        {/* 6. FAQ */}
        <section className="sx-block" aria-labelledby="sd-faq">
          <div className="sx-card sx-faq">
            <h2 className="sx-h2" id="sd-faq" data-sv-title>{detail.faqTitle}</h2>
            <div className="sx-faq-list">
              {detail.faqs.map((item) => (
                <details key={item.q} className="sx-details">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 7. OTHER SERVICES: a row of small light cards. */}
        <section className="sx-block" aria-labelledby="sd-others">
          <h2 className="sx-others-title" id="sd-others">{othersLabel}</h2>
          <ul className="sx-others" data-sv-stagger>
            {others.map((item) => (
              <li key={item.slug}>
                <Link href={localize(`/services/${item.slug}`, lang) as Route} className="sx-card sx-other">
                  <span className="sx-other-n">{item.index}</span>
                  <span className="sx-other-name">
                    {item.title[lang]}
                    <ArrowUpRight className="sx-arrow" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
