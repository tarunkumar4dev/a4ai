import { useMemo, useState, useMemo as useMM } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Bookmark,
  GraduationCap,
  LifeBuoy,
  MessageSquare,
  Newspaper,
  Github,
  ShieldCheck,
  PlayCircle,
  FileCode2,
  Rocket,
  CalendarDays,
  Wrench,
  Lightbulb,
  Puzzle,
  Globe,
  Stars,
  ArrowRight,
  DownloadCloud,
  Sparkles,
  Code2,
  Cpu,
} from "lucide-react";

/*
  Resources.tsx — a4ai
  - Authentic, helpful hub: docs, tutorials, sample apps, roadmap, changelog, status, community, support
  - Modern animated hero + filters + search + sections with cards
  - Self‑contained; Tailwind + shadcn/ui + Framer Motion
*/

// --------------------------- Types ---------------------------

type Resource = {
  id: string;
  title: string;
  description: string;
  href?: string;
  tags: string[];
  icon: React.ElementType;
  cta?: string;
};

// --------------------------- Data ---------------------------

const QUICK_LINKS: Resource[] = [
  { id: "docs", title: "Developer Docs", description: "All endpoints, SDKs, guides, and best practices for a4ai.", href: "/docs", tags: ["docs"], icon: BookOpen, cta: "Read docs" },
  { id: "api", title: "API Overview", description: "Base URL, auth, rate limits, and examples.", href: "/api", tags: ["api"], icon: Code2, cta: "Explore API" },
  { id: "changelog", title: "Changelog", description: "All notable changes, improvements, and fixes.", href: "/changelog", tags: ["updates"], icon: CalendarDays, cta: "See updates" },
  { id: "status", title: "Status", description: "Live service health, incidents, and uptime.", href: "/status", tags: ["status"], icon: ShieldCheck, cta: "View status" },
];

const TUTORIALS: Resource[] = [
  { id: "qs-test", title: "Quickstart: Generate your first test", description: "Create a Class 10 Science paper in minutes using the SDK.", href: "/guides/quickstart-test", tags: ["quickstart", "tests"], icon: Rocket, cta: "Start now" },
  { id: "contest", title: "Host a proctored contest", description: "Schedule, invite, and proctor a live contest end‑to‑end.", href: "/guides/host-contest", tags: ["contests", "proctoring"], icon: LifeBuoy, cta: "Guide" },
  { id: "webhooks", title: "Webhooks in 10 minutes", description: "Receive proctor alerts and test‑ready notifications.", href: "/guides/webhooks", tags: ["webhooks"], icon: Puzzle, cta: "Set up" },
  { id: "analytics", title: "Student analytics dashboard", description: "Track progress and outcomes with the analytics API.", href: "/guides/analytics", tags: ["analytics"], icon: Cpu, cta: "Build it" },
];

const SAMPLE_APPS: Resource[] = [
  { id: "next-starter", title: "Next.js Starter (TS)", description: "Auth, API routes, and UI for tests + contests.", href: "https://github.com/a4ai/examples/next-starter", tags: ["starter", "nextjs", "typescript"], icon: FileCode2, cta: "Open repo" },
  { id: "edge-fn", title: "Supabase Edge Function", description: "Call multi‑LLM generation securely from the edge.", href: "https://github.com/a4ai/examples/supabase-edge", tags: ["supabase", "serverless"], icon: FileCode2, cta: "Open repo" },
  { id: "contest-admin", title: "Contest Admin Panel", description: "Manage contests, proctoring alerts, and results.", href: "https://github.com/a4ai/examples/contest-admin", tags: ["react", "dashboard"], icon: FileCode2, cta: "Open repo" },
];

const COMMUNITY: Resource[] = [
  { id: "discord", title: "Community", description: "Join discussions, share feedback, and get help.", href: "https://discord.gg/a4ai", tags: ["community"], icon: MessageSquare, cta: "Join" },
  { id: "github", title: "GitHub", description: "Track issues, star examples, and contribute.", href: "https://github.com/a4ai", tags: ["code"], icon: Github, cta: "Visit" },
  { id: "newsletter", title: "Newsletter", description: "Monthly updates on features and case studies.", href: "/newsletter", tags: ["updates"], icon: Newspaper, cta: "Subscribe" },
];

const TRUST: Resource[] = [
  { id: "security", title: "Security & Privacy", description: "Encryption, data retention, and responsible AI practices.", href: "/security", tags: ["security"], icon: ShieldCheck, cta: "Learn more" },
  { id: "sla", title: "SLA & Support", description: "Support tiers, SLAs, and escalation paths.", href: "/sla", tags: ["support"], icon: LifeBuoy, cta: "View" },
  { id: "brand", title: "Brand Kit", description: "Logos, colors, and media assets for press.", href: "/brand", tags: ["brand"], icon: DownloadCloud, cta: "Download" },
];

const VIDEOS: Resource[] = [
  { id: "demo", title: "Product Demo (3 min)", description: "End‑to‑end test generation and export.", href: "/videos/demo", tags: ["video"], icon: PlayCircle, cta: "Watch" },
  { id: "api-walk", title: "API Walkthrough", description: "From API key to first contest.", href: "/videos/api", tags: ["video"], icon: PlayCircle, cta: "Watch" },
];

// --------------------------- Helpers ---------------------------

const allTags = Array.from(
  new Set(
    [...QUICK_LINKS, ...TUTORIALS, ...SAMPLE_APPS, ...COMMUNITY, ...TRUST, ...VIDEOS]
      .flatMap((r) => r.tags)
  )
).sort();

function match(q: string, r: Resource) {
  const s = (q || "").toLowerCase().trim();
  if (!s) return true;
  return (
    r.title.toLowerCase().includes(s) ||
    r.description.toLowerCase().includes(s) ||
    r.tags.some((t) => t.toLowerCase().includes(s))
  );
}

// --------------------------- Component ---------------------------

export default function ResourcesPage() {
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const headerGradient = useMemo(
    () =>
      "bg-[radial-gradient(1200px_600px_at_50%_-10%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(900px_500px_at_80%_0%,hsl(var(--primary)/0.12),transparent_60%)]",
    []
  );

  const filter = (list: Resource[]) =>
    list.filter((r) => match(query, r) && (activeTags.length ? r.tags.some((t) => activeTags.includes(t)) : true));

  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div className="relative">
      {/* Animated background */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, -10, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 14, ease: "easeInOut" }}
      >
        <div className={`absolute inset-0 ${headerGradient}`} />
      </motion.div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-18">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm backdrop-blur">
            <Stars className="h-4 w-4" />
            <span className="font-medium">a4ai Resources</span>
            <Badge variant="secondary" className="ml-1">Curated</Badge>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need to build & learn</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Guides, examples, videos, and community links to help you ship faster with a4ai—whether you’re a solo learner or an institute admin.</p>

          {/* Search + Tags */}
          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <Input
              placeholder="Search guides, examples, docs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11"
            />
            <div className="flex flex-wrap gap-2 md:justify-end">
              {allTags.slice(0, 10).map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={`rounded-full border px-3 py-1 text-sm ${activeTags.includes(t) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Quick links */}
      <Section
        icon={<Bookmark className="h-5 w-5" />}
        title="Quick links"
        subtitle="Start with the most‑visited resources"
      >
        <CardsGrid items={filter(QUICK_LINKS)} />
      </Section>

      {/* Tutorials */}
      <Section
        icon={<GraduationCap className="h-5 w-5" />}
        title="Step‑by‑step tutorials"
        subtitle="From quickstarts to deeper integrations"
      >
        <CardsGrid items={filter(TUTORIALS)} />
      </Section>

      {/* Sample apps */}
      <Section
        icon={<FileCode2 className="h-5 w-5" />}
        title="Sample projects"
        subtitle="Clone, run, and customize for your needs"
      >
        <CardsGrid items={filter(SAMPLE_APPS)} />
      </Section>

      {/* Videos */}
      <Section
        icon={<PlayCircle className="h-5 w-5" />}
        title="Videos"
        subtitle="Short walkthroughs to see it in action"
      >
        <CardsGrid items={filter(VIDEOS)} />
      </Section>

      {/* Community */}
      <Section
        icon={<MessageSquare className="h-5 w-5" />}
        title="Community & updates"
        subtitle="Ask questions, share feedback, and stay in the loop"
      >
        <CardsGrid items={filter(COMMUNITY)} />
      </Section>

      {/* Trust */}
      <Section
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Trust & brand"
        subtitle="Security, SLAs, and brand assets"
      >
        <CardsGrid items={filter(TRUST)} />
      </Section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-xl border bg-muted/40 p-6">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Can’t find what you need?</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tell us what you’re building—we’ll point you to the right examples or create a new guide.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-2"><LifeBuoy className="h-4 w-4" /> Contact support</Button>
              <Button size="sm" variant="outline" className="gap-2"><Lightbulb className="h-4 w-4" /> Request a guide</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// --------------------------- Small building blocks ---------------------------

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="mt-0.5 text-primary">{icon}</div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function CardsGrid({ items }: { items: Resource[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r, idx) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20% 0px" }}
          transition={{ duration: 0.45, delay: 0.05 * idx, ease: "easeOut" }}
        >
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><r.icon className="h-4 w-4" /> Resource</div>
              <h3 className="text-lg font-semibold tracking-tight">{r.title}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{r.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {r.tags.map((t) => (
                  <Badge key={t} variant="secondary">{t}</Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <a href={r.href || "#"} className="inline-flex items-center text-sm font-medium hover:underline">
                {r.cta || "Open"}
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </CardFooter>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
