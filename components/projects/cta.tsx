import Link from "next/link";
import { PArrow } from "@/components/projects/arrow";
import type { ProjectsCopy } from "@/components/projects/projects-copy";

export function ProjectsCta({ copy, href }: { copy: ProjectsCopy; href: string }) {
  return (
    <section className="p-cta" data-p-fade-scroll>
      <div className="p-cta-copy">
        <p className="p-kicker p-mono">{copy.ctaKicker}</p>
        <h2 className="p-cta-title">{copy.ctaTitle}</h2>
        <p className="p-cta-text">{copy.ctaText}</p>
      </div>
      <Link href={href} className="p-btn" data-magnetic>
        <span className="p-mono">{copy.ctaButton}</span>
        <PArrow />
      </Link>
    </section>
  );
}
