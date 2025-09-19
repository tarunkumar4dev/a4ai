// ==========================================
// FILE: src/pages/FeaturesPage.tsx
// Features page styled to match homepage/Cluely palette (blue + black, frosted UI)
// Tailwind + shadcn/ui + framer-motion
// ==========================================
import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from "framer-motion";
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
  Zap,
  Video,
  Download,
  TimerReset,
  BarChart3,
  Workflow,
  Ruler,
  GaugeCircle,
  Play,
} from "lucide-react";

// ---------- Animation helpers ----------
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.5 } },
} as const;

const stagger = { whileInView: { transition: { staggerChildren: 0.08 } } } as const;

// Light count-up (TS-safe)
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

// ---------- Types & data ----------
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

// ==========================================
export default function FeaturesPage() {
  // ambient glow (blue)
  const mx = useMotionValue(320);
  const my = useMotionValue(160);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const bgGlow = useMotionTemplate`
    radial-gradient(900px 450px at ${mx}px ${my}px, rgba(59,130,246,0.10), transparent 70%),
    radial-gradient(900px 450px at calc(${mx}px + 220px) calc(${my}px + 120px), rgba(2,132,199,0.12), transparent 70%),
    radial-gradient(900px 450px at calc(${mx}px - 220px) calc(${my}px + 220px), rgba(147,197,253,0.10), transparent 70%)
  `;

  const [tab, setTab] = useState<TabKey>("core");
  const current = TABS.find((t) => t.key === tab)!;

  const stickyRef = useRef<HTMLDivElement>(null);
  useInView(stickyRef, { margin: "-80px 0px 0px 0px" });

  const Papers = useCountUp(3500);

  return (
    <div
      onMouseMove={onMove}
      className="min-h-screen relative"
    >
      {/* frosted base like homepage */}
      <div className="absolute inset-0 -z-20">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(140deg,#F6F9FF 0%,#E9EEF7 48%,#DCE3ED 100%)" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60rem 36rem at 50% 35%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.78) 40%, rgba(255,255,255,0) 70%)",
          }}
        />
        {/* soft blue corner glows */}
        <div
          aria-hidden
          className="absolute -left-40 bottom-10 h-[28rem] w-[28rem] rounded-[9999px] blur-3xl opacity-40"
          style={{ background: "radial-gradient(closest-side, rgba(56,189,248,0.35), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="absolute -right-56 top-24 h-[30rem] w-[30rem] rounded-[9999px] blur-3xl opacity-35"
          style={{ background: "radial-gradient(closest-side, rgba(125,211,252,0.28), transparent 70%)" }}
        />
      </div>

      {/* subtle grid like homepage */}
      <div className="absolute inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(to_right,_#000_1px,_transparent_1px),linear-gradient(to_bottom,_#000_1px,_transparent_1px)] [background-size:48px_48px]" />

      {/* animated mesh */}
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-10" style={{ backgroundImage: bgGlow }} />

      {/* sticky sub-nav */}
      <div ref={stickyRef} className="sticky top-0 z-40 border-b backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="text-sm font-medium opacity-80">a4ai Features</div>
          <TabNav value={tab} onChange={setTab} />
        </div>
      </div>

      {/* hero */}
      <section className="relative z-10 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs tracking-wide backdrop-blur"
              style={{
                border: "1px solid #E4E9F0",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.70))",
              }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "#5D6B7B" }} />
              <span style={{ color: "#4E5A66" }}>What’s included</span>
            </div>

            {/* Halenoir + dark gradient like homepage headline */}
            <h1 className="font-halenoir text-4xl md:text-5xl font-extrabold tracking-tight">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg,#2F3A44 0%,#4F6274 40%,#2F3A44 100%)",
                  backgroundSize: "220% 100%",
                  animation: "bg-pan 10s linear infinite",
                }}
              >
                Powerful features, real classroom impact
              </span>
            </h1>

            <p className="mt-4 text-lg" style={{ color: "#5D6B7B" }}>
              Everything you need to create curriculum-perfect assessments in half the time.
            </p>
          </motion.div>

          {/* grid */}
          <motion.div
            variants={stagger}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.18 }}
            className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3"
          >
            {current.items.map((f, i) => (
              <motion.div key={f.title} variants={fadeUp}>
                <FeatureCard feature={f} index={i} />
              </motion.div>
            ))}
          </motion.div>

          {/* stats band — blue glass border */}
          <motion.div
            {...fadeUp}
            viewport={{ once: true }}
            className="mt-14 rounded-2xl border bg-gradient-to-r from-sky-300 to-blue-500 p-[1px] shadow-lg"
          >
            <div className="rounded-2xl bg-white px-6 py-6">
              <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-4">
                <Stat k={`${Papers.toLocaleString()}+`} v="Papers generated" />
                <Stat k="99%" v="Syllabus alignment" />
                <Stat k="< 2 min" v="Prompt ➜ Paper" />
                <Stat k="99.9%" v="Uptime" />
              </div>
            </div>
          </motion.div>

          {/* comparison strip */}
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

          {/* Demo video */}
          <VideoRow />

          {/* Security & Reliability */}
          <motion.div
            {...fadeUp}
            viewport={{ once: true }}
            className="mt-14 rounded-2xl border bg-white p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <h3 className="text-lg font-semibold tracking-tight">Security & reliability</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <Pill icon={ShieldCheck} title="RBAC" desc="Granular roles for admins, teachers, students" />
              <Pill icon={TimerReset} title="Backups" desc="Point-in-time restore, daily snapshots" />
              <Pill icon={Ruler} title="Compliance" desc="Best-effort CBSE/NEP alignment" />
              <Pill icon={Zap} title="SLA" desc="Up to 99.9% for Enterprise" />
            </div>
          </motion.div>

          {/* FAQ */}
          <section className="mx-auto mt-14 max-w-4xl">
            <h3 className="text-xl font-semibold tracking-tight">FAQs</h3>
            <div className="mt-4 grid gap-4 text-sm">
              <Faq q="Can I control marks per section?" a="Yes—use blueprints to set marks, counts, and difficulty mix; generation respects your scheme." />
              <Faq q="Will it work with my syllabus?" a="Upload PDF/CSV syllabus or paste text; the mapper aligns outcomes and flags gaps." />
              <Faq q="Is proctoring mandatory?" a="No—you can run practice tests without camera/screen checks; controls are per-contest." />
            </div>
          </section>

          {/* CTA — blue primary, black secondary vibe */}
          <div className="relative z-10 text-center mt-16">
            <Button
              size="lg"
              className="rounded-xl px-8 py-4 text-lg font-semibold text-white shadow-lg hover:brightness-110"
              style={{
                background: "linear-gradient(180deg,#93C5FD 0%,#3B82F6 75%)",
                border: "1px solid rgba(59,130,246,0.45)",
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

// ---------- Sub components ----------
function TabNav({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
}) {
  return (
    <div className="relative">
      <div className="inline-flex rounded-lg border p-1 relative bg-white/70 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition ${value === t.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {value === t.key && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-0 rounded-md"
                style={{ background: "linear-gradient(180deg,#EFF6FF,#E0ECFF)" }} // blue glass
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature; index: number }) {
  const mx = useMotionValue(120);
  const my = useMotionValue(90);
  const rotateX = useTransform(my, [0, 180], [8, -8]);
  const rotateY = useTransform(mx, [0, 260], [-10, 10]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const Icon = feature.icon;

  return (
    <div
      onMouseMove={handleMove}
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
        {/* ring */}
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
            <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
          </CardHeader>

          <CardContent className="p-0 pt-3">
            <p className="text-sm text-slate-600">{feature.description}</p>
            <ul className="mt-4 space-y-2">
              {feature.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-[2px] rounded-md bg-gradient-to-r from-sky-400/15 to-blue-600/15 p-[6px]">
                    <Check className="h-3.5 w-3.5 text-blue-600" />
                  </span>
                  <span className="text-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* hairline accent */}
        <div className="absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </motion.div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-3xl font-extrabold">{k}</div>
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
        </span>{" "}
        <span className="font-medium">{good}</span>
      </div>
      <div className="mt-1 text-sm text-slate-600">vs “{bad}”</div>
    </div>
  );
}

function Pill({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border bg-sky-50/60 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4" /> <div className="font-medium">{title}</div>
      </div>
      <div className="text-sm text-slate-600">{desc}</div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border bg-white/80 p-4">
      <div className="font-medium">{q}</div>
      <p className="mt-1 text-sm text-slate-600">{a}</p>
    </div>
  );
}

function VideoRow() {
  const demoRef = useRef<HTMLVideoElement>(null);
  return (
    <motion.div
      {...fadeUp}
      viewport={{ once: true }}
      className="mt-14 grid items-center gap-6 md:grid-cols-[1.2fr_1fr]"
    >
      <Card className="overflow-hidden">
        <div className="border-b bg-slate-50 px-6 py-3 text-sm font-medium flex items-center gap-2">
          <Video className="h-4 w-4" /> See it in action
        </div>
        <CardContent className="p-0">
          <motion.div
            initial={{ opacity: 0.95 }}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.3 }}
            className="relative group p-[1px] rounded-xl bg-gradient-to-br from-sky-400/40 to-blue-600/40"
          >
            <div className="rounded-xl bg-white overflow-hidden">
              <video
                id="demoVideo"
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
            <motion.div
              initial={false}
              animate={{
                opacity:
                  demoRef?.current && !demoRef.current.paused && !demoRef.current.ended
                    ? 0
                    : 1,
              }}
              className="pointer-events-none absolute inset-0 grid place-items-center"
            >
              <div className="rounded-full px-3 py-1 text-xs font-medium bg-black/60 text-white">
                Click ▶ to play
              </div>
            </motion.div>
          </motion.div>
        </CardContent>
        <CardFooter className="justify-between">
          {/* WATCH DEMO — same look as homepage */}
          <Button
            size="sm"
            variant="outline"               // removes the purple bg class
            className="relative h-11 rounded-xl px-5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(17,24,39,0.30)] gap-2 hover:brightness-110 focus-visible:ring-0"
            style={{
              background: "linear-gradient(180deg,#374151 0%,#111827 85%)",
              border: "1px solid rgba(17,24,39,0.5)",
            }}
            onClick={() => {
              const v = demoRef.current;
              if (v) {
                v.scrollIntoView({ behavior: 'smooth', block: 'center' });
                v.play();
              }
            }}
          >
            <Play className="h-5 w-5" />
            Watch demo
            {/* glossy highlight like the hero button */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 45%)",
              }}
            />
          </Button>

          {/* keep download as outline */}
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
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-[2px] h-2 w-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600" />
      <span>{children}</span>
    </div>
  );
}

/* Keyframes used by headline fill exist in globals.css:
@keyframes bg-pan { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
*/
