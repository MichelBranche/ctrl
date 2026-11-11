import { CtaLink } from "@/components/cta-link";
import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { contactCopy } from "@/components/pages/contact-copy";
import { ContactMotion } from "@/components/pages/contact-motion";
import { ContactForm } from "@/components/pages/contact-wizard";
import { Crumbs } from "@/components/seo/crumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { CONTACT_EMAIL, STUDIO_PLACE, studioMapEmbedUrl } from "@/lib/content";
import { formatRating } from "@/lib/google-reviews-core";
import { getGoogleReviews } from "@/lib/google-reviews";
import { localize, type Locale } from "@/lib/i18n";
import { alternates, breadcrumbNode, openGraph } from "@/lib/seo";
import { getSocialLinks } from "@/lib/settings";
import "./contact.css";

export function contactMetadata(lang: Locale): Metadata {
  const c = contactCopy[lang];
  return { title: c.metaTitle, description: c.metaDescription, alternates: alternates("/contact", lang), openGraph: openGraph(lang, { title: c.metaTitle, description: c.metaDescription }) };
}

function Arrow({ className = "c-arrow" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export async function ContactView({ lang }: { lang: Locale }) {
  const c = contactCopy[lang];
  const socials = await getSocialLinks();
  const reviews = await getGoogleReviews();
  const rating = reviews && !reviews.fixture && typeof reviews.rating === "number" ? formatRating(reviews.rating, lang) : null;
  const address = STUDIO_PLACE.address[lang];
  const crumbs = [
    { name: "Home", path: "/" },
    { name: c.tag, path: "/contact" },
  ];
  return (
    <>
      <JsonLd data={[breadcrumbNode(lang, crumbs)]} />
      <SiteHeader />
      <ContactMotion />
      <main className="c-root">
        <section className="c-hero">
          <Image className="c-hero-img" src="/images/home/perche.jpg" alt="" fill priority sizes="100vw" />
          <div className="c-hero-copy">
            <Crumbs label={lang === "it" ? "Percorso" : "Breadcrumbs"} items={crumbs.map((item) => ({ name: item.name, href: localize(item.path, lang) }))} />
            <p className="c-tag">{c.tag}</p>
            <h1 className="c-title">{c.title}</h1>
            <p className="c-lead">
              {c.lead.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
            <CtaLink href="#scrivi" className="c-write">
              {c.write}
            </CtaLink>
          </div>
        </section>

        <div className="c-band">
          <ul className="c-info" data-c-rise>
            <li className="c-info-col">
              <span className="c-mono c-label">{c.emailLabel}</span>
              <a className="c-info-value c-info-link" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              <span className="c-info-note">{c.emailNote}</span>
            </li>
            <li className="c-info-col">
              <span className="c-mono c-label">{c.availLabel}</span>
              <span className="c-info-value">{c.avail}</span>
              <span className="c-info-note">{c.availNote}</span>
            </li>
            <li className="c-info-col">
              <span className="c-mono c-label">{c.placeLabel}</span>
              <span className="c-info-value">{address}</span>
              <span className="c-info-note">{c.placeNote}</span>
            </li>
            {socials.length ? (
              <li className="c-info-col">
                <span className="c-mono c-label">{c.socialLabel}</span>
                <span className="c-socials">
                  {socials.map((s) => (
                    <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer me">
                      {s.label}
                    </a>
                  ))}
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        <section className="c-band c-form-wrap" id="scrivi">
          <div className="c-form-intro" data-c-rise>
            <p className="c-mono c-label">{c.formKicker}</p>
            <h2 className="c-h2">
              {c.formTitle.map((line) => (
                <span key={line}>{line} </span>
              ))}
            </h2>
            <p className="c-form-text">{c.formText}</p>
          </div>
          <ContactForm lang={lang} />
        </section>

        <section className="c-band c-place" aria-label={c.whereKicker}>
          <div className="c-map-media" data-c-rise>
            <iframe
              className="c-map-frame"
              title={c.mapTitle}
              src={studioMapEmbedUrl(lang)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <article className="c-card" data-c-rise>
            <p className="c-mono c-label">{c.whereKicker}</p>
            <h2 className="c-h2 c-where">{c.whereTitle}</h2>
            <p className="c-card-address">{address}</p>
            <p className="c-form-text">{c.whereText}</p>
            <a className="c-mono c-maps" href={STUDIO_PLACE.mapsUrl} target="_blank" rel="noopener noreferrer">
              {c.maps}
              <Arrow />
            </a>
          </article>
          <article className="c-card c-review" data-c-rise>
            <p className="c-mono c-label">{c.reviewKicker}</p>
            <h2 className="c-h2 c-where">{c.reviewTitle}</h2>
            {rating ? <p className="c-rating">{c.ratingLine.replace("{rating}", rating)}</p> : null}
            <p className="c-form-text">{c.reviewText}</p>
            <a className="c-mono c-maps" href={STUDIO_PLACE.reviewUrl} target="_blank" rel="noopener noreferrer">
              {c.reviewAction}
              <Arrow />
            </a>
          </article>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
