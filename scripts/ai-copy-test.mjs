/**
 * Admin AI copy rules. No database and no network:
 *   node scripts/ai-copy-test.mjs
 */
import { registerHooks } from "node:module";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
if (!process.execArgv.includes("--experimental-transform-types")) {
  const r = spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", ...process.execArgv, new URL(import.meta.url).pathname, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    const parent = ctx.parentURL ?? "";
    if (parent.includes("/node_modules/")) return next(spec, ctx);
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    if ((spec.startsWith("./") || spec.startsWith("../")) && !/\.[a-z]+$/i.test(spec)) return next(`${spec}.ts`, ctx);
    return next(spec, ctx);
  },
});

const assert = (await import("node:assert/strict")).default;
const { contactEmailFacts, contactEmailPrompt } = await import("../lib/crm-prompt.ts");
const {
  ASSISTANT_SYSTEM,
  EMAIL_MAX_TOKENS,
  EMAIL_SYSTEM,
  OUTREACH_OPENING,
  classifyAsk,
  clip,
  composeUserPrompt,
  mockOutreachEmail,
  parseEmailJson,
  stripEmDash,
} = await import("../lib/ai/copy.ts");

assert.equal(EMAIL_MAX_TOKENS, 800);
assert.ok(EMAIL_SYSTEM.includes(OUTREACH_OPENING));
assert.ok(EMAIL_SYSTEM.includes("Lei"));
assert.ok(EMAIL_SYSTEM.includes("14 prenotazioni"));
assert.ok(EMAIL_SYSTEM.includes("11.947 euro"));
assert.ok(EMAIL_SYSTEM.includes("CTRL®"));
assert.equal(EMAIL_SYSTEM.includes("\u2014"), false);
assert.equal(ASSISTANT_SYSTEM.includes("\u2014"), false);
assert.ok(ASSISTANT_SYSTEM.includes("solo"));
console.log("ok system prompts");

const card = { businessName: "Trattoria de la Trebia" };
const prompt = contactEmailPrompt(card);
const facts = contactEmailFacts(card);
assert.ok(prompt.endsWith(facts));
assert.ok(facts.startsWith("Attività: Trattoria de la Trebia"));
console.log("ok facts stay the copy-prompt block");

const dossier = composeUserPrompt({
  facts,
  phase: "Fase del contatto: Contattato",
  deals: "Trattative aperte: nessuna",
  sent: "Email già inviate:\n- 2026-01-01 · Presentazione · Buongiorno",
});
assert.ok(dossier.includes("Trattoria de la Trebia"));
assert.ok(dossier.includes("Fase del contatto: Contattato"));
assert.ok(dossier.includes("Presentazione"));
assert.equal(dossier.includes("\u2014"), false);
const huge = composeUserPrompt({ facts: "x".repeat(4000), phase: "Fase", deals: "nessuna", sent: "nessuna" });
assert.ok(huge.length <= 2800);
assert.ok(huge.endsWith("…"));
console.log("ok compact dossier");

assert.equal(stripEmDash("Ciao \u2014 mondo"), "Ciao, mondo");
assert.equal(stripEmDash("Ciao  --  mondo"), "Ciao, mondo");
assert.equal(stripEmDash("prezzo 9\u2014 12"), "prezzo 9, 12");
assert.equal(clip("a   b   c", 20), "a b c");
assert.equal(clip("abcdef", 4), "abc…");
console.log("ok em dash and clip");

const parsed = parseEmailJson('nota {"subject":"Oggetto \u2014 sito","body":"Testo \u2014 qui"} grazie');
assert.ok(parsed);
assert.equal(stripEmDash(parsed.subject), "Oggetto, sito");
assert.equal(stripEmDash(parsed.body), "Testo, qui");
assert.deepEqual(parseEmailJson("Oggetto: Ciao\nMessaggio: Corpo della mail"), { subject: "Ciao", body: "Corpo della mail" });
assert.equal(parseEmailJson("niente"), null);
console.log("ok json parse");

const clean = mockOutreachEmail("Fratelli Savigliano (QA)", []);
assert.ok(clean.body.includes(OUTREACH_OPENING));
assert.ok(clean.body.includes("14 prenotazioni"));
assert.ok(clean.body.endsWith("CTRL®"));
assert.equal(/\btu\b/i.test(clean.body), false);
assert.equal(clean.body.includes("lento"), false);
assert.equal(clean.body.includes("\u2014"), false);
const withIssue = mockOutreachEmail("Cantina", ["Sito lento su mobile"]);
assert.ok(withIssue.body.includes("Sito lento su mobile"));
console.log("ok mock email does not invent flaws");

assert.equal(classifyAsk("Che tempo fa domani a Milano?"), "offtopic");
assert.equal(classifyAsk("ciao"), "offtopic");
assert.equal(classifyAsk("Quante trattative per fase?"), "crm");
assert.equal(classifyAsk("Cosa c'è da fare oggi?"), "crm");
assert.equal(classifyAsk("Hotel Belvedere"), "unclear");
console.log("ok off-topic gate");

console.log("ai copy: all checks passed");
