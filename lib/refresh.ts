import { ScrollTrigger } from "gsap/ScrollTrigger";

let frame = 0;

/** Coalesce every ScrollTrigger.refresh() request in a frame into one (refresh forces a full layout). */
export function scheduleRefresh() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    ScrollTrigger.refresh();
  });
}
