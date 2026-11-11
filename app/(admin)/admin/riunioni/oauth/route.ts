import { cookies } from "next/headers";
import { getAdmin } from "@/lib/admin";
import { logAction } from "@/lib/audit";
import { completeConnect, GoogleError } from "@/lib/google-meet";
import { readOAuthState, STATE_COOKIE } from "@/lib/google-oauth-state";
import { isFounder } from "@/lib/team-types";

const back = (q: string) => new Response(null, { status: 303, headers: { Location: `/admin/riunioni?g=${q}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

/** Google redirects here after consent. Checks the signed state (CSRF) and the founder, then stores the encrypted refresh token. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // The session cookie is SameSite=strict, so it is not sent on the cross-site redirect back from Google.
  // Bounce once through a same-origin navigation (meta refresh, no script) so the browser attaches it.
  if (!url.searchParams.has("r")) {
    url.searchParams.set("r", "1");
    const target = `${url.pathname}${url.search}`.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0;url=${target}"><title>Collegamento…</title>`, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }
  const me = await getAdmin();
  if (!me || !isFounder(me)) return new Response("Solo i founder possono collegare Google.", { status: 403 });
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
