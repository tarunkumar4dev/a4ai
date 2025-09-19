// Hero — Halenoir Expanded, tighter lines, CTAs pushed lower
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
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />, text: "AI-Powered" },
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-600" />, text: "Curriculum-Aligned" },
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />, text: "Real Analytics" },
  { icon: <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-600" />, text: "Instant Generation" },
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

  const magneticX = useSpring(useTransform(mx, (v) => (v - 200) / 50), spring);
  const magneticY = useSpring(useTransform(my, (v) => (v - 60) / 50), spring);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  useEffect(() => {
    mx.set(CENTER_X);
    my.set(CENTER_Y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section onMouseMove={handleMouseMove} className="relative isolate overflow-hidden">
      {/* BG */}
      <div className="absolute inset-0 -z-20">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(140deg, #F6F9FF 0%, #E9EEF7 48%, #DCE3ED 100%)" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60rem 36rem at 50% 35%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.78) 40%, rgba(255,255,255,0) 70%)",
          }}
        />
        <div
          aria-hidden
          className="absolute -left-40 bottom-10 h-[28rem] w-[28rem] rounded-[9999px] blur-3xl opacity-40"
          style={{ background: "radial-gradient(closest-side, rgba(56,189,248,0.35), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="absolute -right-56 top-24 h-[30rem] w-[30rem] rounded-[9999px] blur-3xl opacity-35"
          style={{ background: "radial-gradient(closest-side, rgba(251,146,255,0.28), transparent 70%)" }}
        />
      </div>

      {/* light grid */}
      <div className="absolute inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(to_right,_#000_1px,_transparent_1px),linear-gradient(to_bottom,_#000_1px,_transparent_1px)] [background-size:48px_48px]" />

      {/* subtle blobs */}
      <motion.div
        style={{ x: blobX, y: blobY }}
        className="absolute -top-24 -left-24 h-[42rem] w-[42rem] rounded-full blur-3xl opacity-60 -z-10"
      >
        <div
          className="h-full w-full"
          style={{ background: "radial-gradient(closest-side, rgba(110,124,142,0.22), transparent 70%)" }}
        />
      </motion.div>
      <motion.div
        style={{ x: useTransform(blobX, (v) => -v), y: useTransform(blobY, (v) => v / 2) }}
        className="absolute -bottom-32 -right-24 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-60 -z-10"
      >
        <div
          className="h-full w-full"
          style={{ background: "radial-gradient(closest-side, rgba(173,184,199,0.20), transparent 70%)" }}
        />
      </motion.div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-36">
        {/* badge */}
        <motion.div
          style={{
            x: badgeX,
            y: badgeY,
            border: "1px solid var(--stroke, #E4E9F0)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.70))",
          }}
          className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur"
        >
          <Sparkles className="h-4 w-4" style={{ color: "var(--brand-600, #5D6B7B)" }} />
          <span className="text-sm font-medium tracking-wide" style={{ color: "var(--muted-700, #4E5A66)" }}>
            Think Beyond
          </span>
        </motion.div>

        {/* HEADLINE — Halenoir, tighter tracking & line height */}
        <div className="text-center">
          <h1 className="font-halenoir font-semibold tracking-[-0.02em] leading-[0.86]">
            <span
              className="block bg-clip-text text-transparent text-[clamp(2.6rem,8vw,8rem)]"
              style={{
                backgroundImage: "linear-gradient(90deg,#2F3A44 0%,#4F6274 40%,#2F3A44 100%)",
                backgroundSize: "220% 100%",
                animation: "bg-pan 10s linear infinite",
              }}
            >
              Smartest. Tests. Ever.
            </span>

            <span
              className="mt-1 block font-halenoir text-[clamp(1.25rem,2.6vw,2.2rem)] font-semibold tracking-[-0.012em] leading-[1.02]"
              style={{ color: "var(--ink-800, #2F3A44)" }}
            >
              The Teacher’s Assessment Co-Pilot
            </span>
          </h1>

          <p
            className="mx-auto mt-6 max-w-3xl text-[clamp(0.98rem,1.4vw,1.125rem)]"
            style={{ color: "var(--muted-600, #5D6B7B)" }}
          >
            Generate & host curriculum-perfect tests in under 2 minutes — then track what actually matters.
          </p>

          {/* CTAs pushed further down */}
          <div className="relative mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-10 top-3 h-20 rounded-xl blur-2xl"
              style={{
                background:
                  "radial-gradient(14rem 5rem at 35% 50%, rgba(59,130,246,0.4), transparent 60%), radial-gradient(12rem 5rem at 70% 50%, rgba(17,24,39,0.5), transparent 60%)",
              }}
            />

            {/* primary */}
            <motion.div style={{ x: magneticX, y: magneticY }}>
              <Link to="/signup">
                <Button
                  size="lg"
                  className="relative h-12 rounded-lg px-6 text-base font-semibold text-white shadow-[0_10px_24px_rgba(59,130,246,0.25)] transition-transform"
                  style={{
                    background: "linear-gradient(180deg, #93C5FD 0%, #3B82F6 75%)",
                    border: "1px solid rgba(59,130,246,0.45)",
                  }}
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-lg"
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 40%)",
                    }}
                  />
                </Button>
              </Link>
            </motion.div>

            {/* secondary */}
            <Link to="/demo">
              <Button
                size="lg"
                className="relative h-12 rounded-lg px-6 text-base font-semibold text-white shadow-[0_10px_24px_rgba(17,24,39,0.3)]"
                style={{
                  background: "linear-gradient(180deg, #374151 0%, #111827 85%)",
                  border: "1px solid rgba(17,24,39,0.5)",
                }}
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-lg"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 45%)",
                  }}
                />
              </Button>
            </Link>
          </div>

          {/* marquee */}
          <div className="relative mt-12 overflow-hidden">
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              className="flex gap-3 whitespace-nowrap"
            >
              {[...Array(2)].flatMap(() => features).map((f, i) => (
                <div
                  key={i}
                  className="mx-1 inline-flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur text-sm"
                  style={{
                    border: "1px solid var(--stroke, #E4E9F0)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.70))",
                    color: "var(--muted-700, #4E5A66)",
                  }}
                >
                  {f.icon}
                  <span>{f.text}</span>
                </div>
              ))}
            </motion.div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* globals.css (keep)
@keyframes bg-pan { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } } 
*/
