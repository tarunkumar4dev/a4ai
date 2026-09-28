import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Sparkles } from "lucide-react";

/* ---------- Simple useInView hook (IntersectionObserver) ---------- */
function useInView(
  ref: React.RefObject<HTMLElement | null>,
  options?: { rootMargin?: string }
): boolean {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: options?.rootMargin ?? "0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, options?.rootMargin]);

  return isInView;
}

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
  videoSrcMp4 = "/demo.mp4",
  videoSrcWebm,
  poster = "/demo-poster.png",
  showControls = false,
  showHud = true,
}: Props) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(sectionRef, { rootMargin: "-20% 0px" });

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

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Title */}
        <h2
          className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900"
        >
          See a4ai in Action
        </h2>

        <p
          className="mx-auto mt-4 max-w-2xl text-center text-lg"
          style={{ color: "var(--muted-600, #5D6B7B)" }}
        >
          Explore 1 Lakh+ NCERT questions — generate, host, and analyze assessments in minutes.
        </p>

        {/* SHOWCASE CARD */}
        <div
          className="relative mx-auto mt-12 w-full max-w-5xl"
        >
          <div
            className="relative aspect-video overflow-hidden rounded-2xl shadow-lg bg-neutral-900"
            style={{
              border: "1px solid var(--stroke, #E4E9F0)",
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

            {/* HUD */}
            <FloatingHint />
            {showHud && <BottomHud />}
          </div>

          {mediaError && (
            <p className="mt-2 text-center text-sm text-red-500">
              {mediaError} — try opening the file directly to check:{" "}
              <a className="underline" href={mp4 || webm} target="_blank" rel="noreferrer">
                {mp4 || webm}
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Floating hint pill ---------- */
function FloatingHint() {
  return (
    <div
      className="absolute left-1/2 top-[7%] z-40 -translate-x-1/2"
    >
      <div
        className="relative rounded-full px-4 py-2 text-sm font-medium shadow"
        style={{
          color: "#263244",
          background: "#ffffff",
          border: "1px solid rgba(210,220,232,0.9)",
        }}
      >
        <div className="flex items-center gap-2 relative z-10">
          <Sparkles className="h-4 w-4" style={{ color: "#f75961" }} />
          1 Lakh+ NCERT Questions Bank
        </div>
      </div>
    </div>
  );
}

/* ---------- Bottom HUD pills ---------- */
function BottomHud() {
  return (
    <div
      className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-2 px-2"
    />
  );
}
