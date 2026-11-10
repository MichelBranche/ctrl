import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CtaLink } from "@/components/cta-link";
import { PArrow } from "@/components/projects/arrow";
import { ProjectsCta } from "@/components/projects/cta";
import { LeVeleFilm } from "@/components/projects/le-vele-film";
import { projectsCopy } from "@/components/projects/projects-copy";
import { ProjectsMotion } from "@/components/projects/projects-motion";
import { JsonLd } from "@/components/seo/json-ld";
import { LE_VELE, LE_VELE_MEDIA, websiteGroups, websitesInOrder } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";
import { alternates, breadcrumbNode, faqNode, openGraph, ORG_ID, SITE_URL } from "@/lib/seo";
import "./projects.css";
import "./websites.css";

const money = {
  it: new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(LE_VELE.revenueEur),
  en: new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(LE_VELE.revenueEur),
};
const ads = {
  it: new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(LE_VELE.adsEur),
  en: new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(LE_VELE.adsEur),
};

const copy = {
  it: {
    metaTitle: "Residence Le Vele: 14 prenotazioni, 0 € di ads",
    metaDescription: `Caso studio CTRL®: il sito di Residence Le Vele ha portato ${LE_VELE.bookings} prenotazioni e ${money.it} nel primo mese online, senza spesa in advertising.`,
    lead: "Sito per una struttura ricettiva, progettato e sviluppato da CTRL®. Nel primo mese online le prenotazioni sono arrivate dal sito, senza una campagna ads.",
    storyTitle: "Cosa è successo",
    story: [
      "Residence Le Vele aveva bisogno di un sito proprio, non solo di una scheda su un portale. Il lavoro è stato il sito: camere, informazioni, e un modo per prenotare in modo diretto.",
      `Nel primo mese online i numeri verificati sono ${LE_VELE.bookings} prenotazioni e ${money.it}. La spesa in advertising è stata ${ads.it}.`,
      "Non è una promessa per la struttura successiva. Ogni hotel ha stagionalità, reputazione e offerta diverse. È un caso reale, con cifre che possiamo mostrare.",
    ],
    facts: [
      { label: "Prenotazioni", value: String(LE_VELE.bookings) },
      { label: "Primo mese", value: money.it },
      { label: "Advertising", value: ads.it },
    ],
    film: "Scorrimento del sito",
    filmDesktop: "Scorrimento del sito Residence Le Vele su desktop",
    filmMobile: "Scorrimento del sito Residence Le Vele su telefono",
    play: "Riproduci il video",
    faqTitle: "Domande frequenti",
    faqs: [
      { q: "I numeri sono del primo mese?", a: "Sì. 14 prenotazioni e 11.947 euro si riferiscono al primo mese online. La spesa in advertising in quel mese è stata 0 euro." },
      { q: "CTRL® ha costruito il sito?", a: "Sì. Il sito di Residence Le Vele è un lavoro di CTRL®." },
      { q: "Si può ottenere lo stesso risultato?", a: "Ogni struttura è diversa. Questi numeri descrivono questo caso, non un minimo garantito. Il metodo è un sito chiaro e una prenotazione diretta." },
      { q: "Dove vedo il sito dal vivo?", a: "Il sito pubblico è https://www.residencelevelestintino.it." },
    ],
  },
  en: {
    metaTitle: "Residence Le Vele: 14 bookings, €0 on ads",
    metaDescription: `CTRL® case study: the Residence Le Vele website brought ${LE_VELE.bookings} bookings and ${money.en} in its first month online, with no advertising spend.`,
    lead: "A website for a hospitality business, designed and built by CTRL®. In the first month online the bookings came from the site, with no ad campaign.",
    storyTitle: "What happened",
    story: [
      "Residence Le Vele needed its own website, not only a listing on a portal. The work was the site: rooms, information, and a way to book directly.",
      `In the first month online the verified numbers are ${LE_VELE.bookings} bookings and ${money.en}. Advertising spend was ${ads.en}.`,
      "This is not a promise for the next property. Every hotel has a different season, reputation and offer. It is a real case, with figures we can show.",
    ],
    facts: [
      { label: "Bookings", value: String(LE_VELE.bookings) },
      { label: "First month", value: money.en },
      { label: "Advertising", value: ads.en },
    ],
    film: "Site scroll-through",
    filmDesktop: "Scroll-through of the Residence Le Vele website on desktop",
    filmMobile: "Scroll-through of the Residence Le Vele website on a phone",
    play: "Play the video",
    faqTitle: "Common questions",
    faqs: [
      { q: "Are the numbers from the first month?", a: "Yes. 14 bookings and €11,947 refer to the first month online. Advertising spend in that month was €0." },
      { q: "Did CTRL® build the website?", a: "Yes. The Residence Le Vele website is a CTRL® project." },
      { q: "Can the same result be expected?", a: "Every property is different. These numbers describe this case, not a guaranteed minimum. The method is a clear website and a direct booking." },
      { q: "Where is the live site?", a: "The live site is https://www.residencelevelestintino.it." },
    ],
  },
} as const;

export function leVeleMetadata(lang: Locale): Metadata {
  const c = copy[lang];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: alternates(LE_VELE.path, lang),
    openGraph: openGraph(lang, { title: c.metaTitle, description: c.metaDescription, images: [LE_VELE_MEDIA.desktop.posterJpg] }),
  };
}

export function LeVeleView({ lang }: { lang: Locale }) {
  const c = copy[lang];
  const sites = projectsCopy[lang];
  const s = sites.sites;
  const group = websiteGroups.find((item) => item.slug === "hospitality")?.label[lang] ?? "Hospitality";
  const list = websitesInOrder();
  const index = Math.max(0, list.findIndex((item) => item.slug === LE_VELE.slug));
  const prev = list[(index - 1 + list.length) % list.length];
  const next = list[(index + 1) % list.length];
  const href = (slug: string) => localize(`/projects/websites/${slug}`, lang);
  const crumbs = [
    { name: lang === "it" ? "Home" : "Home", path: "/" },
    { name: sites.metaTitle, path: "/projects" },
    { name: s.back, path: "/projects/websites" },
    { name: "Residence Le Vele", path: LE_VELE.path },
  ];
  const article = {
    "@type": "Article",
    headline: c.metaTitle,
    description: c.metaDescription,
    url: `${SITE_URL}${localize(LE_VELE.path, lang)}`,
    image: `${SITE_URL}${LE_VELE_MEDIA.desktop.posterJpg}`,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    about: "Residence Le Vele",
    inLanguage: lang === "it" ? "it-IT" : "en-US",
  };

  return (
    <>
      <JsonLd data={[breadcrumbNode(lang, crumbs), article, faqNode([...c.faqs])]} />
      <SiteHeader />
      <main className="p-root" data-motion-root>
        <section className="wd-hero">
          <div className="wd-crumbs">
            <Link href={localize("/projects/websites", lang)} className="p-back p-mono" data-p-fade>
              <PArrow className="p-arrow p-arrow-back" />
              {s.back}
            </Link>
          </div>
          <p className="p-tag p-mono" data-p-fade>{group}</p>
          <h1 className="wd-title" data-p-split>Residence Le Vele</h1>
          <dl className="wd-facts p-mono" data-p-fade>
            <div><dt>{s.facts.category}</dt><dd>{group}</dd></div>
            {c.facts.map((fact) => (
              <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
            ))}
          </dl>
          <div className="wd-body">
            <p className="wd-lead" data-p-fade>{c.lead}</p>
            <CtaLink href={LE_VELE.url} external className="wd-live" data-p-fade>
              {s.live}
            </CtaLink>
          </div>
        </section>

        <section className="lv-reel" aria-label={c.film}>
          <figure className="lv-figure">
            <div className="lv-frame">
              <LeVeleFilm labelDesktop={c.filmDesktop} labelMobile={c.filmMobile} playLabel={c.play} />
            </div>
            <figcaption className="lv-cap p-mono">{c.film}</figcaption>
          </figure>
        </section>

        <section className="lv-story" aria-labelledby="lv-story-title">
          <h2 className="lv-story-title" id="lv-story-title">{c.storyTitle}</h2>
          <div>
            {c.story.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="lv-faq" aria-labelledby="lv-faq-title">
          <h2 className="lv-story-title" id="lv-faq-title">{c.faqTitle}</h2>
          <div className="lv-faq-list">
            {c.faqs.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <nav className="wd-nav" aria-label={s.back}>
          <Link href={href(prev.slug)}>
            <span className="wd-nav-k p-mono"><PArrow className="p-arrow p-arrow-back" />{s.prev}</span>
            <span className="wd-nav-t">{prev.title[lang]}</span>
          </Link>
          <Link href={href(next.slug)}>
            <span className="wd-nav-k p-mono">{s.next}<PArrow className="p-arrow" /></span>
            <span className="wd-nav-t">{next.title[lang]}</span>
          </Link>
        </nav>

        <ProjectsCta copy={sites} href={localize("/contact", lang)} />
        <ProjectsMotion />
      </main>
      <SiteFooter />
    </>
  );
}
