import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryView, categoryMetadata } from "@/components/projects/category-page";
import { projectCategories } from "@/lib/content";

type Props = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return projectCategories.map((item) => ({ category: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  return categoryMetadata(category, "it");
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<main className="p-root" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Props) {
  const { category } = await params;
  return <CategoryView slug={category} lang="it" />;
}
