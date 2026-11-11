"use client";

import { useEffect, useRef, useState } from "react";

type Props = { src: string; title: string };

/**
 * The calendar iframe stays out of the network until the slot is near the viewport.
 * loading="lazy" is a second guard once the src is set. A reserved box avoids layout shift.
 */
export function BookingFrame({ src, title }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current;
    const iframe = frame.current;
    if (!el || !iframe) return;
    const show = () => {
      iframe.src = src;
      setReady(true);
    };
    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        show();
        observer.disconnect();
      },
      // 0px: the hero already fills the first screen, so "near" means just as the slot enters.
      { rootMargin: "0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  return (
    <div className="bk-frame" ref={host} inert={!ready}>
      <iframe
        ref={frame}
        className="bk-iframe"
        title={title}
        width={800}
        height={832}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
