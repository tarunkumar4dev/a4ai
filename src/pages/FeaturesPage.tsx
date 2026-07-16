import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import {
  Brain,
  BookOpen,
  ListChecks,
  SlidersHorizontal,
  KeyRound,
  Users2,
  Check,
  Sparkles,
  Video,
  Download,
  BarChart3,
  Workflow,
  GaugeCircle,
  Play,
  ArrowRight
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   BRAND STYLES & GLOBAL INJECTION (Forced Light Only)
   ────────────────────────────────────────────────────────────── */
const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";
const gradientAnimStyle = { backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" };

const GlobalStyles = () => {
  useEffect(() => {
    // Override root baseline layers against forced system schemes
    document.documentElement.style.background = "#ffffff";
    document.documentElement.style.backgroundColor = "#ffffff";
    document.documentElement.style.colorScheme = "light";
    document.documentElement.classList.remove("dark");

    const s = document.createElement("style");
    s.textContent = `
      .lp { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; background-color: #ffffff !important; }
      
      html, body, #root, main, section { background: #ffffff !important; background-color: #ffffff !important; }

      .ag-card {
        border-radius: 18px;
        transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s cubic-bezier(.16,1,.3,1);
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.8) !important;
        border: 1px solid rgba(0, 0, 0, 0.07) !important;
        backdrop-filter: blur(30px) saturate(170%);
        -webkit-backdrop-filter: blur(30px) saturate(170%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(59,130,246,0.03), 0 2px 6px rgba(0,0,0,0.02);
      }
      @media (min-width: 640px) { .ag-card { border-radius: 20px; } }
      
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

      /* Immutable Protected Black Glossy Button Engine */
      .btn-blk {
        position:relative; overflow:hidden;
        background: linear-gradient(180deg, #252629 0%, #0d0d0e 100%) !important;
        background-color: #0d0d0e !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 14px rgba(0,0,0,0.3) !important;
        color: #ffffff !important; font-weight:600;
        border-radius: 14px;
        transition: transform 0.2s, box-shadow 0.2s;
        -webkit-tap-highlight-color: transparent;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }
      .btn-blk * {
        color: #ffffff !important;
        stroke: #ffffff !important;
      }
      @media (hover: hover) {
        .btn-blk:hover { transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 20px rgba(0,0,0,0.4) !important; }
      }
      .btn-blk:active { transform: scale(0.96); }

      /* Immutable White Frosted Sample Button */
      .btn-glass-light {
        position:relative; overflow:hidden;
        background: rgba(255, 255, 255, 0.75) !important;
        background-color: rgba(255, 255, 255, 0.75) !important;
        border: 1px solid #e5e7eb !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border-radius: 14px; font-weight:600;
        transition: transform 0.2s;
        color: #202124 !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
        box-shadow: inset 0 1px 0 #ffffff, 0 2px 8px rgba(0,0,0,0.04) !important;
      }
      .btn-glass-light * {
        color: #202124 !important;
        stroke: #202124 !important;
      }
      @media (hover: hover) {
        .btn-glass-light:hover { transform: translateY(-2px); box-shadow: inset 0 1px 0 #ffffff, 0 4px 14px rgba(0,0,0,0.08) !important; }
      }

      /* Clean Frosted Transparent Custom Navigation Header Dock */
      .force-light-dock {
        background-color: rgba(255, 255, 255, 0.45) !important;
        background: rgba(255, 255, 255, 0.45) !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        border: 1px solid rgba(255, 255, 255, 0.5) !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6), 0 8px 32px rgba(0, 0, 0, 0.03) !important;
      }

      .nlm-pill {
        display:inline-flex; align-items:center; gap:5px;
        padding:5px 14px; border-radius:999px; font-size:13px; font-weight:500;
        background: rgba(59,130,246,0.06); color: #1d4ed8; border: 1px solid rgba(59,130,246,0.14);
      }
      .sorb { position:absolute; border-radius:50%; pointer-events:none; filter: blur(70px); }
      @media (min-width: 640px) { .sorb { filter: blur(100px); } }

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

/* --- Light Visual Design Tokens --- */
const txtMuted = "#5f6368";
const txtHead = "#111111";
const accentColor = "#3b82f6";

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

/* ---------------- Data Restored ---------------- */
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
  { title: "AI Proctoring", description: "Camera presence, face match, gaze & multi-person detection.", icon: Brain, bullets: ["Screen-lock (desktop)", "Anomaly scoring", "Privacy controls"] },
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

/* ---------------- Page Canvas Layout ---------------- */
export default function FeaturesPage() {
  const navigate = useNavigate();

  const mx = useMotionValue(360);
  const my = useMotionValue(180);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  
  const bgGlow = useMotionTemplate`
    radial-gradient(1000px 520px at ${mx}px ${my}px, rgba(59,130,246,0.04), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px + 260px) calc(${my}px + 140px), rgba(96,165,250,0.04), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px - 260px) calc(${my}px + 220px), rgba(129,140,248,0.03), transparent 70%)
  `;

  const [tab, setTab] = useState<TabKey>("core");
  const current = TABS.find((t) => t.key === tab)!;

  const Papers = useCountUp(3500);

  return (
    <div onMouseMove={onMove} className="lp min-h-screen relative overflow-hidden bg-white">
      <GlobalStyles />
      
      {/* Background Orbs */}
      <div className="hidden sm:block">
        <div className="sorb" style={{ width: 600, height: 600, right: -150, top: -100, background: "rgba(59,130,246,0.03)" }} />
        <div className="sorb" style={{ width: 500, height: 500, left: -100, bottom: "20%", background: "rgba(129,140,248,0.03)" }} />
      </div>

      <div
        className="absolute inset-0 -z-20 pointer-events-none"
        style={{
          opacity: 0.015,
          backgroundImage: `linear-gradient(to right, #000000 1px, transparent 1px), linear-gradient(to bottom, #000000 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-100"
        style={{ backgroundImage: bgGlow as any }}
      />

      {/* FLOATING TOP NAVIGATION DOCK BAR */}
      <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
        <nav 
          className="mx-auto max-w-7xl rounded-2xl border transition-all duration-300 relative overflow-hidden force-light-dock"
        >
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Link to="/" className="group flex items-center gap-2.5 select-none text-lg font-semibold tracking-tight transition-opacity active:opacity-90">
              <img 
                src="/ICON.ico" 
                alt="a4ai Logo" 
                className="h-6 w-6 object-contain rounded transition-transform duration-200 group-hover:scale-105"
              />
              <span style={{ color: txtHead }}>
                a4ai <span className="text-xs font-normal opacity-60 ml-1">Features</span>
              </span>
            </Link>
            <TabNav value={tab} onChange={setTab} />
          </div>
        </nav>
      </div>

      {/* Main Body Grid */}
      <div className="pt-24 relative z-10 bg-white">
        {/* Hero Header */}
        <section className="pt-12 pb-4 md:pt-16 md:pb-6 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div className="text-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="mx-auto mb-8 inline-flex justify-center">
                <span className="nlm-pill">
                  <Sparkles className="h-4 w-4" />
                  What’s included
                </span>
              </div>

              <h1 className="text-[34px] md:text-5xl lg:text-6xl leading-[1.15] font-extrabold tracking-tight text-neutral-900">
                Powerful features,{" "}
                <br className="hidden sm:block" />
                real <span className="nlm-text">classroom impact</span>
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-lg" style={{ color: txtMuted }}>
                Everything you need to create curriculum-perfect assessments in half the time.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Feature Layout Block */}
        <section className="relative z-10 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
                      <FeatureCard feature={f} />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Stats Summary Panel */}
            <motion.div {...fadeUp} viewport={{ once: true }} className="mt-12 rounded-2xl p-[1px] shadow-sm overflow-hidden" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
              <div className="rounded-2xl px-6 py-8 relative bg-white/95 backdrop-blur-md">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center relative z-10">
                  <Stat k={`${Papers.toLocaleString()}+`} v="Papers generated" />
                  <Stat k="99%" v="Syllabus alignment" />
                  <Stat k="< 2 min" v="Prompt → Paper" />
                  <Stat k="99.9%" v="Uptime" />
                </div>
              </div>
            </motion.div>

            {/* Comparison Module */}
            <motion.div {...fadeUp} viewport={{ once: true }} className="mt-10 p-6 ag-card bg-white shadow-sm">
              <div className="grid gap-4 md:grid-cols-3 text-sm">
                <Compare good="Outcome-aware generation" bad="Generic question dumps" />
                <Compare good="Deterministic blueprints" bad="Unstable lengths & marks" />
                <Compare good="Rubrics + rationales" bad="Answer-only keys" />
              </div>
            </motion.div>

            {/* Video Demonstration Layout */}
            <VideoRow />

            {/* Bottom Footer Call-To-Action Button */}
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
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SUB-COMPONENTS LAYOUT
   ────────────────────────────────────────────────────────────── */
function TabNav({ value, onChange }: { value: TabKey; onChange: (v: TabKey) => void }) {
  return (
    <div 
      className="inline-flex rounded-xl p-1 bg-white/60 shadow-sm backdrop-blur border border-neutral-200/60"
    >
      {TABS.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative rounded-lg px-3.5 py-1.5 text-xs sm:text-sm md:text-base font-semibold transition-colors duration-200 ${
              active ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {active && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-0 rounded-lg bg-blue-500/10"
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

function FeatureCard({ feature }: { feature: Feature }) {
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
      <motion.div style={{ rotateX, rotateY }} className="relative h-full p-6 transition-all duration-300 ag-card bg-white">
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, rgba(59,130,246,0.06), transparent 80%)` }}
        />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 border border-blue-100"
            >
              <Icon className="h-6 w-6" style={{ color: accentColor }} />
              {feature.tag && (
                <span className="absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
                  {feature.tag}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">{feature.title}</h3>
          </div>

          <div className="flex-grow">
            <p className="text-sm leading-relaxed mb-4" style={{ color: txtMuted }}>{feature.description}</p>
            <ul className="space-y-2.5">
              {feature.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-[3px] rounded flex-shrink-0 p-[2px] bg-blue-50">
                    <Check className="h-3.5 w-3.5" style={{ color: accentColor }} />
                  </span>
                  <span style={{ color: txtHead }}>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-3xl font-extrabold tracking-tight stat-n">{k}</div>
      <div className="mt-1 text-sm font-medium" style={{ color: txtMuted }}>{v}</div>
    </div>
  );
}

// Fixed Contrast Inversions
function Compare({ good, bad }: { good: string; bad: string }) {
  return (
    <div 
      className="rounded-xl p-4 text-left shadow-sm relative overflow-hidden bg-neutral-50 border border-neutral-200/70"
    >
      <div className="text-sm flex items-center mb-1">
        <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
          a4ai
        </span>
        <span className="font-semibold text-neutral-900">{good}</span>
      </div>
      <div className="mt-1 text-sm text-neutral-500">vs “{bad}”</div>
    </div>
  );
}

function VideoRow() {
  const demoRef = useRef<HTMLVideoElement>(null);
  
  return (
    <motion.div {...fadeUp} viewport={{ once: true }} className="mt-16 md:mt-24 grid items-start gap-6 md:grid-cols-[1.2fr_1fr] bg-white">
      <div className="overflow-hidden flex flex-col ag-card bg-white">
        <div 
          className="px-6 py-4 text-sm font-semibold flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 text-neutral-800"
        >
          <Video className="h-4 w-4 text-blue-500" /> See it in action
        </div>
        <div className="p-0 bg-white">
          <motion.div
            initial={{ opacity: 0.98 }} whileHover={{ scale: 1.01 }} transition={{ duration: 0.3 }}
            className="relative group p-[1px] bg-gradient-to-br from-blue-500/20 to-indigo-500/10"
          >
            <div className="bg-black overflow-hidden relative">
              <video ref={demoRef} className="aspect-video w-full object-cover" src="/demo.mp4" playsInline controls preload="metadata" />
            </div>
          </motion.div>
        </div>
        <div className="justify-between gap-3 flex-wrap flex px-6 py-4 bg-neutral-50 border-t border-neutral-100">
          <button
            className="btn-blk px-5 py-2.5 text-sm font-semibold"
            onClick={() => {
              const v = demoRef.current;
              if (v) { v.scrollIntoView({ behavior: "smooth", block: "center" }); v.play(); }
            }}
          >
            <span className="relative z-10 flex items-center gap-2"><Play className="h-4 w-4" /> Watch demo</span>
          </button>

          <button className="px-5 py-2.5 text-sm flex items-center gap-2 btn-glass-light">
            <span className="relative z-10 flex items-center gap-2"><Download className="h-4 w-4" /> Download sample paper</span>
          </button>
        </div>
      </div>

      <div className="p-6 ag-card bg-white border border-neutral-100 shadow-sm">
        <div className="mb-4 text-sm font-semibold uppercase tracking-wider text-blue-600">Why it feels different</div>
        <div className="grid gap-4 text-sm">
          <Bullet>Blueprint-first generation matches your marking scheme exactly.</Bullet>
          <Bullet>Outcome coverage heatmaps catch blind-spots before export.</Bullet>
          <Bullet>Item analytics prune weak questions over time.</Bullet>
          <Bullet>Privacy-first proctoring: humane alerts, no invasive captures.</Bullet>
        </div>
      </div>
    </motion.div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-[6px] h-2 w-2 flex-shrink-0 rounded-full" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }} />
      <span className="leading-relaxed text-neutral-800">{children}</span>
    </div>
  );
}