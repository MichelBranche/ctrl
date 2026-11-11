"use client";

import Image from "next/image";
import { useState } from "react";

/** Click-to-load YouTube: a local poster until the user asks to play, then a youtube-nocookie iframe. */
export function YouTubeFacade({ id, title, play, poster }: { id: string; title: string; play: string; poster: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="ae-video-frame">
      {on ? (
        <iframe
          className="ae-video-iframe"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button type="button" className="ae-video-poster" onClick={() => setOn(true)} aria-label={`${play}: ${title}`}>
          <Image src={poster} alt="" fill sizes="(max-width: 1100px) 100vw, 1100px" className="ae-video-img" />
          <span className="ae-play" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
          </span>
          <span className="ae-play-label p-mono" aria-hidden="true">{play}</span>
        </button>
      )}
    </div>
  );
}
