// src/components/contest/results/motion.ts — small JS-driven motion for the results UI.
// The app's lite mode (src/styles/lite.css) turns CSS animations off, so these run on requestAnimationFrame,
// and every one of them is skipped under prefers-reduced-motion.
import { useEffect, useState } from "react";

export function prefersReducedMotion(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    let mq: MediaQueryList;
    try { mq = window.matchMedia("(prefers-reduced-motion: reduce)"); } catch { return; }
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** 0 → target over ms (ease-out); target at once under reduced motion. */
export function useCountUp(target: number, ms = 900, delay = 0): number {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced || !isFinite(target)) { setV(target); return; }
    let raf = 0;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t + delay;
      const k = Math.min(1, Math.max(0, (t - start) / ms));
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay, reduced]);
  return v;
}

/** A small one-off confetti burst on a throw-away canvas (~1.6 s). No-op under reduced motion. */
export function burstConfetti(): void {
  if (prefersReducedMotion() || typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "300" });
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);
  const colours = ["#6366F1", "#8B5CF6", "#F59E0B", "#10B981", "#EC4899", "#1F3A68"];
  const W = window.innerWidth;
  const parts = Array.from({ length: 90 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: window.innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 4, r: Math.random() * 6 + 3,
    c: colours[Math.floor(Math.random() * colours.length)], a: Math.random() * Math.PI,
  }));
  const t0 = performance.now();
  const frame = (t: number) => {
    const el = t - t0;
    ctx.clearRect(0, 0, W, window.innerHeight);
    for (const p of parts) {
      p.vy += 0.25; p.x += p.vx; p.y += p.vy; p.a += 0.15;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - el / 1600);
      ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (el < 1600) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}
