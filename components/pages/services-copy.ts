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
  details: string;
  graphicAlt: string;
  modesKicker: string;
  modesTitle: string[];
  modesText: string;
  custom: Plan;
  subscription: Plan;
};

export const servicesCopy: Record<Locale, ServicesCopy> = {
  it: {
    metaTitle: "Servizi",
    metaDescription:
      "Brand e identità, sviluppo prodotto, comunicazione visiva, crescita e supporto, software e AI. Su misura o in abbonamento.",
    tag: "Servizi",
    title: "Servizi CTRL®",
    lead: "Idee, tecnologia e design per far crescere il tuo brand.",
    discover: "Scopri i servizi",
    gridLabel: "I nostri servizi",
    details: "Dettagli",
    graphicAlt: "Segno grafico CTRL: una A disegnata come una montagna",
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
    metaTitle: "Services",
    metaDescription:
      "Brand and identity, product development, visual communication, growth and support, software and AI. Tailored or on subscription.",
    tag: "Services",
    title: "CTRL® Services",
    lead: "Ideas, technology and design to grow your brand.",
    discover: "Explore the services",
    gridLabel: "Our services",
    details: "Details",
    graphicAlt: "CTRL graphic mark: an A drawn as a mountain",
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
