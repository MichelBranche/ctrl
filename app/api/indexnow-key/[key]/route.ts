import { NextResponse } from "next/server";

/** IndexNow key file. TODO(owner): set INDEXNOW_KEY to 8-128 hex characters. Served at /<key>.txt */
const KEY = /^[a-fA-F0-9]{8,128}$/;

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const expected = process.env.INDEXNOW_KEY ?? "";
  if (!expected || !KEY.test(expected) || key !== expected) {
    return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  }
  return new NextResponse(expected, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } });
}
