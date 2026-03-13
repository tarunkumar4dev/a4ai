// Hero — Ray Monochrome Gradient + Refined Neumorphic Corner Arrows (RESPONSIVE VERIFIED)
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
} from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";

const features = [
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />, text: "AI-Powered" },
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />, text: "Curriculum-Aligned" },
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-600 dark:bg-neutral-300" />, text: "Real Analytics" },
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-700 dark:bg-neutral-200" />, text: "Instant Generation" },
];

const CENTER_X = 300;
const CENTER_Y = 140;

export default function LandingHero() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const mx = useMotionValue(CENTER_X);
  const my = useMotionValue(CENTER_Y);
  const spring = { stiffness: 120, damping: 18, mass: 0.5 };

  const blobX = useSpring(useTransform(mx, (v) => v / 12), spring);
  const blobY = useSpring(useTransform(my, (v) => v / 12), spring);

  const badgeX = useSpring(useTransform(mx, (v) => v / 25), spring);
  const badgeY = useSpring(useTransform(my, (v) => v / 25), spring);

  const magneticX = useSpring(
    useTransform(mx, (v) => Math.max(-6, Math.min(6, (v - CENTER_X) / 20))),
    spring
  );
  const magneticY = useSpring(
    useTransform(my, (v) => Math.max(-2, Math.min(2, (v - CENTER_Y) / 35))),
    spring
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  useEffect(() => {
    mx.set(CENTER_X);
    my.set(CENTER_Y);
  }, []);

  return (
    <section onMouseMove={handleMouseMove} className="relative isolate overflow-hidden min-h-[85vh] flex items-center">

      {/* ── RAY GRADIENT BG BASE ── */}
      <div className="absolute inset-0 -z-20">
        {/* Core Ray Gradient: from brilliant white to deep black, with a sharp, directional light */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: isDark
              ? // Dark Mode: Deep black to charcoal, with a cool blue "ray" highlight
                "radial-gradient(150% 150% at 30% 20%, #0a0c1a 0%, #000000 70%), linear-gradient(125deg, #101624 0%, #000000 100%)"
              : // Light Mode: Bright white to light grey, with a stark white "ray"
                "radial-gradient(150% 150% at 30% 20%, #ffffff 0%, #f0f4fa 70%), linear-gradient(125deg, #ffffff 0%, #eef2f6 100%)",
          }}
        />

        {/* Dark mode: subtle noise for depth, Light mode: very faint noise */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
          }}
        />

        {/* The "Ray" effect: A sharp, directional gradient from white to transparent, overlaid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-overlay dark:mix-blend-soft-light"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 15%, rgba(255,255,255,0) 70%)",
            opacity: isDark ? 0.06 : 0.5,
          }}
        />
         {/* Secondary, cooler ray for depth */}
         <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(800px 400px at 20% 30%, rgba(140, 180, 255, 0.15) 0%, transparent 70%)",
            opacity: isDark ? 0.4 : 0.1,
          }}
        />
      </div>

      {/* ── MINIMALIST GRID ── */}
      <div
        className="absolute inset-0 -z-10 [background-size:48px_48px]"
        style={{
          opacity: isDark ? 0.03 : 0.04,
          backgroundImage: isDark
            ? "linear-gradient(to right, #a0a0a0 1px, transparent 1px), linear-gradient(to bottom, #a0a0a0 1px, transparent 1px)"
            : "linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)",
        }}
      />

      {/* ── VIGNETTE for focus ── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-x-0 bottom-0 h-32 md:h-40"
          style={{
            background: isDark
              ? "linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0))"
              : "linear-gradient(0deg, rgba(255,255,255,0.9), rgba(255,255,255,0))",
          }}
        />
         <div
          className="absolute inset-x-0 top-0 h-32 md:h-40"
          style={{
            background: isDark
              ? "linear-gradient(180deg, rgba(0,0,0,0.8), rgba(0,0,0,0))"
              : "linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0))",
          }}
        />
      </div>

      {/* ── SUBTLE "RAY" BLOBS (Follow mouse, but very faint) ── */}
      <motion.div
        style={{ x: blobX, y: blobY }}
        className="absolute -top-24 -left-24 h-[30rem] md:h-[56rem] w-[30rem] md:w-[56rem] rounded-full blur-[120px] -z-10"
        aria-hidden
      >
        <div
          className="h-full w-full"
          style={{
            background: isDark
              ? "radial-gradient(closest-side, rgba(100, 100, 120, 0.2), transparent 80%)"
              : "radial-gradient(closest-side, rgba(180, 180, 200, 0.15), transparent 80%)",
          }}
        />
      </motion.div>
      <motion.div
        style={{
          x: useTransform(blobX, (v) => -v),
          y: useTransform(blobY, (v) => v / 2),
        }}
        className="absolute -bottom-32 -right-24 h-[30rem] md:h-[52rem] w-[30rem] md:w-[52rem] rounded-full blur-[120px] -z-10"
        aria-hidden
      >
        <div
          className="h-full w-full"
          style={{
            background: isDark
              ? "radial-gradient(closest-side, rgba(80, 80, 140, 0.15), transparent 80%)"
              : "radial-gradient(closest-side, rgba(160, 160, 200, 0.1), transparent 80%)",
          }}
        />
      </motion.div>

      {/* ── Corner Arrows (Refined Neumorphic) ── */}
      <CornerArrows isDark={isDark} />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 md:pt-32 pb-20 md:pb-32">

        {/* ── Badge (High Contrast, subtle glass) ── */}
        <div className="flex justify-center">
          <motion.div
            style={{
              x: badgeX,
              y: badgeY,
              border: isDark
                ? "1px solid rgba(255,255,255,0.15)"
                : "1px solid rgba(0,0,0,0.1)",
              background: isDark
                ? "linear-gradient(180deg, rgba(30,30,40,0.6), rgba(10,10,15,0.8))"
                : "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.8))",
            }}
            className="mb-6 md:mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur-sm transition-colors duration-300"
          >
            <Sparkles
              className="h-4 w-4"
              style={{ color: isDark ? "#a0a0b0" : "#505060" }}
            />
            <span
              className="text-xs md:text-sm font-medium tracking-wide"
              style={{ color: isDark ? "#c0c0d0" : "#303040" }}
            >
              Think Beyond
            </span>
          </motion.div>
        </div>

        {/* ── Headline (Crisp, with a ray-inspired gradient) ── */}
        <div className="text-center relative z-10">
          <h1 className="font-halenoir font-semibold tracking-[-0.01em] md:tracking-[-0.02em] leading-tight md:leading-[0.84]">
            <span
              className="hero-headline block bg-clip-text text-transparent text-[clamp(2.2rem,12vw,3.5rem)] sm:text-[clamp(2.8rem,9vw,4.5rem)] md:text-[clamp(3.5rem,9vw,8.6rem)]"
              style={{
                backgroundImage: isDark
                  ? "linear-gradient(90deg, #f0f0f0 0%, #b0b0c0 35%, #d0d0ff 55%, #f0f0f0 100%)"
                  : "linear-gradient(90deg, #202020 0%, #505060 40%, #202030 100%)",
                backgroundSize: "220% 100%",
                animation: "bg-pan 10s linear infinite",
              }}
            >
              Smartest.Tests.Ever.
            </span>

            <span
              className="mt-4 md:mt-6 block font-halenoir text-[clamp(1.1rem,5vw,1.4rem)] sm:text-[clamp(1.2rem,4vw,1.8rem)] md:text-[clamp(1.35rem,2.8vw,2.6rem)] font-semibold tracking-[-0.01em] md:tracking-[-0.012em] leading-snug md:leading-[1.04]"
              style={{ color: isDark ? "#d0d0e0" : "#303038" }}
            >
              The Teacher's Assessment Co-Pilot
            </span>
          </h1>

          <p
            className="mx-auto mt-5 md:mt-8 max-w-[280px] sm:max-w-md md:max-w-3xl text-[0.95rem] md:text-[clamp(0.98rem,1.4vw,1.125rem)] leading-relaxed"
            style={{ color: isDark ? "#a0a0b0" : "#505060" }}
          >
            Generate & host curriculum-perfect tests in under 2 minutes — then track what actually matters.
          </p>

          {/* ── CTAs (Magnetic, refined, monochrome with a "ray" accent) ── */}
          <div className="relative mt-10 md:mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row px-4">
            {/* glow strip - now a subtle ray */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-4 md:-inset-x-10 top-2 h-12 md:h-16 rounded-2xl blur-2xl"
              style={{
                background: isDark
                  ? "radial-gradient(12rem 4rem at 35% 50%, rgba(180,180,255,0.1), transparent 60%), radial-gradient(10rem 4rem at 70% 50%, rgba(255,255,255,0.05), transparent 60%)"
                  : "radial-gradient(12rem 4rem at 35% 50%, rgba(0,0,0,0.05), transparent 60%), radial-gradient(10rem 4rem at 70% 50%, rgba(50,50,70,0.05), transparent 60%)",
              }}
            />

            <motion.div style={{ x: magneticX, y: magneticY }} className="isolate w-full sm:w-auto">
              <Link to="/contact" className="w-full block">
                <Button
                  size="lg"
                  className="w-full sm:w-auto relative h-14 sm:h-12 rounded-[14px] px-8 text-base font-semibold text-white flex items-center justify-center gap-2 transform-gpu transition-all"
                  style={{
                    background: isDark
                      ? "linear-gradient(180deg, #404050 0%, #101018 100%)"
                      : "linear-gradient(180deg, #303030 0%, #101010 100%)",
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.15)"
                      : "1px solid rgba(0,0,0,0.25)",
                    boxShadow: isDark
                      ? "0 10px 22px rgba(0,0,0,0.8), inset 0 0 0 0.5px rgba(255,255,255,0.2)"
                      : "0 10px 22px rgba(0,0,0,0.25), inset 0 0 0 0.5px rgba(255,255,255,0.5)",
                  }}
                >
                  <ArrowRight className="h-5 w-5" />
                  Get Free Domain
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[14px]"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.00) 42%)" }}
                  />
                </Button>
              </Link>
            </motion.div>

            <div className="isolate w-full sm:w-auto">
              <Link to="/login" className="w-full block">
                <Button
                  size="lg"
                  className="w-full sm:w-auto relative h-14 sm:h-12 rounded-[14px] px-8 text-base font-semibold flex items-center justify-center gap-2 transform-gpu transition-all"
                  style={{
                    background: isDark
                      ? "linear-gradient(180deg, #202030 0%, #000000 100%)"
                      : "linear-gradient(180deg, #f0f0f0 0%, #d0d0d0 100%)",
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid rgba(0,0,0,0.15)",
                    boxShadow: isDark
                      ? "0 10px 22px rgba(0,0,0,0.6), inset 0 0 0 0.5px rgba(255,255,255,0.05)"
                      : "0 10px 22px rgba(0,0,0,0.1), inset 0 0 0 0.5px rgba(255,255,255,0.8)",
                    color: isDark ? "#e0e0f0" : "#202020",
                  }}
                >
                  <Play className="h-5 w-5" />
                  Login (FREE 100 Coins)
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[14px]"
                    style={{
                      background: isDark
                        ? "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.00) 45%)"
                        : "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.00) 45%)",
                    }}
                  />
                </Button>
              </Link>
            </div>
          </div>

          {/* ── Feature Marquee (High contrast) ── */}
          <div className="relative mt-12 md:mt-20 overflow-hidden px-2">
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="flex gap-3 md:gap-4 whitespace-nowrap"
            >
              {[...Array(2)].flatMap(() => features).map((f, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 rounded-full px-4 md:px-5 py-2.5 backdrop-blur-sm text-xs md:text-sm"
                  style={{
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid rgba(0,0,0,0.08)",
                    background: isDark
                      ? "linear-gradient(180deg, rgba(20,20,30,0.8), rgba(5,5,10,0.9))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(240,240,245,0.8))",
                    color: isDark ? "#b0b0c0" : "#404050",
                  }}
                >
                  {f.icon}
                  <span>{f.text}</span>
                </div>
              ))}
            </motion.div>

            {/* Fade edges (sharper for ray effect) */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-12 md:w-24"
              style={{
                background: isDark
                  ? "linear-gradient(90deg, rgb(0,0,0), transparent)"
                  : "linear-gradient(90deg, rgb(255,255,255), transparent)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-12 md:w-24"
              style={{
                background: isDark
                  ? "linear-gradient(270deg, rgb(0,0,0), transparent)"
                  : "linear-gradient(270deg, rgb(255,255,255), transparent)",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── REFINED NEUMORPHIC CORNER ARROWS (Monochrome) ── */
function CornerArrows({ isDark }: { isDark: boolean }) {
  return (
    <>
      <div className="md:hidden">
        <KeycapArrow pos="right-4 top-[15%]" size={48} tilt={6} dir="SW" isDark={isDark} />
        <KeycapArrow pos="left-4 bottom-[20%]" size={50} tilt={-4} dir="NE" isDark={isDark} />
      </div>
      <div className="hidden md:block">
        <KeycapArrow pos="right-12 top-[18%]" size={72} tilt={6} dir="SW" isDark={isDark} />
        <KeycapArrow pos="left-10 bottom-[48%]" size={72} tilt={4} dir="NE" isDark={isDark} />
      </div>
    </>
  );
}

function KeycapArrow({
  pos,
  size = 72,
  tilt = 0,
  dir = "NE",
  isDark,
}: {
  pos: string;
  size?: number;
  tilt?: number;
  dir?: "NE" | "NW" | "SE" | "SW";
  isDark: boolean;
}) {
  const grad = isDark
    ? "linear-gradient(145deg, #202030, #000000)"
    : "linear-gradient(145deg, #f0f0f0, #d0d0d0)";

  const shadow = isDark
    ? "8px 8px 16px #000000, -8px -8px 16px #202030"
    : "8px 8px 16px #b0b0b0, -8px -8px 16px #ffffff";

  return (
    <motion.div
      className={`absolute ${pos} rounded-xl md:rounded-2xl`}
      style={{
        width: size,
        height: size,
        transform: `rotate(${tilt}deg)`,
        background: grad,
        boxShadow: shadow,
      }}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="relative z-[1] flex h-full w-full items-center justify-center">
        <ArrowGlyph dir={dir} isDark={isDark} />
      </div>
    </motion.div>
  );
}

function ArrowGlyph({
  dir,
  isDark,
}: {
  dir: "NE" | "NW" | "SE" | "SW";
  isDark: boolean;
}) {
  const rotation =
    dir === "NE" ? 0 : dir === "SE" ? 90 : dir === "SW" ? 180 : 270;

  const strokeColor = isDark ? "#a0a0b0" : "#404040";

  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${rotation}deg)` }}>
      <path d="M6 14l8-8m0 0H9m5 0v5" stroke={strokeColor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}