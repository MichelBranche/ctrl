import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { analytics, vercelConfigured, type Bucket } from "@/lib/vercel";

const RANGES = [7, 30] as const;

export default function StatsPage({ searchParams }: PageProps<"/admin/stats">) {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true"><p className="adm-muted">Caricamento…</p></main>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin/stats">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const days = sp.range === "30" ? 30 : 7;
  const head = (
    <header className="adm-top">
      <div>
        <h1 className="adm-h1">Statistiche</h1>
        <p className="adm-muted">Vercel Web Analytics, senza cookie. Il piano Hobby conserva circa un mese di dati.</p>
      </div>
      <nav className="adm-tabs" aria-label="Periodo">
        {RANGES.map((r) => (
          <Link key={r} href={`/admin/stats?range=${r}`} className="adm-tab" aria-current={days === r ? "page" : undefined}>
            {r} giorni
          </Link>
        ))}
      </nav>
    </header>
  );
  if (!vercelConfigured()) {
    return (
      <main className="adm-main">
        {head}
        <div className="adm-note">
          <p>Configura: aggiungi su Vercel le variabili VERCEL_API_TOKEN (token personale), VERCEL_PROJECT_ID e VERCEL_TEAM_ID, poi ridistribuisci.</p>
        </div>
      </main>
    );
  }
  let data: { day: Bucket[]; pages: Bucket[]; refs: Bucket[]; countries: Bucket[]; devices: Bucket[] } | null = null;
  try {
    const [day, pages, refs, countries, devices] = await Promise.all([
      analytics("day", days, 31),
      analytics("requestPath", days, 10),
      analytics("referrerHostname", days, 10),
      analytics("country", days, 10),
      analytics("deviceType", days, 5),
    ]);
    data = { day: day ?? [], pages: pages ?? [], refs: refs ?? [], countries: countries ?? [], devices: devices ?? [] };
  } catch {
    data = null;
  }
  if (!data) {
    return (
      <main className="adm-main">
        {head}
        <p className="adm-error" role="alert">L&apos;API di Vercel non ha risposto. Controlla il token.</p>
      </main>
    );
  }
  const pv = data.day.reduce((a, d) => a + d.pageviews, 0);
  const vis = data.day.reduce((a, d) => a + d.visitors, 0);
  const max = Math.max(1, ...data.day.map((d) => d.pageviews));

  return (
    <main className="adm-main">
      {head}
      <section className="adm-stats" aria-label="Totali">
        <div className="adm-stat">
          <span className="adm-muted">Visualizzazioni</span>
          <span className="adm-stat-num">{pv}</span>
        </div>
        <div className="adm-stat">
          <span className="adm-muted">Visitatori (somma giornaliera)</span>
          <span className="adm-stat-num">{vis}</span>
        </div>
      </section>
      {pv === 0 ? (
        <p className="adm-note">Nessuna visita registrata in questo periodo.</p>
      ) : (
        <>
          <section className="adm-panel">
            <h2 className="adm-h2">Visualizzazioni per giorno</h2>
            <ol className="adm-chart" aria-label="Visualizzazioni per giorno">
              {data.day.map((d) => (
                <li key={d.key} title={`${d.key.slice(0, 10)}: ${d.pageviews} visualizzazioni, ${d.visitors} visitatori`}>
                  <span className="adm-bar" style={{ transform: `scaleY(${d.pageviews / max})` }} />
                  <span className="adm-sr">
                    {d.key.slice(0, 10)}: {d.pageviews}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <div className="adm-grid2">
            <Top title="Pagine" rows={data.pages} />
            <Top title="Provenienza" rows={data.refs} empty="Solo accessi diretti." />
            <Top title="Paesi" rows={data.countries} />
            <Top title="Dispositivi" rows={data.devices} />
          </div>
        </>
      )}
    </main>
  );
}

function Top({ title, rows, empty = "Nessun dato." }: { title: string; rows: Bucket[]; empty?: string }) {
  const filtered = rows.filter((r) => r.key);
  return (
    <section className="adm-panel">
      <h2 className="adm-h2">{title}</h2>
      {filtered.length ? (
        <table className="adm-table adm-table-tight">
          <thead>
            <tr>
              <th>{title}</th>
              <th className="adm-num">Visite</th>
              <th className="adm-num">Visitatori</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.key}>
                <td className="adm-mono">{r.key}</td>
                <td className="adm-num">{r.pageviews}</td>
                <td className="adm-num">{r.visitors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="adm-muted">{empty}</p>
      )}
    </section>
  );
}
