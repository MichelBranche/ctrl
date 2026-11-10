import { getAdmin } from "@/lib/admin";
import { mailProvider } from "@/lib/mail";
import { canAccess } from "@/lib/team-types";

/** Unread count of the agency inbox for the sidebar badge (polled while the admin is visible). */
export async function GET() {
  const admin = await getAdmin();
  if (!admin || !canAccess(admin, "email")) return Response.json({ n: null }, { status: 401 });
  const p = mailProvider();
  let n: number | null = null;
  if (p) n = await p.unread().catch(() => null);
  return Response.json({ n }, { headers: { "Cache-Control": "private, no-store" } });
}
