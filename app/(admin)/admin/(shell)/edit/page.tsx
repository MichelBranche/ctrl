import { notFound, redirect } from "next/navigation";
import { journalEditPath } from "@/lib/journal-admin-path";

export default async function LegacyEditPost({ searchParams }: PageProps<"/admin/edit">) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tw = typeof sp.tw === "string" ? sp.tw.slice(0, 300) : undefined;
  redirect(journalEditPath(id, tw));
}
