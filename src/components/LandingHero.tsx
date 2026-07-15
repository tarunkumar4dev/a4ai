// LandingHero.tsx — Clean White Layout with Solid Protected Black Glossy Button
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

const BRAND_GRADIENT =
  "linear-gradient(90deg, #4ade80, #2dd4bf, #60a5fa, #818cf8, #4ade80, #2dd4bf, #60a5fa, #818cf8)";

const isTouchDevice = () =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

export default function LandingHero() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(isTouchDevice());
  }, []);

  const mx = useMotionValue(CENTER_X);
  const my = useMotionValue(CENTER_Y);
  const sp = { stiffness: 120, damping: 18, mass: 0.5 };

  const badgeX = useSpring(useTransform(mx, (v) => v / 28), sp);
  const badgeY = useSpring(useTransform(my, (v) => v / 28), sp);
  const magX = useSpring(useTransform(mx, (v) => Math.max(-6, Math.min(6, (v - CENTER_X) / 20))), sp);
  const magY = useSpring(useTransform(mx, (v) => Math.max(-2, Math.min(2, (v - CENTER_Y) / 35))), sp);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isTouch) return;
      const r = e.currentTarget.getBoundingClientRect();
      mx.set(e.clientX - r.left);
      my.set(e.clientY - r.top);
    },
    [isTouch, mx, my]
  );

  useEffect(() => {
    mx.set(CENTER_X);
    my.set(CENTER_Y);
  }, []);

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative isolate overflow-hidden flex items-center bg-white w-full"
      style={{
        minHeight: "min(90vh, 900px)",
      }}
    >
      <style>{`
        @keyframes fast-gradient {
          0%   { background-position: 0% center; }
          100% { background-position: -200% center; }
        }

        /* Enforce exact black layout engine properties against auto inversion */
        .hero-black-glossy-btn {
          background: linear-gradient(180deg, #252629 0%, #0d0d0e 100%) !important;
          background-color: #0d0d0e !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.16) !important;
          color-scheme: light only !important;
          forced-color-adjust: none !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 14px rgba(0,0,0,0.3) !important;
        }
        .hero-black-glossy-btn * {
          color: #ffffff !important;
          stroke: #ffffff !important;
        }

        /* Enforce clean white transparent engine state */
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
        .hero-white-frosted-btn * {
          color: #202124 !important;
        }
        .hero-white-frosted-btn .crown-icon {
          color: #f59e0b !important;
          stroke: #f59e0b !important;
        }
      `}</style>

      {/* Background accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-white">
        <div
          className="absolute -top-40 -right-40 h-[350px] w-[350px] md:h-[550px] md:w-[550px] rounded-full"
          style={{
            background: "radial-gradient(circle,rgba(129,140,248,0.06) 0%,transparent 65%)",
            filter: "blur(50px)",
          }}
        />
        <div
          className="absolute bottom-0 -left-20 h-[260px] w-[260px] md:h-[420px] md:w-[420px] rounded-full"
          style={{
            background: "radial-gradient(circle,rgba(74,222,128,0.05) 0%,transparent 65%)",
            filter: "blur(50px)",
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 md:h-32 bg-gradient-to-t from-white to-transparent" />

      {/* ── Content Layout ── */}
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8 pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-16 md:pb-24 bg-transparent">
        {/* Badge */}
        <div className="flex justify-center">
          <motion.div
            className="mb-5 sm:mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 border bg-white/80 border-neutral-200 shadow-sm backdrop-blur-md"
            style={{ x: isTouch ? 0 : badgeX, y: isTouch ? 0 : badgeY }}
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-500" />
            <span className="text-xs sm:text-sm font-medium text-teal-600">
              Built for CBSE Teachers
            </span>
          </motion.div>
        </div>

        {/* ── Headline Block ── */}
        <div className="text-center relative z-10">
          <h1 className="font-halenoir font-bold tracking-[-0.02em]" style={{ lineHeight: 1 }}>
            <span className="block lg:whitespace-nowrap text-neutral-900" style={{ fontSize: "clamp(2.4rem, 8vw, 7.2rem)" }}>
              Smartest.{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: BRAND_GRADIENT,
                  backgroundSize: "200% auto",
                  animation: "fast-gradient 4s linear infinite",
                  WebkitBackgroundClip: "text",
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
          </h1>

          <p className="mx-auto mt-4 sm:mt-5 md:mt-7 max-w-[90%] sm:max-w-lg md:max-w-2xl leading-relaxed text-neutral-500" style={{ fontSize: "clamp(0.85rem, 1.3vw, 1.1rem)" }}>
            Generate CBSE-pattern test papers from NCERT content in under 2 minutes — section-wise, with answer keys, ready to print.
          </p>

          {/* ── Action Buttons ── */}
          <div className="relative mt-7 sm:mt-9 md:mt-12 flex flex-col items-center justify-center gap-3 sm:gap-4 sm:flex-row">
            {/* Try for FREE Button */}
            <motion.div style={{ x: isTouch ? 0 : magX, y: isTouch ? 0 : magY }} className="isolate w-full sm:w-auto">
              <Link to="/dashboard/test-generator" className="w-full block">
                <button
                  className="group w-full sm:w-auto relative overflow-hidden transition-transform duration-200 active:scale-95 flex items-center justify-center gap-2.5 font-semibold hero-black-glossy-btn"
                  style={{
                    height: 48,
                    paddingLeft: 28,
                    paddingRight: 28,
                    fontSize: "0.93rem",
                    borderRadius: 14,
                  }}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[14px] bg-gradient-to-b from-white/15 to-transparent" />
                  <ArrowRight className="h-4 w-4 relative z-10 flex-shrink-0" />
                  <span className="relative z-10">Try for FREE</span>
                </button>
              </Link>
            </motion.div>

            {/* View Pricing Button */}
            <div className="isolate w-full sm:w-auto">
              <Link to="/pricing" className="w-full block">
                <button
                  className="w-full sm:w-auto relative overflow-hidden transition-all duration-200 active:scale-[0.97] hover:-translate-y-[2px] flex items-center justify-center gap-2.5 font-semibold hero-white-frosted-btn"
                  style={{
                    height: 48,
                    paddingLeft: 28,
                    paddingRight: 28,
                    fontSize: "0.93rem",
                    borderRadius: 14,
                  }}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/60 to-transparent" />
                  <Crown className="h-4 w-4 relative z-10 flex-shrink-0 crown-icon" />
                  <span className="relative z-10">View Pricing</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Infinity Marquee */}
          <div className="relative mt-10 sm:mt-12 md:mt-16 overflow-hidden">
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="flex gap-3 whitespace-nowrap will-change-transform"
            >
              {[...Array(2)].flatMap(() => features).map((f, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 border bg-white border-neutral-200 text-neutral-600 shadow-sm"
                  style={{ fontSize: "0.75rem" }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: BRAND_GRADIENT,
                      backgroundSize: "200% auto",
                      animation: "fast-gradient 4s linear infinite",
                    }}
                  />
                  {f.text}
                </div>
              ))}
            </motion.div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 bg-gradient-to-l from-white to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}