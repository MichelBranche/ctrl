import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AgendaEasyView, agendaEasyMetadata } from "@/components/projects/agenda-easy/agenda-easy-page";
import { WebsiteDetail, websiteMetadata, websiteSlugs } from "@/components/projects/website-detail";

type Props = { params: Promise<{ category: string; slug: string }> };

export function generateStaticParams() {
  return [...websiteSlugs().map((slug) => ({ category: "websites", slug })), { category: "webapps", slug: "agenda-easy" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  if (category === "webapps" && slug === "agenda-easy") return agendaEasyMetadata("it");
  return category === "websites" ? websiteMetadata(slug, "it") : {};
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<main className="p-root" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Props) {
  const { category, slug } = await params;
  if (category === "webapps" && slug === "agenda-easy") return <AgendaEasyView lang="it" />;
  if (category !== "websites") notFound();
  return <WebsiteDetail slug={slug} lang="it" />;
}
