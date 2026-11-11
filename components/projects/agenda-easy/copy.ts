import type { Locale } from "@/lib/i18n";

export const AGENDA_EASY_LIVE = "https://agendaeasy.it";
export const AGENDA_EASY_VIDEO = "0ZbTfrsfgcM";

type Icon = "calendar" | "user" | "layers" | "chart";

export const agendaCopy: Record<Locale, {
  metaTitle: string; metaDescription: string; crumbs: [string, string]; back: string;
  tag: string; status: string; lead: string; visit: string; watch: string; newTab: string;
  heroAlt: string;
  overviewKicker: string; overviewTitle: [string, string]; overviewText: string;
  features: { icon: Icon; title: string; text: string }[];
  screensAlt: [string, string];
  videoKicker: string; videoTitle: string; videoLabel: string; play: string;
  factsKicker: string; factsTitle: [string, string];
  facts: { value: string; label: string }[];
  ctaKicker: string; ctaTitle: string; ctaText: string; ctaButton: string;
}> = {
  it: {
    metaTitle: "Agenda Easy, webapp per appuntamenti ad Aosta | CTRL®",
    metaDescription: "Agenda Easy è la webapp di CTRL® per appuntamenti, clienti e servizi. Per studi e attività, da 9,90 € al mese, sviluppata ad Aosta. Attivala ora.",
    crumbs: ["Progetti", "Agenda Easy"],
    back: "Tutti i progetti",
    tag: "Webapp",
    status: "Disponibile ora · Prodotto CTRL®",
    lead: "La webapp per la gestione di appuntamenti, clienti e servizi, pensata per studi e attività professionali.",
    visit: "Visita la webapp",
    watch: "Guarda il video",
    newTab: "(si apre in una nuova scheda)",
    heroAlt: "Agenda Easy aperta su un portatile: elenco degli appuntamenti del giorno",
    overviewKicker: "Overview",
    overviewTitle: ["Un gestionale semplice,", "flessibile e completo."],
    overviewText: "Agenda Easy nasce per semplificare il lavoro quotidiano di professionisti e attività locali, centralizzando appuntamenti, clienti, servizi e statistiche in un'unica piattaforma intuitiva, accessibile ovunque. Senza app da scaricare.",
    features: [
      { icon: "calendar", title: "Gestione appuntamenti", text: "Organizza, modifica e conferma gli appuntamenti in tempo reale." },
      { icon: "user", title: "Anagrafica clienti", text: "Tieni traccia di clienti, storico e preferenze." },
      { icon: "layers", title: "Servizi personalizzati", text: "Configura servizi, durate e prezzi in base alla tua attività." },
      { icon: "chart", title: "Statistiche", text: "Monitora incassi, presenze e andamento nel tempo." },
    ],
    screensAlt: ["Pannello di Agenda Easy su desktop: calendario del mese e appuntamenti del giorno", "Agenda Easy su smartphone"],
    videoKicker: "Il video",
    videoTitle: "Agenda Easy in 48 secondi.",
    videoLabel: "Video di presentazione di Agenda Easy",
    play: "Guarda il video",
    factsKicker: "In breve",
    factsTitle: ["Un prodotto reale,", "pronto da attivare."],
    facts: [
      { value: "9,90 €", label: "al mese, disdici quando vuoi" },
      { value: "7 giorni", label: "di prova gratuita, senza carta" },
      { value: "Link", label: "pubblico di prenotazione, da condividere ovunque" },
      { value: "Promemoria", label: "automatici via e-mail, con pulsante WhatsApp" },
      { value: "Colore", label: "accent personalizzabile sul tuo brand" },
    ],
    ctaKicker: "Hai un progetto simile?",
    ctaTitle: "Parliamone.",
    ctaText: "Raccontaci la tua idea, siamo qui per trasformarla in realtà.",
    ctaButton: "Contattaci",
  },
  en: {
    metaTitle: "Agenda Easy, appointment web app from Aosta | CTRL®",
    metaDescription: "Agenda Easy is the CTRL® web app for appointments, clients and services. For studios and practices, from €9.90 a month, built in Aosta. Switch it on.",
    crumbs: ["Projects", "Agenda Easy"],
    back: "All projects",
    tag: "Web app",
    status: "Available now · A CTRL® product",
    lead: "The web app to manage appointments, clients and services, built for studios and professional practices.",
    visit: "Visit the web app",
    watch: "Watch the video",
    newTab: "(opens in a new tab)",
    heroAlt: "Agenda Easy open on a laptop: list of today's appointments",
    overviewKicker: "Overview",
    overviewTitle: ["A simple, flexible,", "complete back office."],
    overviewText: "Agenda Easy was built to simplify the daily work of professionals and local businesses, bringing appointments, clients, services and statistics together in one intuitive platform, available anywhere. No app to download.",
    features: [
      { icon: "calendar", title: "Appointment management", text: "Organise, edit and confirm appointments in real time." },
      { icon: "user", title: "Client records", text: "Keep track of clients, history and preferences." },
      { icon: "layers", title: "Custom services", text: "Set up services, durations and prices to fit your business." },
      { icon: "chart", title: "Statistics", text: "Track revenue, attendance and trends over time." },
    ],
    screensAlt: ["Agenda Easy dashboard on desktop: monthly calendar and today's appointments", "Agenda Easy on a smartphone"],
    videoKicker: "The video",
    videoTitle: "Agenda Easy in 48 seconds.",
    videoLabel: "Agenda Easy promo video",
    play: "Watch the video",
    factsKicker: "At a glance",
    factsTitle: ["A real product,", "ready to switch on."],
    facts: [
      { value: "€9.90", label: "per month, cancel anytime" },
      { value: "7 days", label: "free trial, no card needed" },
      { value: "Link", label: "public booking page to share anywhere" },
      { value: "Reminders", label: "automatic by e-mail, with a WhatsApp button" },
      { value: "Colour", label: "customisable accent to match your brand" },
    ],
    ctaKicker: "Got a similar project?",
    ctaTitle: "Let's talk.",
    ctaText: "Tell us your idea, we are here to make it real.",
    ctaButton: "Contact us",
  },
};
