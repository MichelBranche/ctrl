"use client";

import { scheduleRefresh } from "@/lib/refresh";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { dict, type Locale } from "@/lib/i18n";
import "./page-transition.css";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const COLS = 5;
const WAIT_MS = 4000;
const BOOT_MIN_MS = 600;
const BOOT_MAX_MS = 2500;

/** Lets the page's own entrance motion start (home hero, page titles, scroll reveals). */
function signalReady() {
  const html = document.documentElement;
  if (html.classList.contains("is-ready")) return;
  html.classList.add("is-ready");
  window.dispatchEvent(new Event("ctrl:ready"));
}

/** Mascot pops in with a squish once the first-load cover has lifted. */
function popMascot() {
  document.documentElement.classList.remove("pt-booting");
  // Animate the mascot, not .ca-root: a transform left on the fixed root becomes the containing block
  // of the mobile panel (position: fixed) and squeezes it to the launcher's width.
  const el = document.querySelector<HTMLElement>(".ca-launcher .ctrl-mascot");
  if (!el) return;
  gsap.fromTo(
    el,
    { scale: 0, yPercent: 40, transformOrigin: "100% 100%" },
    {
      keyframes: [
        { scale: 1.12, scaleY: 0.86, yPercent: 0, duration: 0.32, ease: "power3.out" },
        { scale: 0.96, scaleY: 1.06, duration: 0.16, ease: "sine.inOut" },
        { scale: 1, scaleY: 1, duration: 0.3, ease: "elastic.out(1, 0.5)" },
      ],
      onComplete: () => void gsap.set(el, { clearProps: "transform" }),
    },
  );
}

/** Fonts loaded (at least BOOT_MIN_MS, at most BOOT_MAX_MS after start). */
function bootReady() {
  const start = performance.now();
  const fonts = document.fonts?.ready ?? Promise.resolve();
  const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true }));
  const ready = Promise.all([fonts, loaded]).then(
    () => new Promise<void>((r) => window.setTimeout(r, Math.max(0, BOOT_MIN_MS - (performance.now() - start)))),
  );
  return Promise.race([ready, new Promise<void>((r) => window.setTimeout(r, BOOT_MAX_MS))]);
}

/** Destination label shown on the cover: the page name in the destination language. */
function labelFor(path: string) {
  const lang: Locale = path === "/en" || path.startsWith("/en/") ? "en" : "it";
  const rest = lang === "en" ? path.slice(3) || "/" : path;
  const seg = rest.split("/")[1] ?? "";
  const nav = dict[lang].nav;
  const map: Record<string, string> = {
    projects: nav.work,
    services: nav.services,
    team: nav.team,
    journal: nav.journal,
    contact: nav.contact,
  };
  return map[seg] ?? "CTRL®";
}

/** Returns the internal pathname to animate to, or null when the click should be left alone. */
function targetOf(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = (event.target as HTMLElement | null)?.closest("a");
  if (link?.hasAttribute("data-preview")) return null;
  if (!link || link.closest("[data-no-transition]")) return null;
  if (link.target && link.target !== "_self") return null;
  if (link.hasAttribute("download")) return null;
  const raw = link.getAttribute("href");
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return null;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same page (hash or query-only change, e.g. filters): let the page handle it.
  if (url.pathname === window.location.pathname) return null;
  if (url.pathname.startsWith("/admin") || window.location.pathname.startsWith("/admin")) return null;
  if (url.pathname.startsWith("/api")) return null;
  return url.pathname + url.search + url.hash;
}

export function PageTransition() {
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const arrived = useRef<(() => void) | null>(null);
  const busy = useRef(false);

  // Resolve the pending transition once the new route has rendered.
  useEffect(() => {
    const done = arrived.current;
    if (!done) return;
    arrived.current = null;
    done();
  }, [pathname]);

  useGSAP(
    (_ctx, contextSafe) => {
      const el = root.current;
      const text = label.current;
      if (!el || !text || !contextSafe) return;
      const cols = gsap.utils.toArray<HTMLElement>(".pt-col", el);
      const strip = el.querySelector<HTMLElement>(".pt-strip");
      const meta = el.querySelector<HTMLElement>(".pt-meta");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

      const waitForRoute = () =>
        new Promise<void>((resolve) => {
          const timer = window.setTimeout(() => {
            arrived.current = null;
            resolve();
          }, WAIT_MS);
          arrived.current = () => {
            window.clearTimeout(timer);
            resolve();
          };
        });

      const toTop = () => {
        window.__lenis?.scrollTo(0, { immediate: true, force: true });
        window.scrollTo(0, 0);
      };

      const finish = () => {
        gsap.set(el, { autoAlpha: 0 });
        el.removeAttribute("data-active");
        window.__lenis?.start();
        document.documentElement.classList.remove("pt-running");
        busy.current = false;
        scheduleRefresh();
      };

      const run = contextSafe(async (href: string) => {
        busy.current = true;
        document.documentElement.classList.add("pt-running");
        window.__lenis?.stop();
        el.setAttribute("data-active", "");
        const arrival = waitForRoute();

        if (reduce.matches) {
          gsap.set([cols, strip, meta, text], { clearProps: "all" });
          gsap.set(cols, { yPercent: 0 });
          gsap.set(strip, { autoAlpha: 0 });
          text.textContent = "";
          await new Promise<void>((resolve) => gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15, onComplete: resolve }));
          router.push(href, { scroll: false });
          await arrival;
          toTop();
          await new Promise<void>((resolve) => gsap.to(el, { autoAlpha: 0, duration: 0.2, onComplete: resolve }));
          finish();
          return;
        }

        text.textContent = labelFor(new URL(href, window.location.href).pathname);
        const split = SplitText.create(text, { type: "chars", mask: "chars" });

        gsap.set(el, { autoAlpha: 1 });
        gsap.set(cols, { yPercent: 100 });
        gsap.set(strip, { yPercent: 100, autoAlpha: 1 });
        gsap.set(split.chars, { yPercent: 110 });
        gsap.set(meta, { autoAlpha: 0, y: 12 });

        const cover = gsap.timeline({ defaults: { ease: "power3.inOut" } });
        cover
          .to(strip, { yPercent: 0, duration: 0.38 }, 0)
          .to(cols, { yPercent: 0, duration: 0.42, stagger: 0.035 }, 0.04)
          .to(split.chars, { yPercent: 0, duration: 0.36, ease: "power3.out", stagger: 0.018 }, 0.24)
          .to(meta, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0.28);

        // Start loading the route as soon as the screen is covered.
        await new Promise<void>((resolve) => cover.eventCallback("onComplete", () => resolve()));
        router.push(href, { scroll: false });
        await arrival;
        toTop();
        scheduleRefresh();

        const reveal = gsap.timeline({ defaults: { ease: "power3.inOut" } });
        reveal
          .to(split.chars, { yPercent: -110, duration: 0.26, ease: "power2.in", stagger: 0.012 }, 0)
          .to(meta, { autoAlpha: 0, duration: 0.2 }, 0)
          .to(cols, { yPercent: -100, duration: 0.44, stagger: 0.035 }, 0.12)
          .to(strip, { yPercent: -100, duration: 0.4 }, 0.26);
        await new Promise<void>((resolve) => reveal.eventCallback("onComplete", () => resolve()));
        split.revert();
        text.textContent = "";
        finish();
      });

      // First load: the cover is SSR'd already covering (data-boot); letters rise, then it lifts.
      const boot = contextSafe(async () => {
        busy.current = true;
        window.__lenis?.stop();
        el.setAttribute("data-active", "");
        const ready = bootReady();
        if (reduce.matches) {
          await ready;
          signalReady();
          await new Promise<void>((resolve) => gsap.to(el, { autoAlpha: 0, duration: 0.25, onComplete: resolve }));
          el.removeAttribute("data-boot");
          finish();
          popMascot();
          return;
        }
        text.textContent = labelFor(window.location.pathname);
        const split = SplitText.create(text, { type: "chars", mask: "chars" });
        gsap.set(el, { autoAlpha: 1 });
        gsap.set(cols, { yPercent: 0 });
        gsap.set(strip, { yPercent: 0, autoAlpha: 1 });
        gsap.set(meta, { autoAlpha: 0, y: 12 });
        el.removeAttribute("data-boot");
        const enter = gsap.timeline();
        enter
          .from(split.chars, { yPercent: 110, duration: 0.5, ease: "power3.out", stagger: 0.025 }, 0.05)
          .to(meta, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, 0.15);
        await Promise.all([ready, new Promise<void>((resolve) => enter.eventCallback("onComplete", () => resolve()))]);
        if (!window.location.hash) toTop();
        const reveal = gsap.timeline({ defaults: { ease: "power3.inOut" } });
        reveal
          .to(split.chars, { yPercent: -110, duration: 0.26, ease: "power2.in", stagger: 0.012 }, 0)
          .to(meta, { autoAlpha: 0, duration: 0.2 }, 0)
          .to(cols, { yPercent: -100, duration: 0.5, stagger: 0.04 }, 0.12)
          .to(strip, { yPercent: -100, duration: 0.45 }, 0.3)
          // Hero entrance starts as the columns lift, so it lands as the page appears.
          .add(signalReady, 0.3);
        await new Promise<void>((resolve) => reveal.eventCallback("onComplete", () => resolve()));
        split.revert();
        text.textContent = "";
        finish();
        popMascot();
      });
      if (el.hasAttribute("data-boot")) void boot();

      const onClick = (event: MouseEvent) => {
        const href = targetOf(event);
        if (!href) return;
        // Next's Link skips its own navigation when the default is prevented; its onClick (menu close) still runs.
        event.preventDefault();
        if (busy.current) return;
        void run(href);
      };

      window.addEventListener("click", onClick, true);
      return () => window.removeEventListener("click", onClick, true);
    },
    { scope: root },
  );

  return (
    <div className="pt-root" ref={root} aria-hidden="true" data-boot="">
      <div className="pt-strip" />
      {Array.from({ length: COLS }, (_, i) => (
        <div className="pt-col" key={i} />
      ))}
      <div className="pt-stage">
        <p className="pt-label" ref={label} />
        <p className="pt-meta">
          <span>CTRL®</span>
          <span>Aosta, IT</span>
        </p>
      </div>
    </div>
  );
}
