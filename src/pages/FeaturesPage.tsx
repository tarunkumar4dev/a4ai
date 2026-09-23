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
    document.documentElement.style.background = "#ffffff !important";
    document.documentElement.style.backgroundColor = "#ffffff !important";
    document.documentElement.style.colorScheme = "light only !important";
    document.documentElement.classList.remove("dark");

    const s = document.createElement("style");
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

      .lp-features-wrapper, .lp-features-wrapper * {
        font-family: 'Plus Jakarta Sans', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
        -webkit-font-smoothing: antialiased;
      }
      
      html, body, #root, main, section { background: #ffffff !important; background-color: #ffffff !important; }

      .feature-card {
        border-radius: 24px;
        transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s cubic-bezier(.16,1,.3,1), border-color 0.22s ease;
        position: relative;
        background: rgba(255, 255, 255, 0.95) !important;
        border: 1px solid rgba(226, 232, 240, 0.9) !important;
        backdrop-filter: blur(30px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(170%) !important;
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02) !important;
      }

      @media (hover: hover) {
        .feature-card:hover {
          transform: translateY(-4px) !important;
          border-color: rgba(147, 197, 253, 0.9) !important;
          box-shadow: 0 20px 40px -12px rgba(59, 130, 246, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04) !important;
        }
      }

      .btn-blue-gradient {
        background: linear-gradient(180deg, #93c5fd 0%, #3b82f6 85%) !important;
        color: #ffffff !important;
        border: 1px solid #60a5fa !important;
        box-shadow: 0 4px 14px rgba(59, 130, 246, 0.25) !important;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        border-radius: 14px;
        font-weight: 700;
      }
      .btn-blue-gradient * { color: #ffffff !important; stroke: #ffffff !important; }
      @media (hover: hover) { 
        .btn-blue-gradient:hover { 
          filter: brightness(1.05); 
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.38) !important; 
        } 
      }

      .btn-white-action {
        background: #ffffff !important;
        color: #0f172a !important;
        border: 1px solid #e2e8f0 !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        border-radius: 14px;
        font-weight: 700;
      }
      .btn-white-action * { color: #0f172a !important; stroke: #0f172a !important; }
      @media (hover: hover) {
        .btn-white-action:hover {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.07) !important;
        }
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

      /* Clean Frosted Transparent Custom Navigation Header Dock */
      .force-light-dock {
        background-color: rgba(255, 255, 255, 0.7) !important;
        background: rgba(255, 255, 255, 0.7) !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        border: 1px solid rgba(226, 232, 240, 0.8) !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 32px rgba(0, 0, 0, 0.04) !important;
      }

      .per-student-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #eff6ff;
        border: 1px solid #dbeafe;
        color: #1d4ed8;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 999px;
      }

      .nlm-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        background: rgba(59,130,246,0.06);
        color: #1d4ed8;
        border: 1px solid rgba(59,130,246,0.14);
      }
      .sorb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(70px); }
      @media (min-width: 640px) { .sorb { filter: blur(100px); } }

      .stat-n {
        color: #0f172a !important;
        font-weight: 900;
        letter-spacing: -0.02em;
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
  const rafId = useRef<number | null>(null);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    const currentTarget = e.currentTarget;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (!currentTarget) return;
      const r = currentTarget.getBoundingClientRect();
      mx.set(clientX - r.left);
      my.set(clientY - r.top);
    });
  };

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);
  
  const bgGlow = useMotionTemplate`
    radial-gradient(1000px 520px at ${mx}px ${my}px, rgba(59,130,246,0.04), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px + 260px) calc(${my}px + 140px), rgba(96,165,250,0.04), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px - 260px) calc(${my}px + 220px), rgba(129,140,248,0.03), transparent 70%)
  `;

  const [tab, setTab] = useState<TabKey>("core");
  const current = TABS.find((t) => t.key === tab)!;

  const Papers = useCountUp(3500);

  return (
    <div onMouseMove={onMove} className="lp-features-wrapper min-h-screen relative overflow-hidden bg-white">
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
            <Link to="/" className="group flex items-center gap-2.5 select-none text-lg font-bold tracking-tight transition-opacity active:opacity-90">
              <img 
                src="/ICON.ico" 
                alt="a4ai Logo" 
                className="h-6 w-6 object-contain rounded transition-transform duration-200 group-hover:scale-105"
              />
              <span style={{ color: txtHead }}>
                a4ai <span className="text-xs font-medium opacity-60 ml-1">Features</span>
              </span>
            </Link>
            <TabNav value={tab} onChange={setTab} />
          </div>
        </nav>
      </div>

      {/* Main Body Grid */}
      <div className="pt-24 relative z-10 bg-white">
        {/* Hero Header */}
        <section className="pt-12 pb-6 md:pt-16 md:pb-8 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div className="text-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="mx-auto mb-6 inline-flex justify-center">
                <span className="per-student-pill text-xs px-3.5 py-1.5 font-bold">
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Complete Assessment Toolkit
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.15]">
                Powerful features,{" "}
                <br className="hidden sm:block" />
                real <span className="nlm-text">classroom impact</span>
              </h1>

              <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-slate-600 font-medium">
                Everything Indian teachers, coaching centers, and colleges need to create curriculum-perfect assessments in seconds.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link to="/contact" className="btn-blue-gradient px-6 py-3 text-sm font-bold flex items-center gap-2">
                  Get Started for Free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/pricing" className="btn-white-action px-6 py-3 text-sm font-bold flex items-center gap-2">
                  View Pricing Plans
                </Link>
              </div>

              {/* Audience / Category Tab Switcher matching PricingPage */}
              <div className="mt-10 flex justify-center">
                <TabNav value={tab} onChange={setTab} />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Feature Layout Block */}
        <section className="relative z-10 bg-white pb-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="min-h-[28rem] lg:min-h-[32rem]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch"
                >
                  {current.items.map((f, i) => (
                    <motion.div 
                      key={f.title} 
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
                      className="h-full"
                    >
                      <FeatureCard feature={f} />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Stats Summary Panel */}
            <motion.div {...fadeUp} viewport={{ once: true }} className="mt-14 feature-card p-6 md:p-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                <Stat k={`${Papers.toLocaleString()}+`} v="Papers generated" />
                <Stat k="99%" v="Syllabus alignment" />
                <Stat k="< 2 min" v="Prompt → Paper" />
                <Stat k="99.9%" v="Uptime" />
              </div>
            </motion.div>

            {/* Comparison Module */}
            <motion.div {...fadeUp} viewport={{ once: true }} className="mt-10 p-6 ag-card bg-white shadow-sm">
              <div className="grid gap-4 md:grid-cols-3 text-sm font-medium">
                <Compare good="Outcome-aware generation" bad="Generic question dumps" />
                <Compare good="Deterministic blueprints" bad="Unstable lengths & marks" />
                <Compare good="Rubrics + rationales" bad="Answer-only keys" />
              </div>
            </motion.div>

            {/* Video Demonstration Layout */}
            <VideoRow />

            {/* Bottom Footer Call-To-Action Button */}
            <div className="relative z-10 text-center mt-20 mb-24">
              <button onClick={() => navigate("/dashboard/test-generator")} className="btn-blk px-8 py-4 text-base sm:text-lg font-bold">
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
      className="inline-flex items-center gap-1 rounded-2xl border px-1.5 py-1.5 shadow-sm backdrop-blur bg-white/90 border-slate-200"
    >
      {TABS.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition " +
              (active
                ? "bg-slate-900 text-white shadow-sm ring-1 ring-black/5"
                : "text-slate-700 hover:bg-slate-100/70 ring-1 ring-transparent")
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const mx = useMotionValue(120);
  const my = useMotionValue(90);
  const rotateX = useTransform(my, [0, 180], [7, -7]);
  const rotateY = useTransform(mx, [0, 260], [-8, 8]);
  const Icon = feature.icon;
  const rafId = useRef<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    const currentTarget = e.currentTarget;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (!currentTarget) return;
      const r = currentTarget.getBoundingClientRect();
      mx.set(clientX - r.left);
      my.set(clientY - r.top);
    });
  };

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { mx.set(120); my.set(90); }}
      style={{ perspective: 1000 }}
      className="group h-full flex flex-col"
    >
      <motion.div
        style={{ rotateX, rotateY, willChange: "transform" }}
        className="feature-card p-6 flex flex-col h-full relative"
      >
        {feature.tag && (
          <div className="absolute -top-3 right-4 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-bold text-white shadow z-10">
            {feature.tag}
          </div>
        )}

        {/* Radial cursor sheen */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, rgba(59,130,246,0.06), transparent 80%)` }}
        />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/70 border border-blue-100 flex-shrink-0 text-blue-600 shadow-xs">
              <Icon className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {feature.title}
            </h3>
          </div>

          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-4">
            {feature.description}
          </p>

          <ul className="space-y-2.5 mb-6 flex-grow">
            {feature.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm font-medium">
                <div className="h-5 w-5 rounded-full bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </div>
                <span className="text-slate-700 font-semibold leading-snug">{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="per-student-pill">Included in all plans</span>
            <Link
              to="/pricing"
              className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors group-hover:translate-x-0.5"
            >
              See Plans <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{k}</div>
      <div className="mt-1.5 text-sm font-semibold text-slate-500">{v}</div>
    </div>
  );
}

// Fixed Contrast Inversions
function Compare({ good, bad }: { good: string; bad: string }) {
  return (
    <div 
      className="rounded-2xl p-4 text-left shadow-xs relative overflow-hidden bg-slate-50 border border-slate-200/90"
    >
      <div className="text-sm flex items-center mb-1">
        <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-extrabold text-white uppercase tracking-wider bg-blue-600">
          a4ai
        </span>
        <span className="font-bold text-slate-900">{good}</span>
      </div>
      <div className="mt-1 text-sm font-medium text-slate-500">vs “{bad}”</div>
    </div>
  );
}

function VideoRow() {
  const demoRef = useRef<HTMLVideoElement>(null);
  
  return (
    <motion.div {...fadeUp} viewport={{ once: true }} className="mt-16 md:mt-24 grid items-start gap-6 md:grid-cols-[1.2fr_1fr] bg-white">
      <div className="overflow-hidden flex flex-col feature-card bg-white">
        <div 
          className="px-6 py-4 text-sm font-bold flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 text-slate-800"
        >
          <Video className="h-4 w-4 text-blue-600" /> See it in action
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
        <div className="justify-between gap-3 flex-wrap flex px-6 py-4 bg-slate-50/70 border-t border-slate-100">
          <button
            className="btn-blue-gradient px-5 py-2.5 text-sm font-bold flex items-center gap-2"
            onClick={() => {
              const v = demoRef.current;
              if (v) { v.scrollIntoView({ behavior: "smooth", block: "center" }); v.play(); }
            }}
          >
            <Play className="h-4 w-4" /> Watch demo
          </button>

          <Link to="/contact" className="btn-white-action px-5 py-2.5 text-sm font-bold flex items-center gap-2">
            <Download className="h-4 w-4" /> Download sample paper
          </Link>
        </div>
      </div>

      <div className="p-6 feature-card bg-white">
        <div className="mb-4 text-sm font-extrabold uppercase tracking-wider text-blue-600">Why it feels different</div>
        <div className="grid gap-4 text-sm font-medium">
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
      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
      <span className="leading-relaxed font-semibold text-slate-700">{children}</span>
    </div>
  );
}