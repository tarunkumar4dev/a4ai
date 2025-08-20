import { useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

/*
  FeaturesPage — a4ai
  - Animated, authentic, realistic
  - Sticky sub‑nav with Core / Proctoring / Analytics
  - Tilt + glow feature cards, stats, comparison, demo video, security band, FAQ, CTA
  - Uses Tailwind + shadcn/ui + Framer Motion
*/

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger = { whileInView: { transition: { staggerChildren: 0.12 } } } as const;

type Feature = {
  title: string;
  description: string;
  icon: React.ElementType;
  bullets: string[];
  tag?: "New" | "Pro" | "Beta";
};

const CORE: Feature[] = [
  {
    title: "AI‑Powered Test Generation",
    description: "Create complete papers from a prompt—sections, marks, formatting included.",
    icon: Brain,
    bullets: ["Topic + outcome aware", "Deterministic blueprints", "One‑click export (PDF/DOCX)"],
    tag: "Pro",
  },
  {
    title: "Curriculum‑Aligned Content",
    description: "Questions mapped to standards with coverage scoring.",
    icon: BookOpen,
    bullets: ["Syllabus import (PDF/CSV)", "Outcome coverage heatmap", "Gap warnings before export"],
  },
  {
    title: "Multiple Question Types",
    description: "MCQ, short/long answer, cloze, match, passages, diagrams.",
    icon: ListChecks,
    bullets: ["Auto‑shuffle", "Parallel A/B sets", "LaTeX & figures"],
    tag: "New",
  },
  {
    title: "Difficulty Customization",
    description: "Dial difficulty per section/outcome with readability & cognitive checks.",
    icon: SlidersHorizontal,
    bullets: ["Bloom mapping", "Grade bands", "Readability guardrails"],
  },
  {
    title: "Instant Answer Keys",
    description: "Auto‑generated keys with stepwise rationales & marking hints.",
    icon: KeyRound,
    bullets: ["Rubric templates", "Point‑wise hints", "Misconception flags"],
  },
  {
    title: "Collaborative Workflows",
    description: "Invite colleagues, co‑edit, reuse banks with version control.",
    icon: Users2,
    bullets: ["Shareable links", "Approval flow", "Reusable item banks"],
    tag: "Beta",
  },
];

const PROCTORING: Feature[] = [
  {
    title: "AI Proctoring",
    description: "Camera presence, face match, gaze & multi‑person detection.",
    icon: ShieldCheck,
    bullets: ["Screen‑lock (desktop)", "Anomaly scoring", "Privacy controls"],
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
    description: "Progress by chapter/outcome with trend lines.",
    icon: BarChart3,
    bullets: ["Percentile bands", "Section‑wise accuracy", "Time on task"],
  },
  {
    title: "Quality Dashboard",
    description: "Difficulty, discrimination index & item health.",
    icon: GaugeCircle,
    bullets: ["Flag low‑signal items", "Auto‑retire duplicates", "Bank freshness"],
  },
];

const TABS = [
  { key: "core", label: "Core", items: CORE },
  { key: "proctor", label: "Proctoring", items: PROCTORING },
  { key: "analytics", label: "Analytics", items: ANALYTICS },
] as const;

export default function FeaturesPage() {
  // background glow
  const mx = useMotionValue(320);
  const my = useMotionValue(160);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const bgGlow = useMotionTemplate`
    radial-gradient(900px 450px at ${mx}px ${my}px, hsl(var(--primary)/0.12), transparent 70%),
    radial-gradient(900px 450px at calc(${mx}px + 220px) calc(${my}px + 140px), hsl(var(--primary)/0.10), transparent 70%),
    radial-gradient(900px 450px at calc(${mx}px - 180px) calc(${my}px + 220px), hsl(var(--primary)/0.08), transparent 70%)
  `;

  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("core");
  const current = TABS.find((t) => t.key === tab)!;

  const demoRef = useRef<HTMLVideoElement>(null);

  // sticky sub‑nav visibility
  const stickyRef = useRef<HTMLDivElement>(null);
  const stickyInView = useInView(stickyRef, { margin: "-80px 0px 0px 0px" });

  return (
    <div onMouseMove={onMove} className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      {/* ambient mesh */}
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-80" style={{ backgroundImage: bgGlow }} />
      <div className="fixed inset-0 -z-10 bg-[url('/images/grid.svg')] opacity-[0.06] dark:opacity-[0.03]" />

      {/* sticky sub‑nav */}
      <div ref={stickyRef} className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="text-sm font-medium opacity-80">a4ai Features</div>
          <div className="inline-flex rounded-lg border p-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-muted" : "opacity-70 hover:opacity-100"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* header */}
      <section className="relative z-10 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-10" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs tracking-wide backdrop-blur">
              <Sparkles className="h-4 w-4" /> What’s included
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              <span className="bg-clip-text text-transparent bg-[linear-gradient(90deg,#4f46e5_0%,#a855f7_50%,#ec4899_100%)] bg-[length:200%_100%] animate-[bg-pan_10s_linear_infinite]">
                Powerful features, real classroom impact
              </span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">Everything you need to create curriculum‑perfect assessments in half the time.</p>
          </motion.div>

          {/* category grid */}
          <motion.div variants={stagger} initial="initial" whileInView="whileInView" viewport={{ once: true, amount: 0.2 }} className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
            {current.items.map((f, i) => (
              <motion.div key={f.title} variants={fadeInUp}><FeatureCard feature={f} index={i} /></motion.div>
            ))}
          </motion.div>

          {/* stats band */}
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-14 rounded-2xl border bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-[1px] shadow-lg">
            <div className="rounded-2xl bg-background/70 px-6 py-6 backdrop-blur">
              <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-4">
                <Stat k="3.5K+" v="Papers generated" />
                <Stat k="99%" v="Syllabus alignment" />
                <Stat k="< 2 min" v="Prompt ➜ Paper" />
                <Stat k="99.9%" v="Uptime" />
              </div>
            </div>
          </motion.div>

          {/* comparison strip */}
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-10 rounded-2xl border bg-muted/40 p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <Compare good="Outcome‑aware generation" bad="Generic question dumps" />
              <Compare good="Deterministic blueprints" bad="Unstable lengths & marks" />
              <Compare good="Rubrics + rationales" bad="Answer‑only keys" />
            </div>
          </motion.div>

          {/* Demo video */}
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-14 grid items-center gap-6 md:grid-cols-[1.2fr_1fr]">
            <Card className="overflow-hidden">
              <div className="border-b bg-muted/40 px-6 py-3 text-sm font-medium flex items-center gap-2"><Video className="h-4 w-4"/> See it in action</div>
              <CardContent className="p-0">
                <motion.div initial={{ opacity: 0.95 }} whileHover={{ scale: 1.01 }} transition={{ duration: 0.3 }} className="relative group p-[1px] rounded-xl bg-gradient-to-br from-indigo-600/40 via-purple-600/40 to-pink-600/40">
                  <div className="rounded-xl bg-background/80 backdrop-blur overflow-hidden">
                    <video
                      id="demoVideo"
                      ref={demoRef}
                      className="aspect-video w-full object-cover"
                      src="/demo.mp4"           
                      playsInline
                      controls
                      preload="metadata"
                      // poster="/images/demo_poster.jpg"
                    />
                  </div>
                  <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
                  <motion.div initial={false} animate={{ opacity: demoRef?.current && !demoRef.current.paused && !demoRef.current.ended ? 0 : 1 }} className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="rounded-full px-3 py-1 text-xs font-medium bg-black/60 text-white">Click ▶ to play</div>
                  </motion.div>
                </motion.div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button size="sm" className="gap-2" onClick={() => { const v = demoRef.current; if (v) { v.scrollIntoView({ behavior: 'smooth', block: 'center' }); v.play(); }}}><Zap className="h-4 w-4"/> Watch demo</Button>
                <Button size="sm" variant="outline" className="gap-2"><Download className="h-4 w-4"/> Download sample paper</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-2"><div className="text-sm text-muted-foreground">Why it feels different</div></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <Bullet>Blueprint‑first generation means papers match your marking scheme exactly.</Bullet>
                <Bullet>Outcome coverage heatmaps catch blind‑spots before export.</Bullet>
                <Bullet>Item analytics prune weak questions for a healthier bank over time.</Bullet>
                <Bullet>Privacy‑first proctoring: humane alerts, no invasive captures.</Bullet>
              </CardContent>
            </Card>
          </motion.div>

          {/* Security & Reliability */}
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-14 rounded-2xl border bg-background/80 p-6">
            <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5"/><h3 className="text-lg font-semibold tracking-tight">Security & reliability</h3></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <Pill icon={ShieldCheck} title="RBAC" desc="Granular roles for admins, teachers, students" />
              <Pill icon={TimerReset} title="Backups" desc="Point‑in‑time restore, daily snapshots" />
              <Pill icon={Ruler} title="Compliance" desc="Best‑effort CBSE/NEP alignment" />
              <Pill icon={Zap} title="SLA" desc="Up to 99.9% for Enterprise" />
            </div>
          </motion.div>

          {/* FAQ */}
          <section className="mx-auto mt-14 max-w-4xl">
            <h3 className="text-xl font-semibold tracking-tight">FAQs</h3>
            <div className="mt-4 grid gap-4 text-sm">
              <Faq q="Can I control marks per section?" a="Yes—use blueprints to set marks, counts, and difficulty mix; generation respects your scheme." />
              <Faq q="Will it work with my syllabus?" a="Upload PDF/CSV syllabus or paste text; the mapper aligns outcomes and flags gaps." />
              <Faq q="Is proctoring mandatory?" a="No—you can run practice tests without camera/screen checks; controls are per‑contest." />
            </div>
          </section>

          {/* CTA */}
          <div className="relative z-10 text-center mt-16">
            <Button size="lg" className="rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:brightness-110">
              Start creating tests
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Feature Card ---------- */
function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const mx = useMotionValue(160);
  const my = useMotionValue(100);
  const rotateX = useTransform(my, [0, 220], [8, -8]);
  const rotateY = useTransform(mx, [0, 300], [-10, 10]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const Icon = feature.icon;

  return (
    <div onMouseMove={handleMove} onMouseLeave={() => { mx.set(160); my.set(100); }} style={{ perspective: 1000 }} className="group">
      <motion.div style={{ rotateX, rotateY }} className="relative h-full rounded-2xl border bg-gradient-to-b from-background to-muted/40 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_18px_50px_rgba(0,0,0,0.06)]">
        {/* gradient ring */}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-transparent [background:linear-gradient(theme(colors.background),theme(colors.background))_padding-box,linear-gradient(90deg,rgba(79,70,229,.35),rgba(168,85,247,.35),rgba(236,72,153,.35))_border-box] [border:1px_solid_transparent] opacity-90" />

        {/* faint cursor glow */}
        <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: useMotionTemplate`radial-gradient(160px_110px_at_${mx}px_${my}px,hsl(var(--primary)/0.12),transparent_70%)` }} />

        {/* content */}
        <Card className="h-full border-0 bg-transparent shadow-none">
          <CardHeader className="flex items-center gap-3 p-0">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600/15 via-purple-600/15 to-pink-600/15 text-indigo-700 dark:text-indigo-300">
              <Icon className="h-6 w-6" />
              {feature.tag && (
                <span className="absolute -right-2 -top-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">{feature.tag}</span>
              )}
            </div>
            <h3 className="text-lg font-bold">{feature.title}</h3>
          </CardHeader>

          <CardContent className="p-0 pt-3">
            <p className="text-sm text-foreground/90">{feature.description}</p>
            <ul className="mt-4 space-y-2">
              {feature.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-[2px] rounded-md bg-gradient-to-r from-indigo-600/15 to-purple-600/15 p-[6px]"><Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /></span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* hairline accent */}
        <div className="absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </motion.div>
    </div>
  );
}

/* ---------- Small bits ---------- */
function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-3xl font-extrabold">{k}</div>
      <div className="mt-1 text-sm text-muted-foreground">{v}</div>
    </div>
  );
}

function Compare({ good, bad }: { good: string; bad: string }) {
  return (
    <div className="rounded-xl border bg-background/70 p-4 text-left shadow-sm">
      <div className="text-sm"><span className="mr-2 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 px-2 py-0.5 text-[10px] font-semibold text-white">a4ai</span> <span className="font-medium">{good}</span></div>
      <div className="mt-1 text-sm text-muted-foreground">vs “{bad}”</div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm"><span className="mt-[2px] h-2 w-2 rounded-full bg-gradient-to-r from-indigo-600 to-pink-600"/> <span>{children}</span></div>
  );
}

function Pill({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4"><div className="mb-1 flex items-center gap-2"><Icon className="h-4 w-4"/> <div className="font-medium">{title}</div></div><div className="text-sm text-muted-foreground">{desc}</div></div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border bg-background/70 p-4"><div className="font-medium">{q}</div><p className="mt-1 text-sm text-muted-foreground">{a}</p></div>
  );
}

/* Tailwind keyframes (add in globals if not present)
@keyframes bg-pan { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
*/
