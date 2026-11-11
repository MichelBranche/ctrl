import type { Locale } from "@/lib/i18n";

/** One Google review we are allowed to show. Text and author are copied from Places, never written here. */
export type GoogleReviewCard = {
  id: string;
  author: string;
  authorUri: string | null;
  rating: number;
  text: string;
  publishedAt: string;
};

export type GoogleReviewsSnapshot = {
  /** True only for the dev/test sample. Production never sets this. */
  fixture: boolean;
  rating: number | null;
  count: number | null;
  mapsUri: string;
  reviews: GoogleReviewCard[];
};

/** Cards after locale formatting. The marquee renders these strings as-is. */
export type PresentedReview = GoogleReviewCard & { when: string; stars: number; starLabel: string };

export type PresentedReviews = {
  fixture: boolean;
  ratingLabel: string | null;
  countLabel: string | null;
  metaLabel: string;
  mapsUri: string;
  attribution: string;
  fixtureLabel: string | null;
  pause: string;
  play: string;
  reviews: PresentedReview[];
};

const COPY = {
  it: {
    attribution: "Recensioni Google",
    fixture: "Anteprima locale",
    pause: "Pausa",
    play: "Riprendi",
    stars: (n: number) => `${n} su 5`,
    meta: (rating: string | null, count: string | null) => {
      const parts = ["Recensioni Google"];
      if (rating) parts.push(`valutazione ${rating} su 5`);
      if (count) parts.push(`${count} valutazioni`);
      return parts.join(", ");
    },
  },
  en: {
    attribution: "Google reviews",
    fixture: "Local preview",
    pause: "Pause",
    play: "Play",
    stars: (n: number) => `${n} out of 5`,
    meta: (rating: string | null, count: string | null) => {
      const parts = ["Google reviews"];
      if (rating) parts.push(`rating ${rating} out of 5`);
      if (count) parts.push(`${count} ratings`);
      return parts.join(", ");
    },
  },
} as const;

/** Dev/test sample only. Production builds ignore the flag even if it is set. */
export function reviewsFixtureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && env.GOOGLE_REVIEWS_FIXTURE === "1";
}

export function normalizePlaceId(raw: string): string | null {
  const id = raw.trim().replace(/^places\//, "");
  return /^[A-Za-z0-9_-]{8,256}$/.test(id) ? id : null;
}

export function mapsUrlForPlace(placeId: string, raw?: string | null): string {
  if (raw && /^https:\/\//.test(raw)) return raw;
  return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;
}

/**
 * Prefer 4 and 5 star reviews that include text.
 * When fewer than three of those exist, keep every review that has text so a short list still shows.
 */
export function selectReviews(reviews: GoogleReviewCard[]): GoogleReviewCard[] {
  const withText = reviews.filter((review) => review.text.trim().length > 0 && review.author.trim().length > 0 && review.rating >= 1 && review.rating <= 5);
  const preferred = withText.filter((review) => review.rating >= 4);
  if (preferred.length >= 3 || preferred.length === withText.length) return preferred;
  return withText;
}

/** Repeat a short list so one half of the marquee is wide enough to loop. */
export function marqueeRepeats(count: number): number {
  if (count <= 0) return 0;
  return Math.max(1, Math.ceil(6 / count));
}

export function starCount(rating: number): number {
  if (!Number.isFinite(rating)) return 0;
  return Math.max(0, Math.min(5, Math.round(rating)));
}

export function formatReviewAge(iso: string, lang: Locale, now = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const rtf = new Intl.RelativeTimeFormat(lang === "it" ? "it" : "en", { numeric: "auto" });
  const seconds = Math.round((then - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const abs = Math.abs(seconds);
  for (const [unit, size] of units) {
    if (abs >= size || unit === "minute") return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, "minute");
}

function localeTag(lang: Locale) {
  return lang === "it" ? "it-IT" : "en-GB";
}

export function formatRating(value: number, lang: Locale): string {
  return new Intl.NumberFormat(localeTag(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

export function formatCount(value: number, lang: Locale): string {
  return new Intl.NumberFormat(localeTag(lang)).format(value);
}

export function presentReviews(snapshot: GoogleReviewsSnapshot, lang: Locale, now = Date.now()): PresentedReviews {
  const copy = COPY[lang];
  const ratingLabel = snapshot.rating == null ? null : formatRating(snapshot.rating, lang);
  const countLabel = snapshot.count == null ? null : formatCount(snapshot.count, lang);
  return {
    fixture: snapshot.fixture,
    ratingLabel,
    countLabel,
    metaLabel: copy.meta(ratingLabel, countLabel),
    mapsUri: snapshot.mapsUri,
    attribution: copy.attribution,
    fixtureLabel: snapshot.fixture ? copy.fixture : null,
    pause: copy.pause,
    play: copy.play,
    reviews: snapshot.reviews.map((review) => ({
      ...review,
      when: formatReviewAge(review.publishedAt, lang, now),
      stars: starCount(review.rating),
      starLabel: copy.stars(starCount(review.rating)),
    })),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function reviewText(review: Record<string, unknown>): string {
  const original = asRecord(review.originalText);
  const translated = asRecord(review.text);
  const raw = typeof original?.text === "string" && original.text.trim() ? original.text : typeof translated?.text === "string" ? translated.text : "";
  return raw.trim();
}

function httpsUrl(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}

/** Turn a Place Details JSON body into cards. Returns null when the payload is not a place. */
export function parsePlaceDetails(body: unknown, placeId: string): GoogleReviewsSnapshot | null {
  const row = asRecord(body);
  if (!row) return null;
  const hasSignal = "rating" in row || "userRatingCount" in row || "reviews" in row || "googleMapsUri" in row;
  if (!hasSignal) return null;

  const rating = typeof row.rating === "number" && row.rating >= 1 && row.rating <= 5 ? row.rating : null;
  const count = typeof row.userRatingCount === "number" && Number.isFinite(row.userRatingCount) && row.userRatingCount >= 0 ? Math.round(row.userRatingCount) : null;
  const list = Array.isArray(row.reviews) ? row.reviews : [];
  const cards: GoogleReviewCard[] = [];
  list.forEach((item, index) => {
    const review = asRecord(item);
    if (!review) return;
    const authorRecord = asRecord(review.authorAttribution);
    const author = typeof authorRecord?.displayName === "string" ? authorRecord.displayName.trim() : "";
    const text = reviewText(review);
    const stars = typeof review.rating === "number" ? review.rating : NaN;
    if (!author || !text || !Number.isFinite(stars)) return;
    const published = typeof review.publishTime === "string" && Number.isFinite(Date.parse(review.publishTime)) ? new Date(review.publishTime).toISOString() : "";
    const id = typeof review.name === "string" && review.name.trim() ? review.name.trim() : `review-${index}`;
    cards.push({
      id,
      author,
      authorUri: httpsUrl(authorRecord?.uri),
      rating: stars,
      text,
      publishedAt: published,
    });
  });

  return {
    fixture: false,
    rating,
    count,
    mapsUri: mapsUrlForPlace(placeId, httpsUrl(row.googleMapsUri)),
    reviews: selectReviews(cards),
  };
}

/** Obviously fake cards for local layout checks. Never used when NODE_ENV is production. */
export function fixtureReviews(now = Date.now()): GoogleReviewsSnapshot {
  const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
  return {
    fixture: true,
    rating: 4.7,
    count: 3,
    mapsUri: "https://www.google.com/maps",
    reviews: [
      {
        id: "fixture-1",
        author: "Esempio locale",
        authorUri: null,
        rating: 5,
        text: "Testo di prova per il layout. Non è una recensione Google.",
        publishedAt: daysAgo(12),
      },
      {
        id: "fixture-2",
        author: "Local sample",
        authorUri: null,
        rating: 5,
        text: "Sample text for the layout. This is not a Google review.",
        publishedAt: daysAgo(40),
      },
      {
        id: "fixture-3",
        author: "Anteprima",
        authorUri: null,
        rating: 4,
        text: "Terza scheda di prova, così la striscia si legge anche con poche voci.",
        publishedAt: daysAgo(70),
      },
    ],
  };
}
