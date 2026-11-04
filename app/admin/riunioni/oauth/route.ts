import { cookies } from "next/headers";
import { getAdmin } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { completeConnect, GoogleError } from "@/lib/google-meet";
import { readOAuthState, STATE_COOKIE } from "@/lib/google-oauth-state";
import { isFounder } from "@/lib/team-types";

const back = (q: string) => new Response(null, { status: 303, headers: { Location: `/admin/riunioni?g=${q}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

/** Google redirects here after consent. Checks the signed state (CSRF) and the founder, then stores the encrypted refresh token. */
export async function GET(request: Request) {
  const me = await getAdmin();
  if (!me || !isFounder(me)) return new Response("Solo i founder possono collegare Google.", { status: 403 });
  const url = new URL(request.url);
  const jar = await cookies();
  const verifier = await readOAuthState(jar.get(STATE_COOKIE)?.value, url.searchParams.get("state"), me.id);
  jar.delete({ name: STATE_COOKIE, path: "/admin/riunioni" });
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!verifier || !code) return back("state");
  try {
    await completeConnect(code, verifier, me.id);
  } catch (e) {
    await logAction("meet.google_connect_failed", undefined, { reason: e instanceof GoogleError ? e.message : "errore" });
    return back("error");
  }
  await logAction("meet.google_connected", undefined, { scope: "calendar.events" });
  return back("ok");
}
