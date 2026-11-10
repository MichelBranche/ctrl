import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostEditor } from "@/components/admin/post-editor";
import { requireSection } from "@/lib/admin";
import { db } from "@/lib/db";
import { POST_COLUMNS, rowToPost } from "@/lib/journal";
import { ensureTranslationSchema } from "@/lib/migrate";

export default function EditPost({ searchParams }: PageProps<"/admin/edit">) {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true" />}>
      <Editor searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSection("journal");
  const sp = await searchParams;
  const id = sp.id;
  const tw = typeof sp.tw === "string" ? sp.tw.slice(0, 300) : undefined;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await db().execute({ sql: `SELECT ${POST_COLUMNS} FROM posts WHERE id = ?`, args: [id] });
  if (!res.rows[0]) notFound();
  const post = rowToPost(res.rows[0]);
  let twin: { id: string; auto: boolean } | null = null;
  try {
    await ensureTranslationSchema();
    const t = await db().execute({ sql: "SELECT id, auto_translated FROM posts WHERE lang = 'en' AND translation_of = ?", args: [id] });
    if (t.rows[0]) twin = { id: String(t.rows[0].id), auto: Number(t.rows[0].auto_translated) === 1 };
  } catch {}
  return <PostEditor key={post.updated_at} post={post} twin={twin} initialWarning={tw} />;
}
