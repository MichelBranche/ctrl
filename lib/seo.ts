import type { Metadata } from "next";
import { CONTACT_EMAIL, CONTACT_PHONE, services, team } from "@/lib/content";
import { localize, type Locale } from "@/lib/i18n";

export const SITE_URL = "https://www.ctrlagency.dev";
export const ORG_ID = `${SITE_URL}/#organization`;
export const LOCAL_PATH = "/agenzia-web-valle-d-aosta";

/** Google Maps place for CTRL Agency. Identity URL only: no review markup. */
export const MAPS_URL = "https://www.google.com/maps/place/?q=CTRL+Agency&ftid=0x478921b7884a51df:0x8402eb2a8a05baa2";

/** Pin published with the studio listing. */
export const STUDIO_GEO = { latitude: 45.7374637, longitude: 7.3197432 } as const;

/**
 * Public facts we will not invent.
 * Schema omits a field while its value is empty.
 *
 * Street, postal code and phone are the public studio NAP, also stated on
 * /agenzia-web-valle-d-aosta. Env overrides the street and the phone.
 * Partita IVA is intentionally absent: there is no VAT number yet, and the
 * schema never emits vatID.
 * TODO(owner): BUSINESS_LEGAL_NAME (if it differs from CTRL®)
 * TODO(owner): INDEXNOW_KEY (8 to 128 hex characters). The key file is served at /<key>.txt
 *
 * Founders, as published on /team: Michel Branche and Kallebe Gallo.
 */
export const businessProfile = {
  streetAddress: process.env.BUSINESS_STREET_ADDRESS ?? "Via St. Martin de Corléans, 179",
  postalCode: process.env.BUSINESS_POSTAL_CODE ?? "11100",
  telephone: process.env.BUSINESS_PHONE ?? CONTACT_PHONE,
  legalName: process.env.BUSINESS_LEGAL_NAME ?? "",
};

/** Profiles already linked from the public footer, plus the Maps listing. */
export const SAME_AS = [
  "https://www.linkedin.com/company/ctrl%C2%AE/",
  "https://www.youtube.com/channel/UCgirvfq-N2XXvpRQ0OL5tsw",
  MAPS_URL,
] as const;

const AREAS = [
  { "@type": "City", name: "Aosta" },
  { "@type": "AdministrativeArea", name: "Valle d'Aosta" },
  { "@type": "Place", name: "Northern Italy", alternateName: "Nord Italia" },
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

type PublicMeta = {
  title: string;
  description: string;
  itPath: string;
  enPath?: string;
  /** When false, hreflang only names the language that actually has this URL. */
  paired?: boolean;
  images?: NonNullable<Metadata["openGraph"]>["images"];
  type?: "website" | "article";
  publishedTime?: string;
  robots?: Metadata["robots"];
};

function singleLanguageAlternates(itPath: string, lang: Locale, enPath: string): Metadata["alternates"] {
  const canonical = lang === "en" ? enPath : itPath;
  const code = lang === "en" ? "en-US" : "it-IT";
  return { canonical, languages: { [code]: canonical, "x-default": canonical } };
}

/** Absolute title, description, canonical, hreflang, Open Graph and Twitter for one public URL. */
export function publicMeta(lang: Locale, opts: PublicMeta): Metadata {
  const enPath = opts.enPath ?? (opts.itPath === "/" ? "/en" : `/en${opts.itPath}`);
  const path = lang === "en" ? enPath : opts.itPath;
  const graph = openGraph(lang, {
    title: opts.title,
    description: opts.description,
    url: `${SITE_URL}${path}`,
    ...(opts.images ? { images: opts.images } : {}),
    ...(opts.type === "article" ? { type: "article" as const, publishedTime: opts.publishedTime } : {}),
  });
  const images = graph?.images;
  return {
    title: { absolute: opts.title },
    description: opts.description,
    alternates: opts.paired === false ? singleLanguageAlternates(opts.itPath, lang, enPath) : alternates(opts.itPath, lang, enPath),
    openGraph: graph,
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, ...(images ? { images } : {}) },
    ...(opts.robots ? { robots: opts.robots } : {}),
  };
}

/** First option whose length sits in [min, max]. Used for project titles built from a real name. */
export function pickInRange(options: string[], min: number, max: number): string {
  const hit = options.find((option) => option.length >= min && option.length <= max);
  if (hit) return hit;
  const under = options.filter((option) => option.length <= max).sort((a, b) => b.length - a.length);
  return under[0] ?? options[0];
}

const PROJECT_TITLE_IT = [
  ": progetto web dello studio ad Aosta | CTRL®",
  ": sito dello studio CTRL® ad Aosta",
  ", sito web dello studio in Valle d'Aosta | CTRL®",
];
const PROJECT_TITLE_EN = [
  ": a web project by the Aosta studio | CTRL®",
  ", a CTRL® website from the Aosta studio",
  ", custom site by the web studio in Aosta | CTRL®",
  " | CTRL® website in Aosta.",
];

/** Document title for a website project page. The name is the published project title. */
export function projectDocumentTitle(name: string, lang: Locale): string {
  const suffixes = lang === "it" ? PROJECT_TITLE_IT : PROJECT_TITLE_EN;
  return pickInRange(suffixes.map((suffix) => `${name}${suffix}`), 50, 60);
}

const PROJECT_DESC_IT = [
  " Progetto di CTRL®, agenzia web in Valle d'Aosta.",
  " Progetto di CTRL®, agenzia web ad Aosta.",
  " Lavoro dello studio CTRL® ad Aosta.",
  " Studio CTRL® ad Aosta.",
];
const PROJECT_DESC_EN = [
  " A project by CTRL®, the web studio in Aosta, Valle d'Aosta.",
  " By CTRL®, the web studio in Valle d'Aosta.",
  " A CTRL® project from the Aosta studio.",
  " By the CTRL® studio in Aosta.",
  " From CTRL® in Aosta.",
];

/** Description for a website project page. Starts from the published project blurb. */
export function projectDocumentDescription(base: string, lang: Locale): string {
  const text = base.trim();
  const tails = lang === "it" ? PROJECT_DESC_IT : PROJECT_DESC_EN;
  return pickInRange([text, ...tails.map((tail) => `${text}${tail}`)], 140, 160);
}

const SHOP_DESC_IT = [
  " Card dello shop CTRL®, agenzia web ad Aosta, in Valle d'Aosta.",
  " Dal shop di CTRL®, agenzia web ad Aosta.",
  " Shop di CTRL® ad Aosta.",
];
const SHOP_DESC_EN = [
  " From the CTRL® shop, the web agency in Aosta, Valle d'Aosta.",
  " From the CTRL® shop in Aosta.",
  " CTRL® shop, Aosta.",
];

/** Description for a shop product. Starts from the published product text. */
export function shopDocumentDescription(base: string, lang: Locale): string {
  const text = base.trim();
  const tails = lang === "it" ? SHOP_DESC_IT : SHOP_DESC_EN;
  return pickInRange([text, ...tails.map((tail) => `${text}${tail}`)], 140, 160);
}

const SHOP_TITLE_IT = [
  " con NFC e QR ad Aosta | CTRL®",
  ", NFC e QR | shop CTRL® ad Aosta",
  " | Shop CTRL® ad Aosta",
];
const SHOP_TITLE_EN = [
  " with NFC and QR in Aosta | CTRL®",
  ", NFC and QR | CTRL® shop in Aosta",
  " | CTRL® shop in Aosta",
];

/** Document title for a shop product. The name is the published product title. */
export function shopDocumentTitle(name: string, lang: Locale): string {
  const suffixes = lang === "it" ? SHOP_TITLE_IT : SHOP_TITLE_EN;
  return pickInRange(suffixes.map((suffix) => `${name}${suffix}`), 50, 60);
}

/** Drop the brand suffix when a schema name should stay a service name. */
export function schemaName(title: string): string {
  return title.replace(/\s*\|\s*CTRL®$/, "");
}

function personNode(member: (typeof team)[number]): Record<string, unknown> {
  return {
    "@type": "Person",
    name: member.name,
    jobTitle: member.role.it,
    ...(member.socials.website ? { url: member.socials.website } : {}),
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

  const founders = team.filter((member) => member.slug === "michel-branche" || member.slug === "kallebe-gallo").map(personNode);

  const node: Record<string, unknown> = {
    "@type": ["ProfessionalService", "LocalBusiness", "Organization"],
    "@id": ORG_ID,
    name: "CTRL®",
    url: SITE_URL,
    logo: `${SITE_URL}/apple-icon.png`,
    image: `${SITE_URL}/images/home/hero.jpg`,
    email: CONTACT_EMAIL,
    address,
    geo: { "@type": "GeoCoordinates", latitude: STUDIO_GEO.latitude, longitude: STUDIO_GEO.longitude },
    hasMap: MAPS_URL,
    areaServed: AREAS,
    founder: founders,
    employee: team.map(personNode),
    sameAs: SAME_AS,
  };
  if (businessProfile.legalName) node.legalName = businessProfile.legalName;
  if (businessProfile.telephone) {
    node.telephone = businessProfile.telephone;
    node.contactPoint = {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: CONTACT_EMAIL,
      telephone: businessProfile.telephone,
      areaServed: "IT",
      availableLanguage: ["Italian", "English"],
    };
  }
  return node;
}

/** Real service pages. Names and descriptions come from the public service copy. */
function offeredServices(): Record<string, unknown>[] {
  const listed = [
    ...services.map((service) => ({
      name: service.title.it,
      description: service.summary.it,
      path: `/services/${service.slug}`,
      serviceType: service.title.en,
    })),
    {
      name: "Webapp su misura",
      description: "Webapp con aree riservate, dashboard e flussi su misura, progettate ad Aosta.",
      path: "/services/webapp",
      serviceType: "Web application development",
    },
    {
      name: "Sicurezza web e SSL/TLS gestiti",
      description: "Certificati SSL/TLS, hosting cloud edge, security headers ed email autenticate, con un piano annuale.",
      path: "/services/web-security",
      serviceType: "Managed website security and SSL/TLS certificate management",
    },
  ];
  return listed.map((service) => ({
    "@type": "Service",
    "@id": `${SITE_URL}${service.path}#service`,
    name: service.name,
    description: service.description,
    serviceType: service.serviceType,
    url: `${SITE_URL}${service.path}`,
    provider: { "@id": ORG_ID },
    areaServed: AREAS,
  }));
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
  const offered = offeredServices();
  const organization = organizationNode();
  organization.hasOfferCatalog = {
    "@type": "OfferCatalog",
    name: "Servizi digitali CTRL®",
    itemListElement: offered.map((service) => ({
      "@type": "Offer",
      itemOffered: { "@id": service["@id"] },
    })),
  };
  return { "@context": "https://schema.org", "@graph": [organization, websiteNode(), ...offered] };
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
