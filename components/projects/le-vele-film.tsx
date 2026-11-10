"use client";

import { useEffect, useRef } from "react";
import { LE_VELE_MEDIA } from "@/lib/content";

const WIDE = "(min-width: 780px)";

function cutFor(wide: boolean) {
  return wide ? LE_VELE_MEDIA.desktop : LE_VELE_MEDIA.mobile;
}

/** Loads the scroll film only when it nears the viewport, then plays it. */
export function LeVeleFilm({ labelDesktop, labelMobile }: { labelDesktop: string; labelMobile: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = video.current;
    if (!node) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const width = window.matchMedia(WIDE);

    const applyPoster = () => {
      const cut = cutFor(width.matches);
      node.poster = cut.poster;
      node.setAttribute("aria-label", width.matches ? labelDesktop : labelMobile);
    };

    const stop = () => {
      node.pause();
      node.autoplay = false;
      node.replaceChildren();
      node.removeAttribute("src");
      node.load();
    };

    const playCut = () => {
      if (motion.matches) {
        stop();
        applyPoster();
        return;
      }
      const cut = cutFor(width.matches);
      node.muted = true;
      node.defaultMuted = true;
      node.playsInline = true;
      node.loop = true;
      node.autoplay = true;
      node.preload = "metadata";
      node.poster = cut.poster;
      const webm = document.createElement("source");
      webm.src = cut.webm;
      webm.type = "video/webm";
      const mp4 = document.createElement("source");
      mp4.src = cut.mp4;
      mp4.type = "video/mp4";
      node.replaceChildren(webm, mp4);
      const start = () => {
        node.play().catch(() => undefined);
      };
      node.addEventListener("loadeddata", start, { once: true });
      node.load();
      start();
    };

    applyPoster();
    if (motion.matches) return;

    let seen = false;
    const arm = () => {
      if (seen) return;
      seen = true;
      playCut();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          arm();
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);

    const onChange = () => {
      applyPoster();
      if (motion.matches) {
        seen = false;
        stop();
        return;
      }
      seen = false;
      playCut();
    };
    motion.addEventListener("change", onChange);
    width.addEventListener("change", onChange);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", onChange);
      width.removeEventListener("change", onChange);
    };
  }, [labelDesktop, labelMobile]);

  return (
    <video
      ref={video}
      className="lv-video"
      muted
      loop
      playsInline
      preload="none"
      poster={LE_VELE_MEDIA.desktop.poster}
      aria-label={labelDesktop}
    />
  );
}
