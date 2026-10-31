"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

export function SmoothScroll() {
  const pathname = usePathname();
  const first = useRef(true);
  const popped = useRef(false);

  // Back/forward keeps the browser's restored position; new navigations start at the top.
  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Runs only when the pathname changes, so hash links and query-only filter changes keep their scroll.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (popped.current) {
      popped.current = false;
      return;
    }
    if (window.location.hash) return;
    window.__lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    const frame = window.requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    const lenis = new Lenis({
      lerp: 0.075,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.86,
    });

    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);

    const onTick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    const onClick = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const link = (event.target as HTMLElement | null)?.closest("a");
      const href = link?.getAttribute("href");
      if (!href?.startsWith("#")) return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: 0 });
      history.pushState(null, "", href);
    };

    document.addEventListener("click", onClick);
    const refresh = () => ScrollTrigger.refresh();
    const frame = window.requestAnimationFrame(refresh);
    window.addEventListener("load", refresh);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("load", refresh);
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(onTick);
      lenis.destroy();
      delete window.__lenis;
    };
  }, []);

  return null;
}
