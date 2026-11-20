import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { localize, type Locale } from "@/lib/i18n";
import "./quotes-page.css";

/** Temporary CTRL® Quotes page: kept out of search until the real page is ready. */
const COPY = {
  it: {
    meta: "CTRL® Quotes, la soluzione di CTRL® per i preventivi. Pagina in allestimento.",
    kicker: "Ecosistema CTRL®",
    lead: "Preventivi che convincono.",
    status: "Pagina in allestimento",
    text: "Stiamo preparando questa pagina. Nel frattempo, se vuoi sapere di più su CTRL® Quotes, scrivici.",
    contact: "Contattaci",
    home: "Torna alla home",
  },
  en: {
    meta: "CTRL® Quotes, the CTRL® solution for quotes. Page under construction.",
    kicker: "CTRL® ecosystem",
    lead: "Quotes that win clients.",
    status: "Page under construction",
    text: "We are getting this page ready. In the meantime, if you want to know more about CTRL® Quotes, write to us.",
    contact: "Contact us",
    home: "Back to the home page",
  },
};

export function quotesMetadata(lang: Locale): Metadata {
  return {
    title: { absolute: "CTRL® Quotes | CTRL®" },
    description: COPY[lang].meta,
    robots: { index: false, follow: true },
  };
}

export function QuotesPage({ lang }: { lang: Locale }) {
  const c = COPY[lang];
  return (
    <>
      <SiteHeader />
      <main className="qp-root">
        <section className="qp-card">
          <p className="qp-kicker">{c.kicker}</p>
          <h1 className="qp-title">CTRL® Quotes</h1>
          <p className="qp-lead">{c.lead}</p>
          <p className="qp-status">
            <i aria-hidden="true" />
            {c.status}
          </p>
          <p className="qp-text">{c.text}</p>
          <div className="qp-actions">
            <Link className="qp-cta" href={localize("/contact", lang)}>
              {c.contact}
            </Link>
            <Link className="qp-ghost" href={localize("/", lang)}>
              {c.home}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
