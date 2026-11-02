"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { PArrow } from "@/components/projects/arrow";

export type CarouselSlide = { image: string; alt: string; kicker: string; title: string; text: string; cta: string; href: string; external: boolean };

/** Product card carousel. Arrows and dots only render when there is more than one slide. */
export function WebappCarousel({ slides, label, prev, next, goTo, newTab }: { slides: CarouselSlide[]; label: string; prev: string; next: string; goTo: string[]; newTab: string }) {
  const [i, setI] = useState(0);
  const many = slides.length > 1;
  const s = slides[i];
  const step = (d: number) => setI((v) => (v + d + slides.length) % slides.length);
  return (
    <div className="wa-carousel" role="region" aria-roledescription="carousel" aria-label={label} data-p-fade-scroll>
      {many ? (
        <button type="button" className="wa-nav wa-nav-prev" onClick={() => step(-1)} aria-label={prev}>
          <PArrow className="p-arrow p-arrow-back" />
        </button>
      ) : null}
      <article className="wa-card" key={i} aria-roledescription="slide" aria-label={`${i + 1} / ${slides.length}`}>
        <div className="wa-card-media">
          <Image src={s.image} alt={s.alt} fill sizes="(max-width: 760px) 100vw, 55vw" className="wa-card-img" />
        </div>
        <div className="wa-card-body">
          <p className="p-kicker p-mono wa-card-kicker">{s.kicker}</p>
          <h3 className="wa-card-title">{s.title}</h3>
          <p className="wa-card-text">{s.text}</p>
          {s.external ? (
            <a className="wa-card-cta p-mono" href={s.href} target="_blank" rel="noopener">
              {s.cta}
              <PArrow />
              <span className="p-sr">{newTab}</span>
            </a>
          ) : (
            <Link className="wa-card-cta p-mono" href={s.href as Route}>
              {s.cta}
              <PArrow />
            </Link>
          )}
        </div>
      </article>
      {many ? (
        <>
          <button type="button" className="wa-nav wa-nav-next" onClick={() => step(1)} aria-label={next}>
            <PArrow />
          </button>
          <div className="wa-dots">
            {slides.map((sl, n) => (
              <button key={sl.title + n} type="button" className="wa-dot" aria-label={goTo[n]} aria-current={n === i ? "true" : undefined} onClick={() => setI(n)} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
