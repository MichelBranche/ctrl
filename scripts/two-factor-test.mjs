/*
 * 2FA self-test, no network and no real secrets (uses a throwaway SESSION_SECRET and a temp SQLite file):
 *   node scripts/two-factor-test.mjs
 * Checks RFC 6238 Appendix B vectors (SHA1/256/512), ±1 step window and replay refusal, AES-GCM roundtrip and
 * tamper detection, and the real DB flow: setup confirm, recovery codes single use, code reuse refused.
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ctrl-2fa-"));
process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "t.db")).href;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SESSION_SECRET = "test-only-session-secret-0123456789abcdef";
const root = pathToFileURL(process.cwd() + "/").href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec.startsWith("@/")) return next(new URL(spec.slice(2) + ".ts", root).href, ctx);
    return next(spec, ctx);
  },
});

const t = await import("../lib/totp-core.ts");

// RFC 6238 Appendix B (8 digits).
const seeds = { sha1: "12345678901234567890", sha256: "12345678901234567890123456789012", sha512: "1234567890123456789012345678901234567890123456789012345678901234" };
const vectors = [
  [59, "94287082", "46119246", "90693936"], [1111111109, "07081804", "68084774", "25091201"],
  [1111111111, "14050471", "67062674", "99943326"], [1234567890, "89005924", "91819424", "93441116"],
  [2000000000, "69279037", "90698825", "38618901"], [20000000000, "65353130", "77737706", "47863826"],
];
for (const [sec, a, b, c] of vectors) {
  assert.equal(t.totp(Buffer.from(seeds.sha1), sec * 1000, 8, "sha1"), a, `sha1 @${sec}`);
  assert.equal(t.totp(Buffer.from(seeds.sha256), sec * 1000, 8, "sha256"), b, `sha256 @${sec}`);
  assert.equal(t.totp(Buffer.from(seeds.sha512), sec * 1000, 8, "sha512"), c, `sha512 @${sec}`);
}
// RFC 4226 Appendix D (HOTP, 6 digits).
["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"]
  .forEach((want, i) => assert.equal(t.hotp(Buffer.from(seeds.sha1), i), want, `hotp ${i}`));

// Base32 roundtrip (RFC 4648 vector) and window/replay.
assert.equal(t.base32Encode(Buffer.from("foobar")), "MZXW6YTBOI");
const key = t.newSecret();
assert.deepEqual(t.base32Decode(t.base32Encode(key)), key);
const now = 1_800_000_000_000, step = t.stepAt(now);
assert.equal(t.verifyTotp(key, t.hotp(key, step), now, 0), step);
assert.equal(t.verifyTotp(key, t.hotp(key, step - 1), now, 0), step - 1, "-1 step accepted");
assert.equal(t.verifyTotp(key, t.hotp(key, step + 1), now, 0), step + 1, "+1 step accepted");
assert.equal(t.verifyTotp(key, t.hotp(key, step - 2), now, 0), null, "-2 steps refused");
assert.equal(t.verifyTotp(key, t.hotp(key, step), now, step), null, "same step refused (replay)");
assert.equal(t.verifyTotp(key, "12345", now, 0), null);

// AES-256-GCM roundtrip, wrong AAD and tampering rejected, distinct HKDF labels.
const k = t.deriveKey(process.env.SESSION_SECRET, "ctrl-totp-v1");
assert.notDeepEqual(k, t.deriveKey(process.env.SESSION_SECRET, "ctrl-2fa-recovery-v1"));
const blob = t.encryptSecret(k, key, "admin_2fa:u1");
assert.ok(!blob.includes(t.base32Encode(key)));
assert.deepEqual(t.decryptSecret(k, blob, "admin_2fa:u1"), key);
assert.throws(() => t.decryptSecret(k, blob, "admin_2fa:u2"), "aad bound to user");
const parts = blob.split("."); parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
assert.throws(() => t.decryptSecret(k, parts.join("."), "admin_2fa:u1"), "tamper detected");

// Real DB flow through lib/two-factor.ts on a temp SQLite file.
const { db } = await import("../lib/db.ts");
const { ensureTeamSchema } = await import("../lib/migrate.ts");
await ensureTeamSchema();
await db().execute("INSERT INTO admin_users (id, email, name, password_hash) VALUES ('u1', 'a@example.test', 'A', 'x')");
const tf = await import("../lib/two-factor.ts");
const setup = await tf.beginSetup("u1", "a@example.test");
assert.ok(setup.qrSvg.startsWith("<svg") && !/https?:\/\/(?!www\.w3\.org)/.test(setup.qrSvg), "local SVG QR, no remote URL");
const secret = t.base32Decode(setup.secret);
assert.equal((await tf.twoFactorStatus("u1")).enabled, false, "not active before confirm");
assert.equal(await tf.confirmSetup("u1", "000000" === t.totp(secret, Date.now()) ? "111111" : "000000"), null, "wrong code does not activate");
const codes = await tf.confirmSetup("u1", t.totp(secret, Date.now()));
assert.equal(codes?.length, 10);
const row = (await db().execute("SELECT secret_enc FROM admin_2fa WHERE user_id = 'u1'")).rows[0];
assert.ok(String(row.secret_enc).startsWith("v1.") && !String(row.secret_enc).includes(t.base32Encode(secret)), "secret encrypted at rest");
const stored = (await db().execute("SELECT code_hash FROM admin_2fa_recovery")).rows.map((r) => String(r.code_hash));
assert.ok(codes.every((c) => !stored.includes(c) && !stored.some((h) => h.includes(t.normalizeRecovery(c)))), "only hashes stored");
assert.equal(await tf.checkSecondFactor("u1", t.totp(secret, Date.now())), null, "setup code cannot be reused at login");
const next = t.hotp(secret, t.stepAt(Date.now()) + 1);
assert.equal(await tf.checkSecondFactor("u1", next), "totp");
assert.equal(await tf.checkSecondFactor("u1", next), null, "login code cannot be reused");
assert.equal(await tf.checkSecondFactor("u1", codes[0].toLowerCase()), "recovery", "recovery code works (case-insensitive)");
assert.equal(await tf.checkSecondFactor("u1", codes[0]), null, "recovery code single use");
assert.equal(await tf.checkSecondFactor("u1", "ZZZZ-ZZZZ-ZZZZ"), null);
assert.equal((await tf.twoFactorStatus("u1")).recoveryLeft, 9);
await tf.removeTwoFactor("u1");
assert.equal((await tf.twoFactorStatus("u1")).enabled, false);
assert.equal(await tf.checkSecondFactor("u1", codes[1]), null, "codes gone after disable");
db().close();
rmSync(dir, { recursive: true, force: true });
console.log("2FA tests ok: RFC 6238/4226 vectors, window, replay, AES-GCM, recovery single use");
