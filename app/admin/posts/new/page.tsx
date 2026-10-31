import { Suspense } from "react";
import { PostEditor } from "@/components/admin/post-editor";
import { requireAdmin } from "@/lib/admin";

export default function NewPost() {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true" />}>
      <Guarded />
    </Suspense>
  );
}

async function Guarded() {
  await requireAdmin();
  return <PostEditor post={null} />;
}
