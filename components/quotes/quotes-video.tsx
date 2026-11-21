"use client";

import Image from "next/image";
import { useState } from "react";
import { QUOTES_VIDEO } from "./quotes-copy";

/** Lite YouTube embed: local poster + play; the youtube-nocookie iframe mounts only after a click. */
export function QuotesVideo({ playLabel }: { playLabel: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="qx-video">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${QUOTES_VIDEO.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={QUOTES_VIDEO.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button type="button" className="qx-video-poster" onClick={() => setPlaying(true)} aria-label={`${playLabel}: ${QUOTES_VIDEO.title}`}>
          <Image src={QUOTES_VIDEO.thumb} alt="" fill sizes="(max-width: 1200px) 100vw, 1200px" quality={80} />
          <span className="qx-video-play" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
