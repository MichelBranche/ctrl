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
  EMAIL_CLOSING,
  EMAIL_MAX_TOKENS,
  EMAIL_SYSTEM,
  EMAIL_TEMPERATURE,
  classifyAsk,
  clip,
  composeUserPrompt,
  mockOutreachEmail,
  parseEmailJson,
  polishOutreach,
  stripEmDash,
} = await import("../lib/ai/copy.ts");

const STOCK_OPENER = "il vostro sito poteva rappresentare un buon punto di partenza";
assert.equal(EMAIL_MAX_TOKENS, 800);
assert.equal(EMAIL_TEMPERATURE, 0.8);
assert.equal(EMAIL_CLOSING, "Cordiali saluti,");
assert.ok(EMAIL_SYSTEM.includes("Lei"));
assert.ok(EMAIL_SYSTEM.includes("accompagnarLa"));
assert.ok(EMAIL_SYSTEM.includes(EMAIL_CLOSING));
assert.ok(EMAIL_SYSTEM.includes(`Non aprire con «${STOCK_OPENER}»`));
assert.ok(EMAIL_SYSTEM.includes("non citare Le Vele come blocco standard"));
assert.ok(EMAIL_SYSTEM.includes("Non inventare"));
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
assert.ok(clean.body.startsWith("Gentile responsabile di Fratelli Savigliano (QA),"));
assert.ok(clean.body.includes("accompagnarLa"));
assert.ok(clean.body.includes("Suo"));
assert.ok(clean.body.endsWith(EMAIL_CLOSING));
assert.equal(clean.body.includes(STOCK_OPENER), false);
assert.equal(clean.body.includes("14 prenotazioni"), false);
assert.equal(clean.body.includes("CTRL"), false);
assert.equal(/\btu\b/i.test(clean.body), false);
assert.equal(clean.body.includes("lento"), false);
assert.equal(clean.body.includes("\u2014"), false);
const withIssue = mockOutreachEmail("Cantina", ["Sito lento su mobile"]);
assert.ok(withIssue.body.includes("Sito lento su mobile"));
assert.ok(withIssue.body.endsWith(EMAIL_CLOSING));
assert.equal(withIssue.subject.length <= 80, true);
console.log("ok mock email does not invent flaws");

const signed = polishOutreach(
  "Richieste di gruppo online per Capodoglio Murazzi",
  "Gentile responsabile di Capodoglio Murazzi,\n\nUna osservazione — concreta, presa dai dati.\n\nCordiali saluti,\n\nCTRL®\nMichel Branche",
);
assert.ok(signed);
assert.equal(signed.body.endsWith("Cordiali saluti,"), true);
assert.equal(signed.body.includes("CTRL"), false);
assert.equal(signed.body.includes("Michel"), false);
assert.equal(signed.body.includes("\u2014"), false);
assert.ok(signed.body.includes("Una osservazione, concreta"));
const bare = polishOutreach("Percorso per il locale", "Gentile responsabile,\n\n" + "x".repeat(90));
assert.ok(bare);
assert.ok(bare.body.endsWith("\n\nCordiali saluti,"));
assert.equal(polishOutreach("", "testo"), null);
assert.equal(polishOutreach("Oggetto", "troppo corto"), null);
console.log("ok closing is the last line");

assert.equal(classifyAsk("Che tempo fa domani a Milano?"), "offtopic");
assert.equal(classifyAsk("ciao"), "offtopic");
assert.equal(classifyAsk("Quante trattative per fase?"), "crm");
assert.equal(classifyAsk("Cosa c'è da fare oggi?"), "crm");
assert.equal(classifyAsk("Hotel Belvedere"), "unclear");
console.log("ok off-topic gate");

console.log("ai copy: all checks passed");
