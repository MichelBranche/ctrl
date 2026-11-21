import type { Locale } from "@/lib/i18n";

/** Official CTRL® Quotes site (live app, landing, trial and pricing). */
export const QUOTES_URL = "https://quotes.ctrlagency.dev";
/** Launch video on the CTRL® Agency channel. */
export const QUOTES_VIDEO = { id: "aktDErSD_LI", title: "CTRL® Quotes | Preventivi che convincono.", thumb: "/images/quotes/video.webp" };

/** The five templates, as named on the official site. Covers are the real template first pages. */
export const QUOTES_TEMPLATES = [
  { id: "minimal", name: "Swiss Minimal" },
  { id: "studio", name: "Studio Editorial" },
  { id: "editorial", name: "Editorial Atelier" },
  { id: "corporate", name: "Corporate Executive" },
  { id: "bold", name: "Bold Impact" },
] as const;

/**
 * Page copy. Only features the product really has (see quotes.ctrlagency.dev).
 * Acceptance is a consent + "Conferma accettazione" click: never call it a signature.
 */
export const QUOTES_COPY = {
  it: {
    metaTitle: "CTRL® Quotes: preventivi che convincono | CTRL®",
    metaDesc:
      "CTRL® Quotes è il software di CTRL® per i preventivi: template col tuo brand, IVA e forfettario già calcolati, accettazione online senza account e acconto con IBAN, PayPal o Stripe.",
    status: "In arrivo",
    title: ["Preventivi", "che convincono."],
    lead: "Crea preventivi con il tuo brand, mandali con un link e lascia che il cliente li legga, li accetti e paghi l'acconto online.",
    cta: "Vai al sito di CTRL® Quotes",
    watch: "Guarda il video",
    coversAlt: "Le copertine dei cinque template di CTRL® Quotes",
    videoKicker: "Il video di lancio",
    play: "Riproduci il video",
    onYoutube: "Guarda su YouTube",
    slogan: ["Il tuo lavoro vale.", "Mostralo."],
    stepsKicker: "Come funziona",
    stepsTitle: "Tre passi.",
    steps: [
      { n: "01", title: "Crea", text: "Componi il preventivo a blocchi o nell'editor visuale. Prezzi e imposte si calcolano da soli." },
      { n: "02", title: "Invia", text: "Mandi il link per email o lo copi dove vuoi. Il PDF è incluso, con lo stesso layout." },
      { n: "03", title: "Incassa", text: "Il cliente accetta online e paga l'acconto con IBAN, PayPal o Stripe." },
    ],
    stepUi: { blocks: ["Copertina", "Servizi e prezzi", "Condizioni"], link: "quotes.ctrlagency.dev/q/…", sent: "Link inviato", accepted: "Accettato", deposit: "Acconto ricevuto" },
    featKicker: "Funzionalità",
    featTitle: "Tutto quello che serve. Niente di più.",
    feats: {
      templates: { title: "5 template, il tuo brand", text: "Scegli lo stile, il contenuto si adatta. Logo e colori arrivano dal tuo Brand Kit." },
      tax: { title: "Fisco italiano, già fatto", text: "Totali calcolati al centesimo dal profilo fiscale del workspace.", chips: ["IVA ordinaria", "Regime forfettario", "Ritenuta d'acconto", "Imposta di bollo"] },
      accept: { title: "Il cliente non si registra", text: "Apre il link privato, legge, scarica il PDF e conferma. Niente account.", button: "Conferma accettazione" },
      pay: { title: "Acconto subito", text: "Scegli i metodi quando invii il preventivo.", methods: ["IBAN", "PayPal", "Stripe"] },
      notify: { title: "Sai quando lo apre", items: ["Preventivo aperto", "Preventivo accettato", "Pagamento ricevuto"] },
      analytics: { title: "Analytics", text: "Preventivi inviati, accettati e importi nella panoramica, con grafici che si aggiornano da soli." },
    },
    closeTitle: ["Il prossimo preventivo,", "fallo con Quotes."],
    closeLead: "Template, funzioni e piani sono tutti sul sito ufficiale.",
    by: "by CTRL® Agency",
  },
  en: {
    metaTitle: "CTRL® Quotes: quotes that win clients | CTRL®",
    metaDesc:
      "CTRL® Quotes is the CTRL® software for quotes: branded templates, Italian VAT and flat-rate tax already calculated, online acceptance with no account, and deposits via IBAN, PayPal or Stripe.",
    status: "Coming soon",
    title: ["Quotes", "that win clients."],
    lead: "Create quotes with your brand, send them as a link and let the client read them, accept them and pay the deposit online.",
    cta: "Visit the CTRL® Quotes site",
    watch: "Watch the video",
    coversAlt: "Covers of the five CTRL® Quotes templates",
    videoKicker: "Launch video",
    play: "Play the video",
    onYoutube: "Watch on YouTube",
    slogan: ["Your work is worth it.", "Show it."],
    stepsKicker: "How it works",
    stepsTitle: "Three steps.",
    steps: [
      { n: "01", title: "Create", text: "Build the quote from blocks or in the visual editor. Prices and taxes add up on their own." },
      { n: "02", title: "Send", text: "Email the link or paste it anywhere. The PDF is included, with the same layout." },
      { n: "03", title: "Get paid", text: "The client accepts online and pays the deposit via IBAN, PayPal or Stripe." },
    ],
    stepUi: { blocks: ["Cover", "Services and prices", "Terms"], link: "quotes.ctrlagency.dev/q/…", sent: "Link sent", accepted: "Accepted", deposit: "Deposit received" },
    featKicker: "Features",
    featTitle: "Everything you need. Nothing more.",
    feats: {
      templates: { title: "5 templates, your brand", text: "Pick a style and the content adapts. Logo and colours come from your Brand Kit." },
      tax: { title: "Italian tax, handled", text: "Totals calculated to the cent from the workspace tax profile.", chips: ["Standard VAT", "Flat-rate regime", "Withholding tax", "Stamp duty"] },
      accept: { title: "No sign-up for the client", text: "They open the private link, read, download the PDF and confirm. No account.", button: "Confirm acceptance" },
      pay: { title: "Deposit, right away", text: "Choose the methods when you send the quote.", methods: ["IBAN", "PayPal", "Stripe"] },
      notify: { title: "Know when they open it", items: ["Quote opened", "Quote accepted", "Payment received"] },
      analytics: { title: "Analytics", text: "Quotes sent, accepted and amounts in the overview, with charts that update on their own." },
    },
    closeTitle: ["Your next quote,", "make it with Quotes."],
    closeLead: "Templates, features and plans are all on the official site.",
    by: "by CTRL® Agency",
  },
} satisfies Record<Locale, unknown>;
