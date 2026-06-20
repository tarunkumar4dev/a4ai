import React, { useRef, useEffect, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
} from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
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
  Puzzle,
  DownloadCloud,
  Stars,
  ArrowRight,
  Code2,
  Cpu,
  Lightbulb,
  Search,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   BRAND STYLES & GLOBAL INJECTION
   ────────────────────────────────────────────────────────────── */
const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";
const gradientAnimStyle = { backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" };

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
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);
  return null;
};

const cardTheme = (isDark: boolean) => `ag-card ${isDark ? "ag-card-dark" : "ag-card-light"}`;
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

const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
} as const;
const sectionX = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

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
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const prefersReducedMotion = useReducedMotion();

  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Ambient glow follows cursor
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

  const filter = (list: Resource[]) =>
    list.filter((r) => match(query, r) && (activeTags.length ? r.tags.some((t) => activeTags.includes(t)) : true));

  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div onMouseMove={onMove} className="lp min-h-screen relative overflow-hidden transition-colors duration-300" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <GlobalStyles />

      {/* Background Orbs */}
      <div className="hidden sm:block">
        <div className="sorb" style={{ width: 600, height: 600, right: -150, top: -100, background: isDark ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.03)" }} />
        <div className="sorb" style={{ width: 500, height: 500, left: -100, bottom: "20%", background: isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)" }} />
      </div>

      {/* Grid Overlay */}
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

      {/* HERO */}
      <section className="relative z-10 py-24 md:py-28">
        <div className={sectionX}>
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center justify-center mb-6"
            >
              <span {...pillProps(isDark)}><Stars className="h-3.5 w-3.5"/> a4ai Resources Hub</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="text-[34px] md:text-5xl lg:text-6xl leading-[1.15] font-extrabold tracking-tight"
              style={{ color: head(isDark) }}
            >
              Everything you need to <span className="nlm-text">build & learn</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
              className="mt-6 max-w-2xl text-lg md:text-xl"
              style={{ color: muted(isDark) }}
            >
              Guides, examples, videos, and community links to help you ship faster with a4ai—whether you’re a solo learner or an institute admin.
            </motion.p>
          </div>

          {/* Search + Tags */}
          <motion.div 
            initial={{ opacity: 0, y: 14 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2, duration: 0.6, ease: EASE }}
            className="mx-auto mt-12 max-w-4xl"
          >
            <div className={`flex items-center px-4 py-2 ${cardTheme(isDark)}`}>
              <Search className="h-5 w-5 mr-3" style={{ color: muted(isDark) }} />
              <input
                type="text"
                placeholder="Search guides, examples, docs…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-base"
                style={{ color: head(isDark) }}
              />
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {allTags.slice(0, 10).map((t) => {
                const isActive = activeTags.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${isActive ? "btn-blk" : (isDark ? "btn-glass-dark" : "btn-glass-light")}`}
                    style={{ color: isActive ? "#fff" : head(isDark) }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      <div className="relative z-10 space-y-10 pb-16">
        <Section icon={<Bookmark />} title="Quick links" subtitle="Start with the most‑visited resources" isDark={isDark}>
          <CardsGrid items={filter(QUICK_LINKS)} isDark={isDark} />
        </Section>

        <Section icon={<GraduationCap />} title="Step‑by‑step tutorials" subtitle="From quickstarts to deeper integrations" isDark={isDark}>
          <CardsGrid items={filter(TUTORIALS)} isDark={isDark} />
        </Section>

        <Section icon={<FileCode2 />} title="Sample projects" subtitle="Clone, run, and customize for your needs" isDark={isDark}>
          <CardsGrid items={filter(SAMPLE_APPS)} isDark={isDark} />
        </Section>

        <Section icon={<PlayCircle />} title="Videos" subtitle="Short walkthroughs to see it in action" isDark={isDark}>
          <CardsGrid items={filter(VIDEOS)} isDark={isDark} />
        </Section>

        <Section icon={<MessageSquare />} title="Community & updates" subtitle="Ask questions, share feedback, and stay in the loop" isDark={isDark}>
          <CardsGrid items={filter(COMMUNITY)} isDark={isDark} />
        </Section>

        <Section icon={<ShieldCheck />} title="Trust & brand" subtitle="Security, SLAs, and brand assets" isDark={isDark}>
          <CardsGrid items={filter(TRUST)} isDark={isDark} />
        </Section>
      </div>

      {/* CTA Band */}
      <section className="relative z-10 pb-24 pt-10">
        <div className={sectionX}>
          <motion.div {...fadeUp} viewport={{ once: true }} className="rounded-2xl p-[1px] shadow-lg overflow-hidden" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
            <div className="flex flex-col items-center justify-between gap-6 rounded-2xl px-8 py-12 md:flex-row md:py-16 text-center md:text-left relative" style={{ background: isDark ? "rgba(10,14,24,0.95)" : "rgba(255,255,255,0.95)", backdropFilter: "blur(24px) saturate(160%)" }}>
              <div>
                <motion.h3 initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-2xl font-extrabold tracking-tight" style={{ color: head(isDark) }}>
                  Can’t find what you need?
                </motion.h3>
                <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="mt-2 text-lg" style={{ color: muted(isDark) }}>
                  Tell us what you’re building—we’ll point you to the right examples or create a new guide.
                </motion.p>
              </div>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row gap-4 shrink-0">
                <button className="btn-blk px-6 py-3 text-base">
                  <span className="relative z-10 flex items-center justify-center gap-2"><LifeBuoy className="h-4 w-4" /> Contact support</span>
                </button>
                <button className={`px-6 py-3 text-base ${isDark ? "btn-glass-dark" : "btn-glass-light"}`} style={{ color: isDark ? "#e8eaed" : "#202124" }}>
                  <span className="relative z-10 flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Request a guide</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

// --------------------------- Components ---------------------------

function Section({ icon, title, subtitle, isDark, children }: { icon: React.ReactNode; title: string; subtitle?: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <section className={sectionX}>
      <div className="mb-8 flex items-start gap-4">
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)", border: isDark ? "1px solid rgba(59,130,246,0.18)" : "1px solid rgba(59,130,246,0.12)", color: accent(isDark) }}>
          {React.cloneElement(icon as React.ReactElement, { className: "h-5 w-5" })}
        </div>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: head(isDark) }}>{title}</h2>
          {subtitle && <p className="mt-1 text-base" style={{ color: muted(isDark) }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function CardsGrid({ items, isDark }: { items: Resource[], isDark: boolean }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r, idx) => (
        <ResourceCard key={r.id} resource={r} index={idx} isDark={isDark} />
      ))}
    </div>
  );
}

function ResourceCard({ resource, index, isDark }: { resource: Resource; index: number; isDark: boolean }) {
  const mx = useMotionValue(160);
  const my = useMotionValue(120);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  const onLeave = () => {
    mx.set(160);
    my.set(120);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.45, delay: 0.05 * index, ease: EASE }}
      className="relative h-full flex flex-col"
    >
      <div onMouseMove={onMove} onMouseLeave={onLeave} className="group cursor-pointer h-full flex flex-col">
        <div className={`relative h-full p-6 transition-all duration-300 flex flex-col ${cardTheme(isDark)}`}>
          
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: useMotionTemplate`radial-gradient(200px 160px at ${mx}px ${my}px, ${isDark ? "rgba(96,165,250,0.12)" : "rgba(59,130,246,0.08)"}, transparent 80%)` }}
          />
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}>
                <resource.icon className="h-5 w-5" style={{ color: head(isDark) }} />
              </div>
              <h3 className="text-lg font-bold tracking-tight" style={{ color: head(isDark) }}>{resource.title}</h3>
            </div>
            
            <p className="text-sm leading-relaxed mb-5 flex-grow" style={{ color: muted(isDark) }}>
              {resource.description}
            </p>
            
            <div className="mt-auto">
              <div className="flex flex-wrap gap-2 mb-5">
                {resource.tags.map((t) => (
                  <span key={t} className="px-2.5 py-1 text-xs font-medium rounded-md" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", color: muted(isDark) }}>
                    {t}
                  </span>
                ))}
              </div>
              
              <a href={resource.href || "#"} className="inline-flex items-center text-sm font-bold transition-colors" style={{ color: accent(isDark) }}>
                {resource.cta || "Open"}
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}