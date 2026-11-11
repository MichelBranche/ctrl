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
  // The cookie policy is the one page whose slug differs per language.
  if (bare === "/cookie" || bare === "/cookies") return to === "en" ? "/en/cookies" : "/cookie";
  return localize(bare, to);
}

/** Cookie holding a language picked by hand with the switch; it wins over device detection. */
export const LANG_COOKIE = "ctrl-lang";

/** Device language to site language: Italian for any "it*" tag, English for every other language. */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  const first = header?.split(",")[0]?.trim().toLowerCase();
  if (!first || first === "*") return null;
  return first.startsWith("it") ? "it" : "en";
}

/** Persist a manual language choice for a year (client only). */
export function rememberLocale(lang: Locale) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

export function localeFromPath(pathname: string | null): Locale {
  return pathname && /^\/en(\/|$)/.test(pathname) ? "en" : "it";
}

export const dict = {
  it: {
    nav: { work: "Progetti", team: "Team", services: "Servizi", journal: "Journal", shop: "Shop", contact: "Contatti" },
    cta: "Parliamo del tuo progetto",
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
      lead: "Agenzia web ad Aosta: siti su misura, hotel, software e brand per la Valle d'Aosta e il Nord Italia.",
      approach: "Scopri il nostro approccio",
      heroAlt: "Architettura brutalista in cemento aperta su un lago e sulle montagne",
      heroTags: ["Idee", "Tecnologia", "Esperienze"],
      place: ["Aosta", "Valle d'Aosta"],
      servicesKicker: "Cosa facciamo",
      servicesTitle: ["Più di un sito.", "Una presenza digitale", "che cresce con il brand."],
      servicesLead:
        "Dall'agenzia web di Aosta: siti, identità, web app e software su misura, per attività in Valle d'Aosta e nel Nord Italia.",
      portraitAlt: "Ritratto di profilo in bianco e nero",
      workKicker: "Progetti recenti",
      allProjects: "Tutti i progetti",
      discover: "Scopri il progetto",
      whyKicker: "Perché CTRL®",
      whyWords: ["Strategia.", "Design.", "Tecnologia.", "Risultati."],
      whyLead: "Un approccio integrato per trasformare idee complesse in soluzioni semplici, belle e performanti.",
      stats: [
        // Six offers already claimed on the site: websites, direct-booking hotels, e-commerce, web apps, software, brand.
        { value: "6", label: ["Aree", "Dal sito al software"] },
        { value: "5", label: ["Lingue", "Parlate dal team"] },
        { value: "100%", label: ["Su misura", "Nessun template"] },
        { value: "∞", label: ["Curiosità", "Per il futuro"] },
      ],
      closeTitle: "Parliamo.",
      closeKicker: ["Nuovi progetti", "Nuove collaborazioni"],
      closeLead: "Raccontaci il tuo brand, il prodotto o il problema da risolvere. Siamo pronti a costruire qualcosa di grande, insieme.",
      closeCta: "Scrivici una email",
      location: "Aosta, Valle d'Aosta",
      proofKicker: "Caso studio",
      proofTitle: "Residence Le Vele",
      proofText: "14 prenotazioni e 11.947 € nel primo mese online, con 0 € spesi in advertising.",
      proofCta: "Leggi il caso",
    },
    services: {
      back: "Tutti i servizi",
      next: "Prossimo",
      fallback: "Servizi",
      wipKicker: "Work in progress",
      wipTitle: "Pagina in costruzione",
      wipText: "Stiamo scrivendo questa pagina con casi, metodo e dettagli del servizio. Nel frattempo raccontaci cosa ti serve: rispondiamo noi, di persona.",
      wipContact: "Contattaci",
      wipOthers: "Altri servizi",
    },
    team: {
      metaTitle: "Team dell'agenzia web ad Aosta, Valle d'Aosta | CTRL®",
      description: "Michel Branche, Kallebe Gallo e Jacopo Manzalini. Design, sviluppo, AI e commerciale nello studio CTRL® ad Aosta, in Valle d'Aosta. Tre persone.",
      tag: "Team",
      title: ["Persone", "che costruiscono", "idee."],
      lead: "Il team dell'agenzia web ad Aosta: design, sviluppo, AI e vendita.",
      scroll: "Scopri il team",
    },
    meta: {
      title: "Agenzia web ad Aosta: il sito web su misura | CTRL®",
      description:
        "CTRL® è l'agenzia web di Aosta. Siti su misura, hotel con prenotazione diretta, e-commerce, web app e software per la Valle d'Aosta e il Nord Italia.",
    },
  },
  en: {
    nav: { work: "Work", team: "Team", services: "Services", journal: "Journal", shop: "Shop", contact: "Contact" },
    cta: "Let's talk about your project",
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
      lead: "Web agency in Aosta: custom websites, hotels, software and brand for Valle d'Aosta and Northern Italy.",
      approach: "Discover our approach",
      heroAlt: "Brutalist concrete architecture opening onto a lake and mountains",
      heroTags: ["Ideas", "Technology", "Experiences"],
      place: ["Aosta", "Valle d'Aosta"],
      servicesKicker: "What we do",
      servicesTitle: ["More than a website.", "A digital presence", "that grows with the brand."],
      servicesLead:
        "From the web agency in Aosta: custom websites, identity, web apps and software for businesses in Valle d'Aosta and Northern Italy.",
      portraitAlt: "Black and white profile portrait",
      workKicker: "Recent work",
      allProjects: "All projects",
      discover: "Discover the project",
      whyKicker: "Why CTRL®",
      whyWords: ["Strategy.", "Design.", "Technology.", "Results."],
      whyLead: "An integrated approach that turns complex ideas into simple, beautiful, high-performing solutions.",
      stats: [
        // Same six offers as the Italian line.
        { value: "6", label: ["Areas", "From site to software"] },
        { value: "5", label: ["Languages", "Spoken by the team"] },
        { value: "100%", label: ["Tailored", "No templates"] },
        { value: "∞", label: ["Curiosity", "For the future"] },
      ],
      closeTitle: "Let's talk.",
      closeKicker: ["New projects", "New collaborations"],
      closeLead: "Tell us about your brand, your product or the problem to solve. We are ready to build something great, together.",
      closeCta: "Send us an email",
      location: "Aosta, Valle d'Aosta",
      proofKicker: "Case study",
      proofTitle: "Residence Le Vele",
      proofText: "14 bookings and €11,947 in the first month online, with €0 spent on advertising.",
      proofCta: "Read the case",
    },
    services: {
      back: "All services",
      next: "Next",
      fallback: "Services",
      wipKicker: "Work in progress",
      wipTitle: "Page under construction",
      wipText: "We are writing this page with cases, method and service details. In the meantime, tell us what you need: we answer in person.",
      wipContact: "Contact us",
      wipOthers: "Other services",
    },
    team: {
      metaTitle: "Team of the Aosta web agency, Valle d'Aosta | CTRL®",
      description: "Michel Branche, Kallebe Gallo and Jacopo Manzalini. Design, development, AI and sales at the CTRL® studio in Aosta, Valle d'Aosta. Three people.",
      tag: "Team",
      title: ["People", "who build", "ideas."],
      lead: "The Aosta web agency team: design, development, AI and sales.",
      scroll: "Meet the team",
    },
    meta: {
      title: "Custom websites from our web agency in Aosta | CTRL®",
      description:
        "CTRL® is the web agency in Aosta, Valle d'Aosta. Custom websites, hotel sites, online shops, web apps and software, then across Northern Italy.",
    },
  },
} as const;

export type Dict = (typeof dict)[Locale];
