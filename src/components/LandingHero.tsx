// LandingHero.tsx — Clean White Layout with Tricolor (Independence) theming
import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { ArrowRight, Crown, Sparkles } from "lucide-react";
import { useEffect, useCallback, useState } from "react";

const features = [
  { text: "NCERT-Aligned" },
  { text: "CBSE Pattern Ready" },
  { text: "PDF & DOCX Export" },
  { text: "Answer Key Included" },
  { text: "Section-wise Papers" },
  { text: "Bloom's Taxonomy" },
];

const CENTER_X = 300;
const CENTER_Y = 140;

// 🇮🇳 Standard Indian tricolor (Saffron, Soft White, Green).
// Green updated back to brighter #138808
const TRICOLOR_GRADIENT =
  "linear-gradient(90deg, #FF9933, #F3F4F6, #138808, #FF9933, #F3F4F6, #138808, #FF9933)";
const BRAND_GRADIENT_DEFAULT =
  "linear-gradient(90deg, #4ade80, #2dd4bf, #60a5fa, #818cf8, #4ade80, #2dd4bf, #60a5fa, #818cf8)";

// Festive control
const FORCE_TRICOLOR: boolean | null = true;
const isIndependenceWeek = () => {
  const n = new Date();
  return n.getMonth() === 7 && n.getDate() >= 11 && n.getDate() <= 17;
};

const EASE = [0.16, 1, 0.3, 1] as const;

const isTouchDevice = () =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

export default function LandingHero() {
  const [isTouch, setIsTouch] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [festive, setFestive] = useState(FORCE_TRICOLOR === true);

  useEffect(() => {
    setIsTouch(isTouchDevice());
    setFestive(FORCE_TRICOLOR ?? isIndependenceWeek());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const heroGradient = festive ? TRICOLOR_GRADIENT : BRAND_GRADIENT_DEFAULT;
  const gradAnim = reduce ? "none" : "fast-gradient 4s linear infinite";

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4, delay } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE },
        };

  const mx = useMotionValue(CENTER_X);
  const my = useMotionValue(CENTER_Y);
  const sp = { stiffness: 120, damping: 18, mass: 0.5 };

  const badgeX = useSpring(useTransform(mx, (v) => v / 28), sp);
  const badgeY = useSpring(useTransform(my, (v) => v / 28), sp);
  const magX = useSpring(useTransform(mx, (v) => Math.max(-6, Math.min(6, (v - CENTER_X) / 20))), sp);
  const magY = useSpring(useTransform(mx, (v) => Math.max(-2, Math.min(2, (v - CENTER_Y) / 35))), sp);

  const noMagnet = isTouch || reduce;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (noMagnet) return;
      const r = e.currentTarget.getBoundingClientRect();
      mx.set(e.clientX - r.left);
      my.set(e.clientY - r.top);
    },
    [noMagnet, mx, my]
  );

  useEffect(() => {
    mx.set(CENTER_X);
    my.set(CENTER_Y);
  }, []);

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative isolate overflow-hidden flex items-center justify-center bg-white w-full"
      style={{ minHeight: "min(90vh, 900px)" }}
    >
      <style>{`
        @keyframes fast-gradient {
          0%   { background-position: 0% center; }
          100% { background-position: -200% center; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .hero-black-glossy-btn {
          background: linear-gradient(180deg, #252629 0%, #0d0d0e 100%) !important;
          background-color: #0d0d0e !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.16) !important;
          color-scheme: light only !important;
          forced-color-adjust: none !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 14px rgba(0,0,0,0.3) !important;
        }
        .hero-black-glossy-btn * { color: #ffffff !important; stroke: #ffffff !important; }

        .hero-white-frosted-btn {
          background: rgba(255, 255, 255, 0.75) !important;
          background-color: rgba(255, 255, 255, 0.75) !important;
          color: #202124 !important;
          border: 1px solid #e5e7eb !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          color-scheme: light only !important;
          forced-color-adjust: none !important;
          box-shadow: inset 0 1px 0 #ffffff, 0 2px 8px rgba(0,0,0,0.04) !important;
        }
        .hero-white-frosted-btn * { color: #202124 !important; }
        .hero-white-frosted-btn .crown-icon {
          color: var(--crown) !important;
          stroke: var(--crown) !important;
        }
      `}</style>

      {/* ── Background: COMPLETELY WHITE (Removed Gradients) ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-white z-0" />

      {/* ── Center Ashoka Chakra Watermark (festive only) ── */}
      {festive && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[45%] w-[350px] h-[350px] md:w-[550px] md:h-[550px] opacity-[0.03] pointer-events-none z-0 flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full text-[#000080]" /* Navy Blue for Chakra */
            stroke="currentColor"
            fill="none"
            style={{ animation: reduce ? "none" : "spin-slow 40s linear infinite" }}
          >
            <circle cx="50" cy="50" r="46" strokeWidth="2.5" />
            <circle cx="50" cy="50" r="5" fill="currentColor" stroke="none" />
            {[...Array(24)].map((_, i) => (
              <line key={i} x1="50" y1="50" x2="50" y2="4" strokeWidth="1.2" transform={`rotate(${i * 15} 50 50)`} />
            ))}
          </svg>
        </div>
      )}

      {/* ── Content Layout ── */}
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8 pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-16 md:pb-24 bg-transparent relative z-10 flex flex-col items-center">

        {/* Badge */}
        <motion.div className="flex justify-center w-full" {...rise(0.05)}>
          <motion.div
            className="mb-5 sm:mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 border bg-white/80 border-neutral-200 shadow-sm backdrop-blur-md"
            style={{ x: noMagnet ? 0 : badgeX, y: noMagnet ? 0 : badgeY }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: festive ? "#FF9933" : "#14b8a6" }} />
            <span className="text-xs sm:text-sm font-medium text-neutral-700">Built for CBSE Teachers</span>
          </motion.div>
        </motion.div>

        {/* ── Headline Block ── */}
        <div className="text-center relative z-10 w-full">
          <motion.h1 className="font-halenoir font-bold tracking-[-0.02em]" style={{ lineHeight: 1 }} {...rise(0.15)}>
            <span className="block lg:whitespace-nowrap text-neutral-900" style={{ fontSize: "clamp(2.4rem, 8vw, 7.2rem)" }}>
              Smartest.{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: heroGradient,
                  backgroundSize: "200% auto",
                  animation: gradAnim,
                  WebkitBackgroundClip: "text",
                  filter: festive ? "drop-shadow(0 1px 1.5px rgba(0,0,0,0.15))" : "none",
                }}
              >
                Tests.Ever.
              </span>
            </span>

            <span
              className="mt-3 sm:mt-5 md:mt-6 block font-semibold tracking-[-0.01em] text-neutral-700"
              style={{ fontSize: "clamp(0.95rem, 2.5vw, 2.2rem)", lineHeight: 1.2 }}
            >
              The Teacher's Assessment Co-Pilot
            </span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-4 sm:mt-5 md:mt-7 max-w-[90%] sm:max-w-lg md:max-w-2xl leading-relaxed text-neutral-500"
            style={{ fontSize: "clamp(0.85rem, 1.3vw, 1.1rem)" }}
            {...rise(0.28)}
          >
            Generate CBSE-pattern test papers from NCERT content in under 2 minutes — section-wise, with answer keys, ready to print.
          </motion.p>

          {/* ── Action Buttons ── */}
          <motion.div
            className="relative mt-7 sm:mt-9 md:mt-12 flex flex-col items-center justify-center gap-3 sm:gap-4 sm:flex-row"
            {...rise(0.4)}
          >
            {/* Try for FREE */}
            <motion.div style={{ x: noMagnet ? 0 : magX, y: noMagnet ? 0 : magY }} className="isolate w-full sm:w-auto">
              <Link to="/dashboard/test-generator" className="w-full block">
                <button
                  className="group w-full sm:w-auto relative overflow-hidden transition-transform duration-200 active:scale-95 flex items-center justify-center gap-2.5 font-semibold hero-black-glossy-btn"
                  style={{ height: 48, paddingLeft: 28, paddingRight: 28, fontSize: "0.93rem", borderRadius: 14 }}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[14px] bg-gradient-to-b from-white/15 to-transparent" />
                  <span className="relative z-10">Try for FREE</span>
                  <ArrowRight className="h-4 w-4 relative z-10 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </Link>
            </motion.div>

            {/* View Pricing */}
            <div className="isolate w-full sm:w-auto">
              <Link to="/pricing" className="w-full block">
                <button
                  className="w-full sm:w-auto relative overflow-hidden transition-all duration-200 active:scale-[0.97] hover:-translate-y-[2px] flex items-center justify-center gap-2.5 font-semibold hero-white-frosted-btn"
                  style={{ height: 48, paddingLeft: 28, paddingRight: 28, fontSize: "0.93rem", borderRadius: 14, ["--crown" as any]: festive ? "#138808" : "#f59e0b" }}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/60 to-transparent" />
                  <Crown className="h-4 w-4 relative z-10 flex-shrink-0 crown-icon" />
                  <span className="relative z-10">View Pricing</span>
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Infinity Marquee */}
          <motion.div className="relative mt-10 sm:mt-12 md:mt-16 overflow-hidden w-full max-w-4xl mx-auto" {...rise(0.55)}>
            <motion.div
              initial={{ x: 0 }}
              animate={reduce ? { x: 0 } : { x: ["0%", "-50%"] }}
              transition={reduce ? { duration: 0 } : { duration: 30, repeat: Infinity, ease: "linear" }}
              className="flex gap-3 whitespace-nowrap will-change-transform"
            >
              {[...Array(2)].flatMap(() => features).map((f, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 border bg-white/60 backdrop-blur-sm border-neutral-200 text-neutral-600 shadow-sm"
                  style={{ fontSize: "0.75rem" }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ background: heroGradient, backgroundSize: "200% auto", animation: gradAnim }}
                  />
                  {f.text}
                </div>
              ))}
            </motion.div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 bg-gradient-to-l from-white to-transparent" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}