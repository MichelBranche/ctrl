import type { Locale } from "@/lib/i18n";


type Feature = { icon: "layers" | "lock" | "users" | "bolt"; title: string; text: string };
type Slide = { image: string; alt: string; kicker: string; title: string; text: string; cta: string; href: string; external: boolean };

export const webappCopy: Record<Locale, {
  metaTitle: string; metaDescription: string; crumbs: [string, string]; back: string;
  tag: string; title: [string, string]; lead: string;
  serviceKicker: string; serviceTitle: [string, string]; serviceText: string; consult: string;
  features: Feature[]; slidesLabel: string; prev: string; next: string; goTo: (n: number) => string; newTab: string; slides: Slide[];
  processKicker: string; processTitle: [string, string]; steps: { title: string; text: string }[];
}> = {
  it: {
    metaTitle: "Webapp su misura ad Aosta, con aree riservate | CTRL®",
    metaDescription: "Webapp con aree riservate, dashboard e flussi su misura. CTRL® le sviluppa ad Aosta per team in Valle d'Aosta e nel Nord Italia. Scrivici. Senza template.",
    crumbs: ["Servizi", "Webapp"],
    back: "Tutti i servizi",
    tag: "Webapp",
    title: ["Webapp", "scalabili"],
    lead: "Applicazioni web con aree riservate, dashboard e flussi complessi, costruite per crescere insieme al prodotto.",
    serviceKicker: "Il servizio",
    serviceTitle: ["Dall'idea alla webapp,", "pronta a scalare."],
    serviceText: "Progettiamo e sviluppiamo applicazioni web su misura, robuste, sicure e orientate alla crescita. Interfacce pulite, architetture affidabili e un'esperienza d'uso che semplifica i processi, per utenti e team.",
    consult: "Richiedi una consulenza",
    features: [
      { icon: "layers", title: "Architettura scalabile", text: "Pensata per evolvere nel tempo, con prestazioni e stabilità." },
      { icon: "lock", title: "Sicurezza e privacy", text: "Dati protetti e accessi controllati, secondo le migliori pratiche." },
      { icon: "users", title: "Esperienza su misura", text: "Interfacce intuitive, progettate sulle reali esigenze del tuo business." },
      { icon: "bolt", title: "Integrazioni e automazioni", text: "Si connette ai tuoi strumenti e ottimizza i flussi di lavoro." },
    ],
    slidesLabel: "Prodotti CTRL®",
    prev: "Precedente",
    next: "Successivo",
    goTo: (n) => `Vai alla slide ${n}`,
    newTab: "(si apre in una nuova scheda)",
    slides: [
      {
        image: "/images/services/agenda-easy.webp",
        alt: "Agenda Easy aperta su un portatile: elenco degli appuntamenti del giorno",
        kicker: "Disponibile ora · Prodotto CTRL®",
        title: "Agenda Easy",
        text: "La webapp per gestire appuntamenti, clienti e risorse. Pronta da attivare per studi e attività professionali, da 9,90 €/mese.",
        cta: "Prova Agenda Easy",
        href: "/projects/webapps/agenda-easy",
        external: false,
      },
    ],
    processKicker: "Il processo",
    processTitle: ["Un processo chiaro,", "risultati concreti."],
    steps: [
      { title: "Analisi", text: "Obiettivi, requisiti e flussi di utilizzo." },
      { title: "Progettazione", text: "UX/UI e architettura della soluzione." },
      { title: "Sviluppo", text: "Implementazione, test e integrazioni." },
      { title: "Lancio e crescita", text: "Rilascio, monitoraggio e ottimizzazioni continue." },
    ],
  },
  en: {
    metaTitle: "Custom web apps in Aosta, with private areas | CTRL®",
    metaDescription: "Web apps with private areas, dashboards and custom flows. CTRL® builds them in Aosta for teams in Valle d'Aosta and across Northern Italy. No templates.",
    crumbs: ["Services", "Web apps"],
    back: "All services",
    tag: "Web apps",
    title: ["Scalable", "web apps"],
    lead: "Web applications with private areas, dashboards and complex flows, built to grow with the product.",
    serviceKicker: "The service",
    serviceTitle: ["From idea to web app,", "ready to scale."],
    serviceText: "We design and build custom web applications that are robust, secure and built for growth. Clean interfaces, reliable architecture and an experience that simplifies processes, for users and teams alike.",
    consult: "Book a consultation",
    features: [
      { icon: "layers", title: "Scalable architecture", text: "Designed to evolve over time, with performance and stability." },
      { icon: "lock", title: "Security and privacy", text: "Protected data and controlled access, following best practices." },
      { icon: "users", title: "Tailored experience", text: "Intuitive interfaces, designed around the real needs of your business." },
      { icon: "bolt", title: "Integrations and automation", text: "Connects to your tools and streamlines your workflows." },
    ],
    slidesLabel: "CTRL® products",
    prev: "Previous",
    next: "Next",
    goTo: (n) => `Go to slide ${n}`,
    newTab: "(opens in a new tab)",
    slides: [
      {
        image: "/images/services/agenda-easy.webp",
        alt: "Agenda Easy open on a laptop: list of today's appointments",
        kicker: "Available now · A CTRL® product",
        title: "Agenda Easy",
        text: "The web app to manage appointments, clients and resources. Ready to switch on for studios and professional practices, from €9.90/month.",
        cta: "Try Agenda Easy",
        href: "/projects/webapps/agenda-easy",
        external: false,
      },
    ],
    processKicker: "The process",
    processTitle: ["A clear process,", "concrete results."],
    steps: [
      { title: "Analysis", text: "Goals, requirements and user flows." },
      { title: "Design", text: "UX/UI and solution architecture." },
      { title: "Development", text: "Implementation, testing and integrations." },
      { title: "Launch and growth", text: "Release, monitoring and continuous optimisation." },
    ],
  },
};
