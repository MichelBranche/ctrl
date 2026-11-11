import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PArrow } from "@/components/projects/arrow";
import { ProjectsMotion } from "@/components/projects/projects-motion";
import { Crumbs } from "@/components/seo/crumbs";
import { FaqList } from "@/components/seo/faq";
import { JsonLd } from "@/components/seo/json-ld";
import { SecuritySection } from "@/components/security/security-section";
import { SECURITY_IMAGE, SECURITY_PATH, securityCopy } from "@/components/security/security-copy";
import { services } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";
import { alternates, breadcrumbNode, faqNode, openGraph, serviceNode, SITE_URL } from "@/lib/seo";
import "@/components/projects/projects.css";
import "@/components/services/webapp.css";
import "@/components/pages/service-detail.css";

const PARENT = "/services/growth-support";

export function securityMetadata(lang: Locale): Metadata {
  const p = securityCopy[lang].page;
  return {
    title: p.metaTitle,
    description: p.metaDescription,
    alternates: alternates(SECURITY_PATH, lang),
    openGraph: openGraph(lang, { title: p.metaTitle, description: p.metaDescription, images: [SECURITY_IMAGE] }),
  };
}

/** Service node plus the two yearly plans as offers (prices VAT excluded). */
function securityServiceNode(lang: Locale) {
  const c = securityCopy[lang];
  const url = `${SITE_URL}${localize(SECURITY_PATH, lang)}`;
  return {
    ...serviceNode(lang, { name: c.page.metaTitle, description: c.page.metaDescription, path: SECURITY_PATH, serviceType: c.page.serviceType }),
    image: `${SITE_URL}${SECURITY_IMAGE}`,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: c.plansKicker,
      itemListElement: c.plans.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        description: plan.fit,
        url,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: plan.price,
          priceCurrency: "EUR",
          valueAddedTaxIncluded: false,
          billingDuration: "P1Y",
          unitCode: "ANN",
        },
      })),
    },
  };
}

export function SecurityView({ lang }: { lang: Locale }) {
  const c = securityCopy[lang];
  const p = c.page;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: p.crumbs[0], path: "/services" },
    { name: p.crumbs[1], path: PARENT },
    { name: p.crumbs[2], path: SECURITY_PATH },
  ];

  return (
    <>
      <JsonLd data={[breadcrumbNode(lang, crumbs), securityServiceNode(lang), faqNode(p.faqs)]} />
      <SiteHeader />
      <main className="p-root wa-root" data-motion-root>
        <section className="p-hero wa-hero">
          <span className="p-hero-frame wa-hero-frame" aria-hidden="true">
            <Image className="p-hero-img wa-hero-img sec-hero-img" src={SECURITY_IMAGE} alt="" fill priority sizes="(max-width: 760px) 100vw, 70vw" data-p-hero-img />
          </span>
          <div className="p-hero-copy">
            <Crumbs label={lang === "it" ? "Percorso" : "Breadcrumbs"} items={crumbs.map((item) => ({ name: item.name, href: localize(item.path, lang) }))} />
            <p className="p-tag p-mono" data-p-fade>{p.tag}</p>
            <h1 className="p-title p-title-cat sec-hero-title" data-p-split aria-label={p.title.join(" ")}>
              {p.title.map((line) => (
                <span key={line}>{line} </span>
              ))}
            </h1>
            <p className="p-lead" data-p-fade>{p.lead}</p>
          </div>
        </section>

        <SecuritySection lang={lang} variant="page" />

        <section className="wa-wrap wa-process" aria-labelledby="sec-process">
          <div data-p-fade-scroll>
            <p className="p-kicker p-mono">{p.processKicker}</p>
            <h2 className="wa-h2" id="sec-process">{p.processTitle}</h2>
          </div>
          <ol className="wa-steps">
            {p.steps.map((step, index) => (
              <li key={step.title} className="wa-step" data-p-card>
                <span className="wa-step-dot" aria-hidden="true" />
                <span className="p-mono wa-step-n">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="wa-step-title">{step.title}</h3>
                <p className="wa-step-text">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="wa-wrap">
          <FaqList id="sec-faq" title={p.faqTitle} items={p.faqs} />
        </div>

        <section className="p-others" aria-labelledby="sec-others">
          <h2 className="p-kicker p-mono" id="sec-others">{lang === "it" ? "Altri servizi" : "Other services"}</h2>
          <ul className="p-others-grid">
            {services.map((item) => (
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
