import { getAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

/** CSV of active subscribers. Admin-only; never cached. */
export async function GET() {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  const res = await db().execute("SELECT email, lang, created_at FROM subscribers WHERE unsubscribed_at IS NULL ORDER BY created_at");
  // Prefix values that a spreadsheet would read as formulas.
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = ["email,lang,subscribed_at", ...res.rows.map((r) => [r.email, r.lang, r.created_at].map(cell).join(","))].join("\r\n");
  return new Response(`\uFEFF${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ctrl-newsletter-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
