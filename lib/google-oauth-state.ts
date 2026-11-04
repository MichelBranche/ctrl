import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

/** OAuth state + PKCE verifier in a short-lived signed httpOnly cookie, bound to the founder who started the flow. */
export const STATE_COOKIE = "ctrl_google_oauth";
const AUD = "ctrl-google-oauth";
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export async function newOAuthState(userId: string) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const cookie = await new SignJWT({ state, verifier }).setSubject(userId).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").setAudience(AUD).sign(key());
  return { state, challenge, cookie };
}

export async function readOAuthState(cookie: string | undefined, state: string | null, userId: string): Promise<string | null> {
  if (!cookie || !state) return null;
  try {
    const { payload } = await jwtVerify(cookie, key(), { algorithms: ["HS256"], audience: AUD });
    return payload.sub === userId && payload.state === state && typeof payload.verifier === "string" ? payload.verifier : null;
  } catch {
    return null;
  }
}
