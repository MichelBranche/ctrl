import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostEditor } from "@/components/admin/post-editor";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { POST_COLUMNS, rowToPost } from "@/lib/journal";

export default function EditPost({ searchParams }: PageProps<"/admin/edit">) {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true" />}>
      <Editor searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const id = (await searchParams).id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await db().execute({ sql: `SELECT ${POST_COLUMNS} FROM posts WHERE id = ?`, args: [id] });
  if (!res.rows[0]) notFound();
  const post = rowToPost(res.rows[0]);
  return <PostEditor key={post.updated_at} post={post} />;
}
