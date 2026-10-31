import "server-only";
import { createClient, type Client } from "@libsql/client";

/** True when the Turso env vars are present. Without them the site still builds and the journal shows its empty state. */
export const dbConfigured = Boolean(process.env.TURSO_DATABASE_URL);

let client: Client | null = null;

export function db(): Client {
  if (!dbConfigured) throw new Error("TURSO_DATABASE_URL is not set");
  client ??= createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}
