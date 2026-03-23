// LandingHero.tsx — Single-line headline, Brand exact gradient, correct scale
import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";

const features = [
  { text: "AI-Powered" },
  { text: "Curriculum-Aligned" },
  { text: "Real Analytics" },
  { text: "Instant Generation" },
  { text: "PDF & DOCX Export" },
  { text: "Answer Key Included" },
];

const CENTER_X = 300;
const CENTER_Y = 140;

// New Brand Gradient: Green -> Teal -> Blue -> Purple
const BRAND_GRADIENT = "linear-gradient(90deg, #4ade80, #2dd4bf, #60a5fa, #818cf8, #4ade80, #2dd4bf, #60a5fa, #818cf8)";

export default function LandingHero() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const mx = useMotionValue(CENTER_X);
  const my = useMotionValue(CENTER_Y);
  const sp = { stiffness: 120, damping: 18, mass: 0.5 };

  const blobX = useSpring(useTransform(mx, v => v / 14), sp);
  const blobY = useSpring(useTransform(my, v => v / 14), sp);
  const badgeX = useSpring(useTransform(mx, v => v / 28), sp);
  const badgeY = useSpring(useTransform(my, v => v / 28), sp);
  const magX = useSpring(useTransform(mx, v => Math.max(-6, Math.min(6, (v - CENTER_X) / 20))), sp);
  const magY = useSpring(useTransform(my, v => Math.max(-2, Math.min(2, (v - CENTER_Y) / 35))), sp);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  useEffect(() => { mx.set(CENTER_X); my.set(CENTER_Y); }, []);

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative isolate overflow-hidden flex items-center"
      style={{
        background: isDark ? "#07090f" : "#ffffff",
        minHeight: "90vh",
      }}
    >
      {/* Brand Animation Keyframes */}
      <style>{`
        @keyframes fast-gradient {
          0% { background-position: 0% center; }
          100% { background-position: -200% center; }
        }
      `}</style>

      {/* ── Ambient orbs ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Purple Orb */}
        <div className="absolute -top-40 -right-40 h-[550px] w-[550px] rounded-full"
          style={{ background: isDark ? "radial-gradient(circle,rgba(129,140,248,0.14) 0%,transparent 65%)" : "radial-gradient(circle,rgba(129,140,248,0.07) 0%,transparent 65%)", filter: "blur(70px)" }} />
        {/* Green Orb */}
        <div className="absolute bottom-0 -left-20 h-[420px] w-[420px] rounded-full"
          style={{ background: isDark ? "radial-gradient(circle,rgba(74,222,128,0.12) 0%,transparent 65%)" : "radial-gradient(circle,rgba(74,222,128,0.06) 0%,transparent 65%)", filter: "blur(80px)" }} />
        {/* Blue Orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[700px] rounded-full"
          style={{ background: isDark ? "radial-gradient(ellipse,rgba(96,165,250,0.07) 0%,transparent 60%)" : "radial-gradient(ellipse,rgba(96,165,250,0.04) 0%,transparent 60%)", filter: "blur(90px)" }} />
      </div>

      {/* Mouse blob */}
      <motion.div style={{ x: blobX, y: blobY }}
        className="absolute -top-24 -left-24 h-[32rem] w-[32rem] rounded-full -z-10 pointer-events-none" aria-hidden>
        <div className="h-full w-full rounded-full"
          style={{ background: "radial-gradient(closest-side,rgba(45,212,191,0.07),transparent 80%)", filter: "blur(50px)" }} />
      </motion.div>

      {/* Ultra-fine grid */}
      <div className="absolute inset-0 -z-10 [background-size:56px_56px]"
        style={{
          opacity: isDark ? 0.03 : 0.015,
          backgroundImage: "linear-gradient(to right,rgba(45,212,191,0.5) 1px,transparent 1px),linear-gradient(to bottom,rgba(129,140,248,0.5) 1px,transparent 1px)",
        }} />

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
        style={{ background: isDark ? "linear-gradient(0deg,#07090f,transparent)" : "linear-gradient(0deg,#fff,transparent)" }} />

      <CornerArrows isDark={isDark} />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-28 md:pt-32 pb-16 md:pb-24">

        {/* Badge */}
        <div className="flex justify-center">
          <motion.div
            className="mb-7 inline-flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              x: badgeX, y: badgeY,
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.75)",
              border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.08)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              boxShadow: isDark
                ? "0 2px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)"
                : "0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)",
            }}>
            <Sparkles className="h-3.5 w-3.5" style={{ color: isDark ? "#4ade80" : "#2dd4bf" }} />
            <span className="text-xs md:text-sm font-medium" style={{ color: isDark ? "#4ade80" : "#2dd4bf" }}>
              Think Beyond
            </span>
          </motion.div>
        </div>

        {/* ── Headline ── */}
        <div className="text-center relative z-10">
          <h1 className="font-halenoir font-bold tracking-[-0.02em]" style={{ lineHeight: 1 }}>

            {/*
              KEY FIX: whitespace-nowrap forces single line.
              font-size uses clamp capped lower so it fits on one line at all widths.
              "Smartest." = solid color, "Tests.Ever." = gradient
            */}
            <span
              className="block whitespace-nowrap"
              style={{
                fontSize: "clamp(1.8rem, 7.5vw, 7.2rem)",
                color: isDark ? "#f8fafc" : "#111111",
              }}>
              Smartest.{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: BRAND_GRADIENT,
                  backgroundSize: "200% auto",
                  animation: "fast-gradient 4s linear infinite",
                  WebkitBackgroundClip: "text",
                }}>
                Tests.Ever.
              </span>
            </span>

            {/* Subtitle */}
            <span
              className="mt-5 md:mt-6 block font-semibold tracking-[-0.01em]"
              style={{
                fontSize: "clamp(1rem, 2.2vw, 2.2rem)",
                lineHeight: 1.15,
                color: isDark ? "#8a9bb0" : "#3c4043",
              }}>
              The Teacher's Assessment Co-Pilot
            </span>
          </h1>

          {/* Description */}
          <p
            className="mx-auto mt-5 md:mt-7 max-w-[300px] sm:max-w-lg md:max-w-2xl leading-relaxed"
            style={{ fontSize: "clamp(0.9rem, 1.2vw, 1.1rem)", color: isDark ? "#5f6b7a" : "#5f6368" }}>
            Generate &amp; host curriculum-perfect tests in under 2 minutes — then track what actually matters.
          </p>

          {/* ── CTAs ── */}
          <div className="relative mt-9 md:mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">

            {/* Primary — black glossy */}
            <motion.div style={{ x: magX, y: magY }} className="isolate w-full sm:w-auto">
              <Link to="/contact" className="w-full block">
                <button
                  className="group w-full sm:w-auto relative overflow-hidden transition-all duration-200 hover:-translate-y-[2px] flex items-center justify-center gap-2.5 font-semibold text-white"
                  style={{
                    height: 50,
                    paddingLeft: 36,
                    paddingRight: 36,
                    fontSize: "0.95rem",
                    borderRadius: 16,
                    background: isDark
                      ? "linear-gradient(180deg,#1c2333 0%,#0d1117 100%)"
                      : "linear-gradient(180deg,#202124 0%,#111111 100%)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    boxShadow: [
                      "inset 0 1px 0 rgba(255,255,255,0.16)",
                      "inset 0 -1px 0 rgba(0,0,0,0.3)",
                      "0 1px 3px rgba(0,0,0,0.4)",
                      "0 8px 24px rgba(0,0,0,0.3)",
                    ].join(", "),
                    backdropFilter: "blur(12px) saturate(180%)",
                  }}>
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 rounded-t-[16px]"
                    style={{ height: "50%", background: "linear-gradient(180deg,rgba(255,255,255,0.18) 0%,transparent 100%)" }} />
                  <ArrowRight className="h-4 w-4 relative z-10 flex-shrink-0" />
                  <span className="relative z-10">Get Free Domain</span>
                </button>
              </Link>
            </motion.div>

            {/* Secondary — frosted macOS glass */}
            <div className="isolate w-full sm:w-auto">
              <Link to="/login" className="w-full block">
                <button
                  className="w-full sm:w-auto relative overflow-hidden transition-all duration-200 hover:-translate-y-[2px] flex items-center justify-center gap-2.5 font-semibold"
                  style={{
                    height: 50,
                    paddingLeft: 36,
                    paddingRight: 36,
                    fontSize: "0.95rem",
                    borderRadius: 16,
                    background: isDark ? "rgba(60,60,65,0.7)" : "rgba(235,235,240,0.85)",
                    border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.12)",
                    backdropFilter: "blur(28px) saturate(180%)",
                    WebkitBackdropFilter: "blur(28px) saturate(180%)",
                    color: isDark ? "#e8eaed" : "#202124",
                    boxShadow: isDark
                      ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.4)"
                      : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 10px rgba(0,0,0,0.07)",
                  }}>
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 rounded-t-[16px]"
                    style={{ height: "50%", background: isDark ? "linear-gradient(180deg,rgba(255,255,255,0.1) 0%,transparent 100%)" : "linear-gradient(180deg,rgba(255,255,255,0.8) 0%,transparent 100%)" }} />
                  <Play className="h-4 w-4 relative z-10 flex-shrink-0" />
                  <span className="relative z-10">Login (FREE 100 Coins)</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Marquee */}
          <div className="relative mt-12 md:mt-16 overflow-hidden">
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="flex gap-3 whitespace-nowrap">
              {[...Array(2)].flatMap(() => features).map((f, i) => (
                <div key={i}
                  className="inline-flex items-center gap-2.5 rounded-full px-5 py-2.5"
                  style={{
                    fontSize: "0.8rem",
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.82)",
                    border: isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.07)",
                    backdropFilter: "blur(20px) saturate(160%)",
                    WebkitBackdropFilter: "blur(20px) saturate(160%)",
                    color: isDark ? "#8a9bb0" : "#3c4043",
                    boxShadow: isDark
                      ? "inset 0 1px 0 rgba(255,255,255,0.05)"
                      : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 8px rgba(0,0,0,0.05)",
                  }}>
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ background: BRAND_GRADIENT, backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" }} />
                  {f.text}
                </div>
              ))}
            </motion.div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-20"
              style={{ background: isDark ? "linear-gradient(90deg,#07090f,transparent)" : "linear-gradient(90deg,#fff,transparent)" }} />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20"
              style={{ background: isDark ? "linear-gradient(270deg,#07090f,transparent)" : "linear-gradient(270deg,#fff,transparent)" }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Corner Arrows ── */
function CornerArrows({ isDark }: { isDark: boolean }) {
  return (
    <>
      <div className="md:hidden">
        <KeycapArrow pos="right-4 top-[15%]" size={48} tilt={6} dir="SW" isDark={isDark} />
        <KeycapArrow pos="left-4 bottom-[22%]" size={50} tilt={-4} dir="NE" isDark={isDark} />
      </div>
      <div className="hidden md:block">
        <KeycapArrow pos="right-12 top-[22%]" size={64} tilt={6} dir="SW" isDark={isDark} />
        <KeycapArrow pos="left-10 bottom-[44%]" size={64} tilt={4} dir="NE" isDark={isDark} />
      </div>
    </>
  );
}

function KeycapArrow({ pos, size = 64, tilt = 0, dir = "NE", isDark }: {
  pos: string; size?: number; tilt?: number; dir?: "NE" | "NW" | "SE" | "SW"; isDark: boolean;
}) {
  return (
    <motion.div
      className={`absolute ${pos} rounded-xl md:rounded-2xl overflow-hidden`}
      style={{
        width: size, height: size,
        transform: `rotate(${tilt}deg)`,
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.82)",
        border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.08)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        boxShadow: isDark
          ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)"
          : "inset 0 1px 0 rgba(255,255,255,1), 0 8px 24px rgba(0,0,0,0.1)",
      }}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: "50%", background: isDark ? "linear-gradient(180deg,rgba(255,255,255,0.08) 0%,transparent 100%)" : "linear-gradient(180deg,rgba(255,255,255,0.7) 0%,transparent 100%)" }} />
      <div className="relative flex h-full w-full items-center justify-center">
        <ArrowGlyph dir={dir} />
      </div>
    </motion.div>
  );
}

function ArrowGlyph({ dir }: { dir: "NE" | "NW" | "SE" | "SW" }) {
  const rot = dir === "NE" ? 0 : dir === "SE" ? 90 : dir === "SW" ? 180 : 270;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${rot}deg)` }}>
      <defs>
        <linearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="33%" stopColor="#2dd4bf" />
          <stop offset="66%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <path d="M6 14l8-8m0 0H9m5 0v5" stroke="url(#ag)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}