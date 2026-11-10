"use client";

import { useEffect, useRef, useState } from "react";

const WIDE = "(min-width: 780px)";
const BASE = "/videos/projects/residence-le-vele";

const media = {
  desktop: {
    poster: "/images/projects/works/residence-le-vele.webp",
    posterJpg: "/images/projects/works/residence-le-vele.jpg",
    webm: `${BASE}/desktop.webm`,
    mp4: `${BASE}/desktop.mp4`,
  },
  mobile: {
    poster: "/images/projects/works/residence-le-vele-mobile.webp",
    posterJpg: "/images/projects/works/residence-le-vele-mobile.jpg",
    webm: `${BASE}/mobile.webm`,
    mp4: `${BASE}/mobile.mp4`,
  },
} as const;

export function LeVeleFilm({ label, labelDesktop, labelMobile }: { label: string; labelDesktop: string; labelMobile: string }) {
  const root = useRef<HTMLDivElement>(null);
  const desktop = useRef<HTMLVideoElement>(null);
  const mobile = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);
  const [wide, setWide] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const width = window.matchMedia(WIDE);
    const onWidth = () => setWide(width.matches);
    width.addEventListener("change", onWidth);

    if (motion.matches) {
      return () => width.removeEventListener("change", onWidth);
    }

    const node = root.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setWide(width.matches);
        setArmed(true);
        observer.disconnect();
      },
      { rootMargin: "240px 0px" },
    );
    if (node) observer.observe(node);

    const onMotion = () => {
      if (!motion.matches) return;
      desktop.current?.pause();
      mobile.current?.pause();
      setPlaying(false);
      setArmed(false);
    };
    motion.addEventListener("change", onMotion);
    return () => {
      observer.disconnect();
      width.removeEventListener("change", onWidth);
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  useEffect(() => {
    if (!armed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const active = wide ? desktop.current : mobile.current;
    const idle = wide ? mobile.current : desktop.current;
    idle?.pause();
    if (!active) return;
    const play = () => {
      active.play().catch(() => undefined);
    };
    active.addEventListener("playing", () => setPlaying(true), { once: true });
    active.addEventListener("canplay", play, { once: true });
    active.load();
    return () => active.removeEventListener("canplay", play);
  }, [armed, wide]);

  return (
    <div className="lv-film" ref={root} data-playing={playing ? "" : undefined}>
      <picture className="lv-still">
        <source media={WIDE} srcSet={media.desktop.poster} type="image/webp" />
        <source media={WIDE} srcSet={media.desktop.posterJpg} type="image/jpeg" />
        <source srcSet={media.mobile.poster} type="image/webp" />
        <img src={media.mobile.posterJpg} alt={label} />
      </picture>
      <video
        ref={desktop}
        className="lv-video lv-video-desktop"
        autoPlay={armed && wide}
        muted
        loop
        playsInline
        preload={armed && wide ? "metadata" : "none"}
        poster={media.desktop.poster}
        aria-label={labelDesktop}
      >
        {armed && wide ? (
          <>
            <source src={media.desktop.webm} type="video/webm" />
            <source src={media.desktop.mp4} type="video/mp4" />
          </>
        ) : null}
      </video>
      <video
        ref={mobile}
        className="lv-video lv-video-mobile"
        autoPlay={armed && !wide}
        muted
        loop
        playsInline
        preload={armed && !wide ? "metadata" : "none"}
        poster={media.mobile.poster}
        aria-label={labelMobile}
      >
        {armed && !wide ? (
          <>
            <source src={media.mobile.webm} type="video/webm" />
            <source src={media.mobile.mp4} type="video/mp4" />
          </>
        ) : null}
      </video>
    </div>
  );
}
