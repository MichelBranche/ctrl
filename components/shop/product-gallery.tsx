"use client";

import Image from "next/image";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export function ProductGallery({ images, title, lang }: { images: string[]; title: string; lang: Locale }) {
  const available = images.length ? images : ["/images/shop/review-card-hero.webp"];
  const [active, setActive] = useState(0);
  return <div className="sp-gallery">
    <div className="sp-gallery-main"><Image src={available[active]} alt={`${title} — ${lang === "it" ? "immagine" : "image"} ${active + 1}`} fill priority sizes="(max-width: 900px) 100vw, 50vw" /></div>
    {available.length > 1 ? <div className="sp-gallery-thumbs" aria-label={lang === "it" ? "Immagini prodotto" : "Product images"}>
      {available.map((src, index) => <button key={`${src}-${index}`} className={index === active ? "sp-thumb is-active" : "sp-thumb"} type="button" onClick={() => setActive(index)} aria-label={`${lang === "it" ? "Mostra immagine" : "Show image"} ${index + 1}`} aria-pressed={index === active}>
        <Image src={src} alt="" fill sizes="(max-width: 600px) 27vw, 10vw" />
      </button>)}
    </div> : null}
  </div>;
}
