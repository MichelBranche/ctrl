/*
 * Seeds a throwaway SQLite DB for visual QA of the CRM (no network, no real accounts or credentials):
 *   TURSO_DATABASE_URL=file:/tmp/crm-qa/qa.db SESSION_SECRET=<32+ random chars> node scripts/crm-visual-fixture.mjs [founder|commerciale|pm|posta|vendite|empty]
 * Prints a ctrl_admin cookie value for a fake founder (with a placeholder 2FA row), a fake commerciale without the
 * Email permission, a project manager without crm (Riunioni only), a designer with Email but without crm ("posta"), a commerciale with
 * both CRM and Email ("vendite"), or a founder on an empty CRM. Refuses any URL that is not a local file under the temp dir.
 * Contact email QA (with AGENCY_MAIL_MOCK=1): "Fratelli Savigliano (QA)" matches the mock mailbox by exact address only
 * (its stored email has mixed case and spaces), "Cantina senza email (QA)" has none.
 * Rubrica QA: 30+ contacts (pager), Iris reasons, and a former team member ("Marco Ex", removed) still owning a contact.
 * Every contact is fictional (example.test addresses, 0000 phone numbers).
 */
import { registerHooks } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!url.startsWith("file:") || !fileURLToPath(url).startsWith(tmpdir())) throw new Error("Fixture only on a local file DB under the temp dir.");
if ((process.env.SESSION_SECRET ?? "").length < 32) throw new Error("SESSION_SECRET (test value, 32+ chars) required.");
delete process.env.TURSO_AUTH_TOKEN;
const who = process.argv[2] ?? "founder";
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

const { db } = await import("../lib/db.ts");
const M = await import("../lib/migrate.ts");
const { SignJWT } = await import("jose");
if (!(await db().execute("SELECT 1 FROM sqlite_master WHERE name = 'admin_users'")).rows.length) {
  for (const f of readdirSync("db").filter((f) => f.endsWith(".sql")).sort()) await db().executeMultiple(readFileSync(join("db", f), "utf8"));
  // db/006_email.sql only documents email_send_log; the app uses the runtime table (with a created_at default).
  await db().execute("DROP TABLE IF EXISTS email_send_log");
}
await Promise.all([M.ensureTeamSchema(), M.ensureEmailSchema(), M.ensureAuditSchema(), M.ensureTwoFactorSchema(), M.ensureCrmSchema(), M.ensureClientMeetSchema(), M.ensureDeskSchema()]);

const run = (sql, args = []) => db().execute({ sql, args });
const addUser = async (id, name, roles, emailAccess) => {
  await run("INSERT OR IGNORE INTO admin_users (id, email, name, password_hash, role, active, email_access) VALUES (?, ?, ?, '!', ?, 1, ?)",
    [id, `${id}@example.test`, name, roles.includes("founder") ? "founder" : "member", emailAccess ? 1 : 0]);
  for (const r of roles) await run("INSERT OR IGNORE INTO admin_user_roles (user_id, role) VALUES (?, ?)", [id, r]);
};
await addUser("qa-michel", "Michel Branche", ["founder"], true);
await run("INSERT OR IGNORE INTO admin_2fa (user_id, secret_enc, last_step, enabled_at) VALUES ('qa-michel', 'fixture-not-a-secret', 0, '2026-01-01T00:00:00Z')");
await addUser("qa-giulia", "Giulia Rossi", ["commerciale"], false);
await addUser("qa-pm", "Paolo Riunioni", ["project_manager"], false);
await addUser("qa-ex", "Marco Ex", ["commerciale"], false);
await addUser("qa-posta", "Dario Posta", ["designer"], true);
await addUser("qa-vendite", "Vera Vendite", ["commerciale"], true);
await run("UPDATE admin_users SET active = 0, removed_at = '2026-10-01T09:00:00Z' WHERE id = 'qa-ex'");

const rome = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const day = (n) => rome(new Date(Date.now() + n * 86_400_000));
const ago = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

if (who !== "empty" && !(await run("SELECT 1 FROM crm_contacts LIMIT 1")).rows.length) {
  const contacts = [
    ["00000000-0000-4000-8000-000000000001", "Ottica Bianchi", "Ottica", "Laura Bianchi", "Torino", "radar", 86, "preventivo", 4800, "Inviare preventivo rivisto", day(0), "qa-michel", 30],
    ["00000000-0000-4000-8000-000000000002", "Studio Legale Ferri", "Studio legale", "Avv. Paolo Ferri", "Milano", "sito", 78, "call", 3500, "Call di approfondimento", day(0), "qa-michel", 200],
    ["00000000-0000-4000-8000-000000000003", "Pizzeria Da Mario", "Ristorazione", "Mario Esposito", "Napoli", "manuale", 64, "contattato", null, "Richiamare per feedback", day(-2), "qa-michel", 400],
    ["00000000-0000-4000-8000-000000000004", "Hotel Belvedere", "Hotel", "Sara Conti", "Alba", "radar", 91, "nuovo", null, "Primo contatto", day(1), "qa-michel", 5],
    ["00000000-0000-4000-8000-000000000005", "Palestra Kinetic", "Fitness", "Luca Moretti", "Bologna", "manuale", 55, "call", 2200, "Preparare proposta", day(1), "qa-giulia", 120],
    ["00000000-0000-4000-8000-000000000006", "Cantina Roero", "Vino", "Elena Gallo", "Canale", "manuale", null, "vinto", 6200, null, null, "qa-michel", 900],
    ["00000000-0000-4000-8000-000000000007", "Studio Dentistico Riva", "Medicale", "Dott. Riva", "Asti", "sito", null, "vinto", 3900, null, null, "qa-giulia", 1300],
    ["00000000-0000-4000-8000-000000000008", "Bar Centrale", "Bar", null, "Cuneo", "manuale", null, "perso", null, null, null, "qa-giulia", 1500],
    ["00000000-0000-4000-8000-000000000009", "Anna Neri", null, "Anna Neri", null, "sito", null, "nuovo", null, null, null, null, 3],
    ["00000000-0000-4000-8000-000000000010", "Forno Artigiano Gilli", "Panificio", null, "Bra", "radar", 72, "nuovo", null, null, null, null, 8],
  ];
  for (const [id, name, type, person, city, source, score, stage, value, action, at, owner, hoursAgo] of contacts) {
    await run(`INSERT INTO crm_contacts (id, business_name, type, contact_name, email, city, source, score, stage, value_eur, next_action, next_action_at, owner_user_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, type, person, `${name.toLowerCase().replace(/[^a-z]+/g, "")}@example.test`, city, source, score, stage, value, action, at, owner, owner, ago(hoursAgo), ago(hoursAgo)]);
  }
  const events = [
    ["crm.stage", "crm_contact", "00000000-0000-4000-8000-000000000001", { from: "call", to: "preventivo" }, 1],
    ["crm.contact_create", "crm_contact", "00000000-0000-4000-8000-000000000004", {}, 5],
    ["crm.ingest", "crm", null, { inserted: 2, duplicates: 1, via: "radar" }, 8],
    ["crm.note", "crm_contact", "00000000-0000-4000-8000-000000000002", {}, 26],
    ["crm.followup_done", "crm_contact", "00000000-0000-4000-8000-000000000003", {}, 50],
  ];
  for (const [action, type, id, details, h] of events) {
    await run("INSERT INTO audit_log (user_id, user_name, user_email, action, target_type, target_id, details, created_at) VALUES ('qa-michel', 'Michel Branche', 'qa-michel@example.test', ?, ?, ?, ?, ?)",
      [action, type, id, JSON.stringify(details), ago(h)]);
  }
  await run("INSERT INTO crm_drafts (id, contact_id, subject, body_text) VALUES ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000004', 'Il sito di Hotel Belvedere', 'Buongiorno, abbiamo notato che...')");

  // Rubrica: Langhe wineries from the Radar (fictional), enough for two pages.
  const towns = [["Diano d'Alba", "Piemonte"], ["Barbaresco", "Piemonte"], ["Treiso", "Piemonte"], ["Neive", "Piemonte"], ["La Morra", "Piemonte"], ["Barolo", "Piemonte"]];
  const names = ["Cantina Valmora", "La Ca' Nova (QA)", "Cascina Morassino (QA)", "Giordano Pajè (QA)", "Cascina Roccalini (QA)", "Le Rocche dei Barbari (QA)", "Rosanna Sandri (QA)",
    "Cascina Luisin (QA)", "Cantina del Pino (QA)", "Tenuta Belcolle (QA)", "Poderi Aldo (QA)", "Cascina Fontana (QA)", "Vigna Rionda (QA)", "Cantina Bricco (QA)", "Ca' del Baio (QA)",
    "Tenuta Montanello (QA)", "Cascina Adelaide (QA)", "Borgogno Fratelli (QA)", "Cantina Gigi (QA)", "Bricco Maiolica (QA)", "Cascina Chicco (QA)", "Poderi Colla (QA)"];
  const reasons = [["Funzionale ma grezzo/datato."], ["Sito lento su mobile", "Nessun modulo contatti"], ["Ottime recensioni, sito assente"], ["Sito non sicuro (http)"]];
  for (const [i, name] of names.entries()) {
    const [city, region] = towns[i % towns.length];
    const id = `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`;
    const slug = name.toLowerCase().replace(/\(qa\)/, "").replace(/[^a-z]+/g, "");
    await run(`INSERT INTO crm_contacts (id, business_name, type, email, phone, website, address, city, region, source, score, score_reasons, stage, next_action, next_action_at, owner_user_id, created_at, updated_at)
      VALUES (?, ?, 'Cantina', ?, ?, ?, ?, ?, ?, 'radar', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, `${slug}@example.test`, i % 3 === 2 ? null : `+39 0173 0000${String(i).padStart(2, "0")}`, i % 4 === 3 ? null : `https://www.${slug}.example.test/`, i === 0 ? "Via Fixture 1" : null,
        city, region, [45, 60, 60, 60, 60, 65, 20, 20, 20][i] ?? 30 + ((i * 7) % 50), JSON.stringify(reasons[i % reasons.length]), i < 6 ? "contattato" : "nuovo",
        i === 0 ? "Ricontattare" : i === 1 ? "In attesa di risposta" : i === 4 ? "Richiamare" : null, i === 0 ? day(0) : i === 1 ? day(-4) : i === 4 ? day(1) : i === 7 ? day(3) : null,
        i === 2 ? "qa-ex" : i % 5 === 1 ? "qa-giulia" : null, ago(20 + i), ago(10 + i)]);
  }
  for (const [action, details, h] of [["crm.contact_create", {}, 72], ["crm.stage", { from: "nuovo", to: "contattato" }, 30], ["crm.followup_set", { at: day(0) }, 6]]) {
    await run("INSERT INTO audit_log (user_id, user_name, user_email, action, target_type, target_id, details, created_at) VALUES ('qa-michel', 'Michel Branche', 'qa-michel@example.test', ?, 'crm_contact', '00000000-0000-4000-8000-000000000100', ?, ?)",
      [action, JSON.stringify(details), ago(h)]);
  }
  await run(`INSERT INTO crm_contacts (id, business_name, type, email, city, region, source, score, stage, owner_user_id, created_at, updated_at)
    VALUES ('00000000-0000-4000-8000-000000000200', 'Fratelli Savigliano (QA)', 'Cantina', '  Info@FratelliSavigliano.example ', 'Diano d''Alba', 'CN', 'radar', 45, 'contattato', 'qa-michel', ?, ?)`, [ago(700), ago(1)]);
  await run(`INSERT INTO crm_contacts (id, business_name, type, email, city, source, stage, created_at, updated_at)
    VALUES ('00000000-0000-4000-8000-000000000201', 'Cantina senza email (QA)', 'Cantina', NULL, 'Neive', 'manuale', 'nuovo', ?, ?)`, [ago(90), ago(2)]);
  // Radar QA: Iris drafts to review (one already sent) and a prospect Iris sent without score or reasons.
  for (const [did, cid, subject, status] of [["00000000-0000-4000-8000-0000000000d2", "106", "Il sito di Rosanna Sandri (QA)", "bozza"], ["00000000-0000-4000-8000-0000000000d3", "107", "Cascina Luisin online (QA)", "bozza"], ["00000000-0000-4000-8000-0000000000d4", "103", "Giordano Pajè: proposta (QA)", "inviata"]]) {
    await run("INSERT INTO crm_drafts (id, contact_id, subject, body_text, status, sent_at) VALUES (?, ?, ?, ?, ?, ?)",
      [did, `00000000-0000-4000-8000-000000000${cid}`, subject, "Buongiorno, abbiamo visto il vostro sito e avremmo qualche idea. (bozza fixture QA)", status, status === "inviata" ? ago(30) : null]);
  }
  await run(`INSERT INTO crm_contacts (id, business_name, type, city, region, source, stage, created_at, updated_at)
    VALUES ('00000000-0000-4000-8000-000000000202', 'Agriturismo senza punteggio (QA)', 'Agriturismo', 'Treiso', 'CN', 'radar', 'nuovo', ?, ?)`, [ago(3), ago(3)]);
  await run("INSERT INTO crm_notes (id, contact_id, user_id, body, created_at) VALUES ('n-qa-1', '00000000-0000-4000-8000-000000000100', 'qa-michel', 'Prima chiamata: interessati a rifare il sito prima della vendemmia. (dato fixture QA)', ?)", [ago(28)]);
}

const id = { commerciale: "qa-giulia", pm: "qa-pm", posta: "qa-posta", vendite: "qa-vendite" }[who] ?? "qa-michel";
const token = await new SignJWT({ sv: 1 }).setSubject(id).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .setAudience("ctrl-admin").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
process.stdout.write(token + "\n");
