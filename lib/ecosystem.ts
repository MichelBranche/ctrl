import type { Locale } from "@/lib/i18n";

/**
 * "Ecosistema CTRL®" cards on the home page (solutions made by CTRL®).
 *
 * Images: /public/images/ecosystem/<id>-it.webp and <id>-en.webp, picked by
 * language. Until a file exists the card shows a solid placeholder in `tint`
 * with the product name, so new artwork only needs copying in and a push.
 * Quotes links to the temporary /ctrl-quotes page (noindex); the live app is
 * https://quotes.ctrlagency.dev. Agenda Easy links to its public site.
 * Recommended size: 1710x919 (about 1.86:1), webp.
 * Texts (subtitles, header) live in lib/i18n.ts under home.eco*.
 */
export type EcosystemItem = {
  id: "quotes" | "agenda";
  name: string;
  /** Internal path (localized) or an external URL (opens in a new tab). */
  href: string;
  /** Placeholder background, same colour family as the artwork. */
  tint: string;
  /** Placeholder text colour. */
  ink: string;
};

export const ECOSYSTEM: EcosystemItem[] = [
  { id: "quotes", name: "CTRL® Quotes", href: "/ctrl-quotes", tint: "#ff4a1c", ink: "#0c0c0c" },
  { id: "agenda", name: "Agenda Easy", href: "https://agendaeasy.it", tint: "#e2d6f0", ink: "#3b1f5c" },
];

export function ecosystemImage(id: EcosystemItem["id"], lang: Locale) {
  return `/images/ecosystem/${id}-${lang}.webp`;
}
