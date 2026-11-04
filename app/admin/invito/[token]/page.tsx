import { connection } from "next/server";
import { Suspense } from "react";
import { InviteScreen } from "@/components/admin/invite-screen";
import { readInvite } from "@/lib/team-invite";
import { isFounder, ROLE_LABEL } from "@/lib/team-types";

/** Build-time placeholder only (an invalid token renders the "link non valido" card); real tokens render on request. */
export function generateStaticParams() {
  return [{ token: "_" }];
}

export const metadata = { robots: { index: false, follow: false } };

/** Landing page of the "Accetta l'invito" email button. Dynamic (reads the DB), so it renders inside Suspense. */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<main className="adm-auth" />}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connection();
  const view = await readInvite(token).catch(() => ({ state: "invalid" as const }));
  return (
    <InviteScreen
      token={token}
      invite={view.state === "valid" ? { state: "valid", name: view.name, email: view.email, roles: view.roles.map((r) => ROLE_LABEL[r]), founder: isFounder(view.roles) } : { state: view.state }}
    />
  );
}
