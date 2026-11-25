import { NextResponse, type NextRequest } from "next/server";
import { legacyRubricaPath } from "@/lib/crm-nav";
import { LANG_COOKIE, localeFromAcceptLanguage, localeFromPath, switchPath, type Locale } from "@/lib/i18n";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|lighthouse/i;

/** Manual selection is remembered; otherwise prefer German visitors, then the device language. */
function preferred(req: NextRequest): Locale | null {
  const picked = req.cookies.get(LANG_COOKIE)?.value;
  if (picked === "it" || picked === "en" || picked === "de") return picked;
  if (req.headers.get("x-vercel-ip-country")?.toUpperCase() === "DE") return "de";
  return localeFromAcceptLanguage(req.headers.get("accept-language"));
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Keep the admin redirects, noindex and private-cache behavior intact.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const legacy = legacyRubricaPath(pathname, req.nextUrl.searchParams);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-ctrl-path", pathname);
    requestHeaders.set("x-ctrl-search", search);
    const response = legacy ? NextResponse.redirect(new URL(legacy, req.url), 307) : NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
    if (pathname.startsWith("/admin/invito/") || pathname === "/admin/login/reimposta") response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  // Only redirect full browser navigations. Router requests and crawlers keep their requested URL.
  const h = req.headers;
  if (req.method !== "GET" || h.get("sec-fetch-mode") !== "navigate" || h.has("rsc") || h.has("next-router-prefetch") || BOT.test(h.get("user-agent") ?? "")) {
    return NextResponse.next();
  }
  const want = preferred(req);
  if (!want || want === localeFromPath(pathname)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = switchPath(pathname, want);
  url.search = search;
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Vary", "Cookie, Accept-Language, X-Vercel-IP-Country");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
