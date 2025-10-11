// ==========================================
// FILE: src/pages/FeaturesPage.tsx
// Cluely-style full redesign (v3):
// • Stronger radial mesh + faint grid (inline, cannot be purged)
// • Clean sticky tabs, bold hero, polished cards w/ tilt + glow
// • Black primary CTA, gradient demo footer, bigger video gap
// • Routes preserved (CTA → /dashboard/test-generator)
// ==========================================
import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
} from "lucide-react";

/* ---------------- Anim helpers ---------------- */
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
} as const;
const stagger = { whileInView: { transition: { staggerChildren: 0.08 } } } as const;

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
  {
    title: "AI-Powered Test Generation",
    description: "Create full papers from a prompt—sections, marks, formatting.",
    icon: Brain,
    bullets: ["Topic + outcome aware", "Deterministic blueprints", "One-click export (PDF/DOCX)"],
    tag: "Pro",
  },
  {
    title: "Curriculum-Aligned Content",
    description: "Questions mapped to standards with coverage scoring.",
    icon: BookOpen,
    bullets: ["Syllabus import (PDF/CSV)", "Outcome heatmap", "Gap warnings before export"],
  },
  {
    title: "Multiple Question Types",
    description: "MCQ, short/long answer, cloze, match, passages, diagrams.",
    icon: ListChecks,
    bullets: ["Auto-shuffle", "Parallel A/B sets", "LaTeX & figures"],
    tag: "New",
  },
  {
    title: "Difficulty Customization",
    description: "Set difficulty per section/outcome with cognitive checks.",
    icon: SlidersHorizontal,
    bullets: ["Bloom mapping", "Grade bands", "Readability guardrails"],
  },
  {
    title: "Instant Answer Keys",
    description: "Stepwise rationales & marking hints auto-generated.",
    icon: KeyRound,
    bullets: ["Rubric templates", "Point-wise hints", "Misconception flags"],
  },
  {
    title: "Collaborative Workflows",
    description: "Invite colleagues, co-edit, reuse banks with versioning.",
    icon: Users2,
    bullets: ["Shareable links", "Approval flow", "Reusable item banks"],
    tag: "Beta",
  },
];

const PROCTORING: Feature[] = [
  {
    title: "AI Proctoring",
    description: "Camera presence, face match, gaze & multi-person detection.",
    icon: ShieldCheck,
    bullets: ["Screen-lock (desktop)", "Anomaly scoring", "Privacy controls"],
  },
  {
    title: "Live Contest Host",
    description: "Schedule, invite, run—rankings & exports in one place.",
    icon: Workflow,
    bullets: ["Bulk import students", "Auto grading (MCQ)", "CSV/JSON results"],
  },
];

const ANALYTICS: Feature[] = [
  {
    title: "Student Analytics",
    description: "Progress by chapter/outcome with trends.",
    icon: BarChart3,
    bullets: ["Percentile bands", "Section-wise accuracy", "Time on task"],
  },
  {
    title: "Quality Dashboard",
    description: "Difficulty, discrimination index & item health.",
    icon: GaugeCircle,
    bullets: ["Flag low-signal items", "Auto-retire duplicates", "Bank freshness"],
  },
];

const TABS = [
  { key: "core", label: "Core", items: CORE },
  { key: "proctor", label: "Proctoring", items: PROCTORING },
  { key: "analytics", label: "Analytics", items: ANALYTICS },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/* ---------------- Page ---------------- */
export default function FeaturesPage() {
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
    radial-gradient(1000px 520px at ${mx}px ${my}px, rgba(59,130,246,0.10), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px + 260px) calc(${my}px + 140px), rgba(2,132,199,0.12), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px - 260px) calc(${my}px + 220px), rgba(147,197,253,0.10), transparent 70%)
  `;

  const [tab, setTab] = useState<TabKey>("core");
  const current = TABS.find((t) => t.key === tab)!;

  const stickyRef = useRef<HTMLDivElement>(null);
  useInView(stickyRef, { margin: "-80px 0px 0px 0px" });

  const Papers = useCountUp(3500);

  return (
    <div onMouseMove={onMove} className="min-h-screen relative overflow-hidden">
      {/* --- Cluely-style Background (inline: cannot be purged) --- */}
      <div
        className="absolute inset-0 -z-30"
        style={{
          background:
            "radial-gradient(1100px 620px at 16% -12%, #EDF1F7 0%, transparent 60%), radial-gradient(1100px 620px at 84% 112%, #F7FAFF 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 -z-20 pointer-events-none"
        style={{
          opacity: 0.035,
          backgroundImage:
            "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {!prefersReducedMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-10"
          style={{ backgroundImage: bgGlow as any }}
        />
      )}

      {/* Sticky tabs bar */}
      <div
        ref={stickyRef}
        className="sticky top-0 z-40 border-b supports-[backdrop-filter]:bg-white/65 backdrop-blur"
        role="navigation"
        aria-label="Features tabs"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Sparkles className="h-5 w-5 text-sky-500" />
            <span>Features</span>
          </div>


          <TabNav value={tab} onChange={setTab} />
        </div>
      </div>

      {/* Hero */}
      <section className="relative z-10 pt-12 pb-4 md:pt-16 md:pb-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium tracking-tight backdrop-blur border border-slate-200 bg-white/80 shadow-sm">
              <Sparkles className="h-5 w-5 text-sky-600" />
              <span className="text-slate-800">What’s included</span>
            </div>



            <h1 className="font-halenoir text-[34px] md:text-5xl leading-[1.1] font-extrabold tracking-tight">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg,#1F2A33_0%,#4F6274_40%,#1F2A33_100%)",
                  backgroundSize: "220% 100%",
                  animation: "bg-pan 10s linear infinite",
                }}
              >
                Powerful features, real classroom impact
              </span>
            </h1>

            <p className="mt-4 text-lg text-slate-600">
              Everything you need to create curriculum-perfect assessments in half the time.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={stagger}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.16 }}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {current.items.map((f) => (
              <motion.div key={f.title} variants={fadeUp}>
                <FeatureCard feature={f} />
              </motion.div>
            ))}
          </motion.div>

          {/* Stats band */}
          <motion.div
            {...fadeUp}
            viewport={{ once: true }}
            className="mt-12 rounded-2xl border bg-gradient-to-r from-sky-300 to-blue-500 p-[1px] shadow-lg"
          >
            <div className="rounded-2xl bg-white px-6 py-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                <Stat k={`${Papers.toLocaleString()}+`} v="Papers generated" />
                <Stat k="99%" v="Syllabus alignment" />
                <Stat k="< 2 min" v="Prompt → Paper" />
                <Stat k="99.9%" v="Uptime" />
              </div>
            </div>
          </motion.div>

          {/* Comparison */}
          <motion.div
            {...fadeUp}
            viewport={{ once: true }}
            className="mt-10 rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <Compare good="Outcome-aware generation" bad="Generic question dumps" />
              <Compare good="Deterministic blueprints" bad="Unstable lengths & marks" />
              <Compare good="Rubrics + rationales" bad="Answer-only keys" />
            </div>
          </motion.div>

          {/* Video row (extra gap before) */}
          <VideoRow />

          {/* CTA */}
          <div className="relative z-10 text-center mt-16 mb-16">
            <Button
              size="lg"
              aria-label="Start creating tests"
              onClick={() => navigate("/dashboard/test-generator")}
              className="rounded-xl px-8 py-4 text-lg font-semibold text-white shadow-xl hover:brightness-110 focus-visible:ring-0"
              style={{
                background: "linear-gradient(180deg,#0B1220 0%,#111827 85%)",
                border: "1px solid rgba(17,24,39,0.55)",
                boxShadow: "0 12px 28px rgba(2,6,23,0.25)",
              }}
            >
              Start creating tests
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Subs ---------------- */
function TabNav({ value, onChange }: { value: TabKey; onChange: (v: TabKey) => void }) {
  return (
    <div className="inline-flex rounded-xl border p-1 bg-white/70 backdrop-blur shadow-sm">
      {TABS.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative rounded-lg px-4 py-2 text-base font-semibold transition ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}
            aria-pressed={active}
          >
            {active && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-0 rounded-lg"
                style={{ background: "linear-gradient(180deg,#EFF6FF,#E0ECFF)" }}
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
      onMouseLeave={() => {
        mx.set(120);
        my.set(90);
      }}
      style={{ perspective: 1000 }}
      className="group"
    >
      <motion.div
        style={{ rotateX, rotateY }}
        className="relative h-full rounded-2xl border bg-white p-6 shadow-md transition-all duration-300 hover:shadow-xl"
      >
        {/* inner ring */}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-slate-200" />

        {/* faint cursor blue glow */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: useMotionTemplate`radial-gradient(160px_110px_at_${mx}px_${my}px,rgba(59,130,246,0.10),transparent_70%)`,
          }}
        />

        <Card className="h-full border-0 bg-transparent shadow-none">
          <CardHeader className="flex items-center gap-3 p-0">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400/15 via-sky-500/15 to-blue-600/15 text-blue-700">
              <Icon className="h-6 w-6" />
              {feature.tag && (
                <span className="absolute -right-2 -top-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                  {feature.tag}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
          </CardHeader>

          <CardContent className="p-0 pt-3">
            <p className="text-sm text-slate-600">{feature.description}</p>
            <ul className="mt-4 space-y-2">
              {feature.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-[2px] rounded-md bg-gradient-to-r from-sky-400/15 to-blue-600/15 p-[6px]">
                    <Check className="h-3.5 w-3.5 text-blue-600" />
                  </span>
                  <span className="text-slate-900">{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* base glow */}
        <div className="pointer-events-none absolute inset-x-0 -bottom-4 h-5 rounded-b-2xl bg-black/5 blur-xl" />
      </motion.div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-3xl font-extrabold tracking-tight text-slate-900">{k}</div>
      <div className="mt-1 text-sm text-slate-600">{v}</div>
    </div>
  );
}

function Compare({ good, bad }: { good: string; bad: string }) {
  return (
    <div className="rounded-xl border bg-white/80 p-4 text-left shadow-sm">
      <div className="text-sm">
        <span className="mr-2 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
          a4ai
        </span>
        <span className="font-medium text-slate-900">{good}</span>
      </div>
      <div className="mt-1 text-sm text-slate-600">vs “{bad}”</div>
    </div>
  );
}

function VideoRow() {
  const demoRef = useRef<HTMLVideoElement>(null);
  return (
    <motion.div
      {...fadeUp}
      viewport={{ once: true }}
      className="mt-16 md:mt-20 grid items-start gap-6 md:grid-cols-[1.2fr_1fr]"
    >
      <Card className="overflow-hidden">
        <div className="border-b bg-slate-50 px-6 py-3 text-sm font-medium flex items-center gap-2 text-slate-700">
          <Video className="h-4 w-4" /> See it in action
        </div>
        <CardContent className="p-0">
          <motion.div
            initial={{ opacity: 0.98 }}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.3 }}
            className="relative group p-[1px] rounded-xl bg-gradient-to-br from-sky-400/40 to-blue-600/40"
          >
            <div className="rounded-xl bg-white overflow-hidden">
              <video
                ref={demoRef}
                className="aspect-video w-full object-cover"
                src="/demo.mp4"
                playsInline
                controls
                preload="metadata"
              />
            </div>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10"
            />
          </motion.div>
        </CardContent>
        <CardFooter className="justify-between gap-3 flex-wrap bg-gradient-to-r from-sky-50 to-blue-50 rounded-b-xl px-6 py-4">
          <Button
            size="sm"
            className="relative h-11 rounded-xl px-5 text-base font-semibold text-white gap-2 hover:brightness-110"
            style={{
              background: "linear-gradient(180deg,#0B1220 0%,#111827 85%)",
              border: "1px solid rgba(17,24,39,0.5)",
            }}
            onClick={() => {
              const v = demoRef.current;
              if (v) {
                v.scrollIntoView({ behavior: "smooth", block: "center" });
                v.play();
              }
            }}
          >
            <Play className="h-5 w-5" /> Watch demo
          </Button>

          <Button size="sm" variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Download sample paper
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="text-sm text-slate-600">Why it feels different</div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Bullet>Blueprint-first generation matches your marking scheme exactly.</Bullet>
          <Bullet>Outcome coverage heatmaps catch blind-spots before export.</Bullet>
          <Bullet>Item analytics prune weak questions over time.</Bullet>
          <Bullet>Privacy-first proctoring: humane alerts, no invasive captures.</Bullet>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm text-slate-900">
      <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600" />
      <span>{children}</span>
    </div>
  );
}

/* Keyframes used by headline fill exist in globals.css:
@keyframes bg-pan { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
*/
