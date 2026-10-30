import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowIcon, ServiceIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getService, services } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return { title: "Services" };
  return {
    title: service.title,
    description: service.text,
  };
}

export default function ServicePage({ params }: Props) {
  return (
    <Suspense fallback={<main className="subpage" />}>
      <ServiceBody params={params} />
    </Suspense>
  );
}

async function ServiceBody({ params }: Props) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const index = services.findIndex((item) => item.slug === service.slug);
  const next = services[(index + 1) % services.length];

  return (
    <>
      <SiteHeader />
      <main className="subpage service-page">
        <Link href="/#services" className="text-link case-back">
          <ArrowIcon />
          All services
        </Link>
        <p className="kicker">{service.index}</p>
        <h1>{service.title}</h1>
        <div className="service-page-grid">
          <div>
            <p className="service-page-lead">{service.text}</p>
            <p>{service.summary}</p>
          </div>
          <div>
            <div className="service-page-mark" aria-hidden="true">
              <ServiceIcon name={service.icon} />
            </div>
            <ul className="service-points">
              {service.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
        <Link href={`/services/${next.slug}`} className="service-next">
          <span>Next</span>
          <strong>
            {next.index} {next.title}
            <ArrowIcon />
          </strong>
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
