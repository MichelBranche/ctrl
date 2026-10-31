import { CtaLink } from "@/components/cta-link";
import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ContactForm } from "@/components/pages/contact-form";
import { contactCopy } from "@/components/pages/contact-copy";
import { CONTACT_EMAIL } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { getSocialLinks } from "@/lib/settings";
import "./contact.css";

const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Aosta%2C+Valle+d%27Aosta";

export function contactMetadata(lang: Locale): Metadata {
  const c = contactCopy[lang];
  return { title: c.metaTitle, description: c.metaDescription };
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
  return (
    <>
      <SiteHeader />
      <main className="c-root">
        <section className="c-hero">
          <Image className="c-hero-img" src="/images/home/perche.jpg" alt="" fill priority sizes="100vw" />
          <div className="c-hero-copy">
            <p className="c-tag">{c.tag}</p>
            <h1 className="c-title">{c.title}</h1>
            <p className="c-lead">
              {c.lead.map((line) => (
                <span key={line}>{line} </span>
              ))}
            </p>
            <CtaLink href="#scrivi" className="c-write">
              {c.write}
            </CtaLink>
          </div>
        </section>

        <ul className="c-info">
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
            <span className="c-info-value">{c.place}</span>
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

        <section className="c-form-wrap" id="scrivi">
          <div className="c-form-intro">
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

        <section className="c-map">
          <div className="c-map-media">
            <Image src="/images/contact/aosta-map.svg" alt={c.mapAlt} fill sizes="(max-width: 860px) 100vw, 66vw" unoptimized />
            <small className="c-attrib">
              © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
            </small>
          </div>
          <div className="c-map-copy">
            <p className="c-mono c-label">{c.whereKicker}</p>
            <h2 className="c-h2 c-where">{c.whereTitle}</h2>
            <p className="c-form-text">{c.whereText}</p>
            <a className="c-mono c-maps" href={MAPS_URL} target="_blank" rel="noreferrer">
              {c.maps}
              <Arrow />
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
