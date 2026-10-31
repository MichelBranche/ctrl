import type { L, Locale } from "@/lib/i18n";

/** Single source of truth for the studio contact address. */
export const CONTACT_EMAIL = "ctrlragency@gmail.com";

export const studio = {
  email: CONTACT_EMAIL,
};

/* ------------------------------------------------------------------ */
/* Projects: categories (the /projects index) and the works inside them. */
/* ------------------------------------------------------------------ */

export type ProjectCategory = {
  /** URL segment: /projects/[slug] (same in IT and EN). */
  slug: string;
  /** Short label for tags and filters. */
  label: L;
  /** Card title, one entry per line. */
  title: L<string[]>;
  /** Card line under the title. */
  text: L;
  /** Longer intro shown on the category page. */
  intro: L;
  image: string;
};

export const projectCategories: ProjectCategory[] = [
  {
    slug: "websites",
    label: { it: "Siti web", en: "Websites" },
    title: { it: ["Siti web", "per aziende"], en: ["Websites", "for businesses"] },
    text: { it: "Esperienze digitali su misura per il tuo business.", en: "Custom digital experiences for your business." },
    intro: {
      it: "Siti istituzionali, vetrine e piattaforme editoriali progettati e sviluppati su misura, veloci e facili da gestire.",
      en: "Corporate sites, showcases and editorial platforms, designed and built to measure, fast and easy to manage.",
    },
    image: "/images/projects/websites.webp",
  },
  {
    slug: "webapps",
    label: { it: "Webapp", en: "Web apps" },
    title: { it: ["Webapp", "scalabili"], en: ["Scalable", "web apps"] },
    text: { it: "Prodotti digitali performanti, pronti a crescere.", en: "High-performing digital products, ready to grow." },
    intro: {
      it: "Applicazioni web con aree riservate, dashboard e flussi complessi, costruite per crescere insieme al prodotto.",
      en: "Web applications with private areas, dashboards and complex flows, built to grow with the product.",
    },
    image: "/images/projects/webapps.webp",
  },
  {
    slug: "software",
    label: { it: "Software", en: "Software" },
    title: { it: ["Software", "su misura"], en: ["Custom", "software"] },
    text: { it: "Soluzioni software pensate per i tuoi processi.", en: "Software solutions designed around your processes." },
    intro: {
      it: "Strumenti interni, automazioni e integrazioni pensati attorno al modo in cui lavora il tuo team.",
      en: "Internal tools, automations and integrations designed around the way your team works.",
    },
    image: "/images/projects/software.webp",
  },
  {
    slug: "brand-identity",
    label: { it: "Brand & identità", en: "Brand & identity" },
    title: { it: ["Brand", "che durano"], en: ["Brands", "that last"] },
    text: { it: "Identità visiva e strategia per distinguerti.", en: "Visual identity and strategy to stand out." },
    intro: {
      it: "Logo, sistema visivo e linee guida per un'identità coerente su ogni punto di contatto.",
      en: "Logo, visual system and guidelines for an identity that holds together at every touchpoint.",
    },
    image: "/images/projects/brand-identity.webp",
  },
  {
    slug: "commercial-mockups",
    label: { it: "Mockup commerciali", en: "Commercial mockups" },
    title: { it: ["Mockup", "realistici"], en: ["Realistic", "mockups"] },
    text: { it: "Presenta i tuoi prodotti con stile e impatto.", en: "Present your products with style and impact." },
    intro: {
      it: "Visualizzazioni di packaging e prodotto per presentazioni, e-commerce e campagne, prima ancora della produzione.",
      en: "Packaging and product visuals for pitches, e-commerce and campaigns, even before production.",
    },
    image: "/images/projects/commercial-mockups.webp",
  },
  {
    slug: "promo-videos",
    label: { it: "Video promozionali", en: "Promo videos" },
    title: { it: ["Video", "che coinvolgono"], en: ["Videos", "that engage"] },
    text: { it: "Motion design e video per raccontare il tuo brand.", en: "Motion design and video to tell your brand's story." },
    intro: {
      it: "Motion design, spot e contenuti brevi per social e lanci, pensati per raccontare il brand in pochi secondi.",
      en: "Motion design, spots and short-form content for social and launches, made to tell the brand in seconds.",
    },
    image: "/images/projects/promo-videos.webp",
  },
];

export type Project = {
  slug: string;
  /** ProjectCategory.slug this work belongs to. */
  category: string;
  title: L;
  client: string;
  /** Image path in /public (e.g. /images/projects/works/name.webp), or null for a typographic tile. */
  image: string | null;
  /** Live site or case URL, opened in a new tab. Optional. */
  url?: string;
  year?: string;
};

// TODO(Michel): add real works here; they appear on /projects/[category]
// automatically. Example:
// { slug: "acme", category: "websites", title: { it: "Sito istituzionale", en: "Corporate website" },
//   client: "Acme Srl", image: "/images/projects/works/acme.webp", url: "https://acme.it", year: "2026" },
export const projects: Project[] = [];

export function getProjectCategory(slug: string) {
  return projectCategories.find((category) => category.slug === slug);
}

export function projectsIn(category: string) {
  return projects.filter((project) => project.category === category);
}

export type HomeFeatured = {
  index: string;
  title: L;
  category: L;
  description: L;
  /** Image path, or null for the dark gradient placeholder. */
  image: string | null;
  href: string;
};

// TODO(Michel): placeholder data. Replace with the real projects for the home
// "Progetti recenti" block (first item is the featured one).
export const homeFeatured: HomeFeatured[] = [1, 2, 3, 4].map((n) => ({
  index: String(n).padStart(2, "0"),
  title: { it: "Progetto in arrivo", en: "Project coming soon" },
  category: { it: "Categoria", en: "Category" },
  description: { it: "Descrizione del progetto in arrivo.", en: "Project description coming soon." },
  image: null,
  href: "/projects",
}));

export type Service = {
  slug: string;
  index: string;
  title: L;
  text: L;
  summary: L;
  points: L<string[]>;
  icon: "document" | "code" | "monitor" | "arrow" | "spark";
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
  {
    slug: "software-ai",
    index: "05",
    title: { it: "Software e AI", en: "Software & AI" },
    text: {
      it: "Software su misura o in abbonamento, con intelligenza artificiale integrata.",
      en: "Custom or subscription software, with AI built in.",
    },
    summary: {
      it: "Costruiamo software su richiesta per i processi della tua attività, oppure te lo diamo pronto in abbonamento, già ospitato e aggiornato. Dentro ci mettiamo l'AI dove serve davvero: assistenti, automazioni e ricerca nei tuoi dati.",
      en: "We build custom software for your business processes, or deliver it ready-made on subscription, hosted and kept up to date. We add AI where it truly helps: assistants, automations and search across your data.",
    },
    points: {
      it: ["Software su richiesta", "Software in abbonamento (SaaS)", "Integrazioni AI e automazioni", "Hosting e aggiornamenti inclusi"],
      en: ["Custom software", "Subscription software (SaaS)", "AI integrations and automations", "Hosting and updates included"],
    },
    icon: "spark",
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

/**
 * Person -> portrait mapping (confirmed by Michel).
 * photo-a: Kallebe, suit and tie. photo-b: Michel, black t-shirt.
 */
export const TEAM_PHOTOS: Record<string, string> = {
  "michel-branche": "/team/photo-b.webp",
  "kallebe-gallo": "/team/photo-a.webp",
};

/** Studio team. Add new members here; the Team page renders them in order. */
export const team: TeamMember[] = [
  {
    slug: "michel-branche",
    name: "Michel Branche",
    role: { it: "Founder & Design Engineer", en: "Founder & Design Engineer" },
    bio: {
      it: "Frontend developer dalla Valle d'Aosta. Progetta e sviluppa siti e interfacce su misura con React, Next.js e TypeScript, curando il movimento con GSAP. Un percorso nell'ospitalità e nel lavoro creativo, da ex tatuatore, gli ha lasciato un occhio attento al dettaglio.",
      en: "Frontend developer from Valle d'Aosta. He designs and builds custom websites and interfaces with React, Next.js and TypeScript, crafting motion with GSAP. A background in hospitality and creative work, as a former tattoo artist, gave him a sharp eye for detail.",
    },
    skills: ["React", "Next.js", "TypeScript", "Tailwind", "GSAP", "UI/UX"],
    photo: TEAM_PHOTOS["michel-branche"],
    links: [
      { label: "Portfolio", href: "https://www.michelbranche.it" },
      { label: "GitHub", href: "https://github.com/MichelBranche" },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/michelbranche" },
    ],
  },
  {
    slug: "kallebe-gallo",
    name: "Kallebe Gallo",
    role: { it: "Co-founder & AI Engineer", en: "Co-founder & AI Engineer" },
    bio: {
      it: "AI Full Stack Developer: unisce sviluppo web full stack e intelligenza artificiale per costruire prodotti digitali stabili e scalabili. Integra modelli LLM, pipeline RAG e automazioni, lavorando con Node.js, PostgreSQL, MongoDB e Docker. Parla italiano, inglese, francese, tedesco e portoghese.",
      en: "AI Full Stack Developer who combines full-stack web development and artificial intelligence to build stable, scalable digital products. He integrates LLMs, RAG pipelines and automations, working with Node.js, PostgreSQL, MongoDB and Docker. He speaks Italian, English, French, German and Portuguese.",
    },
    skills: ["LLM", "RAG", "Node.js", "PostgreSQL", "MongoDB", "Docker"],
    photo: TEAM_PHOTOS["kallebe-gallo"],
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

export type { Locale };
