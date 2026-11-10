import type { Metadata } from "next";
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
import { alternates, breadcrumbNode, faqNode, LOCAL_PATH, openGraph } from "@/lib/seo";
import "@/components/projects/projects.css";
import "@/components/services/webapp.css";
import "./service-detail.css";

const money = {
  it: new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(LE_VELE.revenueEur),
  en: new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(LE_VELE.revenueEur),
};

const copy = {
  it: {
    metaTitle: "Agenzia web in Valle d'Aosta",
    metaDescription: "CTRL® è l'agenzia web di Aosta. Siti su misura, hotel con prenotazione diretta, e-commerce, web app, software e brand identity. Prima la Valle d'Aosta, poi il Nord Italia.",
    title: "Agenzia web in Valle d'Aosta",
    lead: "Siamo uno studio di creative technology ad Aosta. Progettiamo e sviluppiamo siti, identità e software per attività della valle, e per hotel e brand del Nord Italia.",
    whereTitle: "Prima la valle.",
    where: [
      "La sede è ad Aosta. Conosciamo il territorio, le stagioni del turismo e le attività che vivono di passaparola. Il primo lavoro di posizionamento è qui, in Valle d'Aosta.",
      "Il passo successivo non è una pagina per ogni città. È un mestiere verticale: siti per hotel e strutture ricettive, con prenotazione diretta, nel Nord Italia. L'Italia intera arriva dopo, progetto per progetto.",
    ],
    servicesTitle: "Cosa possiamo fare",
    services: [
      { href: "/services/visual-communication", kicker: "Siti", label: "Siti web su misura, rifacimenti, e-commerce e hotel" },
      { href: "/services/brand-identity", kicker: "Grafica", label: "Brand identity e identità visiva" },
      { href: "/services/product-development", kicker: "Prodotti", label: "Web app e prodotti digitali su misura" },
      { href: "/services/webapp", kicker: "Webapp", label: "Webapp con aree riservate e dashboard" },
      { href: "/services/software-ai", kicker: "Software", label: "Gestionali su misura, automazioni e AI" },
      { href: "/services/growth-support", kicker: "SEO", label: "SEO, posizionamento Google e manutenzione" },
    ],
    caseKicker: "Caso studio",
    caseTitle: "Residence Le Vele",
    caseText: `Sito realizzato da CTRL®. Nel primo mese online: ${LE_VELE.bookings} prenotazioni e ${money.it}, con 0 € spesi in advertising.`,
    caseCta: "Leggi il caso",
    stats: [
      { value: String(LE_VELE.bookings), label: "prenotazioni nel primo mese" },
      { value: money.it, label: "di prenotazioni dirette" },
      { value: "0 €", label: "spesi in advertising" },
    ],
    faqTitle: "Domande frequenti",
    faqs: [
      { q: "Dove siete?", a: "Ad Aosta, in Valle d'Aosta. Il lavoro si fa di persona quando serve e da remoto per il resto. L'indirizzo preciso, il telefono e la partita IVA li pubblichiamo appena sono confermati." },
      { q: "Lavorate solo in Valle d'Aosta?", a: "Partiamo dalla valle. Poi seguiamo nicchie nel Nord Italia, soprattutto hotel e strutture ricettive. Non apriamo una pagina «siti web» per ogni città." },
      { q: "Fate siti per hotel con prenotazione diretta?", a: "Sì. Il sito mostra camere, date e prezzo, e la prenotazione si chiude sul sito della struttura. I portali possono restare, ma non sono obbligatori." },
      { q: "Quanto costa un sito?", a: "Non abbiamo un prezzo a pagina. Un sito essenziale e un sito hotel con più lingue non costano la stessa cosa. Il preventivo arriva dopo aver visto contenuti, lingue e integrazioni." },
    ],
    cta: "Scrivici da Aosta",
    crumb: "Percorso",
    home: "Home",
  },
  en: {
    metaTitle: "Web studio in Valle d'Aosta",
    metaDescription: "CTRL® is the web studio in Aosta. Custom sites, hotels with direct booking, online shops, web apps, software and brand identity. Valle d'Aosta first, then Northern Italy.",
    title: "A web studio in Valle d'Aosta",
    lead: "We are a creative technology studio in Aosta. We design and build websites, identities and software for businesses in the valley, and for hotels and brands across Northern Italy.",
    whereTitle: "The valley first.",
    where: [
      "The studio is in Aosta. We know the territory, the tourist seasons and the businesses that live on word of mouth. The first search work is here, in Valle d'Aosta.",
      "The next step is not a page for every city. It is a vertical craft: websites for hotels and stays, with direct booking, across Northern Italy. The rest of Italy comes after, project by project.",
    ],
    servicesTitle: "What we can do",
    services: [
      { href: "/services/visual-communication", kicker: "Websites", label: "Custom websites, rebuilds, shops and hotels" },
      { href: "/services/brand-identity", kicker: "Identity", label: "Brand identity and visual systems" },
      { href: "/services/product-development", kicker: "Products", label: "Custom web apps and digital products" },
      { href: "/services/webapp", kicker: "Web apps", label: "Web apps with private areas and dashboards" },
      { href: "/services/software-ai", kicker: "Software", label: "Custom internal tools, automations and AI" },
      { href: "/services/growth-support", kicker: "SEO", label: "SEO, Google rankings and maintenance" },
    ],
    caseKicker: "Case study",
    caseTitle: "Residence Le Vele",
    caseText: `Website built by CTRL®. In the first month online: ${LE_VELE.bookings} bookings and ${money.en}, with €0 spent on advertising.`,
    caseCta: "Read the case",
    stats: [
      { value: String(LE_VELE.bookings), label: "bookings in the first month" },
      { value: money.en, label: "in direct bookings" },
      { value: "€0", label: "spent on advertising" },
    ],
    faqTitle: "Common questions",
    faqs: [
      { q: "Where are you?", a: "In Aosta, Valle d'Aosta. We meet in person when it helps and work remotely the rest of the time. Street address, phone and VAT number go on the site once they are confirmed." },
      { q: "Do you only work in Valle d'Aosta?", a: "We start in the valley. Then we follow niches across Northern Italy, especially hotels and stays. We do not open a “websites” page for every city." },
      { q: "Do you build hotel sites with direct booking?", a: "Yes. The site shows rooms, dates and price, and the booking closes on the property's own site. Portals can stay, but they are not required." },
      { q: "How much does a website cost?", a: "We do not price by the page. A simple site and a hotel site in several languages do not cost the same. The proposal comes after we have seen the content, the languages and the integrations." },
    ],
    cta: "Write to the studio",
    crumb: "Breadcrumbs",
    home: "Home",
  },
} as const;

export function localMetadata(lang: Locale): Metadata {
  const c = copy[lang];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: alternates(LOCAL_PATH, lang),
    openGraph: openGraph(lang, { title: c.metaTitle, description: c.metaDescription }),
  };
}

export function LocalView({ lang }: { lang: Locale }) {
  const c = copy[lang];
  const crumbs = [
    { name: c.home, path: "/" },
    { name: c.title, path: LOCAL_PATH },
  ];
  return (
    <>
      <JsonLd data={[breadcrumbNode(lang, crumbs), faqNode([...c.faqs])]} />
      <SiteHeader />
      <main className="p-root" data-motion-root>
        <section className="p-hero">
          <div className="p-hero-copy">
            <Crumbs label={c.crumb} items={crumbs.map((item) => ({ name: item.name, href: localize(item.path, lang) }))} />
            <p className="p-tag p-mono">Aosta</p>
            <h1 className="p-title p-title-cat">{c.title}</h1>
            <p className="p-lead">{c.lead}</p>
          </div>
        </section>

        <section className="wa-wrap sd-split" aria-labelledby="local-where">
          <h2 className="wa-h2" id="local-where">{c.whereTitle}</h2>
          <div>
            {c.where.map((paragraph) => (
              <p className="sd-prose" key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="wa-wrap" aria-labelledby="local-services">
          <h2 className="wa-h2" id="local-services">{c.servicesTitle}</h2>
          <ul className="sd-service-links">
            {c.services.map((item) => (
              <li key={item.href}>
                <Link href={localize(item.href, lang) as Route}>
                  <span className="sd-service-kicker p-mono">{item.kicker}</span>
                  <span className="sd-service-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="wa-wrap sd-split" aria-labelledby="local-case">
          <div>
            <p className="p-kicker p-mono">{c.caseKicker}</p>
            <h2 className="wa-h2" id="local-case">{c.caseTitle}</h2>
          </div>
          <div>
            <p className="sd-prose">{c.caseText}</p>
            <ul className="sd-stats">
              {c.stats.map((stat) => (
                <li key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </li>
              ))}
            </ul>
            <div className="sd-links">
              <Link href={localize(LE_VELE.path, lang) as Route} className="p-btn p-btn-fill">
                <span className="p-mono">{c.caseCta}</span>
                <PArrow />
              </Link>
              <Link href={localize("/contact", lang) as Route} className="p-btn">
                <span className="p-mono">{c.cta}</span>
                <PArrow />
              </Link>
            </div>
          </div>
        </section>

        <div className="wa-wrap">
          <FaqList id="local-faq" title={c.faqTitle} items={[...c.faqs]} />
        </div>
        <ProjectsMotion />
      </main>
      <SiteFooter />
    </>
  );
}
