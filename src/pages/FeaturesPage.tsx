import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Brain,
  BookOpen,
  ListChecks,
  SlidersHorizontal,
  KeyRound,
  Users2,
  Check,
  ShieldCheck,
  Sparkles,
  Video,
  Download,
  BarChart3,
  Workflow,
  GaugeCircle,
  Play,
  ArrowRight
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/* ──────────────────────────────────────────────────────────────
   BRAND STYLES & GLOBAL INJECTION
   ────────────────────────────────────────────────────────────── */
// Updated to a mix of Violet, Green, Sky Blue, and Indigo to match the screenshot
const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";
const gradientAnimStyle = { backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" };

// Inject the custom CSS required for the UI if it isn't already loaded by the landing page
const GlobalStyles = () => {
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      .lp { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .ag-card {
        border-radius: 18px;
        transition: transform 0.2s cubic-bezier(.16,1,.3,1), box-shadow 0.2s cubic-bezier(.16,1,.3,1);
        position: relative;
        overflow: hidden;
      }
      @media (min-width: 640px) { .ag-card { border-radius: 20px; } }
      .ag-card-light {
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(0,0,0,0.08);
        backdrop-filter: blur(24px) saturate(160%);
        -webkit-backdrop-filter: blur(24px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(59,130,246,0.07), 0 2px 6px rgba(0,0,0,0.05);
      }
      .ag-card-dark {
        background: rgba(20,25,40,0.65);
        border: 1px solid rgba(255,255,255,0.09);
        backdrop-filter: blur(24px) saturate(160%);
        -webkit-backdrop-filter: blur(24px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 6px 24px rgba(0,0,0,0.45);
      }
      @keyframes fast-gradient {
        0% { background-position: 0% center; }
        100% { background-position: -200% center; }
      }
      .nlm-text {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
      }
      .btn-blk {
        position:relative; overflow:hidden;
        background: linear-gradient(180deg,#202124 0%,#111111 100%);
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2);
        color: white; font-weight:600;
        border-radius: 14px;
        transition: transform 0.2s, box-shadow 0.2s;
        -webkit-tap-highlight-color: transparent;
      }
      .btn-glass-light {
        position:relative; overflow:hidden;
        background: rgba(235, 235, 240, 0.85);
        border: 1px solid rgba(0,0,0,0.12);
        backdrop-filter: blur(20px) saturate(160%);
        border-radius: 14px; font-weight:600;
        transition: transform 0.2s;
      }
      .btn-glass-dark {
        position:relative; overflow:hidden;
        background: rgba(60, 60, 65, 0.7);
        border: 1px solid rgba(255,255,255,0.15);
        backdrop-filter: blur(20px) saturate(160%);
        border-radius: 14px; font-weight:600;
        transition: transform 0.2s;
      }
      .nlm-pill {
        display:inline-flex; align-items:center; gap:5px;
        padding:4px 12px; border-radius:999px; font-size:12px; font-weight:500;
      }
      .sorb { position:absolute; border-radius:50%; pointer-events:none; filter: blur(50px); }
      .stat-n {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
      }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);
  return null;
};

const card = (isDark: boolean) => `ag-card ${isDark ? "ag-card-dark" : "ag-card-light"}`;
const pillProps = (isDark: boolean) => ({
  className: "nlm-pill inline-flex items-center gap-1.5",
  style: {
    background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)",
    color: isDark ? "#60a5fa" : "#1d4ed8",
    border: isDark ? "1px solid rgba(59,130,246,0.22)" : "1px solid rgba(59,130,246,0.16)",
  },
});
const muted = (isDark: boolean) => (isDark ? "#8a9bb0" : "#5f6368");
const head = (isDark: boolean) => (isDark ? "#f1f5f9" : "#111111");
const accent = (isDark: boolean) => (isDark ? "#60a5fa" : "#3b82f6");

/* ---------------- Anim helpers ---------------- */
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
} as const;

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setVal(Math.round(target * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ---------------- Data ---------------- */
export type Feature = {
  title: string;
  description: string;
  icon: React.ElementType;
  bullets: string[];
  tag?: "New" | "Pro" | "Beta";
};

const CORE: Feature[] = [
  { title: "AI-Powered Test Generation", description: "Create full papers from a prompt—sections, marks, formatting.", icon: Brain, bullets: ["Topic + outcome aware", "Deterministic blueprints", "One-click export (PDF/DOCX)"], tag: "Pro" },
  { title: "Curriculum-Aligned Content", description: "Questions mapped to standards with coverage scoring.", icon: BookOpen, bullets: ["Syllabus import (PDF/CSV)", "Outcome heatmap", "Gap warnings before export"] },
  { title: "Multiple Question Types", description: "MCQ, short/long answer, cloze, match, passages, diagrams.", icon: ListChecks, bullets: ["Auto-shuffle", "Parallel A/B sets", "LaTeX & figures"], tag: "New" },
  { title: "Difficulty Customization", description: "Set difficulty per section/outcome with cognitive checks.", icon: SlidersHorizontal, bullets: ["Bloom mapping", "Grade bands", "Readability guardrails"] },
  { title: "Instant Answer Keys", description: "Stepwise rationales & marking hints auto-generated.", icon: KeyRound, bullets: ["Rubric templates", "Point-wise hints", "Misconception flags"] },
  { title: "Collaborative Workflows", description: "Invite colleagues, co-edit, reuse banks with versioning.", icon: Users2, bullets: ["Shareable links", "Approval flow", "Reusable item banks"], tag: "Beta" },
];

const PROCTORING: Feature[] = [
  { title: "AI Proctoring", description: "Camera presence, face match, gaze & multi-person detection.", icon: ShieldCheck, bullets: ["Screen-lock (desktop)", "Anomaly scoring", "Privacy controls"] },
  { title: "Live Contest Host", description: "Schedule, invite, run—rankings & exports in one place.", icon: Workflow, bullets: ["Bulk import students", "Auto grading (MCQ)", "CSV/JSON results"] },
];

const ANALYTICS: Feature[] = [
  { title: "Student Analytics", description: "Progress by chapter/outcome with trends.", icon: BarChart3, bullets: ["Percentile bands", "Section-wise accuracy", "Time on task"] },
  { title: "Quality Dashboard", description: "Difficulty, discrimination index & item health.", icon: GaugeCircle, bullets: ["Flag low-signal items", "Auto-retire duplicates", "Bank freshness"] },
];

const TABS = [
  { key: "core", label: "Core", items: CORE },
  { key: "proctor", label: "Proctoring", items: PROCTORING },
  { key: "analytics", label: "Analytics", items: ANALYTICS },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/* ---------------- Page ---------------- */
export default function FeaturesPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();

  // live ambient glow follows cursor
  const mx = useMotionValue(360);
  const my = useMotionValue(180);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  
  const bgGlow = useMotionTemplate`
    radial-gradient(1000px 520px at ${mx}px ${my}px, ${isDark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.04)"}, transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px + 260px) calc(${my}px + 140px), ${isDark ? "rgba(96,165,250,0.06)" : "rgba(96,165,250,0.04)"}, transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px - 260px) calc(${my}px + 220px), ${isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)"}, transparent 70%)
  `;

  const [tab, setTab] = useState<TabKey>("core");
  const current = TABS.find((t) => t.key === tab)!;

  const stickyRef = useRef<HTMLDivElement>(null);
  useInView(stickyRef, { margin: "-80px 0px 0px 0px" });

  const Papers = useCountUp(3500);

  return (
    <div onMouseMove={onMove} className="lp min-h-screen relative overflow-hidden transition-colors duration-300" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <GlobalStyles />
      
      {/* Background Orbs */}
      <div className="hidden sm:block">
        <div className="sorb" style={{ width: 600, height: 600, right: -150, top: -100, background: isDark ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.03)" }} />
        <div className="sorb" style={{ width: 500, height: 500, left: -100, bottom: "20%", background: isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)" }} />
      </div>

      <div
        className="absolute inset-0 -z-20 pointer-events-none"
        style={{
          opacity: isDark ? 0.02 : 0.035,
          backgroundImage: `linear-gradient(to right, ${isDark ? "#ffffff" : "#000000"} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? "#ffffff" : "#000000"} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      {!prefersReducedMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-100"
          style={{ backgroundImage: bgGlow as any }}
        />
      )}

      {/* Sticky tabs bar */}
      <div ref={stickyRef} className="sticky top-0 z-40 supports-[backdrop-filter]:bg-transparent">
        <div 
          className="absolute inset-0 border-b backdrop-blur-xl" 
          style={{ 
            background: isDark ? "rgba(7,9,15,0.75)" : "rgba(255,255,255,0.75)",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" 
          }} 
        />
        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-lg font-semibold" style={{ color: head(isDark) }}>
            <Sparkles className="h-5 w-5" style={{ color: accent(isDark) }} />
            <span>Features</span>
          </div>
          <TabNav value={tab} onChange={setTab} isDark={isDark} />
        </div>
      </div>

      {/* Hero */}
      <section className="relative z-10 pt-12 pb-4 md:pt-16 md:pb-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mx-auto mb-8 inline-flex justify-center">
              <span {...pillProps(isDark)}>
                <Sparkles className="h-4 w-4" />
                What’s included
              </span>
            </div>

            <h1 className="text-[34px] md:text-5xl lg:text-6xl leading-[1.15] font-extrabold tracking-tight" style={{ color: head(isDark) }}>
              Powerful features,{" "}
              <br className="hidden sm:block" />
              real <span className="nlm-text">classroom impact</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg" style={{ color: muted(isDark) }}>
              Everything you need to create curriculum-perfect assessments in half the time.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Prevent gap shrink by giving grid area a stable min-height for the layout */}
          <div className="min-h-[28rem] lg:min-h-[32rem]">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 items-start"
              >
                {current.items.map((f, i) => (
                  <motion.div 
                    key={f.title} 
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
                  >
                    <FeatureCard feature={f} isDark={isDark} />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Stats band */}
          <motion.div {...fadeUp} viewport={{ once: true }} className="mt-12 rounded-2xl p-[1px] shadow-lg overflow-hidden" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
            <div className="rounded-2xl px-6 py-8 relative" style={{ background: isDark ? "rgba(10,14,24,0.95)" : "rgba(255,255,255,0.95)", backdropFilter: "blur(24px) saturate(160%)" }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center relative z-10">
                <Stat k={`${Papers.toLocaleString()}+`} v="Papers generated" isDark={isDark} />
                <Stat k="99%" v="Syllabus alignment" isDark={isDark} />
                <Stat k="< 2 min" v="Prompt → Paper" isDark={isDark} />
                <Stat k="99.9%" v="Uptime" isDark={isDark} />
              </div>
            </div>
          </motion.div>

          {/* Comparison */}
          <motion.div {...fadeUp} viewport={{ once: true }} className={`mt-10 p-6 shadow-sm ${card(isDark)}`}>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <Compare good="Outcome-aware generation" bad="Generic question dumps" isDark={isDark} />
              <Compare good="Deterministic blueprints" bad="Unstable lengths & marks" isDark={isDark} />
              <Compare good="Rubrics + rationales" bad="Answer-only keys" isDark={isDark} />
            </div>
          </motion.div>

          {/* Video row */}
          <VideoRow isDark={isDark} />

          {/* CTA */}
          <div className="relative z-10 text-center mt-20 mb-24">
            <button onClick={() => navigate("/dashboard/test-generator")} className="btn-blk px-8 py-4 text-base sm:text-lg">
              <span className="relative z-10 flex items-center justify-center gap-2">
                🚀 Start creating tests <ArrowRight className="h-5 w-5" />
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Components ---------------- */
function TabNav({ value, onChange, isDark }: { value: TabKey; onChange: (v: TabKey) => void; isDark: boolean }) {
  return (
    <div 
      className="inline-flex rounded-xl p-1 shadow-sm backdrop-blur"
      style={{ 
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.6)",
        border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.06)" 
      }}
    >
      {TABS.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative rounded-lg px-4 py-2 text-sm sm:text-base font-semibold transition-colors duration-200 ${
              active ? (isDark ? "text-white" : "text-slate-900") : (isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
            }`}
          >
            {active && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-0 rounded-lg"
                style={{ background: isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)" }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FeatureCard({ feature, isDark }: { feature: Feature; isDark: boolean }) {
  const mx = useMotionValue(120);
  const my = useMotionValue(90);
  const rotateX = useTransform(my, [0, 180], [8, -8]);
  const rotateY = useTransform(mx, [0, 260], [-10, 10]);
  const Icon = feature.icon;

  return (
    <div
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onMouseLeave={() => { mx.set(120); my.set(90); }}
      style={{ perspective: 1000 }}
      className="group h-full"
    >
      <motion.div style={{ rotateX, rotateY }} className={`relative h-full p-6 transition-all duration-300 ${card(isDark)}`}>
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, ${isDark ? "rgba(96,165,250,0.12)" : "rgba(59,130,246,0.08)"}, transparent 80%)` }}
        />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="relative flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)", border: isDark ? "1px solid rgba(59,130,246,0.18)" : "1px solid rgba(59,130,246,0.12)" }}
            >
              <Icon className="h-6 w-6" style={{ color: accent(isDark) }} />
              {feature.tag && (
                <span className="absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
                  {feature.tag}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold" style={{ color: head(isDark) }}>{feature.title}</h3>
          </div>

          <div className="flex-grow">
            <p className="text-sm leading-relaxed mb-4" style={{ color: muted(isDark) }}>{feature.description}</p>
            <ul className="space-y-2.5">
              {feature.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-[3px] rounded flex-shrink-0 p-[2px]" style={{ background: isDark ? "rgba(96,165,250,0.15)" : "rgba(59,130,246,0.1)" }}>
                    <Check className="h-3.5 w-3.5" style={{ color: accent(isDark) }} />
                  </span>
                  <span style={{ color: head(isDark) }}>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ k, v, isDark }: { k: string; v: string; isDark: boolean }) {
  return (
    <div>
      <div className="text-3xl font-extrabold tracking-tight stat-n">{k}</div>
      <div className="mt-1 text-sm font-medium" style={{ color: muted(isDark) }}>{v}</div>
    </div>
  );
}

function Compare({ good, bad, isDark }: { good: string; bad: string; isDark: boolean }) {
  return (
    <div 
      className="rounded-xl p-4 text-left shadow-sm relative overflow-hidden"
      style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.04)" }}
    >
      <div className="text-sm flex items-center mb-1">
        <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
          a4ai
        </span>
        <span className="font-semibold" style={{ color: head(isDark) }}>{good}</span>
      </div>
      <div className="mt-1 text-sm" style={{ color: muted(isDark) }}>vs “{bad}”</div>
    </div>
  );
}

function VideoRow({ isDark }: { isDark: boolean }) {
  const demoRef = useRef<HTMLVideoElement>(null);
  
  return (
    <motion.div {...fadeUp} viewport={{ once: true }} className="mt-16 md:mt-24 grid items-start gap-6 md:grid-cols-[1.2fr_1fr]">
      <div className={`overflow-hidden flex flex-col ${card(isDark)}`}>
        <div 
          className="px-6 py-4 text-sm font-semibold flex items-center gap-2 border-b"
          style={{ color: head(isDark), borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }}
        >
          <Video className="h-4 w-4" style={{ color: accent(isDark) }} /> See it in action
        </div>
        <div className="p-0">
          <motion.div
            initial={{ opacity: 0.98 }} whileHover={{ scale: 1.01 }} transition={{ duration: 0.3 }}
            className="relative group p-[1px] bg-gradient-to-br"
            style={{ backgroundImage: isDark ? "linear-gradient(to bottom right, rgba(59,130,246,0.3), rgba(129,140,248,0.1))" : "linear-gradient(to bottom right, rgba(59,130,246,0.4), rgba(129,140,248,0.2))" }}
          >
            <div className="bg-black overflow-hidden relative">
              <video ref={demoRef} className="aspect-video w-full object-cover" src="/demo.mp4" playsInline controls preload="metadata" />
            </div>
          </motion.div>
        </div>
        <div className="justify-between gap-3 flex-wrap flex px-6 py-4" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }}>
          <button
            className="btn-blk px-5 py-2.5 text-sm font-semibold"
            onClick={() => {
              const v = demoRef.current;
              if (v) { v.scrollIntoView({ behavior: "smooth", block: "center" }); v.play(); }
            }}
          >
            <span className="relative z-10 flex items-center gap-2"><Play className="h-4 w-4" /> Watch demo</span>
          </button>

          <button className={`px-5 py-2.5 text-sm flex items-center gap-2 ${isDark ? "btn-glass-dark" : "btn-glass-light"}`} style={{ color: isDark ? "#e8eaed" : "#202124" }}>
            <span className="relative z-10 flex items-center gap-2"><Download className="h-4 w-4" /> Download sample paper</span>
          </button>
        </div>
      </div>

      <div className={`p-6 ${card(isDark)}`}>
        <div className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: accent(isDark) }}>Why it feels different</div>
        <div className="grid gap-4 text-sm">
          <Bullet isDark={isDark}>Blueprint-first generation matches your marking scheme exactly.</Bullet>
          <Bullet isDark={isDark}>Outcome coverage heatmaps catch blind-spots before export.</Bullet>
          <Bullet isDark={isDark}>Item analytics prune weak questions over time.</Bullet>
          <Bullet isDark={isDark}>Privacy-first proctoring: humane alerts, no invasive captures.</Bullet>
        </div>
      </div>
    </motion.div>
  );
}

function Bullet({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-[6px] h-2 w-2 flex-shrink-0 rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }} />
      <span className="leading-relaxed" style={{ color: head(isDark) }}>{children}</span>
    </div>
  );
}