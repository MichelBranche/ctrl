import { cookies } from "next/headers";
import { getAdmin } from "@/lib/admin";
import { authorizeUrl, googleConfigured } from "@/lib/google-meet";
import { newOAuthState, STATE_COOKIE } from "@/lib/google-oauth-state";
import { isFounder } from "@/lib/team-types";

/** Founder only: starts the one-time Google connection (top-level redirect to Google's consent page). */
export async function GET() {
  const me = await getAdmin();
  if (!me || !isFounder(me)) return new Response("Solo i founder possono collegare Google.", { status: 403 });
  if (!googleConfigured()) return new Response(null, { status: 303, headers: { Location: "/admin/riunioni?g=config" } });
  const { state, challenge, cookie } = await newOAuthState(me.id);
  (await cookies()).set(STATE_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/admin/riunioni", maxAge: 600 });
  return new Response(null, { status: 303, headers: { Location: authorizeUrl(state, challenge), "Cache-Control": "no-store" } });
}
