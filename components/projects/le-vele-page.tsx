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
import { LE_VELE } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";
import { alternates, breadcrumbNode, faqNode, openGraph, ORG_ID, SITE_URL } from "@/lib/seo";
import "@/components/projects/projects.css";
import "@/components/services/webapp.css";
import "@/components/pages/service-detail.css";

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
    kicker: "Caso studio · Hospitality",
    title: "Residence Le Vele",
    lead: `Sito realizzato da CTRL® per una struttura ricettiva. Nel primo mese online ha raccolto ${LE_VELE.bookings} prenotazioni e ${money.it}, con ${ads.it} spesi in advertising.`,
    storyTitle: "Cosa è successo",
    story: [
      "Residence Le Vele aveva bisogno di un sito proprio, non solo di una scheda su un portale. CTRL® ha progettato e sviluppato il sito: camere, informazioni, e un modo per prenotare in modo diretto.",
      "Nel primo mese online i numeri, verificati, sono questi: 14 prenotazioni, 11.947 euro di valore, 0 euro di pubblicità. Nessun budget ads dietro il risultato. Il canale è stato il sito.",
      "Non è una promessa per la struttura successiva. Ogni hotel ha stagionalità, reputazione e offerta diverse. È un caso reale, con cifre che possiamo mostrare.",
    ],
    stats: [
      { value: String(LE_VELE.bookings), label: "prenotazioni nel primo mese online" },
      { value: money.it, label: "valore delle prenotazioni" },
      { value: ads.it, label: "spesi in advertising" },
    ],
    placeholder: "Segnaposto. Le fotografie e le schermate del sito di Residence Le Vele non sono ancora in archivio. Questo riquadro non è una cattura del sito.",
    nextTitle: "Un sito per la tua struttura",
    nextText: "Se gestisci un hotel, un residence o un'altra struttura in Valle d'Aosta o nel Nord Italia, il percorso è lo stesso: un sito su misura e la prenotazione che si chiude da te.",
    nextCta: "Parliamo della struttura",
    servicesCta: "Siti per hotel",
    faqTitle: "Domande frequenti",
    faqs: [
      { q: "I numeri sono del primo mese?", a: "Sì. 14 prenotazioni e 11.947 euro si riferiscono al primo mese online. La spesa in advertising in quel mese è stata 0 euro." },
      { q: "CTRL® ha costruito il sito?", a: "Sì. Il sito di Residence Le Vele è un lavoro di CTRL®." },
      { q: "Si può ottenere lo stesso risultato?", a: "Ogni struttura è diversa. Questi numeri descrivono questo caso, non un minimo garantito. Il metodo è un sito chiaro e una prenotazione diretta." },
      { q: "Dove vedo il sito dal vivo?", a: "L'indirizzo pubblico del sito non è ancora in questa pagina. Lo aggiungiamo quando è confermato, insieme alle schermate vere al posto del segnaposto." },
    ],
    crumb: "Percorso",
    home: "Home",
    projects: "Progetti",
    sites: "Siti web",
  },
  en: {
    metaTitle: "Residence Le Vele: 14 bookings, €0 on ads",
    metaDescription: `CTRL® case study: the Residence Le Vele website brought ${LE_VELE.bookings} bookings and ${money.en} in its first month online, with no advertising spend.`,
    kicker: "Case study · Hospitality",
    title: "Residence Le Vele",
    lead: `Website built by CTRL® for a hospitality business. In the first month online it took ${LE_VELE.bookings} bookings and ${money.en}, with ${ads.en} spent on advertising.`,
    storyTitle: "What happened",
    story: [
      "Residence Le Vele needed its own website, not only a listing on a portal. CTRL® designed and built the site: rooms, information, and a way to book directly.",
      "In the first month online the verified numbers are these: 14 bookings, €11,947 in value, €0 of advertising. No ad budget sat behind the result. The channel was the website.",
      "This is not a promise for the next property. Every hotel has a different season, reputation and offer. It is a real case, with figures we can show.",
    ],
    stats: [
      { value: String(LE_VELE.bookings), label: "bookings in the first month online" },
      { value: money.en, label: "value of the bookings" },
      { value: ads.en, label: "spent on advertising" },
    ],
    placeholder: "Placeholder. Photographs and screenshots of the Residence Le Vele website are not in the archive yet. This frame is not a capture of the site.",
    nextTitle: "A website for your property",
    nextText: "If you run a hotel, a residence or another stay in Valle d'Aosta or Northern Italy, the path is the same: a custom site, and a booking that closes with you.",
    nextCta: "Talk about the property",
    servicesCta: "Websites for hotels",
    faqTitle: "Common questions",
    faqs: [
      { q: "Are the numbers from the first month?", a: "Yes. 14 bookings and €11,947 refer to the first month online. Advertising spend in that month was €0." },
      { q: "Did CTRL® build the website?", a: "Yes. The Residence Le Vele website is a CTRL® project." },
      { q: "Can the same result be expected?", a: "Every property is different. These numbers describe this case, not a guaranteed minimum. The method is a clear website and a direct booking." },
      { q: "Where is the live site?", a: "The public address is not on this page yet. We will add it once it is confirmed, together with real screenshots in place of the placeholder." },
    ],
    crumb: "Breadcrumbs",
    home: "Home",
    projects: "Projects",
    sites: "Websites",
  },
} as const;

export function leVeleMetadata(lang: Locale): Metadata {
  const c = copy[lang];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: alternates(LE_VELE.path, lang),
    openGraph: openGraph(lang, { title: c.metaTitle, description: c.metaDescription, images: [LE_VELE.image] }),
  };
}

export function LeVeleView({ lang }: { lang: Locale }) {
  const c = copy[lang];
  const crumbs = [
    { name: c.home, path: "/" },
    { name: c.projects, path: "/projects" },
    { name: c.sites, path: "/projects/websites" },
    { name: "Residence Le Vele", path: LE_VELE.path },
  ];
  const article = {
    "@type": "Article",
    headline: c.metaTitle,
    description: c.metaDescription,
    url: `${SITE_URL}${localize(LE_VELE.path, lang)}`,
    image: `${SITE_URL}${LE_VELE.image}`,
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
        <section className="p-hero">
          <div className="p-hero-copy">
            <Crumbs label={c.crumb} items={crumbs.map((item) => ({ name: item.name, href: localize(item.path, lang) }))} />
            <p className="p-tag p-mono">{c.kicker}</p>
            <h1 className="p-title p-title-cat">{c.title}</h1>
            <p className="p-lead">{c.lead}</p>
          </div>
        </section>

        <section className="wa-wrap">
          <ul className="sd-stats">
            {c.stats.map((stat) => (
              <li key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="wa-wrap sd-split" aria-labelledby="lv-story">
          <h2 className="wa-h2" id="lv-story">{c.storyTitle}</h2>
          <div>
            {c.story.map((paragraph) => (
              <p className="sd-prose" key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="wa-wrap" aria-label={c.placeholder}>
          <figure className="sd-placeholder">
            <div className="sd-placeholder-frame">
              <Image src={LE_VELE.image} alt="" fill sizes="(max-width: 900px) 100vw, 70rem" />
            </div>
            <figcaption>{c.placeholder}</figcaption>
          </figure>
        </section>

        <section className="wa-wrap sd-split" aria-labelledby="lv-next">
          <h2 className="wa-h2" id="lv-next">{c.nextTitle}</h2>
          <div>
            <p className="sd-prose">{c.nextText}</p>
            <div className="sd-links">
              <Link href={localize("/contact", lang) as Route} className="p-btn p-btn-fill">
                <span className="p-mono">{c.nextCta}</span>
                <PArrow />
              </Link>
              <Link href={localize("/services/visual-communication", lang) as Route} className="p-btn">
                <span className="p-mono">{c.servicesCta}</span>
                <PArrow />
              </Link>
            </div>
          </div>
        </section>

        <div className="wa-wrap">
          <FaqList id="lv-faq" title={c.faqTitle} items={[...c.faqs]} />
        </div>
        <ProjectsMotion />
      </main>
      <SiteFooter />
    </>
  );
}
