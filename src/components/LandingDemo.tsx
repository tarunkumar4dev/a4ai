// src/components/LandingDemo.tsx — smooth, subtle, grey-blue, white-gradient bg
import { useRef, useState, useEffect } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  useMotionTemplate,
  useSpring,
} from "framer-motion";
import { Play } from "lucide-react";

export type LandingDemoProps = {
  youtubeId?: string;
};

export default function LandingDemo({ youtubeId }: LandingDemoProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-20% 0px" });

  // --------------------------------
  // Cursor + tilt with springs
  // --------------------------------
  const rawX = useMotionValue(300);
  const rawY = useMotionValue(150);

  // smooth cursor values (less jitter)
  const mx = useSpring(rawX, { stiffness: 140, damping: 18, mass: 0.5 });
  const my = useSpring(rawY, { stiffness: 140, damping: 18, mass: 0.5 });

  // very subtle tilt (reduce seasick)
  const rotateX = useSpring(useTransform(my, [0, 300], [3, -3]), {
    stiffness: 120,
    damping: 16,
    mass: 0.5,
  });
  const rotateY = useSpring(useTransform(mx, [0, 600], [-4, 4]), {
    stiffness: 120,
    damping: 16,
    mass: 0.5,
  });

  const glowX = useTransform(mx, (v) => v);
  const glowY = useTransform(my, (v) => v);

  const [hintVisible, setHintVisible] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLoaded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    rawX.set(e.clientX - rect.left);
    rawY.set(e.clientY - rect.top);
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-24"
      onMouseMove={onMouseMove}
    >
      {/* Section background: very light white gradient + faint vignette */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 10%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.75) 40%, rgba(247,249,252,0.8) 60%, rgba(238,243,248,0.9) 100%)",
        }}
      />
      {/* faint vertical sheen */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20 opacity-70"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.6) 45%, rgba(255,255,255,0.0) 100%)",
        }}
      />

      {/* soft grey-blue blobs for depth */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-40 h-[42rem] w-[42rem] rounded-full blur-3xl will-change-transform"
        style={{ opacity: inView ? 0.28 : 0 }}
      >
        <motion.div
          className="h-full w-full"
          animate={{ scale: [1, 1.05, 1], rotate: [0, 6, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(110,124,142,0.22), transparent 70%)",
          }}
        />
      </motion.div>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-40 h-[38rem] w-[38rem] rounded-full blur-3xl will-change-transform"
        style={{ opacity: inView ? 0.22 : 0 }}
      >
        <motion.div
          className="h-full w-full"
          animate={{ scale: [1.02, 0.98, 1.02] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(173,184,199,0.20), transparent 70%)",
          }}
        />
      </motion.div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
          style={{
            background:
              "linear-gradient(90deg,#5D6B7B 0%,#6E7C8E 50%,#8B98A9 100%)",
            WebkitBackgroundClip: "text",
            color: "transparent",
            backgroundSize: "200% 100%",
            animation: "bg-pan 10s linear infinite",
          }}
        >
          See a4ai in Action
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.08, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-4 max-w-2xl text-center text-lg"
          style={{ color: "var(--muted-600, #5D6B7B)" }}
        >
          Generate, host, and analyze assessments — end-to-end in minutes.
        </motion.p>

        {/* VIDEO CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.985, y: 18 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-12 w-full max-w-5xl"
          style={{ perspective: 1200 }}
        >
          <motion.div
            className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl will-change-transform"
            style={{
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
              border: "1px solid var(--stroke, #E4E9F0)",
            }}
            onMouseLeave={() => {
              rawX.set(300);
              rawY.set(150);
            }}
          >
            {/* soft white inner gradient (barely visible) */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.18) 100%)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

            {/* cursor-follow glow (smoother, slightly smaller) */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background: useMotionTemplate`
                  radial-gradient(230px 230px at ${glowX}px ${glowY}px, rgba(255,255,255,0.12), transparent 70%)
                `,
                opacity: isLoaded ? 1 : 0,
                transition: "opacity 220ms ease",
                zIndex: 1,
              }}
            />

            {/* neutral gradient ring (no purple) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset"
              style={{
                background:
                  "linear-gradient(#000,#000) padding-box, linear-gradient(90deg, rgba(93,107,123,.45), rgba(175,186,199,.45)) border-box",
                border: "1px solid transparent",
                borderRadius: "1rem",
                zIndex: 1,
              }}
            />

            {/* media */}
            {youtubeId ? (
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
                title="a4ai Demo Video"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                onLoad={() => {
                  setHintVisible(false);
                  setIsLoaded(true);
                }}
              />
            ) : (
              <video
                className="absolute inset-0 h-full w-full object-cover"
                controls
                playsInline
                preload="metadata"
                poster="/demo-poster.jpg"
                onPlay={() => setHintVisible(false)}
                onLoadedData={() => setIsLoaded(true)}
              >
                <source src="/demo.mp4" type="video/mp4" />
                <source src="/demo.webm" type="video/webm" />
              </video>
            )}

            {/* PLAY HINT */}
            {hintVisible && (
              <motion.div
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45 }}
              >
                <motion.div
                  className="relative rounded-full backdrop-blur-md px-5 py-2.5 text-sm font-medium"
                  style={{
                    color: "#fff",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.22)",
                  }}
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                >
                  <div className="flex items-center gap-2 relative z-10">
                    <Play className="h-4 w-4" fill="white" />
                    Play demo
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* LOADING STATE */}
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                <motion.div
                  className="h-10 w-10 rounded-full border-2 border-transparent border-t-white"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                />
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* Tailwind keyframes (add once in globals.css if you don't already have it)
@keyframes bg-pan {
  0% { background-position: 0% 50% }
  100% { background-position: 200% 50% }
}*/
