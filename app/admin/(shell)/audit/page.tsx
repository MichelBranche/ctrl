import Link from "next/link";
import { Suspense } from "react";
import { PanelSkeleton } from "@/components/admin/dashboard";
import { requireSection } from "@/lib/admin";
import { AUDIT_LABEL } from "@/lib/audit";
import { db, dbConfigured } from "@/lib/db";
import { ensureAuditSchema } from "@/lib/migrate";

const PAGE = 50;

export default function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <main className="adm-main">
      <Suspense fallback={<PanelSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const when = (iso: string) => new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "medium" });

async function Body({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSection("audit");
  const sp = await searchParams;
  const user = one(sp.utente).slice(0, 64);
  const action = one(sp.azione);
  const from = one(sp.dal);
  const to = one(sp.al);
  const page = Math.max(1, Math.min(1000, Number.parseInt(one(sp.pagina), 10) || 1));

  const where: string[] = [];
  const args: (string | number)[] = [];
  if (user) { where.push("user_id = ?"); args.push(user); }
  if (action && action in AUDIT_LABEL) { where.push("action = ?"); args.push(action); }
  // Dates are Rome calendar days; the stored timestamps are UTC, so widen by the offset implicitly via Date.
  if (DAY.test(from)) { where.push("created_at >= ?"); args.push(new Date(`${from}T00:00:00+01:00`).toISOString()); }
  if (DAY.test(to)) { where.push("created_at < ?"); args.push(new Date(new Date(`${to}T00:00:00+01:00`).getTime() + 86_400_000).toISOString()); }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  let rows: Record<string, unknown>[] = [];
  let users: { id: string; name: string }[] = [];
  try {
    if (!dbConfigured) throw new Error("db");
    await ensureAuditSchema();
    const [r, u] = await db().batch([
      { sql: `SELECT id, user_id, user_name, user_email, action, target_type, target_id, details, ip, user_agent, created_at FROM audit_log ${filter} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, args: [...args, PAGE + 1, (page - 1) * PAGE] },
      { sql: "SELECT id, name FROM admin_users ORDER BY name", args: [] },
    ], "read");
    rows = r.rows as unknown as Record<string, unknown>[];
    users = u.rows.map((x) => ({ id: String(x.id), name: String(x.name) }));
  } catch {
    return <p className="adm-error">Database non raggiungibile.</p>;
  }
  const more = rows.length > PAGE;
  rows = rows.slice(0, PAGE);
  const link = (p: number) => {
    const q = new URLSearchParams();
    if (user) q.set("utente", user);
    if (action) q.set("azione", action);
    if (from) q.set("dal", from);
    if (to) q.set("al", to);
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return `/admin/audit${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Registro attività</h1>
          <p className="adm-muted">Chi ha fatto cosa nel pannello. Le voci restano 12 mesi. Solo i founder vedono questa pagina.</p>
        </div>
      </header>
      <section className="adm-panel">
        <form method="get" className="adm-row" role="search">
          <label className="adm-field">
            <span>Utente</span>
            <select name="utente" defaultValue={user} className="adm-input">
              <option value="">Tutti</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="adm-field">
            <span>Azione</span>
            <select name="azione" defaultValue={action} className="adm-input">
              <option value="">Tutte</option>
              {Object.entries(AUDIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="adm-field">
            <span>Dal</span>
            <input type="date" name="dal" defaultValue={DAY.test(from) ? from : ""} className="adm-input" />
          </label>
          <label className="adm-field">
            <span>Al</span>
            <input type="date" name="al" defaultValue={DAY.test(to) ? to : ""} className="adm-input" />
          </label>
          <button type="submit" className="adm-btn">Filtra</button>
          {filter ? <Link href="/admin/audit" className="adm-link">Azzera filtri</Link> : null}
        </form>
      </section>
      <section className="adm-panel">
        {!rows.length ? (
          <p className="adm-muted">Nessuna attività registrata con questi filtri.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Data</th><th>Utente</th><th>Azione</th><th>Oggetto</th><th>Dettagli</th><th>IP</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td className="adm-num">{when(String(r.created_at))}</td>
                    <td>{r.user_name ? String(r.user_name) : <span className="adm-muted">Sconosciuto</span>}</td>
                    <td>{AUDIT_LABEL[String(r.action)] ?? String(r.action)}</td>
                    <td className="adm-mono">{r.target_type ? `${String(r.target_type)}${r.target_id ? ` ${String(r.target_id).slice(0, 48)}` : ""}` : ""}</td>
                    <td className="adm-mono adm-muted">{r.details ? String(r.details) : ""}</td>
                    <td className="adm-mono adm-muted" title={r.user_agent ? String(r.user_agent) : undefined}>{r.ip ? String(r.ip) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav className="adm-row" aria-label="Pagine">
          {page > 1 ? <Link href={link(page - 1)} className="adm-btn">Più recenti</Link> : null}
          <span className="adm-muted">Pagina {page}</span>
          {more ? <Link href={link(page + 1)} className="adm-btn">Meno recenti</Link> : null}
        </nav>
      </section>
    </>
  );
}
