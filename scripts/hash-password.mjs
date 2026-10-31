// Prints an scrypt hash of $ADMIN_PASSWORD for the ADMIN_PASSWORD_HASH env var.
// The password is read from the environment and never written out.
import { randomBytes, scryptSync } from "node:crypto";

const password = process.env.ADMIN_PASSWORD ?? "";
if (password.length < 12) {
  console.error("ADMIN_PASSWORD must be set and at least 12 characters long.");
  process.exit(1);
}
const N = 32768, r = 8, p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
process.stdout.write(`scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}`);
