export const locales = ["it", "en", "de", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "it";

/** Content authored before each locale can continue to fall back to English until translated. */
export type L<T = string> = Record<"it" | "en", T> & Record<string, T>;

function mergeCopy<T>(fallback: T, translated: Partial<T>): T {
  if (!fallback || !translated || typeof fallback !== "object" || typeof translated !== "object" || Array.isArray(fallback) || Array.isArray(translated)) return translated as T;
  const result: Record<string, unknown> = { ...(fallback as Record<string, unknown>), ...(translated as Record<string, unknown>) };
  for (const [key, value] of Object.entries(translated as Record<string, unknown>)) {
    const base = (fallback as Record<string, unknown>)[key];
    if (base && value && typeof base === "object" && typeof value === "object" && !Array.isArray(base) && !Array.isArray(value)) result[key] = mergeCopy(base, value);
  }
  return result as T;
}

/** Merge partial translations with English until every string has its own translation. */
export function withGermanFallback<T>(translations: { it: T; en: T; de?: Partial<T>; fr?: Partial<T> }): Record<Locale, T> {
  const resolved = new Map<string, T>();
  return new Proxy(translations, {
    get(target, property, receiver) {
      if (property === "de" || property === "fr") {
        const key = String(property);
        if (!resolved.has(key)) resolved.set(key, target[property] ? mergeCopy(target.en, target[property]!) : target.en);
        return resolved.get(key);
      }
      return Reflect.get(target, property, receiver);
    },
  }) as Record<Locale, T>;
}

/** Prefix an internal path with the locale segment (Italian is the default, unprefixed). */
export function localize(path: string, lang: Locale) {
  if (lang === defaultLocale) return path;
  if (lang === "de" && (path === "/cookie" || path === "/cookies")) return "/de/cookies";
  if (lang === "fr" && (path === "/cookie" || path === "/cookies")) return "/fr/cookies";
  if (path === "/") return `/${lang}`;
  if (path.startsWith("/#")) return `/${lang}${path.slice(1)}`;
  return `/${lang}${path}`;
}

/** Return the same page in the other locale. */
export function switchPath(pathname: string, to: Locale) {
  const bare = pathname.replace(/^\/(?:en|de|fr)(?=\/|$)/, "") || "/";
  // The cookie policy is the one page whose slug differs per language.
  if (bare === "/cookie" || bare === "/cookies") return to === "it" ? "/cookie" : `/${to}/cookies`;
  return localize(bare, to);
}

/** Cookie holding a language picked by hand with the switch; it wins over device detection. */
export const LANG_COOKIE = "ctrl-lang";

/** Device language to site language: Italian for any "it*" tag, English for every other language. */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  const preferred = header?.split(",").map((item) => item.trim().split(";")[0]?.toLowerCase()).find((item) => item && item !== "*");
  if (!preferred) return null;
  if (preferred.startsWith("de")) return "de";
  if (preferred.startsWith("fr")) return "fr";
  if (preferred.startsWith("it")) return "it";
  return "en";
}

/** Persist a manual language choice for a year (client only). */
export function rememberLocale(lang: Locale) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

export function localeFromPath(pathname: string | null): Locale {
  if (pathname && /^\/en(\/|$)/.test(pathname)) return "en";
  if (pathname && /^\/de(\/|$)/.test(pathname)) return "de";
  if (pathname && /^\/fr(\/|$)/.test(pathname)) return "fr";
  return "it";
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
      heroLine: ["Brand, siti web e software su misura.", "Per aziende in tutta Europa."],
      heroPill: "CTRL® Studio",
      heroCta: "Scopri i progetti",
      servicesIntro: "Progettiamo identità, siti e software che lavorano insieme.",
      platesAlt: "Tre livelli impilati: identità, sito e software",
      navMore: "Altro",
      navAllServices: "Tutti i servizi",
      navTalk: "Parliamone",
      marquee: "TAKE CTRL",
      servicesMore: "Scopri",
      filmKicker: "Studio film",
      filmTitle: "Presentazione di CTRL®",
      ecoKicker: "Ecosistema CTRL®",
      ecoTitle: "Soluzioni, fatte da CTRL®.",
      ecoLead: "Strumenti per gestire appuntamenti, clienti e preventivi.",
      ecoQuotes: "Preventivi che convincono.",
      ecoAgenda: "La tua agenda, finalmente semplice.",
      ecoOpen: "si apre in una nuova scheda",
      ecoSoonTitle: "Prossimamente",
      ecoSoonSub: "Nuovi strumenti CTRL® in arrivo.",
      workTitle: "Lavori che parlano da soli.",
      openProject: "Apri il progetto",
      proofStats: [
        { value: "14", label: "prenotazioni" },
        { value: "11.947 €", label: "nel primo mese online" },
        { value: "0 €", label: "spesi in advertising" },
      ],
      talkMarquee: "PARLIAMONE",
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
      description: "Michel Branche, Kallebe Gallo, Jacopo Manzalini e Katia Micello. Design, sviluppo, AI e commerciale nello studio CTRL® ad Aosta, in Valle d'Aosta.",
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
    bookings: {
      nav: "Prenota",
      metaTitle: "Prenota una call con l'agenzia web ad Aosta | CTRL®",
      metaDescription:
        "Call introduttiva gratuita, circa 20-30 minuti su Google Meet, con CTRL® ad Aosta. Scegli un orario o scrivi dal modulo contatti.",
      tag: "Prenota",
      title: "Parliamone in call.",
      lead: [
        "Una call introduttiva gratuita, circa 20-30 minuti, su Google Meet.",
        "Ci racconti il progetto e vediamo insieme come proseguire.",
      ],
      bookCta: "Scegli un orario",
      frameTitle: "Prenota una call su Google Calendar",
      open: "Apri in una nuova scheda",
      fallback: "Preferisci scrivere? Usa il modulo contatti",
      soon: "Presto disponibile",
      soonText: "La prenotazione online non è ancora attiva. Nel frattempo puoi scriverci dal modulo.",
      fromContact: "Preferisci una call? Prenota un'introduzione.",
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
      heroLine: ["Brand, websites and custom software.", "For businesses across Europe."],
      heroPill: "CTRL® Studio",
      heroCta: "See the work",
      servicesIntro: "We design identities, websites and software that work together.",
      platesAlt: "Three stacked layers: identity, website and software",
      navMore: "More",
      navAllServices: "All services",
      navTalk: "Let's talk",
      marquee: "TAKE CTRL",
      servicesMore: "Discover",
      filmKicker: "Studio film",
      filmTitle: "Introducing CTRL®",
      ecoKicker: "CTRL® ecosystem",
      ecoTitle: "Solutions, made by CTRL®.",
      ecoLead: "Tools to manage appointments, clients and quotes.",
      ecoQuotes: "Quotes that win clients.",
      ecoAgenda: "Your schedule, finally simple.",
      ecoOpen: "opens in a new tab",
      ecoSoonTitle: "Coming soon",
      ecoSoonSub: "More CTRL® tools on the way.",
      workTitle: "Work that speaks for itself.",
      openProject: "Open project",
      proofStats: [
        { value: "14", label: "bookings" },
        { value: "€11,947", label: "in the first month online" },
        { value: "€0", label: "spent on advertising" },
      ],
      talkMarquee: "LET'S TALK",
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
      description: "Michel Branche, Kallebe Gallo, Jacopo Manzalini and Katia Micello. Design, development, AI and sales at the CTRL® studio in Aosta, Valle d'Aosta.",
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
    bookings: {
      nav: "Book",
      metaTitle: "Book a call with the web agency in Aosta | CTRL®",
      metaDescription:
        "A free intro call, about 20-30 minutes on Google Meet, with CTRL® in Aosta. Pick a time, or write through the contact form.",
      tag: "Book",
      title: "Let's talk on a call.",
      lead: [
        "A free intro call, about 20-30 minutes, on Google Meet.",
        "Tell us about the project and we will see how to move forward.",
      ],
      bookCta: "Pick a time",
      frameTitle: "Book a call on Google Calendar",
      open: "Open in a new tab",
      fallback: "Prefer to write? Use the contact form",
      soon: "Available soon",
      soonText: "Online booking is not active yet. In the meantime you can write to us through the form.",
      fromContact: "Prefer a call? Book an introduction.",
    },
  },
  de: {
    nav: { work: "Projekte", team: "Team", services: "Leistungen", journal: "Journal", shop: "Shop", contact: "Kontakt" },
    cta: "Sprechen wir über Ihr Projekt",
    menu: "Menü", close: "Schließen", langLabel: "Sprache",
    cmd: { label: "Schnellmenü", placeholder: "Wohin möchten Sie?", open: "Schnellmenü öffnen", email: "E-Mail schreiben", lang: "English version", empty: "Keine Ergebnisse", home: "Startseite" },
    home: {
      kicker: ["Unabhängiges Studio", "für Creative Technology"], title: ["Von der Identität", "zum Produkt.", "Ein einziger", "Partner."],
      lead: "Webagentur in Aosta: maßgeschneiderte Websites, Hotelbuchungen, Software und Marken für Unternehmen in Italien und ganz Europa.", approach: "Unseren Ansatz entdecken",
      heroAlt: "Brutalistische Betonarchitektur mit Blick auf einen See und die Berge", heroTags: ["Ideen", "Technologie", "Erlebnisse"], place: ["Aosta", "Aostatal"],
      servicesKicker: "Was wir tun", servicesTitle: ["Mehr als eine Website.", "Ein digitaler Auftritt", "der mit Ihrer Marke wächst."],
      servicesLead: "Wir gestalten Identitäten, Websites, Web-Apps und maßgeschneiderte Software für Unternehmen in Italien und Europa.", portraitAlt: "Schwarz-Weiß-Porträt im Profil",
      workKicker: "Aktuelle Projekte", allProjects: "Alle Projekte", discover: "Projekt entdecken", whyKicker: "Warum CTRL®", whyWords: ["Strategie.", "Design.", "Technologie.", "Ergebnisse."],
      whyLead: "Ein ganzheitlicher Ansatz, der komplexe Ideen in einfache, schöne und leistungsstarke Lösungen verwandelt.",
      stats: [{ value: "6", label: ["Bereiche", "Von Websites bis Software"] }, { value: "5", label: ["Sprachen", "Im Team gesprochen"] }, { value: "100%", label: ["Individuell", "Keine Vorlagen"] }, { value: "∞", label: ["Neugier", "Auf die Zukunft"] }],
      closeTitle: "Sprechen wir.", closeKicker: ["Neue Projekte", "Neue Partnerschaften"], closeLead: "Erzählen Sie uns von Ihrer Marke, Ihrem Produkt oder Ihrer Herausforderung. Gemeinsam entwickeln wir etwas Besonderes.", closeCta: "E-Mail schreiben",
      location: "Aosta, Aostatal", proofKicker: "Fallstudie", proofTitle: "Residence Le Vele", proofText: "14 Buchungen und 11.947 € im ersten Monat online – ohne Ausgaben für Werbung.", proofCta: "Fallstudie lesen",
      heroLine: ["Marken, Websites und individuelle Software.", "Für Unternehmen in ganz Europa."], heroPill: "CTRL® Studio", heroCta: "Projekte ansehen", servicesIntro: "Wir gestalten Identitäten, Websites und Software, die zusammenarbeiten.",
      platesAlt: "Drei Ebenen: Identität, Website und Software", navMore: "Mehr", navAllServices: "Alle Leistungen", navTalk: "Sprechen wir", marquee: "TAKE CTRL", servicesMore: "Entdecken",
      filmKicker: "Studiofilm", filmTitle: "CTRL® stellt sich vor", ecoKicker: "CTRL® Ökosystem", ecoTitle: "Lösungen von CTRL®.", ecoLead: "Werkzeuge für Termine, Kunden und Angebote.", ecoQuotes: "Angebote, die überzeugen.", ecoAgenda: "Ihr Kalender – endlich einfach.", ecoOpen: "öffnet in einem neuen Tab", ecoSoonTitle: "Demnächst", ecoSoonSub: "Neue CTRL®-Werkzeuge folgen bald.",
      workTitle: "Projekte, die für sich sprechen.", openProject: "Projekt öffnen", proofStats: [{ value: "14", label: "Buchungen" }, { value: "11.947 €", label: "im ersten Monat online" }, { value: "0 €", label: "für Werbung ausgegeben" }], talkMarquee: "SPRECHEN WIR",
    },
    services: { back: "Alle Leistungen", next: "Weiter", fallback: "Leistungen", wipKicker: "In Arbeit", wipTitle: "Seite im Aufbau", wipText: "Wir ergänzen diese Seite um Beispiele, unsere Arbeitsweise und weitere Details. Erzählen Sie uns inzwischen, was Sie brauchen – wir antworten persönlich.", wipContact: "Kontaktieren Sie uns", wipOthers: "Weitere Leistungen" },
    team: { metaTitle: "Das Team der Webagentur CTRL® in Aosta | CTRL®", description: "Michel Branche, Kallebe Gallo, Jacopo Manzalini und Katia Micello. Design, Entwicklung, KI und Vertrieb im CTRL® Studio in Aosta.", tag: "Team", title: ["Menschen,", "die Ideen", "Wirklichkeit werden lassen."], lead: "Das Team von CTRL®: Design, Entwicklung, KI und Vertrieb.", scroll: "Team kennenlernen" },
    meta: { title: "Maßgeschneiderte Websites und Software | CTRL®", description: "CTRL® entwickelt individuelle Websites, Marken, E-Commerce, Web-Apps und Software für Unternehmen in Italien und Europa." },
    bookings: { nav: "Termin buchen", metaTitle: "Kennenlerngespräch mit CTRL® buchen | CTRL®", metaDescription: "Kostenloses Erstgespräch von etwa 20–30 Minuten mit CTRL® über Google Meet. Wählen Sie einen Termin oder schreiben Sie uns.", tag: "Termin buchen", title: "Lernen wir uns kennen.", lead: ["Ein kostenloses Erstgespräch von etwa 20–30 Minuten über Google Meet.", "Erzählen Sie uns von Ihrem Projekt und wir besprechen die nächsten Schritte."], bookCta: "Termin auswählen", frameTitle: "Termin über Google Calendar buchen", open: "In neuem Tab öffnen", fallback: "Lieber schreiben? Nutzen Sie unser Kontaktformular.", soon: "Demnächst verfügbar", soonText: "Die Online-Terminbuchung ist noch nicht aktiv. Schreiben Sie uns gerne über das Formular.", fromContact: "Lieber ein Gespräch? Buchen Sie ein erstes Kennenlernen." },
  },
  fr: {
    nav: { work: "Projets", team: "Équipe", services: "Services", journal: "Journal", shop: "Boutique", contact: "Contact" },
    cta: "Parlons de votre projet", menu: "Menu", close: "Fermer", langLabel: "Langue",
    cmd: { label: "Menu rapide", placeholder: "Où souhaitez-vous aller ?", open: "Ouvrir le menu rapide", email: "Écrire un e-mail", lang: "Version italienne", empty: "Aucun résultat", home: "Accueil" },
    home: {
      kicker: ["Studio indépendant", "de creative technology"], title: ["De l’identité", "au produit.", "Un seul", "partenaire."],
      lead: "Agence web à Aoste : sites sur mesure, hôtels, logiciels et identités de marque pour les entreprises en Italie et en Europe.", approach: "Découvrir notre approche",
      heroAlt: "Architecture brutaliste en béton ouverte sur un lac et les montagnes", heroTags: ["Idées", "Technologie", "Expériences"], place: ["Aoste", "Vallée d’Aoste"],
      servicesKicker: "Nos services", servicesTitle: ["Plus qu’un site web.", "Une présence numérique", "qui grandit avec votre marque."],
      servicesLead: "Nous concevons des identités, des sites web, des applications web et des logiciels sur mesure pour les entreprises en Italie et en Europe.", portraitAlt: "Portrait de profil en noir et blanc",
      workKicker: "Projets récents", allProjects: "Tous les projets", discover: "Découvrir le projet", whyKicker: "Pourquoi CTRL®", whyWords: ["Stratégie.", "Design.", "Technologie.", "Résultats."],
      whyLead: "Une approche intégrée qui transforme les idées complexes en solutions simples, élégantes et performantes.",
      stats: [{ value: "6", label: ["Domaines", "Du site au logiciel"] }, { value: "5", label: ["Langues", "Parlées par l’équipe"] }, { value: "100%", label: ["Sur mesure", "Sans modèle"] }, { value: "∞", label: ["Curiosité", "Pour l’avenir"] }],
      closeTitle: "Parlons-en.", closeKicker: ["Nouveaux projets", "Nouvelles collaborations"], closeLead: "Parlez-nous de votre marque, de votre produit ou du défi à relever. Ensemble, construisons quelque chose de remarquable.", closeCta: "Nous écrire",
      location: "Aoste, Vallée d’Aoste", proofKicker: "Étude de cas", proofTitle: "Residence Le Vele", proofText: "14 réservations et 11 947 € dès le premier mois en ligne, sans dépense publicitaire.", proofCta: "Lire l’étude de cas",
      heroLine: ["Identités, sites web et logiciels sur mesure.", "Pour les entreprises partout en Europe."], heroPill: "CTRL® Studio", heroCta: "Voir les projets", servicesIntro: "Nous concevons des identités, des sites web et des logiciels qui fonctionnent ensemble.",
      platesAlt: "Trois niveaux superposés : identité, site web et logiciel", navMore: "Plus", navAllServices: "Tous les services", navTalk: "Parlons-en", marquee: "TAKE CTRL", servicesMore: "Découvrir",
      filmKicker: "Film du studio", filmTitle: "Présentation de CTRL®", ecoKicker: "Écosystème CTRL®", ecoTitle: "Des solutions signées CTRL®.", ecoLead: "Des outils pour gérer les rendez-vous, les clients et les devis.", ecoQuotes: "Des devis qui convainquent.", ecoAgenda: "Votre agenda, enfin simple.", ecoOpen: "s’ouvre dans un nouvel onglet", ecoSoonTitle: "Prochainement", ecoSoonSub: "De nouveaux outils CTRL® arrivent bientôt.",
      workTitle: "Des projets qui parlent d’eux-mêmes.", openProject: "Ouvrir le projet", proofStats: [{ value: "14", label: "réservations" }, { value: "11 947 €", label: "au premier mois en ligne" }, { value: "0 €", label: "dépensé en publicité" }], talkMarquee: "PARLONS-EN",
    },
    services: { back: "Tous les services", next: "Suivant", fallback: "Services", wipKicker: "En cours", wipTitle: "Page en préparation", wipText: "Nous préparons cette page avec des exemples, notre méthode et les détails du service. En attendant, dites-nous ce dont vous avez besoin : nous vous répondrons personnellement.", wipContact: "Nous contacter", wipOthers: "Autres services" },
    team: { metaTitle: "L’équipe du studio web CTRL® à Aoste | CTRL®", description: "Michel Branche, Kallebe Gallo, Jacopo Manzalini et Katia Micello. Design, développement, IA et conseil au studio CTRL® à Aoste.", tag: "Équipe", title: ["Des personnes", "qui donnent vie", "aux idées."], lead: "L’équipe de CTRL® : design, développement, IA et conseil.", scroll: "Découvrir l’équipe" },
    meta: { title: "Sites web et logiciels sur mesure | CTRL®", description: "CTRL® crée des sites web, des identités de marque, des boutiques en ligne, des applications web et des logiciels sur mesure pour les entreprises en Italie et en Europe." },
    bookings: { nav: "Prendre rendez-vous", metaTitle: "Réserver un premier échange avec CTRL® | CTRL®", metaDescription: "Premier échange gratuit de 20 à 30 minutes avec CTRL® sur Google Meet. Choisissez un créneau ou écrivez-nous.", tag: "Rendez-vous", title: "Faisons connaissance.", lead: ["Un premier échange gratuit de 20 à 30 minutes sur Google Meet.", "Présentez-nous votre projet et voyons ensemble la suite."], bookCta: "Choisir un créneau", frameTitle: "Réserver un appel sur Google Calendar", open: "Ouvrir dans un nouvel onglet", fallback: "Vous préférez écrire ? Utilisez le formulaire de contact.", soon: "Bientôt disponible", soonText: "La réservation en ligne n’est pas encore active. Vous pouvez nous écrire via le formulaire.", fromContact: "Vous préférez un appel ? Réservez un premier échange." },
  },
} as const;

export type Dict = (typeof dict)[Locale];
