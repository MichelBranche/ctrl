"use client";

import Image from "next/image";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

const images = [
  { src: "/images/shop/review-card-hero.webp", alt: { it: "Card CTRL per recensioni Google con NFC e QR", en: "CTRL Google review card with NFC and QR" } },
  { src: "/images/shop/review-card.webp", alt: { it: "Card da banco CTRL per recensioni", en: "CTRL countertop review card" } },
  { src: "/images/shop/review-card-detail.webp", alt: { it: "Card recensioni Google CTRL in uso", en: "CTRL Google review card in use" } },
];

export function ProductGallery({ lang }: { lang: Locale }) {
  const [active, setActive] = useState(0);
  const image = images[active];
  return <div className="sp-gallery">
    <div className="sp-gallery-main"><Image src={image.src} alt={image.alt[lang]} fill priority sizes="(max-width: 900px) 100vw, 50vw" /></div>
    <div className="sp-gallery-thumbs" aria-label={lang === "it" ? "Immagini prodotto" : "Product images"}>
      {images.map((item, index) => <button key={item.src} className={index === active ? "sp-thumb is-active" : "sp-thumb"} type="button" onClick={() => setActive(index)} aria-label={`${lang === "it" ? "Mostra immagine" : "Show image"} ${index + 1}`} aria-pressed={index === active}>
        <Image src={item.src} alt="" fill sizes="(max-width: 600px) 27vw, 10vw" />
      </button>)}
    </div>
  </div>;
}
