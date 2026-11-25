/*
 * Public language routing and selection checks:
 *   node scripts/public-i18n-test.mjs
 * No network, database, or secrets.
 */
import assert from "node:assert/strict";
import { LANG_COOKIE, locales, localeFromAcceptLanguage, localeFromPath, localize, switchPath, withGermanFallback } from "../lib/i18n.ts";

assert.deepEqual(locales, ["it", "en", "de", "fr"]);
assert.equal(LANG_COOKIE, "ctrl-lang");

assert.equal(localeFromAcceptLanguage("de-DE,de;q=0.9,en;q=0.8"), "de");
assert.equal(localeFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.8"), "fr");
assert.equal(localeFromAcceptLanguage("fr-CH, de;q=0.8"), "fr");
assert.equal(localeFromAcceptLanguage("it-IT,it;q=0.9"), "it");
assert.equal(localeFromAcceptLanguage(null), null);
assert.equal(localeFromAcceptLanguage("*"), null);

assert.equal(localeFromPath("/de"), "de");
assert.equal(localeFromPath("/de/services"), "de");
assert.equal(localeFromPath("/fr"), "fr");
assert.equal(localeFromPath("/fr/services"), "fr");
assert.equal(localeFromPath("/en"), "en");
assert.equal(localeFromPath("/services"), "it");

assert.equal(localize("/", "de"), "/de");
assert.equal(localize("/services", "de"), "/de/services");
assert.equal(localize("/cookie", "de"), "/de/cookies");
assert.equal(localize("/cookie", "fr"), "/fr/cookies");
assert.equal(switchPath("/en/services", "de"), "/de/services");
assert.equal(switchPath("/de/services", "fr"), "/fr/services");
assert.equal(switchPath("/fr/services", "en"), "/en/services");
assert.equal(switchPath("/de/services", "it"), "/services");
assert.equal(switchPath("/cookie", "en"), "/en/cookies");
assert.equal(switchPath("/de/cookies", "fr"), "/fr/cookies");

const copy = withGermanFallback({ it: "Italiano", en: "English", de: "Deutsch" });
assert.equal(copy.de, "Deutsch");
const legacyCopy = withGermanFallback({ it: "Italiano", en: "English" });
assert.equal(legacyCopy.de, "English");
assert.equal(legacyCopy.fr, "English");

console.log("public-i18n-test: all language routing and preference checks passed");
