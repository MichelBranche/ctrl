import type { Locale } from "@/lib/i18n";

type Plan = { title: string; text: string; checks: string[]; cta: string };

type ServicesCopy = {
  metaTitle: string;
  metaDescription: string;
  tag: string;
  title: string;
  lead: string;
  discover: string;
  gridLabel: string;
  graphicAlt: string;
  software: {
    kicker: string;
    title: string;
    text: string;
    available: string;
    perMonth: string;
    products: { name: string; text: string; price: string; image: string; alt: string; href: string; cta: string }[];
  };
  modesKicker: string;
  modesTitle: string[];
  modesText: string;
  custom: Plan;
  subscription: Plan;
};

export const servicesCopy: Record<Locale, ServicesCopy> = {
  it: {
    metaTitle: "Servizi web ad Aosta: siti, software e brand | CTRL®",
    metaDescription:
      "Siti su misura, brand, web app, software, SEO e sicurezza. CTRL® è l'agenzia web di Aosta e lavora in Valle d'Aosta e nel Nord Italia. Scrivici.",
    tag: "Servizi",
    title: "Servizi CTRL®",
    lead: "Siti su misura, brand, web app, software e SEO, dall'agenzia web di Aosta.",
    discover: "Scopri i servizi",
    gridLabel: "I nostri servizi",
    graphicAlt: "Segno grafico CTRL: una A disegnata come una montagna",
    software: {
      kicker: "Software in abbonamento",
      title: "Pronti da attivare.",
      text: "Prodotti CTRL® già sviluppati e mantenuti da noi: li attivi subito, con un canone mensile.",
      available: "Disponibile ora",
      perMonth: "/mese",
      products: [
        {
          name: "Agenda Easy",
          text: "La webapp per gestire appuntamenti, clienti e servizi, per studi e attività professionali.",
          price: "da 9,90 €",
          image: "/images/projects/agenda-easy/hero.webp",
          alt: "Agenda Easy aperta su un portatile",
          href: "/projects/webapps/agenda-easy",
          cta: "Scopri Agenda Easy",
        },
      ],
    },
    modesKicker: "Due modi per lavorare insieme",
    modesTitle: ["Su misura.", "O in abbonamento."],
    modesText: "Scegli il modello più adatto alle tue esigenze.",
    custom: {
      title: "Su misura",
      text: "Progetto personalizzato, dalla strategia al rilascio.",
      checks: ["Soluzione su misura", "Team dedicato", "Tempistiche definite"],
      cta: "Richiedi un preventivo",
    },
    subscription: {
      title: "In abbonamento",
      text: "Un partner continuo, con un canone mensile trasparente.",
      checks: ["Supporto continuo", "Aggiornamenti inclusi", "Assistenza prioritaria"],
      cta: "Scopri il piano",
    },
  },
  en: {
    metaTitle: "Web services in Aosta: sites, software, brand | CTRL®",
    metaDescription:
      "Custom websites, brand identity, web apps, software, SEO and security. CTRL® is the Aosta web agency for Valle d'Aosta and Northern Italy. Talk to us.",
    tag: "Services",
    title: "CTRL® Services",
    lead: "Custom websites, brand, web apps, software and SEO, from the web agency in Aosta.",
    discover: "Explore the services",
    gridLabel: "Our services",
    graphicAlt: "CTRL graphic mark: an A drawn as a mountain",
    software: {
      kicker: "Subscription software",
      title: "Ready to switch on.",
      text: "CTRL® products we build and maintain: switch them on today for a monthly fee.",
      available: "Available now",
      perMonth: "/month",
      products: [
        {
          name: "Agenda Easy",
          text: "The web app to manage appointments, clients and services, for studios and professional practices.",
          price: "from €9.90",
          image: "/images/projects/agenda-easy/hero.webp",
          alt: "Agenda Easy open on a laptop",
          href: "/projects/webapps/agenda-easy",
          cta: "Discover Agenda Easy",
        },
      ],
    },
    modesKicker: "Two ways to work together",
    modesTitle: ["Tailored.", "Or on subscription."],
    modesText: "Choose the model that best fits your needs.",
    custom: {
      title: "Tailored",
      text: "A custom project, from strategy to release.",
      checks: ["Tailored solution", "Dedicated team", "Defined timelines"],
      cta: "Request a quote",
    },
    subscription: {
      title: "On subscription",
      text: "An ongoing partner, with a transparent monthly fee.",
      checks: ["Ongoing support", "Updates included", "Priority assistance"],
      cta: "Discover the plan",
    },
  },
};
