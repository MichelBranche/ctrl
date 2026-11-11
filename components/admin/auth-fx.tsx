"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";

const finePointer = () => typeof window !== "undefined" && matchMedia("(pointer: fine)").matches;

/**
 * Login backdrop: grid, slow conic aura, animated grain tile and an orange glow that eases toward the pointer.
 * One rAF loop writes a single transform (compositor only) and stops itself once the glow has settled.
 */
export function AuthBackdrop() {
  const glow = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = glow.current;
    if (!el) return;
    let tx = innerWidth * 0.5, ty = innerHeight * 0.35, x = tx, y = ty, raf = 0;
    const paint = () => { el.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
    paint();
    if (reduce || !finePointer()) return;
    const tick = () => {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08; paint();
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => { tx = e.clientX; ty = e.clientY; if (!raf) raf = requestAnimationFrame(tick); };
    addEventListener("pointermove", move, { passive: true });
    return () => { removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, [reduce]);
  return (
    <div className="adm-auth-bg" aria-hidden="true">
      <div className="adm-auth-aura" />
      <div className="adm-auth-grid" />
      <div ref={glow} className="adm-auth-glow" />
      <div className="adm-auth-grain" />
      <div className="adm-auth-vignette" />
    </div>
  );
}

/** Trailing orange ring over the site's pixel cursor. pointer:fine only, off with reduced motion. */
export function AuthCursor() {
  const ring = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ring.current;
    if (!el || reduce || !finePointer()) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, seen = false;
    const tick = () => {
      x += (tx - x) * 0.22; y += (ty - y) * 0.22;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY;
      if (!seen) { seen = true; x = tx; y = ty; el.classList.add("is-on"); }
      const t = e.target as Element | null;
      el.classList.toggle("is-text", Boolean(t?.closest("input:not([type=checkbox]), textarea")));
      el.classList.toggle("is-hover", Boolean(t?.closest("a, button:not(:disabled), label, [role=button]")) && !t?.closest("input"));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const down = () => el.classList.add("is-down");
    const up = () => el.classList.remove("is-down");
    const leave = () => { el.classList.remove("is-on"); seen = false; };
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      removeEventListener("pointermove", move); removeEventListener("pointerdown", down); removeEventListener("pointerup", up);
      document.documentElement.removeEventListener("pointerleave", leave); cancelAnimationFrame(raf);
    };
  }, [reduce]);
  return <div ref={ring} className="adm-cursor" aria-hidden="true" />;
}

/** Chrome CTRL mark that tilts a few degrees toward the pointer (3D via perspective, transform only). */
export function ChromeMark() {
  const reduce = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  useEffect(() => {
    if (reduce || !finePointer()) return;
    const move = (e: PointerEvent) => {
      ry.set(((e.clientX / innerWidth) - 0.5) * 24);
      rx.set(-((e.clientY / innerHeight) - 0.5) * 24);
    };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, [reduce, rx, ry]);
  return (
    <motion.span className="adm-auth-mark" aria-hidden="true" style={{ rotateX: rx, rotateY: ry, transformPerspective: 400 }}>
      <span>C</span><i />
    </motion.span>
  );
}

/** Button that leans a few pixels toward the pointer while hovered (pointer:fine, no reduced motion). */
export function MagneticButton({ children, ...props }: Omit<ComponentProps<typeof motion.button>, "children"> & { children: ReactNode }) {
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 300, damping: 20 });
  const y = useSpring(0, { stiffness: 300, damping: 20 });
  const on = !reduce && finePointer();
  return (
    <motion.button
      {...props}
      style={{ x, y }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      onPointerMove={(e) => {
        if (!on) return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * 8);
        y.set(((e.clientY - r.top) / r.height - 0.5) * 6);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.button>
  );
}
