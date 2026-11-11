/*
 * TOTP (RFC 6238 / RFC 4226) and the at-rest crypto for 2FA, on node:crypto only. Pure: no DB, no env,
 * so scripts/two-factor-test.mjs can check it against the RFC test vectors.
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

export const STEP_SECONDS = 30;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("base32");
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newSecret = () => randomBytes(20); // 160 bit, as RFC 4226 recommends

export function hotp(secret: Buffer, counter: number, digits = 6, algo: "sha1" | "sha256" | "sha512" = "sha1"): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algo, secret).update(msg).digest();
  const off = mac[mac.length - 1] & 15;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const stepAt = (ms: number) => Math.floor(ms / 1000 / STEP_SECONDS);
export const totp = (secret: Buffer, ms: number, digits = 6, algo: "sha1" | "sha256" | "sha512" = "sha1") => hotp(secret, stepAt(ms), digits, algo);

/**
 * Accepts the current step and one step either side (clock drift). Returns the matched step, or null.
 * Steps <= lastStep are rejected so a code (or an older one) can never be replayed. Every candidate is compared
 * in constant time and all of them are always checked.
 */
export function verifyTotp(secret: Buffer, code: string, ms: number, lastStep: number): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = stepAt(ms);
  let hit: number | null = null;
  for (const s of [now - 1, now, now + 1]) {
    const ok = timingSafeEqual(Buffer.from(hotp(secret, s)), Buffer.from(c));
    if (ok && s > lastStep && hit === null) hit = s;
  }
  return hit;
}

export const otpauthUri = (secretB32: string, account: string, issuer = "CTRL Admin") =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;

/** 32-byte key for a purpose, from the master secret. Distinct info labels keep TOTP and recovery keys independent of the backup key. */
export const deriveKey = (master: string, info: string) =>
  Buffer.from(hkdfSync("sha256", Buffer.from(master, "utf8"), Buffer.from("ctrl-2fa-salt-v1"), info, 32));

/** AES-256-GCM: v1.iv.tag.ciphertext (base64url). AAD binds the ciphertext to its user, so rows cannot be swapped. */
export function encryptSecret(key: Buffer, plain: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(key: Buffer, blob: string, aad: string): Buffer {
  const [v, iv, tag, ct] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("format");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]);
}

/** Ten codes like "K7Q2-M9XD-4TRP" (60 bit each, no 0/O/1/I confusion). */
export function newRecoveryCodes(n = 10): string[] {
  const A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: n }, () => {
    const b = randomBytes(12);
    const s = Array.from(b, (x) => A[x & 31]).join("");
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
  });
}

export const normalizeRecovery = (code: string) => code.toUpperCase().replace(/[^0-9A-Z]/g, "");

/** HMAC with a SESSION_SECRET-derived key, bound to the user: a leaked DB alone cannot be brute-forced offline. */
export const hashRecovery = (key: Buffer, userId: string, code: string) =>
  createHmac("sha256", key).update(`${userId}\n${normalizeRecovery(code)}`).digest("base64url");

export const sameHash = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
