export const locales = ["it", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "it";

export type L<T = string> = Record<Locale, T>;

/** Prefix an internal path with the locale segment (Italian is the default, unprefixed). */
export function localize(path: string, lang: Locale) {
  if (lang === defaultLocale) return path;
  if (path === "/") return "/en";
  if (path.startsWith("/#")) return `/en${path.slice(1)}`;
  return `/en${path}`;
}

/** Return the same page in the other locale. */
export function switchPath(pathname: string, to: Locale) {
  const bare = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return localize(bare, to);
}

export function localeFromPath(pathname: string | null): Locale {
  return pathname && /^\/en(\/|$)/.test(pathname) ? "en" : "it";
}

export const dict = {
  it: {
    nav: { work: "Progetti", about: "Studio", services: "Servizi", journal: "Journal" },
    cta: "Parliamo del tuo progetto",
    ctaShort: "Parliamo",
    menu: "Menu",
    close: "Chiudi",
    langLabel: "Lingua",
    cmd: {
      label: "Menu rapido",
      placeholder: "Dove vuoi andare?",
      open: "Apri il menu rapido",
      email: "Scrivi una email",
      lang: "English version",
      empty: "Nessun risultato",
      home: "Home",
    },
    home: {
      kicker: "Studio indipendente di creative technology",
      title: ["Dall'identità", "al prodotto.", "Un unico partner."],
      lead: "CTRL® unisce design, sviluppo software e comunicazione visiva. Diamo forma al brand, costruiamo i prodotti digitali e li facciamo evolvere nel tempo.",
      secondary: "Guarda i progetti",
      heroAlt: "Interno in cemento attraversato da una lama di luce",
      posterTop: ["Brand", "Prodotti digitali", "Visual"],
      posterBottom: ["Idee", "Tecnologia", "Impatto"],
      scroll: "Scorri",
      servicesKicker: "Cosa facciamo",
      servicesTitle: ["Più di un sito.", "Una presenza digitale", "che cresce con il brand."],
      servicesLead:
        "Non una web agency, non una software house tradizionale. Un unico partner per progettare, costruire e far evolvere la presenza digitale di un'azienda: identità visiva, prodotti digitali e comunicazione nello stesso percorso.",
      view: "Scopri",
      workKicker: "Progetti recenti",
      allProjects: "Tutti i progetti",
    },
    work: {
      title: "Progetti",
      description: "Progetti di CTRL® | identità, prodotti digitali e comunicazione visiva.",
      kicker: "Progetti selezionati",
      concept: "Concept",
      conceptNote:
        "Progetto concept: un'esplorazione autoprodotta, non commissionata dal brand citato.",
      visit: "Visita il sito live",
      back: "Tutti i progetti",
    },
    services: { back: "Tutti i servizi", next: "Prossimo", fallback: "Servizi" },
    about: {
      description:
        "CTRL® è uno studio indipendente di creative technology: identità, prodotti digitali e comunicazione visiva.",
      title: ["Uno studio indipendente", "per brand che vogliono", "una presenza più netta."],
      body: [
        "CTRL® è uno studio indipendente che unisce design, sviluppo software e comunicazione visiva. Accompagniamo i brand dall'identità ai prodotti digitali, e oltre.",
        "Un unico partner per progettare, costruire e far evolvere la presenza digitale di un'azienda. Uniamo creatività, tecnologia e strategia per creare esperienze che lasciano il segno.",
      ],
    },
    journal: {
      description: "Note di CTRL® su design, prodotti digitali e comunicazione visiva.",
      title: ["Appunti su design,", "prodotto e immagine."],
      notes: [
        { title: "Prima l'identità, poi l'interfaccia", text: "Un prodotto digitale regge solo se il linguaggio visivo è già chiaro. Prima il segno, poi lo schermo." },
        { title: "Costruire per cambiare", text: "La presenza di un brand non è un lancio. È un sistema che deve poter evolvere senza perdere la voce." },
        { title: "Immagini quiete, tipografia esatta", text: "La fotografia tiene il luogo. La tipografia tiene il significato. Insieme fanno il tono." },
      ],
      explore: "Guarda i progetti",
    },
    footer: {
      ticker: ["Design", "Sviluppo", "Comunicazione visiva", "Brand", "Prodotto", "Strategia"],
      kicker: "Nuovi progetti",
      title: "Parliamo.",
      lead: "Raccontaci il brand, il prodotto o il problema da risolvere.",
      studio: "Studio",
      independent: "Indipendente",
      available: "Disponibili per nuovi progetti",
      localTime: "Ora locale, Italia",
      index: "Indice",
      contact: "Contatti",
      top: "Torna su",
      tagline: "Design | Sviluppo | Comunicazione visiva",
    },
    meta: {
      title: "CTRL® | Dall'identità al prodotto. Un unico partner.",
      description:
        "CTRL® è uno studio indipendente di creative technology che unisce design, sviluppo software e comunicazione visiva: dall'identità del brand ai prodotti digitali.",
    },
  },
  en: {
    nav: { work: "Work", about: "Studio", services: "Services", journal: "Journal" },
    cta: "Let's talk about your project",
    ctaShort: "Let's talk",
    menu: "Menu",
    close: "Close",
    langLabel: "Language",
    cmd: {
      label: "Quick menu",
      placeholder: "Where do you want to go?",
      open: "Open the quick menu",
      email: "Write an email",
      lang: "Versione italiana",
      empty: "No results",
      home: "Home",
    },
    home: {
      kicker: "Independent creative technology studio",
      title: ["From identity", "to product.", "One partner."],
      lead: "CTRL® brings together design, software development and visual communication. We shape the brand, build the digital products and keep them evolving.",
      secondary: "See the work",
      heroAlt: "Concrete interior crossed by a blade of light",
      posterTop: ["Brands", "Digital products", "Visuals"],
      posterBottom: ["Ideas", "Technology", "Impact"],
      scroll: "Scroll",
      servicesKicker: "What we do",
      servicesTitle: ["More than a website.", "A digital presence", "that grows with the brand."],
      servicesLead:
        "Not a web agency, not a traditional software house. One partner to design, build and evolve a company's digital presence: visual identity, digital products and communication in a single path.",
      view: "View",
      workKicker: "Latest work",
      allProjects: "All projects",
    },
    work: {
      title: "Work",
      description: "Work by CTRL® | identity, digital products and visual communication.",
      kicker: "Selected work",
      concept: "Concept",
      conceptNote:
        "Concept project: a self-initiated exploration, not commissioned by the brand shown.",
      visit: "Visit the live site",
      back: "All projects",
    },
    services: { back: "All services", next: "Next", fallback: "Services" },
    about: {
      description:
        "CTRL® is an independent creative technology studio for identity, digital products and visual communication.",
      title: ["An independent studio", "for brands that want", "a sharper presence."],
      body: [
        "CTRL® is an independent studio that combines design, software development and visual communication. We help brands go from identity to digital products and beyond.",
        "One partner to design, build and evolve a company's digital presence. We bring creativity, technology and strategy together to create experiences that leave a mark.",
      ],
    },
    journal: {
      description: "Notes from CTRL® on design, digital products and visual communication.",
      title: ["Field notes on design,", "product and image."],
      notes: [
        { title: "Identity before interface", text: "A digital product only holds up when the visual language is already clear. First the mark, then the screen." },
        { title: "Build it so it can change", text: "A brand's presence is not a launch. It is a system that must evolve without losing its voice." },
        { title: "Quiet pictures, exact type", text: "Photography holds the place. Typography holds the meaning. Together they set the tone." },
      ],
      explore: "See the work",
    },
    footer: {
      ticker: ["Design", "Development", "Visual Communication", "Brand", "Product", "Strategy"],
      kicker: "New business",
      title: "Let's talk.",
      lead: "Tell us about the brand, the product, or the problem to solve.",
      studio: "Studio",
      independent: "Independent",
      available: "Available for new projects",
      localTime: "Local time, Italy",
      index: "Index",
      contact: "Contact",
      top: "Back to top",
      tagline: "Design | Development | Visual Communication",
    },
    meta: {
      title: "CTRL® | From identity to product. One partner.",
      description:
        "CTRL® is an independent creative technology studio combining design, software development and visual communication: from brand identity to digital products.",
    },
  },
} as const;

export type Dict = (typeof dict)[Locale];
