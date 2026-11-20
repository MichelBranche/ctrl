/**
 * Client reviews shown on the home page (section after "Cosa facciamo").
 *
 * To add or edit a review: change the entries below. `quote` is the client's
 * text exactly as sent (no quotation marks: the card adds them); `mark` must
 * be a phrase that appears word for word inside `quote`, it gets the animated
 * highlight. Pages hold 5 reviews each on desktop (entries 1-5, then 6-10),
 * 2 each on mobile. Avatars are initials, never photos.
 *
 * TESTIMONIALS_READY: set to false while texts are placeholders. When false the
 * section is rendered everywhere except the production deployment
 * (VERCEL_ENV=production), so drafts can be reviewed on previews and locally.
 */
export const TESTIMONIALS_READY = true;

type L = { it: string; en: string };
export type Testimonial = {
  name: string;
  role: L;
  stars: number;
  quote: L;
  mark: L;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Giulia Ferri",
    role: { it: "Fondatrice di uno studio di architettura", en: "Founder of an architecture studio" },
    stars: 5,
    quote: {
      it: "Il nostro vecchio sito mostrava i progetti, ma raccontava poco di come lavoriamo. Con CTRL® abbiamo ripensato insieme la struttura, la selezione delle immagini e il modo in cui presentiamo ogni intervento. Mi è piaciuto che Michel ci spiegasse perché certe scelte funzionavano, anche quando ci proponeva di tagliare qualcosa a cui eravamo affezionati. Oggi mi viene naturale mandare il link del sito prima di un incontro. Chi arriva ha già un’idea molto più chiara dello studio.",
      en: "Our old website showed our projects, but said little about how we work. With CTRL® we rethought the structure together, the choice of images and the way we present each project. I liked that Michel explained why certain choices worked, even when he suggested cutting something we were attached to. Today I naturally send the website link before a meeting. People arrive with a much clearer idea of the studio.",
    },
    mark: { it: "Chi arriva ha già un’idea molto più chiara dello studio.", en: "People arrive with a much clearer idea of the studio." },
  },
  {
    name: "Davide Moretti",
    role: { it: "Responsabile commerciale B2B", en: "B2B sales manager" },
    stars: 5,
    quote: {
      it: "Prima le richieste dei clienti arrivavano via email e le seguivamo tra fogli di calcolo e messaggi interni. Bastava che qualcuno fosse fuori ufficio per perdere il filo. CTRL® ha seguito il nostro team nel lavoro di tutti i giorni e ha costruito un flusso semplice, dalla prima richiesta al preventivo. Abbiamo provato una prima versione con casi reali e sistemato insieme i passaggi più macchinosi. Ora, quando un collega riprende una trattativa, trova subito lo storico e sa da dove continuare.",
      en: "Client requests used to arrive by email, and we tracked them across spreadsheets and internal messages. If someone was out of the office, we lost the thread. CTRL® followed our team through its everyday work and built a simple flow, from the first request to the quote. We tried a first version with real cases and smoothed out the clunkiest steps together. Now, when a colleague picks up a deal, they find the full history right away and know where to continue.",
    },
    mark: { it: "trova subito lo storico e sa da dove continuare", en: "they find the full history right away and know where to continue" },
  },
  {
    name: "Elena Riva",
    role: { it: "Fotografa", en: "Photographer" },
    stars: 5,
    quote: {
      it: "Finalmente un portfolio che sento mio. Da telefono le foto si vedono benissimo.",
      en: "Finally a portfolio that feels like mine. The photos look great on a phone.",
    },
    mark: { it: "un portfolio che sento mio", en: "a portfolio that feels like mine" },
  },
  {
    name: "Matteo Galli",
    role: { it: "Titolare di un’officina specializzata", en: "Owner of a specialist workshop" },
    stars: 5,
    quote: {
      it: "Volevo che fosse più facile capire quali interventi facciamo e come prenotarli. Ora mando la pagina giusta quando qualcuno mi scrive su WhatsApp e spesso arriva già con tutte le informazioni che mi servono.",
      en: "I wanted it to be easier to understand which jobs we do and how to book them. Now I send the right page when someone messages me on WhatsApp, and they often arrive with all the information I need.",
    },
    mark: { it: "arriva già con tutte le informazioni che mi servono", en: "arrive with all the information I need" },
  },
  {
    name: "Sara Benedetti",
    role: { it: "Fondatrice di un brand di ceramica", en: "Founder of a ceramics brand" },
    stars: 5,
    quote: {
      it: "Mi è piaciuto vedere la stessa identità funzionare sulle confezioni, sul sito e nelle foto dei prodotti. CTRL® ha trovato un modo per far riconoscere il mio lavoro anche nei dettagli più piccoli, come il cartoncino che metto in ogni ordine.",
      en: "I loved seeing the same identity work on the packaging, on the website and in the product photos. CTRL® found a way to make my work recognisable even in the smallest details, like the card I put in every order.",
    },
    mark: { it: "anche nei dettagli più piccoli", en: "even in the smallest details" },
  },
  {
    name: "Luca Romano",
    role: { it: "Responsabile di un centro sportivo", en: "Manager of a sports centre" },
    stars: 5,
    quote: {
      it: "La cosa che apprezzo di più è poter aggiornare gli orari da solo. Quando cambiamo il calendario dei corsi, lo pubblico in pochi minuti e posso mandare subito il link agli iscritti.",
      en: "What I appreciate most is being able to update the timetable myself. When we change the class schedule, I publish it in a few minutes and can send the link to members straight away.",
    },
    mark: { it: "lo pubblico in pochi minuti", en: "I publish it in a few minutes" },
  },
  {
    name: "Valentina Costa",
    role: { it: "Consulente HR indipendente", en: "Independent HR consultant" },
    stars: 5,
    quote: {
      it: "Avevo difficoltà a spiegare in poche righe la differenza tra i miei servizi. Con CTRL® abbiamo chiarito a chi si rivolge ciascun percorso e cosa aspettarsi dal primo incontro. Finalmente riesco a usare il sito anche come strumento di lavoro.",
      en: "I struggled to explain the difference between my services in a few lines. With CTRL® we clarified who each programme is for and what to expect from the first meeting. At last I can use the website as a working tool too.",
    },
    mark: { it: "usare il sito anche come strumento di lavoro", en: "use the website as a working tool too" },
  },
  {
    name: "Andrea Bellini",
    role: { it: "Titolare di un e-commerce di arredamento", en: "Owner of a furniture e-commerce" },
    stars: 5,
    quote: {
      it: "Su mobile era faticoso orientarsi tra misure, finiture e disponibilità. Il team ha rimesso ordine nelle schede e ci ha lasciato una struttura che riusciamo a seguire anche quando aggiungiamo una nuova collezione.",
      en: "On mobile it was hard to find your way through sizes, finishes and availability. The team put the product pages back in order and left us a structure we can follow even when we add a new collection.",
    },
    mark: { it: "una struttura che riusciamo a seguire", en: "a structure we can follow" },
  },
  {
    name: "Francesca Milani",
    role: { it: "Direttrice di una scuola di musica", en: "Director of a music school" },
    stars: 5,
    quote: {
      it: "A settembre riceviamo sempre le stesse domande su corsi, età e lezioni di prova. Adesso le famiglie trovano le risposte sul sito e possono mandarci una richiesta già completa. In segreteria si sente la differenza.",
      en: "Every September we get the same questions about courses, ages and trial lessons. Now families find the answers on the website and can send us a complete request. The front office really feels the difference.",
    },
    mark: { it: "In segreteria si sente la differenza.", en: "The front office really feels the difference." },
  },
  {
    name: "Roberto De Santis",
    role: { it: "Fondatore di una società di consulenza IT", en: "Founder of an IT consulting firm" },
    stars: 5,
    quote: {
      it: "Avevamo bisogno di un partner che sapesse discutere di design con noi e parlare di integrazioni con il nostro team tecnico. Con CTRL® il confronto è stato concreto in entrambe le fasi. Alla consegna sapevamo già come gestire il sito in autonomia.",
      en: "We needed a partner who could discuss design with us and talk integrations with our technical team. With CTRL® the conversation was concrete in both phases. At handover we already knew how to run the website on our own.",
    },
    mark: { it: "sapevamo già come gestire il sito in autonomia", en: "we already knew how to run the website on our own" },
  },
];

/** Whether the section may render in this deployment. */
export function showTestimonials() {
  return TESTIMONIALS_READY || process.env.VERCEL_ENV !== "production";
}
