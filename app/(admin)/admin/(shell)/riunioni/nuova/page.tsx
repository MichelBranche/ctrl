import "@/components/ds/admin-ui.css";
import "@/components/ds/rubrica.css";
import "@/components/ds/meetings.css";
import { Suspense } from "react";
import { Icon, MI } from "@/components/admin/meet/meet-icons";
import { ClientWizard, type ContactOption, TeamWizard } from "@/components/admin/meet/meet-wizard";
import { CAN_SIGN_IN_SQL, requireSection } from "@/lib/admin";
import { inviteContacts } from "@/lib/crm";
import { db } from "@/lib/db";
import { connection, googleConfigured, nowLocal } from "@/lib/google-meet";

type SP = Record<string, string | string[] | undefined>;

export default function NewMeetingPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<main className="ds-page rb mt mt-narrow" aria-busy="true"><div className="mt-skel" style={{ height: "30rem" }} /></main>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

/** Next quarter hour, at least 15 minutes away, as Rome local time. */
function nextSlot() {
  const t = new Date().getTime() + 15 * 60_000;
  return nowLocal(new Date(t - (t % (15 * 60_000))));
}

async function Body({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSection("meetings");
  const sp = await searchParams;
  const kind = sp.tipo === "cliente" ? "cliente" : "team";
  const live = googleConfigured() && Boolean(await connection().catch(() => null));
  const [today, time] = nextSlot().split("T");
  let wizard;
  if (kind === "team") {
    // Prefill from the CRM contact card (?titolo=…&ospite=…); plain text into inputs, validated again on submit.
    const title = typeof sp.titolo === "string" ? sp.titolo.slice(0, 120) : undefined;
    const external = typeof sp.ospite === "string" && /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/.test(sp.ospite) ? sp.ospite.slice(0, 200) : undefined;
    const members = (await db().execute({ sql: `SELECT id, name, email FROM admin_users WHERE ${CAN_SIGN_IN_SQL} AND id <> ? ORDER BY name`, args: [me.id] })).rows.map((r) => ({ id: String(r.id), name: String(r.name), email: String(r.email) }));
    wizard = <TeamWizard members={members} today={today} time={time} title={title} external={external} live={live} />;
  } else {
    const contacts: ContactOption[] = await inviteContacts(me).catch(() => []);
    const preset = typeof sp.cliente === "string" ? contacts.find((c) => c.id === sp.cliente) ?? null : null;
    wizard = <ClientWizard contacts={contacts} today={today} time={time} live={live} preset={preset} />;
  }
  return (
    <main className="ds-page rb mt mt-narrow">
      <nav className="mt-crumbs" aria-label="Percorso">
        <a href="/admin/riunioni"><Icon d={MI.back} size={14} />Riunioni</a>
        <span className="rb-segs" role="group" aria-label="Tipo di riunione">
          <a href="/admin/riunioni/nuova?tipo=team" aria-current={kind === "team" ? "page" : undefined}>Team</a>
          <a href="/admin/riunioni/nuova?tipo=cliente" aria-current={kind === "cliente" ? "page" : undefined}>Cliente</a>
        </span>
      </nav>
      {wizard}
    </main>
  );
}
