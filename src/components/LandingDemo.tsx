import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Sparkles } from "lucide-react";

type Props = {
  /** Fallback image when no video is provided */
  bgImage?: string;

  /** Provide to render video instead of image (public paths OK) */
  videoSrcMp4?: string;
  videoSrcWebm?: string;
  poster?: string;
  showControls?: boolean;

  /** Show HUD pills */
  showHud?: boolean;
};

export default function LandingDemo({
  bgImage = "/showcase-bg.png",
  videoSrcMp4,
  videoSrcWebm,
  // FIX: default matches your actual file
  poster = "/demo-poster.png",
  showControls = false,
  showHud = true,
}: Props) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(sectionRef, { once: false, margin: "-20% 0px" });

  // disable tilt on touch
  const isCoarsePointer = useMemo(
    () => (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches) ?? false,
    []
  );

  // tilt
  const rawX = useMotionValue(300);
  const rawY = useMotionValue(160);
  const mx = useSpring(rawX, { stiffness: 140, damping: 18, mass: 0.5 });
  const my = useSpring(rawY, { stiffness: 140, damping: 18, mass: 0.5 });
  const rotateX = useSpring(useTransform(my, [0, 320], [3, -3]), {
    stiffness: 120,
    damping: 16,
    mass: 0.5,
  });
  const rotateY = useSpring(useTransform(mx, [0, 640], [-4, 4]), {
    stiffness: 120,
    damping: 16,
    mass: 0.5,
  });

  const glowX = useTransform(mx, (v) => v);
  const glowY = useTransform(my, (v) => v);

  const [isReady, setReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(t);
  }, []);

  // base-url-safe resolver for public assets
  const resolve = (p?: string) => {
    if (!p) return p;
    if (/^https?:\/\//i.test(p)) return p;
    // Vite base support
    const base = (import.meta as any).env?.BASE_URL ?? "/";
    const trimmed = p.startsWith("/") ? p.slice(1) : p;
    return `${String(base).replace(/\/$/, "")}/${trimmed}`;
  };

  const resolvedImg = resolve(bgImage);
  const resolvedPoster = resolve(poster);
  const mp4 = videoSrcMp4 ? `${resolve(videoSrcMp4)}?v=2` : undefined; // cache-bust
  const webm = videoSrcWebm ? `${resolve(videoSrcWebm)}?v=2` : undefined;

  // Pause video when offscreen or tab hidden
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handleVisibility = () => {
      if (document.hidden) el.pause();
      else if (inView) el.play().catch(() => {});
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [inView]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (inView) el.play().catch(() => {});
    else el.pause();
  }, [inView]);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isReady || isCoarsePointer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    rawX.set(e.clientX - rect.left);
    rawY.set(e.clientY - rect.top);
  };

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-24"
      onMouseMove={onMouseMove}
    >
      {/* BACKDROP */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 8%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.76) 40%, rgba(247,249,252,0.82) 60%, rgba(238,243,248,0.92) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-20 opacity-70"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.6) 45%, rgba(255,255,255,0.0) 100%)",
        }}
      />

      {/* BLOBS */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-28 -left-40 h-[42rem] w-[42rem] rounded-full blur-3xl"
        style={{ opacity: inView ? 0.25 : 0 }}
      >
        <motion.div
          className="h-full w-full"
          animate={{ scale: [1, 1.05, 1], rotate: [0, 6, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "radial-gradient(closest-side, rgba(110,124,142,0.22), transparent 70%)" }}
        />
      </motion.div>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-40 h-[38rem] w-[38rem] rounded-full blur-3xl"
        style={{ opacity: inView ? 0.2 : 0 }}
      >
        <motion.div
          className="h-full w-full"
          animate={{ scale: [1.02, 0.98, 1.02] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "radial-gradient(closest-side, rgba(173,184,199,0.20), transparent 70%)" }}
        />
      </motion.div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
          style={{
            background: "linear-gradient(90deg,#5D6B7B 0%,#6E7C8E 50%,#8B98A9 100%)",
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

        {/* SHOWCASE CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.985, y: 18 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-12 w-full max-w-5xl"
          style={{ perspective: 1200 }}
        >
          <motion.div
            className="relative aspect-video overflow-hidden rounded-2xl shadow-2xl bg-neutral-900"
            style={{
              rotateX: isCoarsePointer ? 0 : (rotateX as any),
              rotateY: isCoarsePointer ? 0 : (rotateY as any),
              transformStyle: "preserve-3d",
              border: "1px solid var(--stroke, #E4E9F0)",
            }}
            onMouseLeave={() => {
              if (isCoarsePointer) return;
              rawX.set(300);
              rawY.set(160);
            }}
          >
            {/* MEDIA */}
            {mp4 || webm ? (
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover"
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
                poster={resolvedPoster}
                controls={showControls}
                crossOrigin="anonymous"
                onLoadedData={() => setReady(true)}
                onCanPlay={() => setReady(true)}
                onError={(e) => {
                  console.error("Video load error", e);
                  setMediaError(`Could not load video ${mp4 || webm}`);
                }}
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  if (v.paused) v.play().catch(() => {});
                  else v.pause();
                }}
                style={{ zIndex: 0 }}
              >
                {/* Prefer MP4 first for wider support */}
                {mp4 && <source src={mp4} type="video/mp4" />}
                {webm && <source src={webm} type="video/webm" />}
              </video>
            ) : (
              <img
                src={resolvedImg}
                alt="a4ai product preview"
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
                style={{ zIndex: 0 }}
                onLoad={() => setMediaError(null)}
                onError={() => setMediaError(`Could not load ${resolvedImg}`)}
              />
            )}

            {/* sheen */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.18) 100%)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

            {/* cursor glow */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background: useMotionTemplate`
                  radial-gradient(230px 230px at ${glowX}px ${glowY}px, rgba(255,255,255,0.12), transparent 70%)
                `,
                opacity: isReady && !isCoarsePointer ? 1 : 0,
                transition: "opacity 220ms ease",
                zIndex: 2,
              }}
            />

            {/* gradient border mask */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                border: "1px solid transparent",
                borderRadius: "1rem",
                background:
                  "linear-gradient(90deg, rgba(93,107,123,.45), rgba(175,186,199,.45)) border-box",
                WebkitMask:
                  "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                zIndex: 3,
              }}
            />

            {/* HUD */}
            <FloatingHint />
            {showHud && <BottomHud />}
          </motion.div>

          {mediaError && (
            <p className="mt-2 text-center text-sm text-red-500">
              {mediaError} — try opening the file directly to check:{" "}
              <a className="underline" href={mp4 || webm} target="_blank" rel="noreferrer">
                {mp4 || webm}
              </a>
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Floating hint pill ---------- */
function FloatingHint() {
  return (
    <motion.div
      className="absolute left-1/2 top-[7%] z-40 -translate-x-1/2"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="relative rounded-full backdrop-blur-md px-4 py-2 text-sm font-medium shadow"
        style={{
          color: "#263244",
          background: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(210,220,232,0.9)",
        }}
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center gap-2 relative z-10">
          <Sparkles className="h-4 w-4" />
          Keep scrolling
        </div>
        <div aria-hidden className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 80px 20px rgba(120,140,160,0.15)" }} />
      </motion.div>
    </motion.div>
  );
}

/* ---------- Bottom HUD pills ---------- */
function BottomHud() {
  return (
    <motion.div
      className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-2 px-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}
