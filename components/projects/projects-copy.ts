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
};

export const projectsCopy: Record<Locale, ProjectsCopy> = {
  it: {
    metaTitle: "Progetti",
    metaDescription: "Siti web, webapp, software, brand, mockup commerciali e video promozionali: i lavori di CTRL® divisi per categoria.",
    tag: "Progetti",
    title: "Progetti.",
    lead: ["Idee, soluzioni e risultati concreti.", "Scopri alcuni dei nostri lavori."],
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
  },
  en: {
    metaTitle: "Projects",
    metaDescription: "Websites, web apps, software, brand, commercial mockups and promo videos: CTRL® work grouped by category.",
    tag: "Projects",
    title: "Projects.",
    lead: ["Ideas, solutions and concrete results.", "Explore some of our work."],
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
  },
};
