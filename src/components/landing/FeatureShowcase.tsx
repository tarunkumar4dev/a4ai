// FeatureShowcase.tsx — hero product showcase: one pastel panel per feature.
// Advances every 2 s on its own; tabs, prev/next and swipe switch instantly
// (no animation library). Autoplay stops while the mouse is over it, while it
// has keyboard focus, when it is off screen or the tab is hidden, after the
// pause button, and starts paused for reduced-motion / Data Saver users.
// Only the current slide's screenshot is in the DOM, plus a preload of the next one.
import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronLeft, ChevronRight, ImageOff, Pause, Play } from "lucide-react";
import TestGeneratorPreview from "./TestGeneratorPreview";
import { THEMES, VISIBLE_SLIDES, getScreenshot, type FeatureSlide } from "./featureSlides";

const AUTOPLAY_MS = 2000;
const IMG_SIZES = "(min-width: 1280px) 680px, (min-width: 1024px) 52vw, 94vw";

function startsPaused() {
  if (typeof window === "undefined") return true;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return Boolean(reduce || saveData);
}

interface Props {
  slides?: FeatureSlide[];
  initialId?: string;
}

export default function FeatureShowcase({ slides = VISIBLE_SLIDES, initialId }: Props) {
  const count = slides.length;
  const [index, setIndex] = useState(() => Math.max(0, slides.findIndex((s) => s.id === initialId)));
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [interacted, setInteracted] = useState(false);
  const [paused, setPaused] = useState(startsPaused);
  const [hovering, setHovering] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const rootRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const playing = !paused && !hovering && !keyboardFocus && onScreen && count > 1;

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [playing, index, count]);

  // Off screen or tab hidden → stop.
  useEffect(() => {
    const el = rootRef.current;
    let inView = true;
    const update = () => setOnScreen(inView && document.visibilityState === "visible");
    const io =
      el && "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([e]) => {
              inView = e.isIntersecting;
              update();
            },
            { threshold: 0.25 },
          )
        : null;
    if (el) io?.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // Fetch the next slide's screenshot ahead of time so it is ready when shown.
  useEffect(() => {
    if (!onScreen || count < 2) return;
    const next = slides[(index + 1) % count];
    const nextShot = next && !next.builtIn ? getScreenshot(next.id) : null;
    if (!nextShot) return;
    const img = new Image();
    img.sizes = IMG_SIZES;
    img.srcset = nextShot.srcSet;
    img.src = nextShot.src;
  }, [index, count, slides, onScreen]);

  // Keep the active tab visible in the (mobile) scrolling tab row without
  // scrolling the page itself.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const row = tabsRef.current;
    const tab = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !tab) return;
    const left = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left) });
  }, [index]);

  if (count === 0) return null;
  const safeIndex = Math.min(index, count - 1);
  const slide = slides[safeIndex];
  const theme = THEMES[slide.theme];
  const shot = slide.builtIn ? null : getScreenshot(slide.id);
  const panelId = "a4-showcase-panel";

  const select = (i: number, focus = false) => {
    setInteracted(true);
    const next = ((i % count) + count) % count;
    setIndex(next);
    if (focus) tabsRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return; // a tap or a vertical scroll
    select(safeIndex + (dx < 0 ? 1 : -1));
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: safeIndex + 1,
      ArrowLeft: safeIndex - 1,
      Home: 0,
      End: count - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    select(keys[e.key], true);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="a4ai product tour"
      ref={rootRef}
      data-testid="hero-preview"
      className="w-full min-w-0 rounded-[28px] p-3 sm:p-5 border border-black/[0.04]"
      style={{ backgroundImage: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovering(false)}
      onFocus={(e) => setKeyboardFocus(e.target.matches(":focus-visible"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocus(false);
      }}
    >
      {/* Feature tabs */}
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Features"
        onKeyDown={onTabKey}
        className="a4-no-scrollbar -mx-1 px-1 py-1 mb-3 sm:mb-4 flex gap-1.5 overflow-x-auto"
      >
        {slides.map((s, i) => {
          const active = i === safeIndex;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`a4-tab-${s.id}`}
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => select(i)}
              className={`shrink-0 rounded-full px-3.5 min-h-[36px] text-[13px] font-semibold whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 ${
                active
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white/70 text-[#374151] border-black/5 hover:bg-white"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={`a4-tab-${slide.id}`}>
        {/* Product frame */}
        <div className="rounded-[18px] border border-black/[0.08] bg-white overflow-hidden shadow-[0_10px_30px_rgba(17,17,17,0.08)]">
          <div className="flex items-center justify-between gap-3 px-3.5 sm:px-4 h-9 border-b border-[#EEF0F2] bg-[#FCFCFD]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: theme.accent }} aria-hidden="true" />
              <span className="text-[12px] font-semibold text-[#5D6570] truncate">
                a4ai <span aria-hidden="true">·</span> {slide.product}
              </span>
            </div>
            {slide.note && (
              <span className="shrink-0 text-[11px] font-semibold text-[#5D6570] bg-[#F1F3F5] px-2 py-0.5 rounded-md">
                {slide.note}
              </span>
            )}
          </div>

          <div
            className="a4-showcase-media relative aspect-[4/3] sm:aspect-[16/10] touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            style={{ backgroundColor: slide.canvas ?? "#F7F8FA" }}
          >
            {slide.builtIn === "test-generator" ? (
              <div role="img" aria-label={slide.alt} className="absolute inset-0">
                <div aria-hidden="true" className="h-full">
                  <TestGeneratorPreview />
                </div>
              </div>
            ) : shot && !failed[slide.id] ? (
              <img
                key={slide.id}
                src={shot.src}
                srcSet={shot.srcSet}
                sizes={IMG_SIZES}
                width={shot.width}
                height={shot.height}
                alt={slide.alt}
                decoding="async"
                onError={() => setFailed((f) => ({ ...f, [slide.id]: true }))}
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                <ImageOff className="h-6 w-6 text-[#9CA3AF]" aria-hidden="true" />
                <span className="text-sm font-semibold text-[#5D6570]">{slide.product}</span>
                <span className="text-xs text-[#9CA3AF]">Preview couldn&apos;t load</span>
              </div>
            )}
          </div>
        </div>

        {/* Caption */}
        <div className="px-1 sm:px-1.5 pt-4 sm:pt-5">
          <h2 className="font-halenoir text-[1.25rem] sm:text-[1.4rem] font-bold leading-snug tracking-[-0.01em] text-[#1B1B1B]">
            {slide.title}
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-[#4B5563] sm:min-h-[3.25em]">{slide.description}</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {slide.benefits.map((b) => (
              <li key={b} className="flex items-center gap-1.5 text-[13px] font-medium text-[#374151]">
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: theme.accent }} aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3">
            {slide.cta ? (
              <Link
                to={slide.cta.to}
                className="inline-flex items-center gap-1.5 min-h-[40px] text-[14px] font-bold text-[#111111] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] rounded-md"
              >
                {slide.cta.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setPaused((v) => !v)}
                aria-label={paused ? "Play slideshow" : "Pause slideshow"}
                className="h-10 w-10 rounded-full border border-black/10 bg-white/80 flex items-center justify-center text-[#111111] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
              >
                {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={() => select(safeIndex - 1)}
                aria-label="Previous feature"
                className="h-10 w-10 rounded-full border border-black/10 bg-white flex items-center justify-center text-[#111111] hover:bg-[#F7F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-[3.25rem] text-center text-[13px] font-semibold tabular-nums text-[#374151]" aria-hidden="true">
                {safeIndex + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => select(safeIndex + 1)}
                aria-label="Next feature"
                className="h-10 w-10 rounded-full border border-black/10 bg-white flex items-center justify-center text-[#111111] hover:bg-[#F7F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Announces prev/next changes; tab changes are announced by the tabs themselves */}
      <p className="sr-only" aria-live={playing ? "off" : "polite"}>
        {interacted ? `${safeIndex + 1} of ${count}: ${slide.label}` : ""}
      </p>
    </section>
  );
}
