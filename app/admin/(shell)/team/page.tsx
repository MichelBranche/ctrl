import { UserAvatar } from "@/components/admin/user-avatar";
import { Suspense } from "react";
import { PanelSkeleton } from "@/components/admin/dashboard";
import { EditUserForm, LeaderboardSwitch, NewUserForm } from "@/components/admin/team/team-forms";
import { requireSection } from "@/lib/admin";
import { leaderboardVisible, listUsers } from "@/lib/team";
import { AREA_LABEL, AREA_SECTIONS, AREAS, ROLE_LABEL, SECTION_HREF } from "@/lib/team-types";

export default function TeamPage() {
  return (
    <main className="adm-main">
      <Suspense fallback={<PanelSkeleton />}>
        <Body />
      </Suspense>
    </main>
  );
}

const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" }) : "mai";
const label = (href: string) => href.replace("/admin/", "");

async function Body() {
  const me = await requireSection("team");
  let users: Awaited<ReturnType<typeof listUsers>>;
  let board = false;
  try {
    [users, board] = await Promise.all([listUsers(), leaderboardVisible()]);
  } catch {
    return <p className="adm-error">Database non raggiungibile.</p>;
  }
  return (
    <>
      <header className="adm-top">
        <div>
          <h1 className="adm-h1">Team</h1>
          <p className="adm-muted">Profili, ruoli e aree. Solo il founder vede e modifica questa pagina.</p>
        </div>
      </header>

      <div className="adm-grid2">
        <section className="adm-panel adm-rise" style={{ "--i": 0 } as React.CSSProperties}>
          <h2 className="adm-h2">Impostazioni team</h2>
          <LeaderboardSwitch visible={board} />
        </section>
        <section className="adm-panel adm-rise" style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className="adm-h2">Cosa può modificare ogni area</h2>
          <dl className="adm-dl">
            {AREAS.map((a) => (
              <div key={a} style={{ display: "contents" }}>
                <dt>{AREA_LABEL[a]}</dt>
                <dd>{AREA_SECTIONS[a].map((s) => label(SECTION_HREF[s])).join(", ")}</dd>
              </div>
            ))}
          </dl>
          <p className="adm-muted">Tutti vedono Panoramica, Introiti (solo i propri lavori) e Impostazioni (la propria password). La casella Email si concede a persona, indipendentemente dall&apos;area. Il founder ha accesso completo.</p>
        </section>
      </div>

      <section className="adm-panel adm-rise" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="adm-panel-head">
          <h2 className="adm-h2">Profili</h2>
          <span className="adm-muted">{users.length} {users.length === 1 ? "utente" : "utenti"}</span>
        </div>
        <ul className="adm-users">
          {users.map((u, i) => (
            <li key={u.id} className="adm-user adm-rise" data-off={!u.active || undefined} style={{ "--i": i } as React.CSSProperties}>
              <details>
                <summary>
                  <UserAvatar name={u.name} src={u.avatarUrl} />
                  <span className="adm-user-id">
                    <strong>{u.name}{u.id === me.id ? <em className="adm-muted"> · tu</em> : null}</strong>
                    <span className="adm-muted">{u.email}</span>
                  </span>
                  <span className={`adm-badge ${u.role === "founder" ? "is-published" : ""}`}>{ROLE_LABEL[u.role]}</span>
                  <span className="adm-muted">{u.area ? AREA_LABEL[u.area] : "Tutte le aree"}{u.emailAccess ? " · Email" : ""}</span>
                  <span className="adm-num">{eur.format(u.totalCents / 100)} <span className="adm-muted">· {u.jobs} lavori</span></span>
                  <span className="adm-muted adm-user-seen">{u.active ? `Ultimo accesso: ${when(u.lastLoginAt)}` : "Disattivato"}</span>
                </summary>
                <EditUserForm user={u} self={u.id === me.id} />
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="adm-panel adm-rise" style={{ "--i": 3 } as React.CSSProperties}>
        <h2 className="adm-h2">Nuovo profilo</h2>
        <NewUserForm />
      </section>
    </>
  );
}
