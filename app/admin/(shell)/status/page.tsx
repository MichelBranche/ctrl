import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { db, dbConfigured } from "@/lib/db";
import { deployments, vercelConfigured, type Deployment } from "@/lib/vercel";

export default function StatusPage() {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Controllo in corso…</p></main>}>
      <Body />
    </Suspense>
  );
}

const ORIGIN = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://ctrlagency.dev";

type Check = { name: string; ok: boolean; detail: string };

async function timed(name: string, fn: () => Promise<string>): Promise<Check> {
  const t = performance.now();
  try {
    const detail = await fn();
    return { name, ok: true, detail: `${detail} · ${Math.round(performance.now() - t)} ms` };
  } catch (e) {
    return { name, ok: false, detail: e instanceof Error ? e.message : "errore" };
  }
}

const page = (path: string) => async () => {
  const res = await fetch(`${ORIGIN}${path}`, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(8000) });
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  return `HTTP ${res.status}`;
};

async function Body() {
  await requireAdmin();
  const checks = await Promise.all([
    timed(`Home (${ORIGIN.replace("https://", "")})`, page("/")),
    timed("Journal", page("/journal")),
    timed("Database Turso", async () => {
      if (!dbConfigured) throw new Error("non configurato");
      await db().execute("SELECT 1");
      return "risponde";
    }),
    Promise.resolve<Check>({ name: "Storage immagini", ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN), detail: process.env.BLOB_READ_WRITE_TOKEN ? "configurato" : "manca BLOB_READ_WRITE_TOKEN" }),
  ]);
  let deps: Deployment[] | null = null;
  let depError = false;
  if (vercelConfigured()) {
    try {
      deps = await deployments(8);
    } catch {
      depError = true;
    }
  }
  const checkedAt = new Date().toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });

  return (
    <main className="adm-main">
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Stato sito</h1>
          <p className="adm-muted">Controllo eseguito alle {checkedAt} (ora di Roma), a ogni apertura della pagina.</p>
        </div>
      </header>
      <section className="adm-panel">
        <h2 className="adm-h2">Controlli</h2>
        <ul className="adm-list">
          {checks.map((c) => (
            <li key={c.name} className="adm-check">
              <span className={`adm-dot ${c.ok ? "is-ok" : "is-bad"}`} aria-hidden="true" />
              <span>{c.name}</span>
              <span className="adm-muted adm-num">{c.ok ? c.detail : `Problema: ${c.detail}`}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="adm-panel">
        <h2 className="adm-h2">Ultimi deploy</h2>
        {!vercelConfigured() ? (
          <p className="adm-note">Configura: servono VERCEL_API_TOKEN, VERCEL_PROJECT_ID e VERCEL_TEAM_ID nelle variabili di Vercel.</p>
        ) : depError ? (
          <p className="adm-error" role="alert">L&apos;API di Vercel non ha risposto.</p>
        ) : !deps?.length ? (
          <p className="adm-muted">Nessun deploy trovato.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Stato</th>
                  <th>Ambiente</th>
                  <th>Commit</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {deps.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className={`adm-badge is-${d.state.toLowerCase()}`}>{d.state}</span>
                    </td>
                    <td>{d.target === "production" ? "Produzione" : "Anteprima"}</td>
                    <td>
                      <a href={`https://${d.url}`} target="_blank" rel="noopener noreferrer" className="adm-link">
                        {d.message || d.url}
                      </a>
                      {d.sha ? <span className="adm-muted adm-mono"> {d.sha}</span> : null}
                    </td>
                    <td className="adm-num">{new Date(d.createdAt).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
