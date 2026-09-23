// src/pages/Resource.tsx — Unified UI Pattern matching FeaturesPage
import React, { useRef, useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useMotionTemplate,
  AnimatePresence,
} from "framer-motion";
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
  ArrowRight,
  Code2,
  Cpu,
  Lightbulb,
  Search,
  Sparkles,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";

/* ──────────────────────────────────────────────────────────────
   BRAND STYLES & GLOBAL INJECTION (Forced Light Only)
   ────────────────────────────────────────────────────────────── */
const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";
const gradientAnimStyle = { backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" };

const GlobalStyles = () => {
  useEffect(() => {
    document.documentElement.style.background = "#ffffff";
    document.documentElement.style.backgroundColor = "#ffffff";
    document.documentElement.style.colorScheme = "light only";
    document.documentElement.classList.remove("dark");

    const s = document.createElement("style");
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

      .lp-resources-wrapper, .lp-resources-wrapper * {
        font-family: 'Plus Jakarta Sans', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
        -webkit-font-smoothing: antialiased;
      }
      
      html, body, #root, main, section { background: #ffffff !important; background-color: #ffffff !important; }

      .resource-card {
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
        .resource-card:hover {
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

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
} as const;

// --------------------------- Types ---------------------------

export type Resource = {
  id: string;
  title: string;
  description: string;
  category: "docs" | "tutorials" | "projects" | "community" | "trust";
  href?: string;
  tags: string[];
  icon: React.ElementType;
  bullets: string[];
  tag?: string;
  cta?: string;
};

// --------------------------- Data ---------------------------

const ALL_RESOURCES: Resource[] = [
  // Docs & API
  {
    id: "docs",
    title: "Developer Documentation",
    category: "docs",
    description: "Complete guide to integrating a4ai into your school portal or LMS.",
    href: "/docs",
    tags: ["REST", "SDK", "Guides"],
    icon: BookOpen,
    bullets: ["Endpoints for test creation & grading", "Python & TypeScript official SDKs", "Webhook triggers & event schemas"],
    tag: "Docs",
    cta: "Read Docs",
  },
  {
    id: "api",
    title: "API Reference & Specs",
    category: "docs",
    description: "Low-latency REST endpoints for test generator and contest engine.",
    href: "/api",
    tags: ["API", "Auth", "JSON"],
    icon: Code2,
    bullets: ["API key management & JWT auth", "Deterministic blueprint schema", "Rate limits & status codes"],
    tag: "API",
    cta: "Explore API",
  },
  {
    id: "changelog",
    title: "Platform Changelog",
    category: "docs",
    description: "Track all recent updates, new question types, and feature releases.",
    href: "/changelog",
    tags: ["Updates", "Release"],
    icon: CalendarDays,
    bullets: ["Weekly feature drops", "Model improvements & speedups", "CBSE syllabus alignment updates"],
    tag: "Weekly",
    cta: "See Updates",
  },
  {
    id: "status",
    title: "Live System Status",
    category: "docs",
    description: "Real-time service health, server uptime, and incident logs.",
    href: "/status",
    tags: ["Uptime", "Health"],
    icon: ShieldCheck,
    bullets: ["99.9% uptime SLA track record", "Global response latency metrics", "Incident history & postmortems"],
    tag: "Live",
    cta: "View Status",
  },

  // Tutorials & Guides
  {
    id: "qs-test",
    title: "Quickstart: Create First Test",
    category: "tutorials",
    description: "Generate a Class 10 Science paper in 10 seconds and export to PDF.",
    href: "/guides/quickstart-test",
    tags: ["Quickstart", "CBSE"],
    icon: Rocket,
    bullets: ["Curated from 1 Lakh+ NCERT questions", "Section-wise marks & Bloom levels", "Print-ready CBSE paper with answer key"],
    tag: "Popular",
    cta: "Start Guide",
  },
  {
    id: "contest",
    title: "Host a Proctored Contest",
    category: "tutorials",
    description: "Run live, fair online tests with anti-cheat camera proctoring.",
    href: "/guides/host-contest",
    tags: ["Contest", "Proctoring"],
    icon: LifeBuoy,
    bullets: ["WhatsApp contest link sharing", "Tab-switch & camera monitoring", "Instant MCQ auto-grading & rankings"],
    tag: "Guide",
    cta: "Host Contest",
  },
  {
    id: "webhooks",
    title: "Automate with Webhooks",
    category: "tutorials",
    description: "Receive instant notifications when students complete tests or cheat.",
    href: "/guides/webhooks",
    tags: ["Webhooks", "Automation"],
    icon: Puzzle,
    bullets: ["Automated grading callbacks", "Tamper-proof HMAC signature checks", "Zero server polling required"],
    tag: "Tutorial",
    cta: "Set Up",
  },
  {
    id: "analytics",
    title: "Teacher Analytics & Reports",
    category: "tutorials",
    description: "Turn classroom test scores into actionable student growth insights.",
    href: "/guides/analytics",
    tags: ["Analytics", "Report Cards"],
    icon: Cpu,
    bullets: ["Chapter-wise weakness heatmaps", "1-click CBSE report card PDF generation", "Class vs student benchmark curves"],
    tag: "Pro",
    cta: "View Guide",
  },

  // Sample Projects & Starter Kits
  {
    id: "next-starter",
    title: "Next.js School Portal Starter",
    category: "projects",
    description: "Production-ready web portal with auth, student dashboards, and tests.",
    href: "https://github.com/a4ai/examples/next-starter",
    tags: ["Next.js", "TypeScript", "Tailwind"],
    icon: FileCode2,
    bullets: ["Integrated Tailwind CSS & Shadcn UI", "Supabase authentication pre-configured", "Responsive desktop and mobile view"],
    tag: "Open Source",
    cta: "View GitHub",
  },
  {
    id: "edge-fn",
    title: "Supabase Edge Functions",
    category: "projects",
    description: "Securely generate tests from your syllabus via serverless edge workers.",
    href: "https://github.com/a4ai/examples/supabase-edge",
    tags: ["Serverless", "Deno"],
    icon: FileCode2,
    bullets: ["Zero cold-start global deployment", "Safe API key protection in backend", "Streaming AI response parser"],
    tag: "Starter",
    cta: "Clone Repo",
  },
  {
    id: "contest-admin",
    title: "Contest Invigilator Panel",
    category: "projects",
    description: "Admin dashboard to monitor live contests and handle anomalies.",
    href: "https://github.com/a4ai/examples/contest-admin",
    tags: ["React", "Dashboard"],
    icon: FileCode2,
    bullets: ["Live student camera gallery", "Anomaly warning log & live feed", "One-click CSV result export"],
    tag: "Template",
    cta: "Inspect Code",
  },

  // Community & Trust
  {
    id: "discord",
    title: "Educator & Dev Community",
    category: "community",
    description: "Join 1,000+ teachers, coaching directors, and EdTech developers.",
    href: "https://discord.gg/a4ai",
    tags: ["Discord", "Support"],
    icon: MessageSquare,
    bullets: ["Direct chat with a4ai core founders", "Share test paper blueprints & prompts", "Early beta invites & feature requests"],
    tag: "Community",
    cta: "Join Discord",
  },
  {
    id: "github",
    title: "GitHub Repository",
    category: "community",
    description: "Star our open-source templates, report bugs, and view examples.",
    href: "https://github.com/a4ai",
    tags: ["GitHub", "Code"],
    icon: Github,
    bullets: ["Community contributions welcome", "Fully tested example apps", "Continuous releases & issue tracking"],
    tag: "Code",
    cta: "Star on GitHub",
  },
  {
    id: "security",
    title: "Security & Privacy Whitepaper",
    category: "trust",
    description: "How we protect student records, test questions, and exam integrity.",
    href: "/security",
    tags: ["Security", "Compliance"],
    icon: ShieldCheck,
    bullets: ["End-to-end data encryption in transit & rest", "No student data selling or advertising", "Strict role-based teacher permissions"],
    tag: "Trust",
    cta: "Read Security",
  },
  {
    id: "brand",
    title: "Official Brand Kit",
    category: "trust",
    description: "Download approved high-res logos, badge assets, and color standards.",
    href: "/brand",
    tags: ["Assets", "Logos"],
    icon: DownloadCloud,
    bullets: ["High-res SVG and PNG logos", "Color codes & official typography", "Co-branding guidelines for institutes"],
    tag: "Media",
    cta: "Download Assets",
  },
];

const CATEGORIES = [
  { key: "all", label: "All Resources" },
  { key: "docs", label: "Docs & API" },
  { key: "tutorials", label: "Tutorials & Guides" },
  { key: "projects", label: "Sample Projects" },
  { key: "community", label: "Community & Trust" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

// --------------------------- Component ---------------------------

export default function ResourcesPage() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [query, setQuery] = useState("");

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

  // Filter logic
  const filtered = ALL_RESOURCES.filter((r) => {
    const matchesCat =
      activeCategory === "all"
        ? true
        : activeCategory === "community"
        ? r.category === "community" || r.category === "trust"
        : r.category === activeCategory;

    const q = query.toLowerCase().trim();
    const matchesQuery =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q)) ||
      r.bullets.some((b) => b.toLowerCase().includes(q));

    return matchesCat && matchesQuery;
  });

  return (
    <div onMouseMove={onMove} className="lp-resources-wrapper min-h-screen relative overflow-hidden bg-white">
      <GlobalStyles />

      {/* Background Orbs */}
      <div className="hidden sm:block">
        <div className="sorb" style={{ width: 600, height: 600, right: -150, top: -100, background: "rgba(59,130,246,0.03)" }} />
        <div className="sorb" style={{ width: 500, height: 500, left: -100, bottom: "20%", background: "rgba(129,140,248,0.03)" }} />
      </div>

      {/* Grid Overlay */}
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

      {/* ── FLOATING TOP NAVIGATION DOCK BAR (Unified with FeaturesPage & PricingPage) ── */}
      <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
        <nav className="mx-auto max-w-7xl rounded-2xl border transition-all duration-300 relative overflow-hidden force-light-dock">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Link to="/" className="group flex items-center gap-2.5 select-none text-lg font-bold tracking-tight transition-opacity active:opacity-90">
              <img
                src="/ICON.ico"
                alt="a4ai Logo"
                className="h-6 w-6 object-contain rounded transition-transform duration-200 group-hover:scale-105"
              />
              <span style={{ color: txtHead }}>
                a4ai <span className="text-xs font-medium opacity-60 ml-1">Resources</span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                to="/features"
                className="text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Features
              </Link>
              <Link
                to="/pricing"
                className="text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Pricing
              </Link>
              <Link
                to="/about"
                className="text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                About
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="pt-24 relative z-10 bg-white">
        {/* Hero Section */}
        <section className="pt-12 pb-6 md:pt-16 md:pb-8 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div className="text-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="mx-auto mb-6 inline-flex justify-center">
                <span className="per-student-pill text-xs px-3.5 py-1.5 font-bold">
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Documentation &amp; Learning Hub
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.15]">
                Everything you need to{" "}
                <br className="hidden sm:block" />
                <span className="nlm-text">build, teach &amp; learn</span>
              </h1>

              <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-slate-600 font-medium">
                Guides, SDK documentation, starter apps, and community resources to help you create better assessments in minutes.
              </p>

              {/* Search input with clean glass aesthetic */}
              <div className="mx-auto mt-8 max-w-2xl relative">
                <div className="resource-card flex items-center px-4 py-3.5 bg-white/95 border border-slate-200/90 shadow-sm rounded-2xl">
                  <Search className="h-5 w-5 text-slate-400 mr-3 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search guides, tutorials, SDK endpoints, topics…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-sm sm:text-base font-medium text-slate-800 placeholder-slate-400"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="text-xs text-slate-400 hover:text-slate-600 font-semibold px-2 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Selector matching PricingPage audience toggle */}
              <div className="mt-8 flex justify-center">
                <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-2xl border px-1.5 py-1.5 shadow-sm backdrop-blur bg-white/90 border-slate-200">
                  {CATEGORIES.map((cat) => {
                    const active = activeCategory === cat.key;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => setActiveCategory(cat.key)}
                        className={
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition " +
                          (active
                            ? "bg-slate-900 text-white shadow-sm ring-1 ring-black/5"
                            : "text-slate-700 hover:bg-slate-100/70 ring-1 ring-transparent")
                        }
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── RESOURCE CARDS GRID (Unified FeatureCard Pattern) ── */}
        <section className="relative z-10 py-8 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {filtered.length === 0 ? (
              <div className="text-center py-20 bg-white">
                <p className="text-slate-400 font-medium text-base">No resources found matching "{query}".</p>
                <button
                  onClick={() => { setQuery(""); setActiveCategory("all"); }}
                  className="mt-3 text-sm text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Reset search &amp; filters
                </button>
              </div>
            ) : (
              <motion.div layout className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">
                <AnimatePresence>
                  {filtered.map((item, i) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.4 }}
                    >
                      <ResourceFeatureCard item={item} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>

        {/* ── STATS SUMMARY PANEL (Matching FeaturesPage) ── */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12">
          <motion.div {...fadeUp} viewport={{ once: true }} className="rounded-2xl p-[1px] shadow-sm overflow-hidden" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
            <div className="rounded-2xl px-6 py-8 relative bg-white/95 backdrop-blur-md">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center relative z-10">
                <div>
                  <div className="text-3xl font-black tracking-tight text-neutral-900">1 Lakh+</div>
                  <div className="mt-1 text-sm font-medium" style={{ color: txtMuted }}>NCERT Question Bank</div>
                </div>
                <div>
                  <div className="text-3xl font-black tracking-tight text-neutral-900">&lt; 10s</div>
                  <div className="mt-1 text-sm font-medium" style={{ color: txtMuted }}>Test Generation Time</div>
                </div>
                <div>
                  <div className="text-3xl font-black tracking-tight text-neutral-900">100%</div>
                  <div className="mt-1 text-sm font-medium" style={{ color: txtMuted }}>CBSE Pattern Aligned</div>
                </div>
                <div>
                  <div className="text-3xl font-black tracking-tight text-neutral-900">99.9%</div>
                  <div className="mt-1 text-sm font-medium" style={{ color: txtMuted }}>Service Uptime</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── BOTTOM CTA BANNER (Unified with FeaturesPage) ── */}
        <section className="relative z-10 pb-24 pt-16 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div {...fadeUp} viewport={{ once: true }} className="rounded-2xl p-[1px] shadow-sm overflow-hidden" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
              <div className="flex flex-col items-center justify-between gap-6 rounded-2xl px-8 py-12 md:flex-row md:py-16 text-center md:text-left relative bg-white/95 backdrop-blur-md">
                <div>
                  <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900">
                    Need a custom guide or school integration?
                  </h3>
                  <p className="mt-2 text-base md:text-lg font-medium text-neutral-500 max-w-xl">
                    Tell us what you're building. Our engineering team will help you connect your LMS or provide sample code.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <a href="mailto:support@a4ai.in" className="btn-blue-gradient px-6 py-3 text-sm font-bold inline-flex items-center justify-center gap-2">
                    <LifeBuoy className="h-4 w-4" /> Contact Support
                  </a>
                  <Link to="/features" className="btn-white-action px-6 py-3 text-sm font-bold inline-flex items-center justify-center gap-2">
                    <Lightbulb className="h-4 w-4" /> Explore Features
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   UNIFIED FEATURE CARD COMPONENT (Matching FeaturesPage & PricingPage)
   ────────────────────────────────────────────────────────────── */
function ResourceFeatureCard({ item }: { item: Resource }) {
  const mx = useMotionValue(120);
  const my = useMotionValue(90);
  const rotateX = useTransform(my, [0, 180], [7, -7]);
  const rotateY = useTransform(mx, [0, 260], [-8, 8]);
  const Icon = item.icon;
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
        className="resource-card p-6 flex flex-col h-full relative"
      >
        {item.tag && (
          <div className="absolute -top-3 right-4 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-bold text-white shadow z-10">
            {item.tag}
          </div>
        )}

        {/* Radial cursor hover sheen */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, rgba(59,130,246,0.06), transparent 80%)` }}
        />

        <div className="relative z-10 flex flex-col h-full">
          {/* Card Top: Icon Box + Title */}
          <div className="flex items-center gap-3.5 mb-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/70 border border-blue-100 flex-shrink-0 text-blue-600 shadow-xs">
              <Icon className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {item.title}
            </h3>
          </div>

          {/* Description */}
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-4">
            {item.description}
          </p>

          {/* Checklist Bullets */}
          <ul className="space-y-2.5 mb-6 flex-grow">
            {item.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm font-medium">
                <div className="h-5 w-5 rounded-full bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </div>
                <span className="text-slate-700 font-semibold leading-snug">{b}</span>
              </li>
            ))}
          </ul>

          {/* Card Footer: Tags & Action Link */}
          <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200/60"
                >
                  {t}
                </span>
              ))}
            </div>

            <Link
              to={item.href || "#"}
              className="inline-flex items-center text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors group-hover:translate-x-0.5 flex-shrink-0"
            >
              {item.cta || "Open"}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}