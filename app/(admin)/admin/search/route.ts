import { getAdmin } from "@/lib/admin";
import { commandSearch } from "@/lib/command-center";

/** Auth-protected admin search. Debounced by the palette; results stay grouped by type. */
export async function GET(request: Request) {
  const me = await getAdmin();
  if (!me) return Response.json({ hits: [] }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const hits = await commandSearch(me, q);
  return Response.json({ hits }, { headers: { "Cache-Control": "private, no-store" } });
}
