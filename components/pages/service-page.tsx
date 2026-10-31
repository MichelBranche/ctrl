import { CtaLink } from "@/components/cta-link";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowIcon, ServiceIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT_EMAIL, getService, services } from "@/lib/content";
import { dict, localize, type Locale } from "@/lib/i18n";

export function serviceMetadata(slug: string, lang: Locale): Metadata {
  const service = getService(slug);
  if (!service) return { title: dict[lang].services.fallback };
  return { title: service.title[lang], description: service.text[lang] };
}

export function ServiceView({ slug, lang }: { slug: string; lang: Locale }) {
  const service = getService(slug);
  if (!service) notFound();
  const t = dict[lang];

  const index = services.findIndex((item) => item.slug === service.slug);
  const next = services[(index + 1) % services.length];

  return (
    <>
      <SiteHeader />
      <main className="subpage service-page">
        <Link href={localize("/services", lang)} className="text-link case-back">
          <ArrowIcon />
          {t.services.back}
        </Link>
        <p className="kicker">{service.index}</p>
        <h1>{service.title[lang]}</h1>
        <div className="service-page-grid">
          <div>
            <p className="service-page-lead">{service.text[lang]}</p>
            <p>{service.summary[lang]}</p>
            <CtaLink href={`mailto:${CONTACT_EMAIL}`} className="service-page-cta">
              {t.cta}
            </CtaLink>
          </div>
          <div>
            <div className="service-page-mark" aria-hidden="true">
              <ServiceIcon name={service.icon} />
            </div>
            <ul className="service-points">
              {service.points[lang].map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
        <Link href={localize(`/services/${next.slug}`, lang)} className="service-next">
          <span>{t.services.next}</span>
          <strong>
            {next.index} {next.title[lang]}
            <ArrowIcon />
          </strong>
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
