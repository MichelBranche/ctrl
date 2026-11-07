/*
 * HTTP check of the contact email view on a local production build (next start) with the CRM fixture DB and the mock
 * mailbox (AGENCY_MAIL_MOCK=1). Reads pages only: it never posts a form or a server action, so nothing is sent.
 *   BASE=http://127.0.0.1:3217 TOKENS=/tmp/ctrl-contact-email-qa/tokens.json node scripts/contact-email-http-test.mjs
 * TOKENS: {"founder": "...", "vendite": "...", "commerciale": "...", "posta": "..."} from scripts/crm-visual-fixture.mjs.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE)) throw new Error("BASE must be a local http://127.0.0.1:<port> server.");
const tokens = JSON.parse(readFileSync(process.env.TOKENS ?? "", "utf8"));
const SAV = "00000000-0000-4000-8000-000000000200", NOMAIL = "00000000-0000-4000-8000-000000000201";
const OURS = ["Presentazione CTRL®", "Re: Presentazione CTRL®", "Informazioni", "Re: Informazioni"];
const DECOYS = ["Listino Fratelli Savigliano", "Offerta per info@fratellisavigliano.example", "Copia finita in Spam"];
const key = (id) => createHash("sha256").update(id).digest("hex").slice(0, 32);
const page = async (path, who) => {
  const res = await fetch(BASE + path, { redirect: "manual", headers: who ? { cookie: `ctrl_admin=${tokens[who]}` } : {} });
  return { status: res.status, location: res.headers.get("location"), html: res.status === 200 ? await res.text() : "" };
};
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<!--[\s\S]*?-->/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const decode = (s) => s.replace(/&amp;/g, "&");
const mailPath = (q = "") => `/admin/crm/${SAV}/email${q}`;

let pres;
// 1. Founder (CRM + Email): exactly the contact's mail, newest first; decoys and Spam never listed.
{
  const r = await page(mailPath("?da=q%3DSavigliano%26p%3D1%26ordina%3Dnome%26dir%3Dasc"), "founder");
  assert.equal(r.status, 200);
  const t = text(r.html);
  for (const s of OURS) assert.ok(t.includes(`>${s}<`), `listed: ${s}`);
  for (const s of DECOYS) assert.ok(!t.includes(s), `not listed: ${s}`);
  assert.ok(t.includes("info@fratellisavigliano.example"), "matched address shown");
  assert.ok(decode(r.html).includes(`href="/admin/crm/rubrica?q=Savigliano&ordina=nome&dir=asc&c=${SAV}"`), "back keeps filters/sort and the contact");
  assert.ok(decode(r.html).includes(`href="/admin/crm/rubrica?q=Savigliano&ordina=nome&dir=asc&c=${SAV}&tab=note"`), "Note tab back to the panel");
  assert.ok(!r.html.includes("10 MB"), "no invented limits");
  const links = [...decode(r.html).matchAll(/href="(\/admin\/crm\/[^"]+\/email\?[^"]*m=(\d+)&k=([a-f0-9]{32})[^"]*)"/g)].map((m) => ({ href: m[1], uid: Number(m[2]), k: m[3] }));
  assert.equal(new Set(links.map((l) => l.uid)).size, 4, "4 openable messages");
  console.log("ok founder list (exact matches only, safe back link)");

  // 2. Open the received HTML message: sanitized, remote image blocked, reply available.
  pres = links.find((l) => l.k === key("<sav-2@fratellisavigliano.example>"));
  const open = await page(pres.href, "founder");
  assert.equal(open.status, 200);
  assert.ok(open.html.includes("1 immagine remota bloccata"), "remote image blocked");
  const srcdoc = /srcDoc="([^"]*)"|srcdoc="([^"]*)"/i.exec(open.html);
  assert.ok(srcdoc, "body in a sandboxed iframe");
  assert.ok(!/<script|onclick|alert\(1\)/i.test(srcdoc[1] ?? srcdoc[2]), "no script or handlers in the body");
  assert.ok(/sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"/.test(open.html), "same sandbox as Posta");
  const reply = await page(`${pres.href}&compose=reply`, "founder");
  assert.ok(reply.html.includes('name="replyUid" value="' + pres.uid + '"') && reply.html.includes('name="replyFolder" value="all"'), "reply threads from All Mail");
  const to = /<input[^>]*name="to"[^>]*value="([^"]*)"/.exec(reply.html)?.[1] ?? "";
  assert.match(to, /&lt;info@fratellisavigliano\.example&gt;$/i, "reply goes to the contact (its Reply-To/From)");
  assert.ok(text(reply.html).includes("3 MB complessivi"), "real attachment limit");
  console.log("ok open + sanitize + reply");

  // 3. Wrong key, unrelated message, malformed parameters: honest messages, no body.
  const wrong = await page(mailPath(`?m=${pres.uid}&k=${"0".repeat(32)}`), "founder");
  assert.ok(text(wrong.html).includes("Email non più disponibile"), "uid with another key is not opened");
  // A real message of another address (same domain), found through Posta's own search: its uid and key are valid.
  const posta = decode((await page(`/admin/email?f=all&search=${encodeURIComponent("Listino Fratelli")}`, "founder")).html);
  const decoyUid = Number(/href="\/admin\/email\?search=[^"]*&f=all&m=(\d+)"/.exec(posta)?.[1]);
  assert.ok(decoyUid > 0, "decoy found in Posta");
  const decoy = await page(mailPath(`?m=${decoyUid}&k=${key("<decoy-1@fratellisavigliano.example>")}`), "founder");
  assert.ok(text(decoy.html).includes("Questa email non riguarda info@fratellisavigliano.example"), "a valid message of another address is refused");
  assert.ok(!text(decoy.html).includes("Listino prezzi"), "and its body is not rendered");
  const junk = await page(mailPath("?m=abc&k=zz&compose=forward&vista=spam&da=%2F%2Fevil.example"), "founder");
  assert.equal(junk.status, 200);
  // (Next echoes the requested URL in its router payload; what matters is that no link or redirect uses it.)
  assert.ok(!/(href|action|content)="[^"]*evil\.example/.test(junk.html), "foreign return URL dropped from every link");
  assert.ok(decode(junk.html).includes(`href="/admin/crm/rubrica?c=${SAV}"`), "back falls back to the plain Rubrica");
  assert.ok(text(junk.html).includes("Seleziona un'email"), "malformed params fall back to the list");
  const nolink = await page(mailPath(`?m=${pres.uid}`), "founder");
  assert.ok(text(nolink.html).includes("Link non valido"), "uid without key");
  console.log("ok malformed / unrelated / stale links");

  // 4. Filters and composer.
  const sent = text((await page(mailPath("?vista=inviate"), "founder")).html);
  assert.ok(sent.includes(">Re: Informazioni<") && sent.includes(">Presentazione CTRL®<") && !sent.includes(">Informazioni<") && !sent.includes(">Re: Presentazione CTRL®<"), "Inviate only");
  const compose = await page(mailPath("?compose=new"), "founder");
  const ct = text(compose.html);
  assert.ok(ct.includes("Nuova email a Fratelli Savigliano (QA)"));
  assert.ok(/value="info@fratellisavigliano.example"/.test(compose.html), "recipient prefilled (normalized)");
  assert.ok(ct.includes("agenzia@example.test"), "agency sender, read-only text");
  assert.ok(ct.includes("Salva bozza") && ct.includes("Anteprima") && ct.includes("**grassetto**"), "existing markdown composer, manual draft, preview");
  console.log("ok filters + composer");
}

// 5. Contact without email; unknown or malformed contact ids.
{
  const r = await page(`/admin/crm/${NOMAIL}/email`, "founder");
  assert.ok(text(r.html).includes("Questo contatto non ha un indirizzo email"));
  const missing = await page("/admin/crm/00000000-0000-4000-8000-00000000dead/email", "founder");
  assert.ok(missing.status === 404 || /not.?found|404/i.test(missing.html), "unknown contact: not found");
  const bad = await page("/admin/crm/..%2F..%2Fadmin/email", "founder");
  assert.ok(bad.status === 404 || bad.status === 400 || /404/.test(bad.html), "malformed id: not found");
  console.log("ok no-email and unknown contacts");
}

// 6. Permissions: no leak without Email, without CRM, or without a session.
{
  const noMail = await page(mailPath(), "commerciale");
  assert.equal(noMail.status, 200);
  assert.ok(text(noMail.html).includes("Non hai accesso alla posta"));
  for (const s of [...OURS, "info@fratellisavigliano.example", "Nuova email"]) assert.ok(!text(noMail.html).includes(s), `CRM without Email sees no ${s}`);
  const reply = await page(`${mailPath()}?m=${pres.uid}&k=${pres.k}`, "commerciale");
  assert.ok(!text(reply.html).includes("Interessante"), "no body without Email");
  const noCrm = await page(mailPath(), "posta");
  assert.ok(!OURS.some((s) => text(noCrm.html).includes(s)), "Email without CRM sees nothing");
  assert.ok(noCrm.status === 307 || noCrm.status === 303 || /negato=1/.test(noCrm.html + (noCrm.location ?? "")), "and is sent away");
  const anon = await page(mailPath());
  assert.ok(!OURS.some((s) => text(anon.html).includes(s)), "no session sees nothing");
  const both = await page(mailPath(), "vendite");
  assert.ok(OURS.every((s) => text(both.html).includes(`>${s}<`)), "commerciale with Email sees the contact's mail");
  console.log("ok permissions (CRM+Email server-side)");
}

// 7. Rubrica panel opens the contextual view with this list as its back.
{
  const r = decode((await page(`/admin/crm/rubrica?q=Savigliano&c=${SAV}`, "founder")).html);
  assert.ok(r.includes(`href="/admin/crm/${SAV}/email?da=q%3DSavigliano&compose=new"`), "panel Email → contextual composer");
  assert.ok(r.includes(`href="/admin/crm/${SAV}/email?da=q%3DSavigliano"`), "Email collegate → contextual list");
  const noMail = decode((await page(`/admin/crm/rubrica?q=Savigliano&c=${SAV}`, "commerciale")).html);
  assert.ok(!noMail.includes(`/admin/crm/${SAV}/email`), "no email link without Email");
  console.log("ok rubrica panel links");
}
// 8. Provider failure (second harness instance with AGENCY_MAIL_MOCK_FAIL=contact): honest error, no list, no crash.
if (process.env.ERR_BASE) {
  const res = await fetch(process.env.ERR_BASE + mailPath(), { redirect: "manual", headers: { cookie: `ctrl_admin=${tokens.founder}` } });
  assert.equal(res.status, 200);
  const t = text(await res.text());
  assert.ok(t.includes("Impossibile raggiungere Gmail in questo momento."), "error message shown");
  for (const s of OURS) assert.ok(!t.includes(`>${s}<`), "no stale list on error");
  assert.ok(t.includes("Nuova email"), "composer still reachable");
  console.log("ok provider error state");
}
console.log("contact email http checks passed");
