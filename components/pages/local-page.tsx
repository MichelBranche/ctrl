import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProjectsMotion } from "@/components/projects/projects-motion";
import { Crumbs } from "@/components/seo/crumbs";
import { FaqList } from "@/components/seo/faq";
import { JsonLd } from "@/components/seo/json-ld";
import { localize, withGermanFallback, type Locale } from "@/lib/i18n";
import { breadcrumbNode, faqNode, LOCAL_PATH, publicMeta } from "@/lib/seo";
import { ProjectsCta } from "@/components/projects/cta";
import { projectsCopy } from "@/components/projects/projects-copy";
import "@/components/projects/projects.css";
import "@/components/services/webapp.css";
import "./service-detail.css";
import "@/components/ds/legacy-frame.css";

const copy = withGermanFallback({
  it: {
    metaTitle: "Agenzia web in Valle d'Aosta, con sede ad Aosta | CTRL®",
    metaDescription: "Cerchi un'agenzia web in Valle d'Aosta? CTRL® ha sede ad Aosta e realizza siti su misura, hotel, e-commerce, web app e software. Scrivi allo studio.",
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
      { href: "/services/web-security", kicker: "Sicurezza", label: "Certificati SSL/TLS, hosting e protezione del sito" },
    ],
    faqTitle: "Domande frequenti",
    faqs: [
      { q: "Dove siete?", a: "In Via St. Martin de Corléans 179, 11100 Aosta. Il telefono è +39 388 166 0117. La partita IVA non è ancora pubblicata." },
      { q: "Lavorate solo in Valle d'Aosta?", a: "Partiamo dalla valle. Poi seguiamo nicchie nel Nord Italia, soprattutto hotel e strutture ricettive. Non apriamo una pagina «siti web» per ogni città." },
      { q: "Fate siti per hotel con prenotazione diretta?", a: "Sì. Il sito mostra camere, date e prezzo, e la prenotazione si chiude sul sito della struttura. I portali possono restare, ma non sono obbligatori." },
      { q: "Quanto costa un sito?", a: "Non abbiamo un prezzo a pagina. Un sito essenziale e un sito hotel con più lingue non costano la stessa cosa. Il preventivo arriva dopo aver visto contenuti, lingue e integrazioni." },
    ],
    cta: "Scrivici da Aosta",
    crumb: "Percorso",
    home: "Home",
  },
  en: {
    metaTitle: "Web agency in Valle d'Aosta, based in Aosta | CTRL®",
    metaDescription: "Looking for a web agency in Valle d'Aosta? CTRL® is based in Aosta and builds custom sites, hotels, shops, web apps and software. Write to us.",
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
      { href: "/services/web-security", kicker: "Security", label: "SSL/TLS certificates, hosting and site protection" },
    ],
    faqTitle: "Common questions",
    faqs: [
      { q: "Where are you?", a: "At Via St. Martin de Corléans 179, 11100 Aosta. The phone number is +39 388 166 0117. The VAT number is not published yet." },
      { q: "Do you only work in Valle d'Aosta?", a: "We start in the valley. Then we follow niches across Northern Italy, especially hotels and stays. We do not open a “websites” page for every city." },
      { q: "Do you build hotel sites with direct booking?", a: "Yes. The site shows rooms, dates and price, and the booking closes on the property's own site. Portals can stay, but they are not required." },
      { q: "How much does a website cost?", a: "We do not price by the page. A simple site and a hotel site in several languages do not cost the same. The proposal comes after we have seen the content, the languages and the integrations." },
    ],
    cta: "Write to the studio",
    crumb: "Breadcrumbs",
    home: "Home",
  },
  de: {
    metaTitle: "Webagentur im Aostatal mit Sitz in Aosta | CTRL®",
    metaDescription: "CTRL® entwickelt maßgeschneiderte Websites, Hotelbuchungen, Shops, Web-Apps und Software. Unser Studio sitzt in Aosta.",
    title: "Ein Webstudio im Aostatal",
    lead: "Wir sind ein Creative-Technology-Studio in Aosta. Wir gestalten Websites, Marken und Software für Unternehmen im Aostatal sowie Hotels und Marken in ganz Norditalien.",
    whereTitle: "Zuerst das Aostatal.",
    where: ["Unser Studio sitzt in Aosta. Wir kennen die Region, die Tourismussaisons und Unternehmen, die von Empfehlungen leben. Unser erster Schwerpunkt liegt hier im Aostatal.", "Der nächste Schritt ist keine Seite für jede Stadt, sondern eine Spezialisierung: Websites mit Direktbuchung für Hotels und Unterkünfte in Norditalien. Weitere Regionen folgen von Projekt zu Projekt."],
    servicesTitle: "Was wir anbieten",
    services: [
      { href: "/services/visual-communication", kicker: "Websites", label: "Maßgeschneiderte Websites, Relaunches, Shops und Hotelseiten" },
      { href: "/services/brand-identity", kicker: "Marke", label: "Markenidentität und visuelle Systeme" },
      { href: "/services/product-development", kicker: "Produkte", label: "Individuelle Web-Apps und digitale Produkte" },
      { href: "/services/webapp", kicker: "Web-Apps", label: "Web-Apps mit geschützten Bereichen und Dashboards" },
      { href: "/services/software-ai", kicker: "Software", label: "Individuelle Tools, Automatisierungen und KI" },
      { href: "/services/growth-support", kicker: "SEO", label: "SEO, Google-Sichtbarkeit und Wartung" },
      { href: "/services/web-security", kicker: "Sicherheit", label: "SSL/TLS-Zertifikate, Hosting und Website-Schutz" },
    ],
    faqTitle: "Häufige Fragen",
    faqs: [
      { q: "Wo sind Sie ansässig?", a: "In der Via St. Martin de Corléans 179, 11100 Aosta. Telefon: +39 388 166 0117. Eine Umsatzsteuer-Identifikationsnummer ist noch nicht veröffentlicht." },
      { q: "Arbeiten Sie nur im Aostatal?", a: "Wir beginnen im Aostatal und betreuen anschließend ausgewählte Branchen in Norditalien, besonders Hotels und Unterkünfte." },
      { q: "Gestalten Sie Hotelseiten mit Direktbuchung?", a: "Ja. Die Website zeigt Zimmer, Daten und Preise; die Buchung wird direkt auf der Website der Unterkunft abgeschlossen. Buchungsportale können bestehen bleiben, sind aber nicht erforderlich." },
      { q: "Was kostet eine Website?", a: "Wir berechnen keinen pauschalen Seitenpreis. Eine einfache Website und eine mehrsprachige Hotelwebsite sind unterschiedlich aufwendig. Ein Angebot erstellen wir, nachdem wir Inhalte, Sprachen und Integrationen kennen." },
    ],
    cta: "Schreiben Sie unserem Studio", crumb: "Brotkrumennavigation", home: "Startseite",
  },
  fr: {
    metaTitle: "Studio web dans la Vallée d’Aoste, à Aoste | CTRL®",
    metaDescription: "CTRL® conçoit des sites sur mesure, des réservations hôtelières, des boutiques en ligne, des applications web et des logiciels. Notre studio est à Aoste.",
    title: "Un studio web dans la Vallée d’Aoste",
    lead: "Nous sommes un studio de creative technology à Aoste. Nous concevons des sites, des identités et des logiciels pour les entreprises de la vallée et les hôtels du nord de l’Italie.",
    whereTitle: "La vallée d’abord.",
    where: ["Notre studio est à Aoste. Nous connaissons le territoire, les saisons touristiques et les entreprises qui vivent du bouche-à-oreille. Notre premier ancrage est ici, dans la Vallée d’Aoste.", "La suite ne consiste pas à créer une page pour chaque ville, mais à développer une expertise : des sites avec réservation directe pour les hôtels et hébergements du nord de l’Italie. Le reste vient ensuite, projet après projet."],
    servicesTitle: "Nos services",
    services: [
      { href: "/services/visual-communication", kicker: "Sites web", label: "Sites sur mesure, refontes, boutiques en ligne et hôtels" },
      { href: "/services/brand-identity", kicker: "Identité", label: "Identité de marque et univers visuel" },
      { href: "/services/product-development", kicker: "Produits", label: "Applications web et produits numériques sur mesure" },
      { href: "/services/webapp", kicker: "Applications web", label: "Applications avec espaces privés et tableaux de bord" },
      { href: "/services/software-ai", kicker: "Logiciels", label: "Outils internes, automatisations et intelligence artificielle" },
      { href: "/services/growth-support", kicker: "SEO", label: "Référencement Google et maintenance" },
      { href: "/services/web-security", kicker: "Sécurité", label: "Certificats SSL/TLS, hébergement et protection du site" },
    ],
    faqTitle: "Questions fréquentes",
    faqs: [
      { q: "Où êtes-vous situés ?", a: "Via St. Martin de Corléans 179, 11100 Aoste. Téléphone : +39 388 166 0117. Notre numéro de TVA n’est pas encore publié." },
      { q: "Travaillez-vous uniquement dans la Vallée d’Aoste ?", a: "Nous commençons dans la vallée, puis accompagnons des secteurs ciblés dans le nord de l’Italie, notamment les hôtels et hébergements." },
      { q: "Créez-vous des sites d’hôtel avec réservation directe ?", a: "Oui. Le site présente les chambres, les dates et les tarifs, puis la réservation se termine directement sur le site de l’établissement. Les plateformes peuvent rester, mais ne sont pas indispensables." },
      { q: "Combien coûte un site web ?", a: "Nous ne facturons pas un tarif fixe par page. Un site simple et un site hôtelier multilingue demandent des travaux différents. Nous établissons un devis après avoir étudié les contenus, les langues et les intégrations." },
    ],
    cta: "Écrire au studio", crumb: "Fil d’Ariane", home: "Accueil",
  },
});

export function localMetadata(lang: Locale): Metadata {
  const c = copy[lang];
  return publicMeta(lang, { title: c.metaTitle, description: c.metaDescription, itPath: LOCAL_PATH });
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
      <main className="p-root pf" data-motion-root>
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

        <div className="wa-wrap">
          <FaqList id="local-faq" title={c.faqTitle} items={[...c.faqs]} />
        </div>

        <ProjectsCta copy={projectsCopy[lang]} href={localize("/contact", lang)} />
        <ProjectsMotion />
      </main>
      <SiteFooter />
    </>
  );
}
