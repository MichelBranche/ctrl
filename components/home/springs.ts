/**
 * Damped springs sampled into easing curves, so CSS transitions and GSAP tweens
 * can share the exact same motion.
 *
 * Parameters were fitted on the reference capture (1440x900, virtual clock):
 * - UI: nav pill, dropdown groups, row hover. Damping ratio 0.8, natural
 *   frequency 22.5 rad/s (stiffness 506.25, damping 36, mass 1), settles in
 *   400ms with a 1.5% overshoot.
 * - TEXT: hero title words. Critically damped, 4.6 rad/s, 2000ms, no overshoot.
 */
export type Spring = { zeta: number; omega: number; duration: number };

export const UI_SPRING: Spring = { zeta: 0.8, omega: 22.5, duration: 0.4 };
export const TEXT_SPRING: Spring = { zeta: 1, omega: 4.6, duration: 2 };

function position({ zeta, omega }: Spring, t: number) {
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-omega * t) * (1 + omega * t);
}

/** GSAP ease: progress 0..1 over spring.duration, pinned to 1 at the end. */
export function springEase(spring: Spring) {
  return (p: number) => (p >= 1 ? 1 : position(spring, p * spring.duration));
}

/** CSS linear() easing with the given number of segments. */
export function springLinear(spring: Spring, steps = 40) {
  const stops: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const p = i / steps;
    const v = i === steps ? 1 : position(spring, p * spring.duration);
    stops.push(`${Number(v.toFixed(4))} ${Number((p * 100).toFixed(2))}%`);
  }
  return `linear(${stops.join(", ")})`;
}
