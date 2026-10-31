import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostEditor } from "@/components/admin/post-editor";
import { requireAdmin } from "@/lib/admin";
import type { Post } from "@/lib/journal-types";

export default function EditPost({ searchParams }: PageProps<"/admin/edit">) {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true" />}>
      <Editor searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireAdmin();
  const id = (await searchParams).id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <PostEditor key={data.updated_at} post={data as Post} />;
}
