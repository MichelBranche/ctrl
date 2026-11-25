import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AgendaEasyView, agendaEasyMetadata } from "@/components/projects/agenda-easy/agenda-easy-page";
import { LeVeleView, leVeleMetadata } from "@/components/projects/le-vele-page";
import { WebsiteDetail, websiteMetadata, websiteSlugs } from "@/components/projects/website-detail";
import { LE_VELE } from "@/lib/content";

type Props = { params: Promise<{ category: string; slug: string }> };

export function generateStaticParams() {
  return [...websiteSlugs().map((slug) => ({ category: "websites", slug })), { category: "webapps", slug: "agenda-easy" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  if (category === "webapps" && slug === "agenda-easy") return agendaEasyMetadata("fr");
  if (category === "websites" && slug === LE_VELE.slug) return leVeleMetadata("fr");
  return category === "websites" ? websiteMetadata(slug, "fr") : {};
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
  if (category === "webapps" && slug === "agenda-easy") return <AgendaEasyView lang="fr" />;
  if (category === "websites" && slug === LE_VELE.slug) return <LeVeleView lang="fr" />;
  if (category !== "websites") notFound();
  return <WebsiteDetail slug={slug} lang="fr" />;
}
