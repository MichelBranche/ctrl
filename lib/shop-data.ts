// Shared shop types and constants (safe for client components: no DB, no supplier data).

export const SHOP_CATEGORIES = ["tech", "merch", "accessories", "gift"] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];
export const SHOP_CATEGORY_LABEL: Record<"it" | "en", Record<ShopCategory, string>> = {
  it: { tech: "Tech & Tools", merch: "Merch", accessories: "Accessori", gift: "Gift Card" },
  en: { tech: "Tech & Tools", merch: "Merch", accessories: "Accessories", gift: "Gift Card" },
};
export const isShopCategory = (value: unknown): value is ShopCategory => SHOP_CATEGORIES.includes(value as ShopCategory);

/** Per-language product page copy: small label above the title, benefits block, short highlights next to the buy button. */
export type ShopDetails = { label: string; heading: string; benefits: [string, string][]; highlights: string[] };
export type ShopDetailsByLang = { it: ShopDetails; en: ShopDetails };
export const EMPTY_DETAILS: ShopDetails = { label: "", heading: "", benefits: [], highlights: [] };

/** Public product: what pages and client components receive. Supplier fields live only in ShopProductAdmin. */
export type ShopProduct = {
  id: string;
  slug: string;
  category: ShopCategory;
  titleIt: string;
  titleEn: string;
  descriptionIt: string;
  descriptionEn: string;
  price: string;
  images: string[];
  published: boolean;
  sortOrder: number;
  createdAt: string;
  details: ShopDetailsByLang;
};

export type ShopProductAdmin = ShopProduct & {
  updatedAt: string;
  enAuto: boolean;
  supplierName: string;
  supplierProductUrl: string;
  supplierSku: string;
  /** Unit cost paid to the supplier, "" when unknown. Admin only. */
  supplierCost: string;
};

export const ORDER_STATUSES = ["richiesta", "confermata", "ordinata", "spedita", "consegnata", "annullata"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const isOrderStatus = (value: unknown): value is OrderStatus => ORDER_STATUSES.includes(value as OrderStatus);
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  richiesta: "Richiesta", confermata: "Confermata", ordinata: "Ordinata al fornitore", spedita: "Spedita", consegnata: "Consegnata", annullata: "Annullata",
};

export const GOOGLE_CARD_DETAILS: ShopDetailsByLang = {
  it: {
    label: "Cards",
    heading: "Un piccolo gesto. Più recensioni.",
    benefits: [
      ["Più recensioni", "Rendi semplice per i clienti raccontare la loro esperienza."],
      ["Più fiducia", "Aiuta i nuovi clienti a scoprire le opinioni di chi ti ha già scelto."],
      ["NFC + QR", "Funziona con un tap NFC o con la scansione del codice."],
      ["Sempre con te", "Un piccolo strumento, pronto da usare al banco."],
    ],
    highlights: ["NFC e QR", "Due modalità di accesso", "Assistenza dedicata"],
  },
  en: {
    label: "Cards",
    heading: "One small gesture. More reviews.",
    benefits: [
      ["More reviews", "Make it easy for customers to share their experience."],
      ["More trust", "Help new customers discover feedback from people who chose you."],
      ["NFC + QR", "Works with an NFC tap or a quick scan."],
      ["Always at hand", "A small tool, ready to use at your counter."],
    ],
    highlights: ["NFC and QR", "Two ways to open the link", "Dedicated support"],
  },
};

export const DEFAULT_SHOP_PRODUCT: ShopProduct = {
  id: "google-review-card",
  slug: "google-review-card",
  category: "tech",
  published: true,
  titleIt: "Card recensioni Google",
  titleEn: "Google Review Card",
  descriptionIt: "Invita i clienti a lasciare una recensione con un semplice tap NFC o una scansione del QR code.",
  descriptionEn: "Invite customers to leave a review with a quick NFC tap or a scan of the QR code.",
  price: "19.90",
  images: ["/images/shop/review-card-hero.webp", "/images/shop/review-card.webp", "/images/shop/review-card-detail.webp"],
  sortOrder: 0,
  createdAt: "2026-11-01T00:00:00.000Z",
  details: GOOGLE_CARD_DETAILS,
};

function cleanDetails(value: unknown): ShopDetails {
  const v = (value ?? {}) as Partial<ShopDetails>;
  const str = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
  return {
    label: str(v.label, 40),
    heading: str(v.heading, 120),
    benefits: Array.isArray(v.benefits)
      ? v.benefits.filter((b): b is [string, string] => Array.isArray(b) && typeof b[0] === "string").map((b): [string, string] => [str(b[0], 60), str(b[1], 240)]).filter((b) => b[0]).slice(0, 6)
      : [],
    highlights: Array.isArray(v.highlights) ? v.highlights.map((h) => str(h, 60)).filter(Boolean).slice(0, 4) : [],
  };
}

export function parseDetails(json: unknown): ShopDetailsByLang {
  let raw: Record<string, unknown> = {};
  try { raw = typeof json === "string" ? JSON.parse(json) : {}; } catch { raw = {}; }
  return { it: cleanDetails(raw?.it), en: cleanDetails(raw?.en) };
}

/** Admin textarea format: one benefit per line, "Title | text". */
export const benefitsToText = (b: [string, string][]) => b.map(([t, d]) => (d ? `${t} | ${d}` : t)).join("\n");
export const textToBenefits = (s: string): [string, string][] =>
  s.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const i = line.indexOf("|");
    return i < 0 ? [line, ""] : [line.slice(0, i).trim(), line.slice(i + 1).trim()];
  });
export const textToLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
