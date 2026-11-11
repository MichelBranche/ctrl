import { CtaLink } from "@/components/cta-link";
import { BookingFrame } from "@/components/pages/booking-frame";
import { BookingMotion } from "@/components/pages/booking-motion";
import { Crumbs } from "@/components/seo/crumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { bookingEmbedUrl, bookingOpenUrl } from "@/lib/content";
import { dict, localize, type Locale } from "@/lib/i18n";
import { breadcrumbNode, publicMeta } from "@/lib/seo";
import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import "./booking.css";

export function bookingMetadata(lang: Locale): Metadata {
  const c = dict[lang].bookings;
  return publicMeta(lang, { title: c.metaTitle, description: c.metaDescription, itPath: "/bookings" });
}

function Arrow() {
  return (
    <svg className="bk-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function BookingView({ lang }: { lang: Locale }) {
  const c = dict[lang].bookings;
  const embed = bookingEmbedUrl();
  const open = bookingOpenUrl();
  const contact = localize("/contact", lang);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: c.tag, path: "/bookings" },
  ];
  return (
    <>
      <JsonLd data={[breadcrumbNode(lang, crumbs)]} />
      <SiteHeader />
      <BookingMotion />
      <main className="bk-root">
        <section className="bk-hero">
          <Image className="bk-hero-img" src="/images/home/perche.jpg" alt="" fill priority sizes="100vw" />
          <div className="bk-hero-copy">
            <Crumbs label={lang === "it" ? "Percorso" : "Breadcrumbs"} items={crumbs.map((item) => ({ name: item.name, href: localize(item.path, lang) }))} />
            <p className="bk-tag">{c.tag}</p>
            <h1 className="bk-title">{c.title}</h1>
            <p className="bk-lead">
              {c.lead.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
            <CtaLink href={embed ? "#prenota" : contact}>{embed ? c.bookCta : c.soon}</CtaLink>
          </div>
        </section>

        <section className="bk-band bk-schedule" id="prenota" aria-label={c.frameTitle}>
          {embed ? (
            <div className="bk-slot" data-bk-rise>
              <BookingFrame src={embed} title={c.frameTitle} />
            </div>
          ) : (
            <article className="bk-soon" data-bk-rise>
              <p className="bk-mono bk-label">{c.tag}</p>
              <h2 className="bk-h2">{c.soon}</h2>
              <p className="bk-text">{c.soonText}</p>
            </article>
          )}
          <div className="bk-actions" data-bk-rise>
            {embed && open ? (
              <a className="bk-open" href={open} target="_blank" rel="noopener noreferrer">
                {c.open}
                <Arrow />
              </a>
            ) : null}
            <Link href={contact as Route} className="bk-write">
              {c.fallback}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
