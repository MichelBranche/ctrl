import { NextResponse } from "next/server";

/** Admin only: keep the area out of search engines and out of shared caches. Auth is checked server-side in every page and action. */
export function proxy() {
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
