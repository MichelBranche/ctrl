/**
 * "Ecosistema CTRL®" cards on the home page (solutions made by CTRL®).
 *
 * Each product shows its app icon (128x128 webp in /public/images/ecosystem/<id>-icon.webp,
 * rendered at about 60px) next to its wordmark, written as the brand writes it
 * (see components/home/eco-wordmarks.tsx). Quotes links to the CTRL® Quotes page /ctrl-quotes
 * (components/pages/quotes-page.tsx); the live app is https://quotes.ctrlagency.dev. Agenda Easy links to its public site.
 * Add a product: one entry here, its icon file, and a wordmark. The grid keeps cards centred.
 * Texts (subtitles, header) live in lib/i18n.ts under home.eco*.
 */
export type EcosystemItem = {
  id: "quotes" | "agenda";
  name: string;
  /** Internal path (localized) or an external URL (opens in a new tab). */
  href: string;
};

export const ECOSYSTEM: EcosystemItem[] = [
  { id: "quotes", name: "CTRL® Quotes", href: "/ctrl-quotes" },
  { id: "agenda", name: "Agenda Easy", href: "https://agendaeasy.it" },
];

export function ecosystemIcon(id: EcosystemItem["id"]) {
  return `/images/ecosystem/${id}-icon.webp`;
}
