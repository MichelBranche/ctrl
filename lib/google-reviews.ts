import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { dbConfigured } from "@/lib/db";
import { readSettings, writeSettings } from "@/lib/settings";
import {
  fixtureReviews,
  normalizePlaceId,
  parsePlaceDetails,
  reviewsFixtureEnabled,
  type GoogleReviewsSnapshot,
} from "@/lib/google-reviews-core";

const SETTINGS_KEY = "google.reviews";
const DAY_MS = 86_400_000;
const FIELDS = "rating,userRatingCount,reviews,googleMapsUri";

type StoredReviews = {
  fetchedAt: string;
  rating: number | null;
  count: number | null;
  mapsUri: string;
  reviews: GoogleReviewsSnapshot["reviews"];
};

export type GoogleReviewsSync = "unconfigured" | "fresh" | "updated" | "kept" | "empty";

function snapshotFromStored(stored: StoredReviews): GoogleReviewsSnapshot {
  return { fixture: false, rating: stored.rating, count: stored.count, mapsUri: stored.mapsUri, reviews: stored.reviews };
}

function isStored(value: unknown): value is StoredReviews {
  if (!value || typeof value !== "object") return false;
  const row = value as StoredReviews;
  return typeof row.fetchedAt === "string" && typeof row.mapsUri === "string" && Array.isArray(row.reviews);
}

async function readStored(): Promise<StoredReviews | null> {
  if (!dbConfigured) return null;
  const raw = (await readSettings([SETTINGS_KEY]))[SETTINGS_KEY];
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStored(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeStored(stored: StoredReviews) {
  await writeSettings({ [SETTINGS_KEY]: JSON.stringify(stored) });
}

async function fetchPlace(placeId: string, apiKey: string): Promise<GoogleReviewsSnapshot> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELDS,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`places ${res.status}`);
  const parsed = parsePlaceDetails(await res.json(), placeId);
  if (!parsed) throw new Error("places empty");
  return parsed;
}

/**
 * Refresh Place Details at most once a day.
 * A failed call keeps the previous row, so the home page can keep showing the last good reviews.
 * Places returns at most five reviews per call.
 */
export async function syncGoogleReviews(): Promise<GoogleReviewsSync> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
  const placeId = normalizePlaceId(process.env.GOOGLE_PLACE_ID ?? "");
  if (!apiKey || !placeId || !dbConfigured) return "unconfigured";

  const current = await readStored().catch(() => null);
  const age = current ? Date.now() - Date.parse(current.fetchedAt) : Number.POSITIVE_INFINITY;
  if (current && Number.isFinite(age) && age >= 0 && age < DAY_MS) return "fresh";

  try {
    const fresh = await fetchPlace(placeId, apiKey);
    await writeStored({
      fetchedAt: new Date().toISOString(),
      rating: fresh.rating,
      count: fresh.count,
      mapsUri: fresh.mapsUri,
      reviews: fresh.reviews,
    });
    return fresh.reviews.length ? "updated" : "empty";
  } catch (error) {
    console.error("[google-reviews]", error instanceof Error ? error.message : "fetch failed");
    const fetchedAt = new Date().toISOString();
    if (current) {
      await writeStored({ ...current, fetchedAt }).catch(() => undefined);
      return "kept";
    }
    await writeStored({ fetchedAt, rating: null, count: null, mapsUri: "", reviews: [] }).catch(() => undefined);
    return "empty";
  }
}

async function cachedGoogleReviews(): Promise<GoogleReviewsSnapshot | null> {
  "use cache";
  cacheLife({ stale: 86400, revalidate: 86400, expire: 86400 * 30 });
  cacheTag("google-reviews");
  if (!process.env.GOOGLE_PLACES_API_KEY?.trim() || !normalizePlaceId(process.env.GOOGLE_PLACE_ID ?? "")) return null;
  try {
    await syncGoogleReviews();
    const stored = await readStored();
    if (!stored?.reviews.length) return null;
    return snapshotFromStored(stored);
  } catch (error) {
    console.error("[google-reviews]", error instanceof Error ? error.message : "read failed");
    return null;
  }
}

/** Reviews for the home hero. Missing keys, an empty list, or a failed read render nothing. */
export async function getGoogleReviews(): Promise<GoogleReviewsSnapshot | null> {
  if (reviewsFixtureEnabled()) return fixtureReviews();
  const snapshot = await cachedGoogleReviews();
  if (!snapshot?.reviews.length) return null;
  return snapshot;
}
