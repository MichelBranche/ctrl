import type { L, Locale } from "@/lib/i18n";

/** Single source of truth for the studio contact address. */
export const CONTACT_EMAIL = "ctrlragency@gmail.com";

export const studio = {
  email: CONTACT_EMAIL,
};

export type Project = {
  slug: string;
  name: string;
  meta: L;
  image: string | null;
  /** Live demo URL. */
  url: string;
  /** Short place / sector line shown on typographic tiles. */
  place: L;
  summary: L;
};

export const projects: Project[] = [
  {
    slug: "altura",
    name: "Maison Altura",
    meta: { it: "Concept | Identità e sito per cantina", en: "Concept | Winery identity and website" },
    image: "/images/altura.jpg",
    url: "https://demo-vini.vercel.app",
    place: { it: "Cantina", en: "Winery" },
    summary: {
      it: "Identità visiva e sito per una cantina. Una presenza calma, costruita su paesaggio, luce e una tipografia silenziosa.",
      en: "Visual identity and website for a winery. A calm presence built on landscape, light and quiet typography.",
    },
  },
  {
    slug: "villa-matilde",
    name: "Villa Matilde",
    meta: { it: "Concept | Sito per hotel in villa storica", en: "Concept | Historic villa hotel website" },
    image: null,
    url: "https://demo-sina-villa-matilde.vercel.app",
    place: { it: "Hospitality", en: "Hospitality" },
    summary: {
      it: "Concept di sito per un hotel in villa storica. Ritmo lento, immagini ampie e un percorso di prenotazione chiaro.",
      en: "Website concept for a historic villa hotel. A slow rhythm, generous imagery and a clear booking path.",
    },
  },
  {
    slug: "omama",
    name: "OMAMA",
    meta: { it: "Concept | Sito per social hotel, Aosta", en: "Concept | Social hotel website, Aosta" },
    image: null,
    url: "https://demo-omama.vercel.app",
    place: { it: "Aosta", en: "Aosta" },
    summary: {
      it: "Concept di sito per un social hotel nel centro di Aosta. Camere, spazi condivisi e montagna raccontati con un tono diretto e contemporaneo.",
      en: "Website concept for a social hotel in the centre of Aosta. Rooms, shared spaces and the mountains told with a direct, contemporary tone.",
    },
  },
  {
    slug: "hotel-bijou",
    name: "Hotel Bijou",
    meta: { it: "Concept | Sito per boutique hotel, Saint-Vincent", en: "Concept | Boutique hotel website, Saint-Vincent" },
    image: null,
    url: "https://demo-hotelbijou.vercel.app",
    place: { it: "Saint-Vincent", en: "Saint-Vincent" },
    summary: {
      it: "Concept di sito per un boutique hotel in piazza a Saint-Vincent. Un'esperienza raccolta ed elegante, dalla prima schermata alla richiesta di soggiorno.",
      en: "Website concept for a boutique hotel on the square in Saint-Vincent. An intimate, elegant experience from the first screen to the booking request.",
    },
  },
];

export type Service = {
  slug: string;
  index: string;
  title: L;
  text: L;
  summary: L;
  points: L<string[]>;
  icon: "document" | "code" | "monitor" | "arrow";
};

export const services: Service[] = [
  {
    slug: "brand-identity",
    index: "01",
    title: { it: "Brand e identità", en: "Brand & Identity" },
    text: {
      it: "Strategia, design e linguaggio visivo per dare forma alla tua identità.",
      en: "Strategy, design and visual language to shape your identity.",
    },
    summary: {
      it: "Un sistema visivo che tiene insieme nome, segno, colore e tono. Lo costruiamo per durare oltre il sito: linee guida chiare, applicabili su prodotto, contenuti e comunicazione.",
      en: "A visual system that holds name, mark, colour and tone together. Built to last beyond the website: clear guidelines that work across product, content and communication.",
    },
    points: {
      it: ["Strategia di marca", "Identità visiva", "Linguaggio e tono", "Linee guida"],
      en: ["Brand strategy", "Visual identity", "Language and tone", "Guidelines"],
    },
    icon: "document",
  },
  {
    slug: "product-development",
    index: "02",
    title: { it: "Sviluppo prodotto", en: "Product Development" },
    text: {
      it: "Web e mobile app, performance, scalabilità e soluzioni su misura.",
      en: "Web and mobile apps, performance, scalability and custom solutions.",
    },
    summary: {
      it: "Progettiamo e costruiamo prodotti digitali su misura. Interfaccia, codice e performance restano nello stesso percorso, dal primo schermo al rilascio.",
      en: "We design and build custom digital products. Interface, code and performance stay on the same path, from the first screen to release.",
    },
    points: {
      it: ["Web e mobile app", "Architettura", "Design di prodotto", "Performance"],
      en: ["Web and mobile apps", "Architecture", "Product design", "Performance"],
    },
    icon: "code",
  },
  {
    slug: "visual-communication",
    index: "03",
    title: { it: "Comunicazione visiva", en: "Visual Communication" },
    text: {
      it: "Siti, contenuti, motion e direzione creativa per raccontare il tuo brand.",
      en: "Websites, content, motion and creative direction to tell your brand's story.",
    },
    summary: {
      it: "Direzione visiva per raccontare il brand fuori e dentro il prodotto. Siti, motion e contenuti con la stessa gerarchia e lo stesso carattere.",
      en: "Visual direction to tell the brand's story inside and outside the product. Websites, motion and content with the same hierarchy and character.",
    },
    points: {
      it: ["Siti", "Motion", "Direzione creativa", "Contenuti"],
      en: ["Websites", "Motion", "Creative direction", "Content"],
    },
    icon: "monitor",
  },
  {
    slug: "growth-support",
    index: "04",
    title: { it: "Crescita e supporto", en: "Growth & Support" },
    text: {
      it: "Ottimizzazione, manutenzione e affiancamento continuo.",
      en: "Optimisation, maintenance and ongoing support.",
    },
    summary: {
      it: "Dopo il lancio restiamo vicini. Misuriamo, sistemiamo e facciamo evolvere quello che abbiamo costruito, senza perdere la qualità del primo rilascio.",
      en: "After launch we stay close. We measure, refine and evolve what we built, without losing the quality of the first release.",
    },
    points: {
      it: ["Ottimizzazione", "Manutenzione", "Affiancamento", "Evoluzione"],
      en: ["Optimisation", "Maintenance", "Ongoing support", "Evolution"],
    },
    icon: "arrow",
  },
];

export type TeamLink = { label: string; href: string };

export type TeamMember = {
  slug: string;
  name: string;
  role: L;
  bio: L;
  skills: string[];
  /**
   * Optional portrait. Put the file at /public/images/team/<slug>.jpg and set
   * photo: "/images/team/<slug>.jpg". When null, an initials block is shown.
   */
  photo?: string | null;
  links: TeamLink[];
};

/** Studio team. Add new members here; the Team page renders them in order. */
export const team: TeamMember[] = [
  {
    slug: "michel-branche",
    name: "Michel Branche",
    role: { it: "Design e sviluppo frontend", en: "Design & frontend development" },
    bio: {
      it: "Frontend developer dalla Valle d'Aosta. Progetta e sviluppa siti e interfacce su misura con React, Next.js e TypeScript, curando il movimento con GSAP. Un percorso nell'ospitalità e nel lavoro creativo, da ex tatuatore, gli ha lasciato un occhio attento al dettaglio.",
      en: "Frontend developer from Valle d'Aosta. He designs and builds custom websites and interfaces with React, Next.js and TypeScript, crafting motion with GSAP. A background in hospitality and creative work, as a former tattoo artist, gave him a sharp eye for detail.",
    },
    skills: ["React", "Next.js", "TypeScript", "Tailwind", "GSAP", "UI/UX"],
    photo: null,
    links: [
      { label: "GitHub", href: "https://github.com/MichelBranche" },
      // TODO: add LinkedIn profile URL.
    ],
  },
  {
    slug: "kallebe-gallo",
    name: "Kallebe Gallo",
    role: { it: "AI e sviluppo full stack", en: "AI & full-stack development" },
    bio: {
      it: "AI Full Stack Developer: unisce sviluppo web full stack e intelligenza artificiale per costruire prodotti digitali stabili e scalabili. Integra modelli LLM, pipeline RAG e automazioni, lavorando con Node.js, PostgreSQL, MongoDB e Docker. Parla italiano, inglese, francese, tedesco e portoghese.",
      en: "AI Full Stack Developer who combines full-stack web development and artificial intelligence to build stable, scalable digital products. He integrates LLMs, RAG pipelines and automations, working with Node.js, PostgreSQL, MongoDB and Docker. He speaks Italian, English, French, German and Portuguese.",
    },
    skills: ["LLM", "RAG", "Node.js", "PostgreSQL", "MongoDB", "Docker"],
    photo: null,
    links: [
      { label: "Portfolio", href: "https://portafoglio-alpha.vercel.app/" },
      { label: "GitHub", href: "https://github.com/kallebesiqueira-dev" },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/kallebe-gallo-a55b01211" },
    ],
  },
];

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}

export type { Locale };
