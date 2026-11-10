import type { Metadata } from "next";
import { CONTACT_EMAIL, CONTACT_PHONE, team } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";

export const SITE_URL = "https://www.ctrlagency.dev";
export const ORG_ID = `${SITE_URL}/#organization`;
export const LOCAL_PATH = "/agenzia-web-valle-d-aosta";

/**
 * Public facts we will not invent.
 * Schema omits a field while its env value is empty.
 *
 * Street, postal code and phone are the public studio NAP. Env overrides them.
 * TODO(owner): BUSINESS_VAT_ID (partita IVA). Leave empty: there is no VAT number yet.
 * TODO(owner): BUSINESS_LEGAL_NAME (if it differs from CTRL®)
 * TODO(owner): INDEXNOW_KEY (8 to 128 hex characters). The key file is served at /<key>.txt
 *
 * Founders, as published on /team: Michel Branche and Kallebe Gallo.
 */
export const businessProfile = {
  streetAddress: process.env.BUSINESS_STREET_ADDRESS ?? "Via St. Martin de Corléans, 179",
  postalCode: process.env.BUSINESS_POSTAL_CODE ?? "11100",
  telephone: process.env.BUSINESS_PHONE ?? CONTACT_PHONE,
  vatId: process.env.BUSINESS_VAT_ID ?? "",
  legalName: process.env.BUSINESS_LEGAL_NAME ?? "",
};

/** Profiles already linked from the public footer. */
export const SAME_AS = [
  "https://www.linkedin.com/company/ctrl%C2%AE/",
  "https://www.youtube.com/channel/UCgirvfq-N2XXvpRQ0OL5tsw",
] as const;

const AREAS = [
  { "@type": "AdministrativeArea", name: "Valle d'Aosta" },
  { "@type": "Country", name: "Italy" },
] as const;

export function alternates(itPath: string, lang: Locale, enPath = itPath === "/" ? "/en" : `/en${itPath}`): Metadata["alternates"] {
  return {
    canonical: lang === "en" ? enPath : itPath,
    languages: { "it-IT": itPath, "en-US": enPath, "x-default": itPath },
  };
}

const OG_ALT = {
  it: "CTRL®, studio indipendente di creative technology ad Aosta",
  en: "CTRL®, independent creative technology studio in Aosta",
} as const;

/** Full Open Graph object. A page that sets openGraph replaces the layout value, so pass the extras here. */
export function openGraph(lang: Locale, extra?: Metadata["openGraph"]): Metadata["openGraph"] {
  return {
    type: "website",
    siteName: "CTRL®",
    locale: lang === "en" ? "en_US" : "it_IT",
    alternateLocale: [lang === "en" ? "it_IT" : "en_US"],
    images: [{ url: "/images/home/hero.jpg", width: 1200, height: 630, alt: OG_ALT[lang] }],
    ...extra,
  };
}

export function organizationNode(): Record<string, unknown> {
  const address: Record<string, unknown> = {
    "@type": "PostalAddress",
    addressLocality: "Aosta",
    addressRegion: "Valle d'Aosta",
    addressCountry: "IT",
  };
  if (businessProfile.streetAddress) address.streetAddress = businessProfile.streetAddress;
  if (businessProfile.postalCode) address.postalCode = businessProfile.postalCode;

  const founders = team
    .filter((member) => member.slug === "michel-branche" || member.slug === "kallebe-gallo")
    .map((member) => ({
      "@type": "Person",
      name: member.name,
      jobTitle: member.role.en,
      ...(member.socials.website ? { url: member.socials.website } : {}),
    }));

  const node: Record<string, unknown> = {
    "@type": ["Organization", "ProfessionalService"],
    "@id": ORG_ID,
    name: "CTRL®",
    url: SITE_URL,
    logo: `${SITE_URL}/apple-icon.png`,
    image: `${SITE_URL}/images/home/hero.jpg`,
    email: CONTACT_EMAIL,
    address,
    areaServed: AREAS,
    founder: founders,
    sameAs: SAME_AS,
  };
  if (businessProfile.legalName) node.legalName = businessProfile.legalName;
  if (businessProfile.telephone) node.telephone = businessProfile.telephone;
  if (businessProfile.vatId) node.vatID = businessProfile.vatId;
  return node;
}

export function websiteNode(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "CTRL®",
    inLanguage: ["it-IT", "en-US"],
    publisher: { "@id": ORG_ID },
  };
}

export function organizationGraph(): Record<string, unknown> {
  return { "@context": "https://schema.org", "@graph": [organizationNode(), websiteNode()] };
}

export function breadcrumbNode(lang: Locale, items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${localize(item.path, lang)}`,
    })),
  };
}

export function serviceNode(lang: Locale, opts: { name: string; description: string; path: string; serviceType: string }): Record<string, unknown> {
  return {
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    serviceType: opts.serviceType,
    url: `${SITE_URL}${localize(opts.path, lang)}`,
    provider: { "@id": ORG_ID },
    areaServed: AREAS,
  };
}

export function faqNode(items: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
