import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, localeFromAcceptLanguage, localeFromPath, switchPath, type Locale } from "@/lib/i18n";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|lighthouse/i;

/** Language the visitor wants: a manual choice (cookie) first, then the device language. */
function preferred(req: NextRequest): Locale | null {
  const picked = req.cookies.get(LANG_COOKIE)?.value;
  if (picked === "it" || picked === "en") return picked;
  return localeFromAcceptLanguage(req.headers.get("accept-language"));
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Admin only: keep the area out of search engines and out of shared caches. Auth is checked server-side in every page and action.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  // Language: only full page loads by people (browser document navigations). Router/prefetch requests follow the links the user clicked,
  // and crawlers keep indexing both /... (IT) and /en/... as they are.
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
  response.headers.set("Vary", "Cookie, Accept-Language");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Pages only: skip API routes, Next internals and any file with an extension (icons, images, fonts, robots, sitemap).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
