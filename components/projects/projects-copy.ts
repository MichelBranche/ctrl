import type { Locale } from "@/lib/i18n";

export type ProjectsCopy = {
  metaTitle: string;
  metaDescription: string;
  tag: string;
  title: string;
  lead: [string, string];
  all: string;
  filterLabel: string;
  filterAll: string;
  viewLabel: string;
  gridView: string;
  listView: string;
  open: string;
  ctaKicker: string;
  ctaTitle: string;
  ctaText: string;
  ctaButton: string;
  back: string;
  worksLabel: string;
  updatingKicker: string;
  emptyTitle: string;
  emptyText: string;
  emptyCta: string;
  client: string;
  visit: string;
  newTab: string;
  others: string;
  count: (n: number) => string;
  categoryMeta: (label: string) => string;
  categorySeo: Record<string, { title: string; description: string }>;
  sites: {
    metaDescription: string;
    filterLabel: string;
    madeBy: string;
    portfolioTab: string;
    open: string;
    back: string;
    facts: { category: string; place: string; year: string; author: string; tech: string };
    live: string;
    prev: string;
    next: string;
    galleryLabel: string;
    shotDesktop: string;
    shotMobile: string;
  };
};

export const projectsCopy: Record<Locale, ProjectsCopy> = {
  it: {
    metaTitle: "Progetti web ad Aosta: siti, webapp e software | CTRL®",
    metaDescription: "Siti web, webapp, software, brand e video dello studio CTRL® ad Aosta, più la sicurezza web e i certificati SSL/TLS gestiti. Guarda i lavori.",
    tag: "Progetti",
    title: "Progetti.",
    lead: ["Siti, webapp e software fatti ad Aosta.", "Lavori dello studio CTRL®."],
    all: "Tutti i progetti",
    filterLabel: "Filtra per categoria",
    filterAll: "Tutti",
    viewLabel: "Visualizzazione",
    gridView: "Vista griglia",
    listView: "Vista lista",
    open: "Apri la categoria",
    ctaKicker: "Hai un progetto in mente?",
    ctaTitle: "Parliamone.",
    ctaText: "Raccontaci la tua idea, siamo qui per trasformarla in realtà.",
    ctaButton: "Contattaci",
    back: "Tutti i progetti",
    worksLabel: "Lavori",
    updatingKicker: "In aggiornamento",
    emptyTitle: "Contenuto in aggiornamento",
    emptyText: "Stiamo selezionando i lavori da mostrare in questa categoria. Torna a trovarci presto, oppure raccontaci il tuo progetto.",
    emptyCta: "Raccontaci il tuo progetto",
    client: "Cliente",
    visit: "Visita il progetto",
    newTab: "(si apre in una nuova scheda)",
    others: "Altre categorie",
    count: (n) => (n === 1 ? "1 progetto" : `${n} progetti`),
    categoryMeta: (label) => `${label} | Progetti`,
    categorySeo: {
      websites: {
        title: "Siti web realizzati ad Aosta: casi e demo live | CTRL®",
        description: "Siti per hospitality, food, cultura e brand, progettati ad Aosta da CTRL® con Next.js, React e GSAP. Include il caso Residence Le Vele. In Italia.",
      },
      software: {
        title: "Progetti software su misura dello studio ad Aosta | CTRL®",
        description: "Strumenti interni, automazioni e integrazioni sul modo di lavorare del team. Progetti software di CTRL®, agenzia web con sede ad Aosta. In Italia.",
      },
      "brand-identity": {
        title: "Progetti di brand identity dello studio ad Aosta | CTRL®",
        description: "Logo, sistemi visivi e linee guida dello studio CTRL® ad Aosta. Identità pensate per restare coerenti su sito, social e stampa. Guarda i lavori.",
      },
      "promo-videos": {
        title: "Video promozionali dello studio web ad Aosta | CTRL®",
        description: "Motion, spot e video brevi per social e lanci, realizzati da CTRL® ad Aosta. La categoria raccoglie i lavori video dello studio in valle. In Italia.",
      },
    },
    sites: {
      metaDescription: "Siti per hospitality, food, cultura e brand, progettati ad Aosta da CTRL® con Next.js, React e GSAP. Include il caso Residence Le Vele. In Italia.",
      filterLabel: "Filtra i siti per settore",
      madeBy: "Realizzato da",
      portfolioTab: "(portfolio dell'autore, si apre in una nuova scheda)",
      open: "Apri la scheda del progetto",
      back: "Siti web",
      facts: { category: "Categoria", place: "Contesto", year: "Anno", author: "Realizzato da", tech: "Stack" },
      live: "Visita il sito live",
      prev: "Precedente",
      next: "Successivo",
      galleryLabel: "Screenshot del sito live",
      shotDesktop: "Desktop",
      shotMobile: "Mobile",
    },
  },
  en: {
    metaTitle: "Web projects from Aosta: sites, apps, software | CTRL®",
    metaDescription: "Websites, web apps, software, brand and promo videos from the CTRL® studio in Aosta, plus managed web security and SSL/TLS certificates. See the work.",
    tag: "Projects",
    title: "Projects.",
    lead: ["Websites, apps and software made in Aosta.", "Work from the CTRL® studio."],
    all: "All projects",
    filterLabel: "Filter by category",
    filterAll: "All",
    viewLabel: "View",
    gridView: "Grid view",
    listView: "List view",
    open: "Open the category",
    ctaKicker: "Have a project in mind?",
    ctaTitle: "Let's talk.",
    ctaText: "Tell us your idea, we are here to make it real.",
    ctaButton: "Contact us",
    back: "All projects",
    worksLabel: "Work",
    updatingKicker: "Being updated",
    emptyTitle: "Content being updated",
    emptyText: "We are selecting the work to show in this category. Check back soon, or tell us about your project.",
    emptyCta: "Tell us about your project",
    client: "Client",
    visit: "View the project",
    newTab: "(opens in a new tab)",
    others: "Other categories",
    count: (n) => (n === 1 ? "1 project" : `${n} projects`),
    categoryMeta: (label) => `${label} | Projects`,
    categorySeo: {
      websites: {
        title: "Websites built in Aosta: case studies and demos | CTRL®",
        description: "Sites for hospitality, food, culture and brands, designed in Aosta by CTRL® with Next.js, React and GSAP. Includes the Residence Le Vele case.",
      },
      software: {
        title: "Custom software projects from the Aosta studio | CTRL®",
        description: "Internal tools, automations and integrations shaped around how a team works. Software projects by CTRL®, the web studio based in Aosta. See the work.",
      },
      "brand-identity": {
        title: "Brand identity projects from the Aosta studio | CTRL®",
        description: "Logos, visual systems and guidelines from the CTRL® studio in Aosta. Identities built to stay consistent on the site, on social and in print.",
      },
      "promo-videos": {
        title: "Promo videos from our own web studio in Aosta | CTRL®",
        description: "Motion, spots and short videos for social and launches, made by CTRL® in Aosta. This category collects the studio's video work in the valley.",
      },
    },
    sites: {
      metaDescription: "Sites for hospitality, food, culture and brands, designed in Aosta by CTRL® with Next.js, React and GSAP. Includes the Residence Le Vele case.",
      filterLabel: "Filter sites by sector",
      madeBy: "Made by",
      portfolioTab: "(author's portfolio, opens in a new tab)",
      open: "Open the project page",
      back: "Websites",
      facts: { category: "Category", place: "Context", year: "Year", author: "Made by", tech: "Stack" },
      live: "Visit live site",
      prev: "Previous",
      next: "Next",
      galleryLabel: "Screenshots of the live site",
      shotDesktop: "Desktop",
      shotMobile: "Mobile",
    },
  },
};
