/**
 * Google review parsing: real text only, 4-5 stars unless the list is short, no production fixture.
 *   node scripts/google-reviews-test.mjs
 */
import assert from "node:assert/strict";
import {
  fixtureReviews,
  formatReviewAge,
  marqueeRepeats,
  parsePlaceDetails,
  presentReviews,
  reviewsFixtureEnabled,
  selectReviews,
} from "../lib/google-reviews-core.ts";

const now = Date.parse("2026-11-11T10:00:00.000Z");

const card = (id, rating, text, author = "Ada") => ({ id, author, authorUri: null, rating, text, publishedAt: "2026-10-01T00:00:00.000Z" });

const chosen = selectReviews([
  card("a", 5, "Ottimo sito."),
  card("b", 4, "Hotel chiaro."),
  card("c", 5, "Software su misura."),
  card("d", 2, "Non mi è piaciuto."),
  card("e", 5, "   "),
  card("f", 5, "Manca il nome.", ""),
]);
assert.deepEqual(chosen.map((review) => review.id), ["a", "b", "c"]);

const few = selectReviews([
  card("a", 5, "Una sola alta."),
  card("b", 3, "Resta visibile perché le alte sono poche."),
]);
assert.deepEqual(few.map((review) => review.id), ["a", "b"]);

assert.deepEqual(selectReviews([card("a", 5, "Solo questa.")]).map((review) => review.id), ["a"]);
assert.equal(selectReviews([]).length, 0);
assert.equal(marqueeRepeats(0), 0);
assert.equal(marqueeRepeats(1), 6);
assert.equal(marqueeRepeats(3), 2);
assert.equal(marqueeRepeats(5), 2);

const parsed = parsePlaceDetails({
  rating: 4.6,
  userRatingCount: 12,
  googleMapsUri: "https://maps.google.com/?cid=1",
  reviews: [
    {
      name: "places/x/reviews/1",
      rating: 5,
      publishTime: "2026-09-01T00:00:00.000Z",
      originalText: { text: "Testo originale dell'autore.", languageCode: "it" },
      text: { text: "Translated text that must not replace the original.", languageCode: "en" },
      authorAttribution: { displayName: "Giulia Neri", uri: "https://www.google.com/maps/contrib/1" },
    },
    { name: "places/x/reviews/2", rating: 5, text: { text: "" }, authorAttribution: { displayName: "Senza testo" } },
    { name: "places/x/reviews/3", rating: 4, text: { text: "Solo testo tradotto." }, authorAttribution: { displayName: "Luca" } },
    { name: "places/x/reviews/4", rating: 1, text: { text: "Bassa, e le alte sono due." }, authorAttribution: { displayName: "Poco" } },
  ],
}, "ChIJexampleplace");

assert.ok(parsed);
assert.equal(parsed.rating, 4.6);
assert.equal(parsed.count, 12);
assert.equal(parsed.mapsUri, "https://maps.google.com/?cid=1");
assert.equal(parsed.reviews.length, 3);
assert.equal(parsed.reviews[0].text, "Testo originale dell'autore.");
assert.equal(parsed.reviews[0].author, "Giulia Neri");
assert.equal(parsed.reviews[1].text, "Solo testo tradotto.");
assert.equal(parsed.reviews.find((review) => review.author === "Senza testo"), undefined);

assert.equal(parsePlaceDetails({ error: { message: "nope" } }, "ChIJexampleplace"), null);

assert.equal(reviewsFixtureEnabled({ NODE_ENV: "production", GOOGLE_REVIEWS_FIXTURE: "1" }), false);
assert.equal(reviewsFixtureEnabled({ NODE_ENV: "development", GOOGLE_REVIEWS_FIXTURE: "1" }), true);
assert.equal(reviewsFixtureEnabled({ NODE_ENV: "development", GOOGLE_REVIEWS_FIXTURE: "0" }), false);

const fixture = fixtureReviews(now);
assert.equal(fixture.fixture, true);
assert.match(fixture.reviews[0].text, /Non è una recensione Google/);
for (const review of fixture.reviews) assert.equal(review.text.includes("\u2014"), false);

const presented = presentReviews(fixture, "it", now);
assert.equal(presented.fixtureLabel, "Anteprima locale");
assert.equal(presented.attribution, "Recensioni Google");
assert.equal(presented.reviews.length, 3);
assert.equal(presented.reviews[0].when.includes("\u2014"), false);
assert.equal(formatReviewAge("not-a-date", "en", now), "");
assert.match(formatReviewAge("2026-10-11T10:00:00.000Z", "en", now), /month|ago/i);

const hidden = presentReviews({ ...fixture, fixture: false }, "en", now);
assert.equal(hidden.fixtureLabel, null);
assert.equal(hidden.attribution, "Google reviews");

console.log("google-reviews-test ok");
