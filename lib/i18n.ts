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
    nav: { work: "Progetti", team: "Team", services: "Servizi", journal: "Journal", contact: "Contatti" },
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
      kicker: ["Studio indipendente", "di creative technology"],
      title: ["Dall'identità", "al prodotto.", "Un unico", "partner."],
      lead: "Uno studio creativo e tecnologico che trasforma idee in esperienze digitali e prodotti che lasciano il segno.",
      approach: "Scopri il nostro approccio",
      heroAlt: "Architettura brutalista in cemento aperta su un lago e sulle montagne",
      heroTags: ["Idee", "Tecnologia", "Esperienze"],
      place: ["Aosta", "Valle d'Aosta"],
      servicesKicker: "Cosa facciamo",
      servicesTitle: ["Più di un sito.", "Una presenza digitale", "che cresce con il brand."],
      servicesLead:
        "Progettiamo esperienze digitali, prodotti e contenuti che rafforzano l'identità del brand, unendo tecnologia, design e strategia. Dall'idea al prodotto, con un approccio su misura, concreto e orientato ai risultati.",
      portraitAlt: "Ritratto di profilo in bianco e nero",
      pillars: [
        { title: "Brand & Identità", text: "Strategia, naming e linguaggio visivo per dare forma alla tua identità." },
        { title: "Sviluppo Prodotto", text: "Web e mobile app, performance, scalabilità e soluzioni su misura." },
        { title: "Comunicazione Visiva", text: "Storie, contenuti e direzione creativa per raccontare il tuo brand." },
        { title: "Crescita & Supporto", text: "Ottimizzazione, manutenzione e affiancamento continuo." },
      ],
      workKicker: "Progetti recenti",
      allProjects: "Tutti i progetti",
      discover: "Scopri il progetto",
      whyKicker: "Perché CTRL®",
      whyWords: ["Strategia.", "Design.", "Tecnologia.", "Risultati."],
      whyLead: "Un approccio integrato per trasformare idee complesse in soluzioni semplici, belle e performanti.",
      stats: [
        { value: "2", label: ["Aree", "Design e AI"] },
        { value: "5", label: ["Lingue", "Parlate dal team"] },
        { value: "100%", label: ["Su misura", "Nessun template"] },
        { value: "∞", label: ["Curiosità", "Per il futuro"] },
      ],
      closeTitle: "Parliamo.",
      closeKicker: ["Nuovi progetti", "Nuove collaborazioni"],
      closeLead: "Raccontaci il tuo brand, il prodotto o il problema da risolvere. Siamo pronti a costruire qualcosa di grande, insieme.",
      closeCta: "Scrivici una email",
      location: "Aosta, Valle d'Aosta",
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
    team: {
      description: "Le persone di CTRL®: design, sviluppo frontend, AI e sviluppo full stack.",
      tag: "Team",
      title: ["Persone", "che costruiscono", "idee."],
      lead: "Un team multidisciplinare, unito dalla passione per il digitale e dalla voglia di spingersi oltre.",
      scroll: "Scopri il team",
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
      localTime: "Ora locale, Aosta, Valle d'Aosta",
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
    nav: { work: "Work", team: "Team", services: "Services", journal: "Journal", contact: "Contact" },
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
      kicker: ["Independent studio", "of creative technology"],
      title: ["From identity", "to product.", "One single", "partner."],
      lead: "A creative and technology studio that turns ideas into digital experiences and products that leave a mark.",
      approach: "Discover our approach",
      heroAlt: "Brutalist concrete architecture opening onto a lake and mountains",
      heroTags: ["Ideas", "Technology", "Experiences"],
      place: ["Aosta", "Valle d'Aosta"],
      servicesKicker: "What we do",
      servicesTitle: ["More than a website.", "A digital presence", "that grows with the brand."],
      servicesLead:
        "We design digital experiences, products and content that strengthen a brand's identity, bringing technology, design and strategy together. From idea to product, with a tailored, practical and results-driven approach.",
      portraitAlt: "Black and white profile portrait",
      pillars: [
        { title: "Brand & Identity", text: "Strategy, naming and visual language to shape your identity." },
        { title: "Product Development", text: "Web and mobile apps, performance, scalability and custom solutions." },
        { title: "Visual Communication", text: "Stories, content and creative direction to tell your brand's story." },
        { title: "Growth & Support", text: "Optimisation, maintenance and ongoing support." },
      ],
      workKicker: "Recent work",
      allProjects: "All projects",
      discover: "Discover the project",
      whyKicker: "Why CTRL®",
      whyWords: ["Strategy.", "Design.", "Technology.", "Results."],
      whyLead: "An integrated approach that turns complex ideas into simple, beautiful, high-performing solutions.",
      stats: [
        { value: "2", label: ["Areas", "Design and AI"] },
        { value: "5", label: ["Languages", "Spoken by the team"] },
        { value: "100%", label: ["Tailored", "No templates"] },
        { value: "∞", label: ["Curiosity", "For the future"] },
      ],
      closeTitle: "Let's talk.",
      closeKicker: ["New projects", "New collaborations"],
      closeLead: "Tell us about your brand, your product or the problem to solve. We are ready to build something great, together.",
      closeCta: "Send us an email",
      location: "Aosta, Valle d'Aosta",
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
    team: {
      description: "The people behind CTRL®: design, frontend development, AI and full-stack development.",
      tag: "Team",
      title: ["People", "who build", "ideas."],
      lead: "A multidisciplinary team, united by a passion for digital and the drive to push further.",
      scroll: "Meet the team",
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
      localTime: "Local time, Aosta, Valle d'Aosta",
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
