"use client";

import gsap from "gsap";
import Image from "next/image";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { UI_SPRING, springEase } from "@/components/home/springs";
import { CTRL_VIDEOS, formatDuration } from "@/lib/ctrl-videos";
import type { Locale } from "@/lib/i18n";

const COPY = {
  it: { play: "Riproduci", now: "Nel player", list: "Altri video di CTRL®", open: "Guarda su YouTube", select: "Porta nel player" },
  en: { play: "Play", now: "Now playing", list: "More videos from CTRL®", open: "Watch on YouTube", select: "Load in the player" },
};

const ease = springEase(UI_SPRING);

/**
 * Big player plus a rail of the channel's videos. Lite embed: the stage shows a
 * local poster and a play button; the youtube-nocookie iframe only mounts after
 * a click, so no YouTube request or cookie happens before that. Once the visitor
 * has pressed play, picking another video in the rail starts it straight away.
 */
export function HomeFilm({ lang }: { lang: Locale }) {
  const t = COPY[lang];
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLUListElement>(null);
  const first = useRef(true);
  const video = CTRL_VIDEOS[active];

  // Soft swap on every change of video: the new stage settles in with the UI spring.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = stage.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.fromTo(el, { opacity: 0, scale: 1.03 }, { opacity: 1, scale: 1, duration: 0.6, ease, clearProps: "transform,opacity" });
    return () => {
      tween.kill();
    };
  }, [active]);

  const pick = (i: number) => {
    if (i === active) return;
    setActive(i);
  };

  // Arrow keys move along the rail, Home/End jump to the ends.
  const onRailKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(rail.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const next =
      e.key === "ArrowRight" ? Math.min(at + 1, buttons.length - 1)
      : e.key === "ArrowLeft" ? Math.max(at - 1, 0)
      : e.key === "Home" ? 0
      : e.key === "End" ? buttons.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    buttons[next].focus();
    buttons[next].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  };

  return (
    <div className="h-film">
      <div className="h-film-frame">
        <div className="h-film-stage" ref={stage} key={video.id}>
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <button type="button" className="h-film-poster" onClick={() => setPlaying(true)} aria-label={`${t.play}: ${video.title}`}>
              <Image src={video.thumb} alt="" fill sizes="(max-width: 1152px) 100vw, 1152px" quality={75} priority={false} className="h-film-poster-img" />
              <span className="h-film-play" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                </svg>
              </span>
              <span className="h-film-caption" aria-hidden="true">
                <span className="h-film-caption-title">{video.title}</span>
                <span className="h-film-caption-time">{formatDuration(video.duration)}</span>
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="h-film-rail-head">
        <p className="h-film-rail-title" id="h-film-rail-title">
          {t.list}
        </p>
        <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="hv-link">
          {t.open}
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </a>
      </div>
      <ul className="h-film-rail" ref={rail} aria-labelledby="h-film-rail-title" onKeyDown={onRailKey}>
        {CTRL_VIDEOS.map((v, i) => (
          <li key={v.id}>
            <button
              type="button"
              className="h-film-thumb"
              data-active={i === active ? "" : undefined}
              aria-current={i === active ? "true" : undefined}
              aria-label={`${i === active ? t.now : t.select}: ${v.title}, ${formatDuration(v.duration)}`}
              onClick={() => pick(i)}
            >
              <span className="h-film-thumb-media">
                <Image src={v.thumb} alt="" fill sizes="(max-width: 809px) 62vw, 280px" quality={70} />
                <span className="h-film-thumb-time">{formatDuration(v.duration)}</span>
                {i === active ? <span className="h-film-thumb-now">{t.now}</span> : null}
              </span>
              <span className="h-film-thumb-title">{v.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
