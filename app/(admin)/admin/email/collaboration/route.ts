import { getAdmin } from "@/lib/admin";
import { canAccess } from "@/lib/team-types";
import { collabFor, KEY } from "@/lib/mail/collab";

export async function GET(request: Request) {
  const me = await getAdmin();
  if (!me || !canAccess(me, "email")) return new Response("Non autorizzato", { status: 401 });
  const keys = (new URL(request.url).searchParams.get("keys") ?? "").split(",");
  if (!keys.length || keys.length > 64 || keys.some((key) => !KEY.test(key))) return new Response("Richiesta non valida", { status: 400 });
  return Response.json({ entries: [...await collabFor(keys)] }, { headers: { "Cache-Control": "private, no-store" } });
}
