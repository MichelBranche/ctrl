import type { ReactNode } from "react";
import type { TeamSocials as Socials } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

const ICONS: Record<keyof Socials, ReactNode> = {
  linkedin: <path d="M4.5 9.5v10M4.5 5.5v.01M9 19.5v-6a3 3 0 0 1 6 0v6M9 9.5v10" />,
  email: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  website: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></>,
  github: <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />,
};
const LABELS: Record<keyof Socials, Record<Locale, string>> = {
  linkedin: { it: "LinkedIn di", en: "LinkedIn of" },
  email: { it: "Scrivi a", en: "Email" },
  website: { it: "Sito di", en: "Website of" },
  github: { it: "GitHub di", en: "GitHub of" },
};
const ORDER: (keyof Socials)[] = ["linkedin", "email", "website", "github"];

/** Row of small icon links under a team card; renders only the links that are set. */
export function TeamSocials({ socials, name, lang }: { socials: Socials; name: string; lang: Locale }) {
  const items = ORDER.flatMap((k) => (socials[k] ? [[k, socials[k]] as const] : []));
  if (!items.length) return null;
  return (
    <ul className="t-socials">
      {items.map(([k, v]) => {
        const mail = k === "email";
        return (
          <li key={k}>
            <a href={mail ? `mailto:${v}` : v} {...(mail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              aria-label={`${LABELS[k][lang]} ${name}`} title={mail ? v : undefined}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[k]}
              </svg>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
