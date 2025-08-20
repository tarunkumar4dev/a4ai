import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useMotionTemplate } from "framer-motion";
import { ArrowRight, Sparkles, Zap, BookOpen, BarChart2, Check } from "lucide-react";
import { useEffect } from "react";

const features = [
  { icon: <Zap className="h-4 w-4" />, text: "AI-Powered" },
  { icon: <BookOpen className="h-4 w-4" />, text: "Curriculum-Aligned" },
  { icon: <BarChart2 className="h-4 w-4" />, text: "Real Analytics" },
  { icon: <Check className="h-4 w-4" />, text: "Instant Generation" },
];

export default function LandingHero() {
  // cursor values for parallax + magnetic CTA
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const blobX = useTransform(mx, v => v / 12);
  const blobY = useTransform(my, v => v / 12);

  const badgeX = useTransform(mx, v => v / 25);
  const badgeY = useTransform(my, v => v / 25);

  const magneticX = useTransform(mx, v => (v - 200) / 50);
  const magneticY = useTransform(my, v => (v - 60) / 50);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  useEffect(() => {
    // mobile safety: center values so the hero looks good without mouse
    mx.set(300);
    my.set(140);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative isolate overflow-hidden"
    >
      {/* BACKGROUND — gradient mesh blobs */}
      <div className="absolute inset-0 -z-10">
        <motion.div
          style={{
            translateX: blobX,
            translateY: blobY,
          }}
          className="absolute -top-24 -left-24 h-[42rem] w-[42rem] rounded-full blur-3xl"
        >
          <div className="h-full w-full bg-[radial-gradient(closest-side,_rgba(99,102,241,0.25),_transparent_70%)] dark:bg-[radial-gradient(closest-side,_rgba(99,102,241,0.2),_transparent_70%)]" />
        </motion.div>

        <motion.div
          style={{
            translateX: useTransform(blobX, v => -v),
            translateY: useTransform(blobY, v => v / 2),
          }}
          className="absolute -bottom-32 -right-24 h-[40rem] w-[40rem] rounded-full blur-3xl"
        >
          <div className="h-full w-full bg-[radial-gradient(closest-side,_rgba(168,85,247,0.25),_transparent_70%)] dark:bg-[radial-gradient(closest-side,_rgba(168,85,247,0.2),_transparent_70%)]" />
        </motion.div>

        {/* subtle grain */}
        <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
             style={{
               backgroundImage:
                 "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%2240%22 height=%2240%22 filter=%22url(%23n)%22 opacity=%220.25%22/></svg>')"
             }}
        />
      </div>

      {/* LIGHT GRID */}
      <div className="absolute inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(to_right,_#000_1px,_transparent_1px),linear-gradient(to_bottom,_#000_1px,_transparent_1px)] [background-size:48px_48px]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-36">
        {/* Floating badge */}
        <motion.div
          style={{
            translateX: badgeX,
            translateY: badgeY,
          }}
          className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2 backdrop-blur"
        >
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-medium tracking-wide text-gray-700 dark:text-gray-200">
            Think Beyond
          </span>
        </motion.div>

        {/* HEADLINE */}
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="font-extrabold leading-[0.95] tracking-tight
                       text-5xl sm:text-6xl md:text-7xl lg:text-8xl
                       text-gray-900 dark:text-white"
            style={{ fontStretch: "condensed" as any }}
          >
            <span className="bg-clip-text text-transparent bg-[linear-gradient(90deg,#4f46e5_0%,#a855f7_50%,#ec4899_100%)] bg-[length:200%_100%] animate-[bg-pan_8s_linear_infinite]">
              Smartest. Tests. Ever.
            </span>
            <br />
            <span className="mt-3 inline-block">
              The Teacher’s Assessment Co-Pilot
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mx-auto mt-6 max-w-3xl text-lg sm:text-xl text-gray-600 dark:text-gray-300"
          >
            Generate & host curriculum-perfect tests in under 2 minutes—then track what actually matters.
          </motion.p>

          {/* CTA Row (magnetic primary) */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.div style={{ x: magneticX, y: magneticY }}>
              <Link to="/signup">
                <Button
                  size="lg"
                  className="relative px-8 py-6 text-lg font-semibold
                             bg-gradient-to-r from-indigo-600 to-purple-600
                             hover:from-indigo-700 hover:to-purple-700
                             shadow-lg hover:shadow-xl transition-all rounded-2xl"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{
                      background: useMotionTemplate`
                        radial-gradient(120px at ${mx}px ${my}px, rgba(255,255,255,0.18), transparent 70%)
                      `,
                    }}
                  />
                </Button>
              </Link>
            </motion.div>

            <Link to="/demo">
              <Button
                variant="outline"
                size="lg"
                className="px-8 py-6 text-lg font-semibold rounded-2xl border-gray-300/70 dark:border-white/20 hover:bg-white/60 dark:hover:bg-white/10 transition"
              >
                Watch Demo
              </Button>
            </Link>
          </div>

          {/* Marquee of feature pills */}
          <div className="relative mt-14 overflow-hidden">
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              className="flex gap-3 whitespace-nowrap"
            >
              {[...Array(2)].flatMap(() => features).map((f, i) => (
                <div
                  key={i}
                  className="mx-1 inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-2 backdrop-blur text-sm text-gray-700 dark:text-gray-200"
                >
                  {f.icon}
                  <span>{f.text}</span>
                </div>
              ))}
            </motion.div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white dark:from-gray-950 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white dark:from-gray-950 to-transparent" />
          </div>
        </div>
      </div>

      {/* bottom divider */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent"
      />
    </section>
  );
}

/* Tailwind keyframes (add once in globals.css if you don't already have it)
@keyframes bg-pan { 
  0% { background-position: 0% 50% } 
  100% { background-position: 200% 50% } 
}
*/
