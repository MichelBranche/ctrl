/*
 * Admin dictionary key parity and shared date/number formatters:
 *   node scripts/admin-i18n-test.mjs
 * No network, no database, no secrets.
 */
import assert from "node:assert/strict";

const {
  ADMIN_LANG_COOKIE,
  ADMIN_TIME_ZONE,
  adminDict,
  adminIntlLocale,
  defaultAdminLocale,
  flattenDictKeys,
  formatAdminCurrency,
  formatAdminDate,
  formatAdminDateLabel,
  formatAdminNumber,
  formatAdminShortAgo,
  interpolate,
  isAdminLocale,
  parseAdminLocale,
} = await import("../lib/admin-i18n.ts");

assert.equal(ADMIN_LANG_COOKIE, "ctrl-admin-lang");
assert.equal(ADMIN_TIME_ZONE, "Europe/Rome");
assert.equal(defaultAdminLocale, "it");
assert.equal(adminIntlLocale("it"), "it-IT");
assert.equal(adminIntlLocale("en"), "en-GB");

assert.equal(isAdminLocale("it"), true);
assert.equal(isAdminLocale("en"), true);
assert.equal(isAdminLocale("fr"), false);
assert.equal(parseAdminLocale("en"), "en");
assert.equal(parseAdminLocale("it"), "it");
assert.equal(parseAdminLocale("fr"), "it");
assert.equal(parseAdminLocale(undefined), "it");
assert.equal(parseAdminLocale(""), "it");

const itKeys = flattenDictKeys(adminDict.it);
const enKeys = flattenDictKeys(adminDict.en);
const missingInEn = itKeys.filter((key) => !enKeys.includes(key));
const extraInEn = enKeys.filter((key) => !itKeys.includes(key));
assert.deepEqual(missingInEn, [], `EN is missing keys: ${missingInEn.join(", ")}`);
assert.deepEqual(extraInEn, [], `EN has extra keys: ${extraInEn.join(", ")}`);
assert.ok(itKeys.length > 100, `expected a substantial dictionary, got ${itKeys.length} keys`);
assert.equal(new Set(itKeys).size, itKeys.length);
assert.equal(new Set(enKeys).size, enKeys.length);

assert.equal(interpolate("Hello {name}", { name: "Michel" }), "Hello Michel");
assert.equal(interpolate("{n} items", { n: 3 }), "3 items");
assert.equal(interpolate("no vars", {}), "no vars");

assert.equal(formatAdminNumber(12345.5, "it"), "12.345,5");
assert.equal(formatAdminNumber(12345.5, "en"), "12,345.5");
assert.match(formatAdminNumber(1234.5, "it"), /1.?234,5/);
assert.match(formatAdminNumber(1234.5, "en"), /1,?234\.5/);

const euroIt = formatAdminCurrency(12345, "it");
const euroEn = formatAdminCurrency(12345, "en");
assert.ok(euroIt.includes("12.345") && euroIt.includes("€"), euroIt);
assert.ok(euroEn.includes("12,345") && euroEn.includes("€"), euroEn);

// 15 Nov 2026 22:30 UTC = 15 Nov 2026 23:30 Europe/Rome (UTC+1)
const fixed = new Date("2026-11-15T22:30:00.000Z");
const dateIt = formatAdminDate(fixed, "it", { day: "numeric", month: "short", year: "numeric" });
const dateEn = formatAdminDate(fixed, "en", { day: "numeric", month: "short", year: "numeric" });
assert.ok(/15/.test(dateIt) && /2026/.test(dateIt), dateIt);
assert.ok(/15/.test(dateEn) && /2026/.test(dateEn), dateEn);
assert.notEqual(dateIt, dateEn);

const labelIt = formatAdminDateLabel(fixed, "it");
const labelEn = formatAdminDateLabel(fixed, "en");
assert.ok(labelIt.includes("15") && labelIt.includes("2026"), labelIt);
assert.ok(labelEn.includes("15") && labelEn.includes("2026"), labelEn);
assert.ok(labelIt === labelIt.toLocaleUpperCase("it-IT"), labelIt);
assert.ok(labelEn === labelEn.toLocaleUpperCase("en-GB"), labelEn);

const now = Date.parse("2026-11-15T22:30:00.000Z");
assert.equal(formatAdminShortAgo(new Date(now - 10_000).toISOString(), "it", now), adminDict.it.time.justNow);
assert.equal(formatAdminShortAgo(new Date(now - 10_000).toISOString(), "en", now), adminDict.en.time.justNow);
assert.equal(formatAdminShortAgo(new Date(now - 5 * 60_000).toISOString(), "it", now), "5 min fa");
assert.equal(formatAdminShortAgo(new Date(now - 5 * 60_000).toISOString(), "en", now), "5 min ago");
assert.equal(formatAdminShortAgo(new Date(now - 2 * 3600_000).toISOString(), "it", now), "2 h fa");
assert.equal(formatAdminShortAgo(new Date(now - 2 * 3600_000).toISOString(), "en", now), "2 h ago");
assert.equal(formatAdminShortAgo(new Date(now - 3 * 24 * 3600_000).toISOString(), "it", now), "3 g fa");
assert.equal(formatAdminShortAgo(new Date(now - 3 * 24 * 3600_000).toISOString(), "en", now), "3 d ago");
assert.equal(formatAdminShortAgo("not-a-date", "it", now), "");

console.log(`admin-i18n-test: all passed (${itKeys.length} dictionary keys, formatters it-IT / en-GB, TZ ${ADMIN_TIME_ZONE})`);
