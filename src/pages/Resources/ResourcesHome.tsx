// src/pages/resources/ResourcesHome.tsx
import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { BookOpen, LifeBuoy, Newspaper, Briefcase, Search, ArrowRight } from "lucide-react";
import ResourcesLayout from "./ResourcesLayout";

const cards = [
  { to: "/docs", title: "Documentation", desc: "Install, configure, and integrate the a4ai test generator.", Icon: BookOpen, tags: ["setup", "api", "sdk", "integration"] },
  { to: "/help", title: "Help Center", desc: "FAQs, troubleshooting, and how-tos for common issues.", Icon: LifeBuoy, tags: ["faq", "errors", "troubleshoot", "account"] },
  { to: "/blog", title: "Blog", desc: "Product updates, tips, and behind-the-scenes notes.", Icon: Newspaper, tags: ["updates", "release", "tips", "news"] },
  { to: "/case-studies", title: "Case Studies", desc: "How schools and teachers use a4ai in the real world.", Icon: Briefcase, tags: ["schools", "teachers", "impact", "stories"] },
];

/* ──────────────────────────────────────────────────────────────
   ULTIMATE ANTI-INVERSION STYLE OVERRIDES
   ────────────────────────────────────────────────────────────── */
const GlobalStyles = () => {
  useEffect(() => {
    // Explicitly lock down the global window document context to clean light space
    document.documentElement.style.background = "#ffffff !important";
    document.documentElement.style.backgroundColor = "#ffffff !important";
    document.documentElement.style.colorScheme = "light only !important";
    document.documentElement.classList.remove("dark");

    const s = document.createElement("style");
    s.textContent = `
      /* Force override on any layout container background or layout elements */
      html, body, #root, main, section, .lp-hub-wrapper, [class*="layout"] {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }
      
      /* Reset layout headers/containers to be light text, white background */
      h1, h2, h3, p, span {
        forced-color-adjust: none !important;
      }

      .ag-card {
        border-radius: 18px;
        transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s cubic-bezier(.16,1,.3,1);
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.85) !important;
        background-color: rgba(255, 255, 255, 0.85) !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
        backdrop-filter: blur(30px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(170%) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(59,130,246,0.03), 0 2px 6px rgba(0,0,0,0.02) !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }
      @media (min-width: 640px) { .ag-card { border-radius: 20px; } }
      
      @media (hover: hover) {
        .ag-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 14px 38px rgba(59,130,246,0.08), 0 6px 16px rgba(0,0,0,0.03) !important;
        }
      }

      .search-box-forced {
        border: 1px solid rgba(0, 0, 0, 0.12) !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #111111 !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02) !important;
      }
      
      .search-box-forced::placeholder {
        color: #94a3b8 !important;
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

function ResourceHubCard({ c }: { c: typeof cards[0] }) {
  const mx = useMotionValue(120);
  const my = useMotionValue(90);
  const Icon = c.Icon;

  return (
    <Link
      to={c.to}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onMouseLeave={() => { mx.set(120); my.set(90); }}
      className="ag-card p-6 group block relative h-full transition-all duration-300 bg-white"
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: useMotionTemplate`radial-gradient(200px 160px at ${mx}px ${my}px, rgba(59,130,246,0.06), transparent 80%)` }}
      />
      <div className="relative z-10 flex flex-col h-full bg-transparent">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl mb-4 bg-blue-50 border border-blue-100">
          <Icon className="h-6 w-6" style={{ color: accentColor }} />
        </div>
        <h3 className="text-lg font-bold mb-2" style={{ color: txtHead }}>{c.title}</h3>
        <p className="text-sm leading-relaxed mb-6 flex-grow" style={{ color: txtMuted }}>{c.desc}</p>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold transition-transform duration-200 group-hover:translate-x-0.5" style={{ color: accentColor }}>
          Explore Hub <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

export default function ResourcesHome() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cards;
    return cards.filter(c => 
      c.title.toLowerCase().includes(needle) || 
      c.desc.toLowerCase().includes(needle) || 
      c.tags?.some(t => t.toLowerCase().includes(needle))
    );
  }, [q]);

  return (
    <div className="lp-hub-wrapper bg-white w-full min-h-screen">
      <GlobalStyles />
      <ResourcesLayout title="Resources" subtitle="Everything you need to build, learn, and succeed with a4ai.">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search docs, help, blog, case studies…"
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all duration-200 search-box-forced"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 bg-white">
          {filtered.map((c) => (
            <ResourceHubCard key={c.to} c={c} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-slate-200 p-10 text-center bg-white">
            <p className="text-sm" style={{ color: txtMuted }}>
              No matches found for <span className="font-semibold text-neutral-800">“{q}”</span>.
            </p>
          </div>
        )}
      </ResourcesLayout>
    </div>
  );
}