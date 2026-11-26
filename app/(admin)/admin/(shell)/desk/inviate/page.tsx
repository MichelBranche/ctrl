import Link from "next/link";
import type { Route } from "next";
import { requireSection } from "@/lib/admin";
import { db } from "@/lib/db";
import { ensureEmailSchema } from "@/lib/migrate";
import { getAdminCopy } from "@/lib/admin-locale";
import { interpolate } from "@/lib/admin-i18n";

type Search = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 50;
const str = (value: string | string[] | undefined) => typeof value === "string" ? value.trim().slice(0, 120) : "";
const pageHref = (q: string, status: string, page: number) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("esito", status);
  if (page > 1) params.set("p", String(page));
  const suffix = params.toString();
  return `/admin/desk/inviate${suffix ? `?${suffix}` : ""}` as Route;
};

export default async function SentEmailsPage({ searchParams }: { searchParams: Search }) {
  const [me, { t, lang }, params] = await Promise.all([requireSection("email"), getAdminCopy(), searchParams]);
  await ensureEmailSchema();
  const q = str(params.q);
  const statusRaw = str(params.esito);
  const status = statusRaw === "sent" || statusRaw === "failed" ? statusRaw : "all";
  const requested = Number.parseInt(str(params.p), 10);
  const page = Number.isFinite(requested) && requested > 1 ? Math.min(requested, 100_000) : 1;
  const where = ["user_id = ?"];
  const args: (string | number)[] = [me.id];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    where.push("(subject LIKE ? ESCAPE '\\' COLLATE NOCASE OR recipients LIKE ? ESCAPE '\\' COLLATE NOCASE)");
    args.push(like, like);
  }
  if (status === "sent") where.push("ok = 1");
  if (status === "failed") where.push("ok = 0");
  const predicate = where.join(" AND ");
  const [count, result] = await Promise.all([
    db().execute({ sql: `SELECT COUNT(*) AS n FROM email_send_log WHERE ${predicate}`, args }),
    db().execute({ sql: `SELECT recipients,subject,ok,created_at FROM email_send_log WHERE ${predicate} ORDER BY created_at DESC LIMIT ? OFFSET ?`, args: [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE] }),
  ]);
  const total = Number(count.rows[0]?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = current === page ? result.rows : (await db().execute({
    sql: `SELECT recipients,subject,ok,created_at FROM email_send_log WHERE ${predicate} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...args, PAGE_SIZE, (current - 1) * PAGE_SIZE],
  })).rows;
  const date = (raw: unknown) => {
    const value = String(raw ?? "");
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(parsed);
  };
  return (
    <main className="ds-page rb dk">
      <div className="rb-main">
        <header className="rb-head dk-head">
          <div className="rb-head-row">
            <div className="rb-head-title">
              <p className="rb-kicker">{t.desk.sentHistory}</p>
              <h1>{t.desk.sentHistoryTitle} <span className="rb-count">{total.toLocaleString()}</span></h1>
              <p className="dk-lead">{t.desk.sentHistoryLead}</p>
            </div>
            <Link className="rb-btn" href="/admin/desk" as={`/admin/desk` as Route}>{t.desk.sentBack}</Link>
          </div>
        </header>
        <section className="adm-panel" aria-label={t.desk.sentHistory}>
          <form className="adm-row-actions" method="get" role="search">
            <label className="adm-field" style={{ flex: "1 1 18rem" }}>
              <span>{t.desk.sentSearch}</span><input className="adm-input" name="q" defaultValue={q} maxLength={120} />
            </label>
            <label className="adm-field">
              <span>{t.desk.sentStatus}</span>
              <select className="adm-input" name="esito" defaultValue={status}>
                <option value="all">{t.desk.sentAll}</option><option value="sent">{t.desk.sentOk}</option><option value="failed">{t.desk.sentUncertain}</option>
              </select>
            </label>
            <button className="adm-btn adm-btn-primary" type="submit">{lang === "en" ? "Search" : "Cerca"}</button>
          </form>
          {rows.length ? (
            <div className="ds-table-wrap">
              <table>
                <thead><tr><th>{t.desk.sentDate}</th><th>{t.desk.sentRecipient}</th><th>{t.desk.sentSubject}</th><th>{t.desk.sentResult}</th></tr></thead>
                <tbody>{rows.map((row, index) => {
                  const ok = Number(row.ok) === 1;
                  return <tr key={`${row.created_at}-${index}`}><td>{date(row.created_at)}</td><td>{String(row.recipients ?? "")}</td><td>{String(row.subject ?? "")}</td><td>{ok ? t.desk.sentSuccess : t.desk.sentFailed}</td></tr>;
                })}</tbody>
              </table>
            </div>
          ) : <p className="adm-muted">{t.desk.sentEmpty}</p>}
          {pages > 1 ? <nav className="adm-row-actions" aria-label={interpolate(t.desk.sentPage, { n: current })}>
            <span>{interpolate(t.desk.sentPage, { n: current })} / {pages}</span>
            {current > 1 ? <Link className="adm-btn" href={pageHref(q, status, current - 1)}>{lang === "en" ? "Previous" : "Precedenti"}</Link> : null}
            {current < pages ? <Link className="adm-btn" href={pageHref(q, status, current + 1)}>{lang === "en" ? "Next" : "Successive"}</Link> : null}
          </nav> : null}
        </section>
      </div>
    </main>
  );
}
