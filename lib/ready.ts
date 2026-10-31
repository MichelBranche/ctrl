/** True once the first-load cover has started revealing the page. */
export function isReady() {
  return document.documentElement.classList.contains("is-ready");
}

/** Hold a paused-until-ready intro timeline and play it when the first-load cover reveals. */
export function playWhenReady(tl: { play: () => unknown }) {
  if (isReady()) {
    tl.play();
    return;
  }
  window.addEventListener("ctrl:ready", () => tl.play(), { once: true });
}
