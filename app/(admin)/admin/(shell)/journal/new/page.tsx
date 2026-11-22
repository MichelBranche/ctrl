import { Suspense } from "react";
import { PostEditor } from "@/components/admin/post-editor";
import { requireSection } from "@/lib/admin";

export default function NewPost() {
  return (
    <Suspense fallback={<main className="adm-main" aria-busy="true" />}>
      <Guarded />
    </Suspense>
  );
}

async function Guarded() {
  await requireSection("journal");
  return <PostEditor post={null} />;
}
