import type { Metadata } from "next";
import { Suspense } from "react";
import { ServiceView, serviceMetadata } from "@/components/pages/service-page";
import { services } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return services.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return serviceMetadata(slug, "en");
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<main className="subpage" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Props) {
  const { slug } = await params;
  return <ServiceView slug={slug} lang="en" />;
}
