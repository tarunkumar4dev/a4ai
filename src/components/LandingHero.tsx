// Hero — refined headline + exact CTA pills + PRO neumorphic corner arrows (RESPONSIVE VERIFIED)
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

const features = [
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-400" />, text: "AI-Powered" },
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-600 dark:bg-sky-300" />, text: "Curriculum-Aligned" },
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-400" />, text: "Real Analytics" },
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-600 dark:bg-slate-300" />, text: "Instant Generation" },
];

const CENTER_X = 300;
const CENTER_Y = 140;

export default function LandingHero() {
  const mx = useMotionValue(CENTER_X);
  const my = useMotionValue(CENTER_Y);
  const spring = { stiffness: 120, damping: 18, mass: 0.5 };

  const blobX = useSpring(useTransform(mx, (v) => v / 12), spring);
  const blobY = useSpring(useTransform(my, (v) => v / 12), spring);

  const badgeX = useSpring(useTransform(mx, (v) => v / 25), spring);
  const badgeY = useSpring(useTransform(my, (v) => v / 25), spring);

  // magnetic (blue button only), clamped
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
      {/* BG base */}
      <div className="absolute inset-0 -z-20">
        <div
          className="absolute inset-0 dark:bg-gradient-dark"
          style={{ background: "linear-gradient(140deg, #EEF3FC 0%, #E6ECF7 48%, #D9E1EC 100%)" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none dark:bg-radial-dark"
          style={{
            background:
              "radial-gradient(60rem 36rem at 50% 35%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.78) 40%, rgba(255,255,255,0) 70%)",
          }}
        />
      </div>

      {/* grid */}
      <div className="absolute inset-0 -z-10 opacity-[0.05] dark:opacity-[0.03] [background-image:linear-gradient(to_right,_#000_1px,_transparent_1px),linear-gradient(to_bottom,_#000_1px,_transparent_1px)] dark:[background-image:linear-gradient(to_right,_#fff_1px,_transparent_1px),linear-gradient(to_bottom,_#fff_1px,_transparent_1px)] [background-size:32px_32px] md:[background-size:48px_48px]" />

      {/* vignette */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hidden md:block absolute inset-y-0 left-0 w-56 dark:bg-vignette-left" style={{ background: "linear-gradient(90deg, rgba(15,23,42,0.10), rgba(15,23,42,0.00))" }} />
        <div className="hidden md:block absolute inset-y-0 right-0 w-56 dark:bg-vignette-right" style={{ background: "linear-gradient(270deg, rgba(15,23,42,0.10), rgba(15,23,42,0.00))" }} />
        <div className="absolute inset-x-0 bottom-0 h-32 md:h-40 dark:bg-vignette-bottom" style={{ background: "linear-gradient(0deg, rgba(2,6,23,0.06), rgba(2,6,23,0))" }} />
      </div>

      {/* blobs */}
      <motion.div style={{ x: blobX, y: blobY }} className="absolute -top-24 -left-24 h-[24rem] md:h-[42rem] w-[24rem] md:w-[42rem] rounded-full blur-3xl opacity-60 -z-10 dark:opacity-50">
        <div className="h-full w-full dark:bg-blob-dark" style={{ background: "radial-gradient(closest-side, rgba(110,124,142,0.22), transparent 70%)" }} />
      </motion.div>
      <motion.div style={{ x: useTransform(blobX, (v) => -v), y: useTransform(blobY, (v) => v / 2) }} className="absolute -bottom-32 -right-24 h-[24rem] md:h-[40rem] w-[24rem] md:w-[40rem] rounded-full blur-3xl opacity-60 -z-10 dark:opacity-40">
        <div className="h-full w-full dark:bg-blob-secondary-dark" style={{ background: "radial-gradient(closest-side, rgba(173,184,199,0.20), transparent 70%)" }} />
      </motion.div>

      {/* the two active corner arrows */}
      <CornerArrows />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 md:pt-32 pb-20 md:pb-32">
        {/* badge */}
        <div className="flex justify-center">
          <motion.div
            style={{
              x: badgeX,
              y: badgeY,
              border: "1px solid var(--stroke, #E4E9F0)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.70))",
            }}
            className="mb-6 md:mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur dark:badge-dark"
          >
            <Sparkles className="h-4 w-4 dark:text-slate-300" style={{ color: "var(--brand-600, #5D6B7B)" }} />
            <span className="text-xs md:text-sm font-medium tracking-wide dark:text-slate-300" style={{ color: "var(--muted-700, #4E5A66)" }}>
              Think Beyond
            </span>
          </motion.div>
        </div>

        {/* headline */}
        <div className="text-center relative z-10">
          <h1 className="font-halenoir font-semibold tracking-[-0.01em] md:tracking-[-0.02em] leading-tight md:leading-[0.84]">
            <span
              className="hero-headline block bg-clip-text text-transparent text-[clamp(2.2rem,12vw,3.5rem)] sm:text-[clamp(2.8rem,9vw,4.5rem)] md:text-[clamp(3.5rem,9vw,8.6rem)] dark:hero-headline-dark"
              style={{
                backgroundImage: "linear-gradient(90deg,#2F3A44 0%,#4F6274 40%,#2F3A44 100%)",
                backgroundSize: "220% 100%",
                animation: "bg-pan 10s linear infinite",
              }}
            >
              Smartest.Tests.Ever.
            </span>

            <span
              className="mt-4 md:mt-6 block font-halenoir text-[clamp(1.1rem,5vw,1.4rem)] sm:text-[clamp(1.2rem,4vw,1.8rem)] md:text-[clamp(1.35rem,2.8vw,2.6rem)] font-semibold tracking-[-0.01em] md:tracking-[-0.012em] leading-snug md:leading-[1.04] dark:text-slate-200"
              style={{ color: "var(--ink-800, #2F3A44)" }}
            >
              The Teacher's Assessment Co-Pilot
            </span>
          </h1>

          <p
            className="mx-auto mt-5 md:mt-8 max-w-[280px] sm:max-w-md md:max-w-3xl text-[0.95rem] md:text-[clamp(0.98rem,1.4vw,1.125rem)] leading-relaxed dark:text-slate-400"
            style={{ color: "var(--muted-600, #5D6B7B)" }}
          >
            Generate & host curriculum-perfect tests in under 2 minutes — then track what actually matters.
          </p>

          {/* CTAs */}
          <div className="relative mt-10 md:mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row px-4">
            {/* glow strip (reduced for mobile) */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-4 md:-inset-x-10 top-2 h-12 md:h-16 rounded-2xl blur-2xl dark:glow-strip-dark"
              style={{
                background:
                  "radial-gradient(12rem 4rem at 35% 50%, rgba(59,130,246,0.15), transparent 60%), radial-gradient(10rem 4rem at 70% 50%, rgba(17,24,39,0.15), transparent 60%)",
              }}
            />

            <motion.div
              style={{ x: magneticX, y: magneticY }}
              className="isolate w-full sm:w-auto"
            >
              <Link to="/contact" className="w-full block">
                <Button
                  size="lg"
                  className="w-full sm:w-auto relative h-14 sm:h-12 rounded-[14px] px-8 text-base font-semibold text-white flex items-center justify-center gap-2 transform-gpu transition-all dark:blue-button-dark"
                  style={{
                    background: "linear-gradient(180deg, #76B6FF 0%, #2F6DF4 88%)",
                    border: "1px solid rgba(59,130,246,0.55)",
                    boxShadow: "0 10px 22px rgba(59,130,246,0.28), inset 0 0 0 0.5px rgba(255,255,255,0.35)",
                  }}
                >
                  <ArrowRight className="h-5 w-5" />
                  Get Free Domain
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[14px] dark:blue-button-highlight-dark"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.00) 42%)" }}
                  />
                </Button>
              </Link>
            </motion.div>

            <div className="isolate w-full sm:w-auto">
              <Link to="/login" className="w-full block">
                <Button
                  size="lg"
                  className="w-full sm:w-auto relative h-14 sm:h-12 rounded-[14px] px-8 text-base font-semibold text-white flex items-center justify-center gap-2 transform-gpu transition-all dark:secondary-button-dark"
                  style={{
                    background: "linear-gradient(180deg, #1F2937 0%, #0B1220 92%)",
                    border: "1px solid rgba(0,0,0,0.35)",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.35), inset 0 0 0 0.5px rgba(255,255,255,0.06)",
                  }}
                >
                  <Play className="h-5 w-5" />
                  Login (FREE 100 Coins)
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[14px] dark:secondary-button-highlight-dark"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.00) 45%)" }}
                  />
                </Button>
              </Link>
            </div>
          </div>

          {/* marquee */}
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
                  className="inline-flex items-center gap-2 rounded-full px-4 md:px-5 py-2.5 backdrop-blur text-xs md:text-sm dark:feature-pill-dark"
                  style={{
                    border: "1px solid var(--stroke, #E4E9F0)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.70))",
                    color: "var(--muted-700, #4E5A66)",
                  }}
                >
                  {f.icon}
                  <span className="dark:text-slate-300">{f.text}</span>
                </div>
              ))}
            </motion.div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-12 md:w-24 dark:bg-gradient-to-r dark:from-slate-950 dark:to-transparent bg-gradient-to-r from-white via-white/80 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-12 md:w-24 dark:bg-gradient-to-l dark:from-slate-950 dark:to-transparent bg-gradient-to-l from-white via-white/80 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}

function CornerArrows() {
  return (
    <>
      {/* Mobile/Tablet: Smaller, Fixed positions */}
      <div className="md:hidden">
        <KeycapArrow pos="right-4 top-[15%]" size={50} variant="neon" tilt={8} dir="SW" />
        <KeycapArrow pos="left-4 bottom-[20%]" size={52} variant="neon" tilt={-6} dir="NE" />
      </div>
      {/* Desktop: Original size and placements */}
      <div className="hidden md:block">
        <KeycapArrow pos="right-12 top-[18%]" size={74} variant="neon" tilt={8} dir="SW" />
        <KeycapArrow pos="left-10 bottom-[48%]" size={75} variant="neon" tilt={6} dir="NE" />
      </div>
    </>
  );
}

function KeycapArrow({
  pos,
  size = 76,
  tilt = 0,
  variant = "raised",
  dir = "NE",
}: {
  pos: string;
  size?: number;
  tilt?: number;
  variant?: "raised" | "neon";
  dir?: "NE" | "NW" | "SE" | "SW";
}) {
  const baseGrad =
    "linear-gradient(180deg, rgba(255,255,255,0.74) 0%, rgba(240,244,255,0.82) 40%, rgba(228,234,247,0.95) 100%)";
  const innerShadow =
    "inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -3px 10px rgba(2,6,23,0.12)";
  const dropShadow =
    "0 30px 60px rgba(2,6,23,0.18), 0 6px 16px rgba(2,6,23,0.10)";
  const ring = "inset 0 0 0 1px rgba(255,255,255,0.55)";
  const neonRim =
    "0 0 0 2px rgba(255,255,255,0.9), 0 0 40px rgba(147,197,253,0.65), 0 16px 36px rgba(30,58,138,0.20)";
  const ovalShadow =
    "radial-gradient(120px 60px at 60% 60%, rgba(36,62,155,0.12), rgba(36,62,155,0) 70%)";

  return (
    <motion.div
      className={`absolute ${pos} rounded-[14px] md:rounded-[20px] backdrop-blur dark:corner-arrow-dark`}
      style={{
        width: size,
        height: size,
        transform: `rotate(${tilt}deg)`,
        background: baseGrad,
        boxShadow: `${dropShadow}, ${ring}, ${innerShadow}`,
      }}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[14px] md:rounded-[20px] dark:corner-arrow-highlight-dark"
        style={{
          background:
            "radial-gradient(140% 120% at 30% 0%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 55%), radial-gradient(100% 80% at 50% 120%, rgba(2,6,23,0.08) 0%, rgba(2,6,23,0) 60%)",
        }}
      />
      {variant === "neon" && (
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[14px] md:rounded-[20px] dark:corner-arrow-neon-dark" style={{ boxShadow: neonRim }} />
      )}
      <span aria-hidden className="pointer-events-none absolute -inset-x-8 md:-inset-x-16 -bottom-10 h-24 rounded-[40px] blur-2xl opacity-90 dark:corner-arrow-shadow-dark" style={{ background: ovalShadow }} />
      <div className="relative z-[1] flex h-full w-full items-center justify-center scale-75 md:scale-100">
        <ArrowGlyph dir={dir} variant={variant} />
      </div>
    </motion.div>
  );
}

function ArrowGlyph({
  dir,
  variant,
}: {
  dir: "NE" | "NW" | "SE" | "SW";
  variant: "raised" | "neon";
}) {
  const rotation =
    dir === "NE" ? 0 : dir === "SE" ? 90 : dir === "SW" ? 180 : 270;

  const strokeMain = variant === "neon"
    ? "rgba(255,255,255,0.95)"
    : "rgba(30,41,59,0.55)";

  const strokeHighlight = variant === "neon"
    ? "rgba(255,255,255,0.95)"
    : "rgba(255,255,255,0.65)";

  const strokeWidth = variant === "neon" ? 2.6 : 1.9;

  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${rotation}deg)` }}>
      <path d="M6 14l8-8m0 0H9m5 0v5" stroke={strokeMain} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-slate-200/80" />
      <path d="M13.6 6.4h2v2" stroke={strokeHighlight} strokeWidth={0.7} strokeLinecap="round" className="dark:stroke-white/60" />
      {variant === "raised" && (
        <path d="M6 14l8-8" stroke="rgba(2,6,23,0.18)" strokeWidth={1.4} strokeLinecap="round" className="dark:stroke-black/30" />
      )}
    </svg>
  );
}