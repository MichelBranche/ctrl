"use client";

import { useEffect, useRef } from "react";
import { LE_VELE_MEDIA } from "@/lib/content";

const WIDE = "(min-width: 780px)";

type Cut = { webm: string; mp4: string; poster: string };

function cutFor(wide: boolean): Cut {
  return wide ? LE_VELE_MEDIA.desktop : LE_VELE_MEDIA.mobile;
}

function mark(stage: HTMLElement, playing: boolean, blocked: boolean) {
  if (playing) stage.setAttribute("data-playing", "");
  else stage.removeAttribute("data-playing");
  if (blocked) stage.setAttribute("data-blocked", "");
  else stage.removeAttribute("data-blocked");
}

/**
 * Scroll film. The video element stays in the layout (never display:none before play).
 * Autoplay failure and prefers-reduced-motion leave the poster up with a Play button.
 */
export function LeVeleFilm({
  labelDesktop,
  labelMobile,
  playLabel,
  variant = "frame",
  fixedCut,
}: {
  labelDesktop: string;
  labelMobile: string;
  playLabel: string;
  variant?: "frame" | "fill";
  /** Card previews pass one cut. The case study follows the viewport. */
  fixedCut?: Cut;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = video.current;
    const root = stage.current;
    if (!node || !root) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const width = window.matchMedia(WIDE);
    let loadedKey = "";

    const current = () => fixedCut ?? cutFor(width.matches);

    const applyPoster = () => {
      const cut = current();
      const still = root.querySelector<HTMLImageElement>(".lv-still");
      if (still) still.src = cut.poster;
      node.poster = cut.poster;
      const desktopLabel = Boolean(fixedCut) || width.matches;
      node.setAttribute("aria-label", desktopLabel ? labelDesktop : labelMobile);
    };

    const loadSources = (cut: Cut) => {
      const key = `${cut.webm}|${cut.mp4}`;
      if (loadedKey === key && node.querySelector("source")) return;
      loadedKey = key;
      const webm = document.createElement("source");
      webm.src = cut.webm;
      webm.type = "video/webm";
      const mp4 = document.createElement("source");
      mp4.src = cut.mp4;
      mp4.type = "video/mp4";
      node.replaceChildren(webm, mp4);
      node.load();
    };

    const tryPlay = async () => {
      applyPoster();
      if (motion.matches) {
        node.pause();
        mark(root, false, true);
        return;
      }
      if (root.getClientRects().length === 0) return;
      const cut = current();
      node.muted = true;
      node.defaultMuted = true;
      node.playsInline = true;
      node.loop = true;
      node.autoplay = true;
      node.preload = "metadata";
      loadSources(cut);
      try {
        await node.play();
        mark(root, true, false);
      } catch (error) {
        console.error("[le-vele] autoplay failed", error);
        mark(root, false, true);
      }
    };

    applyPoster();
    if (motion.matches) mark(root, false, true);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void tryPlay();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(root);

    const onChange = () => {
      loadedKey = "";
      void tryPlay();
    };
    motion.addEventListener("change", onChange);
    if (!fixedCut) width.addEventListener("change", onChange);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", onChange);
      if (!fixedCut) width.removeEventListener("change", onChange);
    };
  }, [fixedCut, labelDesktop, labelMobile]);

  const onPlay = async () => {
    const node = video.current;
    const root = stage.current;
    if (!node || !root) return;
    const wide = window.matchMedia(WIDE).matches;
    const cut = fixedCut ?? cutFor(wide);
    node.muted = true;
    node.defaultMuted = true;
    node.playsInline = true;
    node.loop = true;
    if (!node.querySelector("source")) {
      const webm = document.createElement("source");
      webm.src = cut.webm;
      webm.type = "video/webm";
      const mp4 = document.createElement("source");
      mp4.src = cut.mp4;
      mp4.type = "video/mp4";
      node.replaceChildren(webm, mp4);
      node.preload = "metadata";
      node.load();
      await new Promise<void>((resolve) => node.addEventListener("loadeddata", () => resolve(), { once: true }));
    }
    try {
      await node.play();
      mark(root, true, false);
    } catch (error) {
      console.error("[le-vele] play failed", error);
      mark(root, false, true);
    }
  };

  const poster = fixedCut?.poster ?? LE_VELE_MEDIA.desktop.poster;

  return (
    <div className={variant === "fill" ? "lv-stage lv-stage-fill" : "lv-stage"} ref={stage}>
      <video
        ref={video}
        className="lv-video"
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        aria-label={labelDesktop}
      />
      <img className="lv-still" src={poster} alt="" />
      <button type="button" className="lv-play" aria-label={playLabel} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void onPlay(); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
