export type Project = {
  slug: string;
  name: string;
  meta: string;
  image: string | null;
  kind: "phone" | "photo";
  summary: string;
};

export const projects: Project[] = [
  {
    slug: "nexora",
    name: "Nexora",
    meta: "Brand Identity / Web Platform",
    image: null,
    kind: "phone",
    summary:
      "Identità visiva e piattaforma web. Un sistema scuro e tipografico, pensato per presentare il prodotto con la stessa precisione del brand.",
  },
  {
    slug: "novara",
    name: "Novara",
    meta: "Digital Product / Visual Design",
    image: "/images/novara.jpg",
    kind: "photo",
    summary:
      "Prodotto digitale e direzione visiva. Geometrie, contrasto e una gerarchia che tiene insieme interfaccia e immagine.",
  },
  {
    slug: "altura",
    name: "Altura",
    meta: "Web Platform / Visual Identity",
    image: "/images/altura.jpg",
    kind: "photo",
    summary:
      "Piattaforma web e identità visiva. Una presenza calma, costruita su paesaggio, luce e una tipografia silenziosa.",
  },
  {
    slug: "orbital",
    name: "Orbital",
    meta: "Brand Strategy / Web Platform",
    image: "/images/orbital.jpg",
    kind: "photo",
    summary:
      "Strategia di brand e piattaforma. Un linguaggio visivo ridotto all’essenziale, dal segno al sito.",
  },
];

export const studio = {
  email: "hello@ctrl.studio",
};

export type Service = {
  slug: string;
  index: string;
  title: string;
  text: string;
  summary: string;
  points: string[];
  icon: "document" | "code" | "monitor" | "arrow";
};

export const services: Service[] = [
  {
    slug: "brand-identity",
    index: "01",
    title: "Brand & Identity",
    text: "Strategia, design e linguaggio visivo per dare forma alla tua identità.",
    summary:
      "Un sistema visivo che tiene insieme nome, segno, colore e tono. Lo costruiamo per durare oltre il sito: linee guida chiare, applicabili su prodotto, contenuti e comunicazione.",
    points: ["Strategia di marca", "Identità visiva", "Linguaggio e tono", "Linee guida"],
    icon: "document",
  },
  {
    slug: "product-development",
    index: "02",
    title: "Product Development",
    text: "Web e mobile app, performance, scalabilità e soluzioni su misura.",
    summary:
      "Progettiamo e costruiamo prodotti digitali su misura. Interfaccia, codice e performance restano nello stesso percorso, dal primo schermo al rilascio.",
    points: ["Web e mobile app", "Architettura", "Design di prodotto", "Performance"],
    icon: "code",
  },
  {
    slug: "visual-communication",
    index: "03",
    title: "Visual Communication",
    text: "Siti, contenuti, motion e direzione creativa per raccontare il tuo brand.",
    summary:
      "Direzione visiva per raccontare il brand fuori e dentro il prodotto. Siti, motion e contenuti con la stessa gerarchia e lo stesso carattere.",
    points: ["Siti", "Motion", "Direzione creativa", "Contenuti"],
    icon: "monitor",
  },
  {
    slug: "growth-support",
    index: "04",
    title: "Growth & Support",
    text: "Ottimizzazione, manutenzione e affiancamento continuo.",
    summary:
      "Dopo il lancio restiamo vicini. Misuriamo, sistemiamo e facciamo evolvere quello che abbiamo costruito, senza perdere la qualità del primo rilascio.",
    points: ["Ottimizzazione", "Manutenzione", "Affiancamento", "Evoluzione"],
    icon: "arrow",
  },
];

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}
