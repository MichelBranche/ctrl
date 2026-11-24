import type { Metadata, Route } from "next";
import Image from "next/image";
import { ArrowUpRight } from "@/components/ds/arrow-up-right";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { contactCopy } from "@/components/pages/contact-copy";
import { ContactMotion } from "@/components/pages/contact-motion";
import { ServicesMotion } from "@/components/pages/services-motion";
import { ContactForm } from "@/components/pages/contact-wizard";
import { Crumbs } from "@/components/seo/crumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { ADMIN_EMAIL, MAILBOX_LABEL, SALES_EMAIL, STUDIO_PLACE, studioMapEmbedUrl } from "@/lib/content";
import { formatRating } from "@/lib/google-reviews-core";
import { getGoogleReviews } from "@/lib/google-reviews";
import { dict, localize, type Locale } from "@/lib/i18n";
import { breadcrumbNode, publicMeta } from "@/lib/seo";
import { getSocialLinks } from "@/lib/settings";
import "@/components/ds/frame.css";
import "./contact.css";

export function contactMetadata(lang: Locale): Metadata {
  const c = contactCopy[lang];
  return publicMeta(lang, { title: c.metaTitle, description: c.metaDescription, itPath: "/contact" });
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
      <main className="c-root ds-page">
        <ServicesMotion root=".c-root" />

        {/* 1. HERO: one photo card, copy bottom left, actions bottom right. */}
        <section className="ds-hero-block c-hero" data-sv-hero>
          <div className="ds-card ds-card-dark ds-under-nav c-hero-card">
            <Image className="c-hero-img" src="/images/home/perche.jpg" alt="" fill priority sizes="100vw" data-sv-hero-img />
            <div className="c-hero-top">
              <Crumbs label={lang === "it" ? "Percorso" : "Breadcrumbs"} items={crumbs.map((item) => ({ name: item.name, href: localize(item.path, lang) }))} />
            </div>
            <div className="c-hero-copy">
              <p className="ds-tag" data-sv-fade>{c.tag}</p>
              <h1 className="ds-h1 c-title" data-sv-words>{c.title}</h1>
              <p className="ds-lead c-lead" data-sv-fade>
                {c.lead.map((line) => (
                  <span key={line}>{line} </span>
                ))}
              </p>
            </div>
            <div className="c-hero-actions" data-sv-fade>
              <a href="#scrivi" className="ds-cta">
                {c.write}
                <ArrowUpRight className="ds-arrow c-arrow-down" />
              </a>
              <Link href={localize("/bookings", lang) as Route} className="ds-ghost">
                {dict[lang].bookings.fromContact}
              </Link>
            </div>
          </div>
        </section>

        {/* 2. INFO: small light cards in a row. */}
        <section className="ds-block" aria-label={c.emailLabel}>
          <ul className="ds-list c-info" data-sv-stagger>
            <li className="ds-card ds-card-light c-info-col">
              <span className="ds-kicker">{c.emailLabel}</span>
              <span className="c-info-mails">
                <a className="c-info-mail" href={`mailto:${SALES_EMAIL}`}>
                  <span className="c-info-mail-label">{MAILBOX_LABEL[lang].sales}</span>
                  <span className="c-info-value c-info-link">{SALES_EMAIL}</span>
                </a>
                <a className="c-info-mail" href={`mailto:${ADMIN_EMAIL}`}>
                  <span className="c-info-mail-label">{MAILBOX_LABEL[lang].admin}</span>
                  <span className="c-info-value c-info-link">{ADMIN_EMAIL}</span>
                </a>
              </span>
              <span className="c-info-note">{c.emailNote}</span>
            </li>
            <li className="ds-card ds-card-light c-info-col">
              <span className="ds-kicker">{c.availLabel}</span>
              <span className="c-info-value">{c.avail}</span>
              <span className="c-info-note">{c.availNote}</span>
            </li>
            <li className="ds-card ds-card-light c-info-col">
              <span className="ds-kicker">{c.placeLabel}</span>
              <span className="c-info-value">{address}</span>
              <span className="c-info-note">{c.placeNote}</span>
            </li>
            {socials.length ? (
              <li className="ds-card ds-card-light c-info-col">
                <span className="ds-kicker">{c.socialLabel}</span>
                <span className="c-socials">
                  {socials.map((s) => (
                    <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer me" className="ds-chip">
                      {s.label}
                    </a>
                  ))}
                </span>
              </li>
            ) : null}
          </ul>
        </section>

        {/* 3. FORM: one dark card, intro left (sticky on desktop), the wizard right. */}
        <section className="ds-block c-form-wrap" id="scrivi">
          <div className="ds-card ds-card-dark ds-pad c-form-card">
            <div className="c-form-intro">
              <p className="ds-kicker">{c.formKicker}</p>
              <h2 className="ds-h2" data-sv-title>
                {c.formTitle.join(" ")}
              </h2>
              <p className="ds-text">{c.formText}</p>
            </div>
            <div className="c-form-slot">
              <ContactForm lang={lang} />
            </div>
          </div>
        </section>

        {/* 4. PLACE: map card and two cards beside it. */}
        <section className="ds-block" aria-label={c.whereKicker}>
          <div className="c-place" data-sv-stagger>
            <div className="ds-card c-map-media">
              <iframe
                className="c-map-frame"
                title={c.mapTitle}
                src={studioMapEmbedUrl(lang)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <article className="ds-card ds-card-light ds-pad c-card">
              <p className="ds-kicker">{c.whereKicker}</p>
              <h2 className="ds-h3">{c.whereTitle}</h2>
              <p className="c-card-address">{address}</p>
              <p className="ds-text">{c.whereText}</p>
              <a className="ds-ghost" href={STUDIO_PLACE.mapsUrl} target="_blank" rel="noopener noreferrer">
                {c.maps}
                <ArrowUpRight className="ds-arrow" />
              </a>
            </article>
            <article className="ds-card ds-card-dark ds-pad c-card">
              <p className="ds-kicker">{c.reviewKicker}</p>
              <h2 className="ds-h3">{c.reviewTitle}</h2>
              {rating ? <p className="c-rating">{c.ratingLine.replace("{rating}", rating)}</p> : null}
              <p className="ds-text">{c.reviewText}</p>
              <a className="ds-cta" href={STUDIO_PLACE.reviewUrl} target="_blank" rel="noopener noreferrer">
                {c.reviewAction}
                <ArrowUpRight className="ds-arrow" />
              </a>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
