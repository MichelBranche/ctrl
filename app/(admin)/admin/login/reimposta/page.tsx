import { connection } from "next/server";
import { Suspense } from "react";
import { ResetScreen } from "@/components/admin/reset-screen";
import { readReset } from "@/lib/password-reset";

export const metadata = { robots: { index: false, follow: false } };

/** Landing page of the "Reimposta la password" email button. Dynamic (reads the DB), so it renders inside Suspense. */
export default function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  return (
    <Suspense fallback={<main className="adm-auth" />}>
      <Reset searchParams={searchParams} />
    </Suspense>
  );
}

async function Reset({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  await connection();
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  const view = await readReset(token).catch(() => "invalid" as const);
  return <ResetScreen token={view === "valid" ? token : ""} view={view} />;
}
