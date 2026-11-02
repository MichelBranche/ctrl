import Link from "next/link";
import { Suspense } from "react";
import { CardsSkeleton, PanelSkeleton } from "@/components/admin/dashboard";
import { Count } from "@/components/admin/shop/shop-charts";
import { Leaderboard, MonthlyBars } from "@/components/admin/team/earnings-charts";
import { DeleteJob, JobForm } from "@/components/admin/team/team-forms";
import { requireSection, type AdminUser } from "@/lib/admin";
import { EARN_RANGE_LABEL, EARN_RANGES, getEarnings, leaderboardVisible, parseEarnRange, type EarnRange } from "@/lib/team";
import { AREA_LABEL } from "@/lib/team-types";

export default function IntroitiPage({ searchParams }: PageProps<"/admin/introiti">) {
  return (
    <main className="adm-main">
      <Suspense fallback={<><CardsSkeleton n={3} /><PanelSkeleton /></>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const pct = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
const today = () => new Date().toISOString().slice(0, 10);

function href(range: EarnRange, user: string | null) {
  const q = new URLSearchParams();
  if (range !== "365") q.set("range", range);
  if (user) q.set("u", user);
  const s = q.toString();
  return `/admin/introiti${s ? `?${s}` : ""}`;
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin/introiti">["searchParams"] }) {
  const [me, sp] = await Promise.all([requireSection("introiti"), searchParams]);
  const range = parseEarnRange(sp.range);
  const founder = me.role === "founder";
  const filter = founder && typeof sp.u === "string" && /^[\w-]{1,64}$/.test(sp.u) ? sp.u : null;
  return (
    <>
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Introiti</h1>
          <p className="adm-muted">{founder ? "Quanto produce il team: totali, andamento e lavori di tutti." : "I lavori pagati che hai registrato e quanto hai prodotto."}</p>
        </div>
        <div className="adm-top-actions">
          <nav className="adm-seg" aria-label="Periodo">
            {EARN_RANGES.map((r) => (
              <Link key={r} href={href(r, filter)} className="adm-seg-item" aria-current={range === r ? "page" : undefined} scroll={false}>
                {EARN_RANGE_LABEL[r]}
              </Link>
            ))}
          </nav>
          <a href="#nuovo" className="adm-btn adm-btn-primary">Registra un lavoro</a>
        </div>
      </header>
      <Suspense key={`${range}-${filter}`} fallback={<><CardsSkeleton n={3} /><PanelSkeleton /></>}>
        <Report me={me} range={range} filter={filter} />
      </Suspense>
    </>
  );
}

async function Report({ me, range, filter }: { me: AdminUser; range: EarnRange; filter: string | null }) {
  const founder = me.role === "founder";
  let data: Awaited<ReturnType<typeof getEarnings>>;
  let boardOn = false;
  try {
    [data, boardOn] = await Promise.all([getEarnings(me, range, filter), founder ? leaderboardVisible() : Promise.resolve(false)]);
  } catch {
    return <p className="adm-error">Database non raggiungibile.</p>;
  }
  const d = data.prevCents ? (data.totalCents - data.prevCents) / data.prevCents : null;
  const avg = data.jobs ? data.totalCents / data.jobs : 0;
  const myRank = data.leaderboard ? data.leaderboard.findIndex((r) => r.userId === me.id) + 1 : 0;
  return (
    <>
      {founder ? (
        <nav className="adm-tabs adm-earn-people" aria-label="Persona">
          <Link href={href(range, null)} className="adm-tab" aria-current={!filter ? "page" : undefined} scroll={false}>Tutto il team</Link>
          {data.people.map((p) => (
            <Link key={p.id} href={href(range, p.id)} className="adm-tab" aria-current={filter === p.id ? "page" : undefined} scroll={false}>
              {p.name}
            </Link>
          ))}
        </nav>
      ) : null}
      <section className="adm-stats">
        <div className="adm-stat adm-rise" style={{ "--i": 0 } as React.CSSProperties}>
          <span className="adm-stat-head">
            <span className="adm-muted">{founder ? `Introiti · ${data.scope.label}` : "I tuoi introiti"}, {EARN_RANGE_LABEL[range]}</span>
            {data.prevCents !== null ? (
              d === null ? <span className="adm-delta">{data.totalCents ? "nuovo" : "–"}</span> : <span className={`adm-delta ${d > 0 ? "is-up" : d < 0 ? "is-down" : ""}`} title="Rispetto al periodo precedente">{d > 0 ? "↑" : d < 0 ? "↓" : ""} {pct.format(d)}</span>
            ) : null}
          </span>
          <Count value={data.totalCents / 100} money className="adm-stat-num" />
        </div>
        <div className="adm-stat adm-rise" style={{ "--i": 1 } as React.CSSProperties}>
          <span className="adm-stat-head"><span className="adm-muted">Lavori pagati</span></span>
          <Count value={data.jobs} className="adm-stat-num" />
          <span className="adm-muted">{data.jobs ? `Media ${eur.format(avg / 100)} a lavoro` : "Nessun lavoro nel periodo"}</span>
        </div>
        <div className="adm-stat adm-rise" style={{ "--i": 2 } as React.CSSProperties}>
          <span className="adm-stat-head"><span className="adm-muted">{founder ? "Persone attive nel periodo" : "Posizione in classifica"}</span></span>
          {founder ? (
            <Count value={data.leaderboard?.filter((r) => r.totalCents > 0).length ?? 0} className="adm-stat-num" />
          ) : data.leaderboard && myRank ? (
            <span className="adm-stat-num">{myRank}° <small className="adm-muted">di {data.leaderboard.length}</small></span>
          ) : (
            <span className="adm-muted">Classifica non condivisa dal founder</span>
          )}
          {me.area ? <span className="adm-muted">Area: {AREA_LABEL[me.area]}</span> : null}
        </div>
      </section>

      <div className="adm-dash">
        <section className="adm-panel adm-rise" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="adm-panel-head">
            <h2 className="adm-h2">Andamento · ultimi 12 mesi</h2>
            <span className="adm-muted">{data.scope.label}</span>
          </div>
          <MonthlyBars data={data.series} />
        </section>
        <section className="adm-panel adm-rise" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="adm-panel-head">
            <h2 className="adm-h2">Leaderboard</h2>
            {founder ? <span className="adm-pill">{boardOn ? "Visibile al team" : "Solo founder"}</span> : null}
          </div>
          {data.leaderboard ? (
            <Leaderboard rows={data.leaderboard} me={me.id} />
          ) : (
            <p className="adm-muted adm-empty">Il founder non ha reso visibile la classifica del team.</p>
          )}
          {founder ? <Link href="/admin/team" className="adm-link">Gestisci visibilità →</Link> : null}
        </section>
      </div>

      <section className="adm-panel adm-rise" style={{ "--i": 5 } as React.CSSProperties}>
        <h2 className="adm-h2">Registra un lavoro pagato</h2>
        <JobForm area={me.area} today={today()} people={founder ? data.people : null} me={me.id} />
      </section>

      <section className="adm-panel adm-rise" style={{ "--i": 6 } as React.CSSProperties}>
        <div className="adm-panel-head">
          <h2 className="adm-h2">{founder ? "Lavori" : "I tuoi lavori"}</h2>
          <span className="adm-muted">{data.list.length} nel periodo</span>
        </div>
        {data.list.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table adm-table-tight">
              <thead>
                <tr>
                  <th>Data</th>
                  {founder ? <th>Persona</th> : null}
                  <th>Cliente</th>
                  <th>Descrizione</th>
                  <th>Area</th>
                  <th className="adm-num">Importo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.list.map((j) => (
                  <tr key={j.id}>
                    <td className="adm-num">{fmtDate(j.date)}</td>
                    {founder ? <td>{j.userName}</td> : null}
                    <td>{j.client}</td>
                    <td>{j.description}</td>
                    <td>{j.area ? AREA_LABEL[j.area] : "–"}</td>
                    <td className="adm-num">{eur.format(j.amountCents / 100)}</td>
                    <td>{founder || j.userId === me.id ? <DeleteJob id={j.id} label={j.client} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adm-muted adm-empty">Nessun lavoro registrato in questo periodo. Usa il modulo qui sopra per aggiungerne uno.</p>
        )}
      </section>
    </>
  );
}
