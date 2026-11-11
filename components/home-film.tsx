"use client";

import Image from "next/image";
import { useState } from "react";

const FILM_ID = "upTqsodkdo4";

/** Poster until the first click, then a youtube-nocookie iframe. Nothing from YouTube loads before that. */
export function HomeFilm({ title, play }: { title: string; play: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="h-film-frame">
      {on ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${FILM_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button type="button" className="h-film-poster" onClick={() => setOn(true)} aria-label={`${play}: ${title}`}>
          <Image
            src="/images/home/studio-film.jpg"
            alt=""
            fill
            sizes="(max-width: 1152px) 100vw, 1152px"
            quality={75}
            className="h-film-poster-img"
          />
          <span className="h-film-play" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
