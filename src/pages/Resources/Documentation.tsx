// src/pages/Documentation.tsx
import React, { useEffect, useState } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen, Search, Server, Rocket, FileText, TerminalSquare } from "lucide-react";

const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";

const SECTIONS = [
  {
    title: "Getting Started",
    icon: Rocket,
    description: "Core concepts and setup guides.",
    items: [
      { t: "What is a4ai?", to: "#" },
      { t: "Quickstart (5 min)", to: "#" },
      { t: "Project setup (React + TS)", to: "#" },
    ],
  },
  {
    title: "Backend & APIs",
    icon: Server,
    description: "Authentication and serverless integrations.",
    items: [
      { t: "Supabase Auth (email + Google OAuth)", to: "#" },
      { t: "Edge Functions for multi-LLM generation", to: "#" },
      { t: "Keyword scoring & best-response selection", to: "#" },
    ],
  },
  {
    title: "Production",
    icon: TerminalSquare,
    description: "Deployment, monitoring, and scaling.",
    items: [
      { t: "Vercel deployment checklist", to: "#" },
      { t: "Env vars & secrets", to: "#" },
      { t: "Monitoring & logs", to: "#" },
    ],
  },
];

const GlobalStyles = () => {
  useEffect(() => {
    document.documentElement.style.background = "#ffffff !important";
    document.documentElement.style.backgroundColor = "#ffffff !important";
    document.documentElement.style.colorScheme = "light only !important";
    document.documentElement.classList.remove("dark");

    const s = document.createElement("style");
    s.textContent = `
      .lp { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; background-color: #ffffff !important; }
      html, body, #root, main, section { background: #ffffff !important; background-color: #ffffff !important; }
      
      .ag-card {
        border-radius: 18px;
        transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s cubic-bezier(.16,1,.3,1);
        position: relative; overflow: hidden;
        background: rgba(255, 255, 255, 0.85) !important;
        border: 1px solid rgba(0, 0, 0, 0.07) !important;
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

      .force-light-dock {
        background-color: rgba(255, 255, 255, 0.45) !important;
        background: rgba(255, 255, 255, 0.45) !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        border: 1px solid rgba(255, 255, 255, 0.5) !important;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6), 0 8px 32px rgba(0, 0, 0, 0.03) !important;
      }

      .search-box-forced {
        border: 1px solid rgba(0, 0, 0, 0.12) !important;
        background: #ffffff !important;
        color: #111111 !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }

      @keyframes fast-gradient {
        0% { background-position: 0% center; }
        100% { background-position: -200% center; }
      }
      .running-gradient-text {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
        display: inline-block;
        forced-color-adjust: none !important;
      }
    `;
    document.head.appendChild(s);
    return () => { if (document.head.contains(s)) document.head.removeChild(s); };
  }, []);
  return null;
};

export default function Documentation() {
  const [query, setQuery] = useState("");
  const mx = useMotionValue(360);
  const my = useMotionValue(180);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const bgGlow = useMotionTemplate`
    radial-gradient(1000px 520px at ${mx}px ${my}px, rgba(59,130,246,0.04), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px + 260px) calc(${my}px + 140px), rgba(96,165,250,0.04), transparent 70%)
  `;

  const filteredSections = SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.t.toLowerCase().includes(query.toLowerCase()) ||
      section.title.toLowerCase().includes(query.toLowerCase())
    )
  })).filter(section => section.items.length > 0);

  return (
    <div onMouseMove={onMove} className="lp min-h-screen relative overflow-hidden pt-24 pb-20 bg-white">
      <GlobalStyles />
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-100" style={{ backgroundImage: bgGlow as any }} />

      <div className="hidden sm:block pointer-events-none">
        <div className="absolute" style={{ width: 600, height: 600, right: -100, top: -50, background: "rgba(59,130,246,0.03)", filter: "blur(50px)", borderRadius: "50%" }} />
      </div>

      <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
        <nav className="mx-auto max-w-7xl rounded-2xl border backdrop-blur-xl force-light-dock">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Link to="/" className="group flex items-center gap-2.5 text-lg font-semibold tracking-tight">
              <img src="/ICON.ico" alt="Logo" className="h-6 w-6 object-contain" />
              <span style={{ color: "#111111" }}>a4ai <span className="text-xs font-normal opacity-60 ml-1">Docs</span></span>
            </Link>
            <Link to="/resources" className="text-sm font-semibold" style={{ color: "#5f6368" }}>Back to Hub</Link>
          </div>
        </nav>
      </div>

      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10 bg-white">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur mb-6"
            style={{ background: "rgba(59,130,246,0.08)", color: "#1d4ed8", borderColor: "rgba(59,130,246,0.16)" }}>
            <BookOpen className="h-3.5 w-3.5" /> a4ai Documentation v2.0
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight" style={{ color: "#111111" }}>
            <span className="running-gradient-text">Build with confidence</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "#5f6368" }}>
            Official guides, API notes, and architectural patterns for integrating a4ai into your platform.
          </p>

          <div className="mt-8 relative max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="search"
              placeholder="Search docs, guides, or keywords…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 w-full pl-11 pr-4 bg-transparent border rounded-xl outline-none text-base transition-all duration-200 search-box-forced"
            />
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 bg-white">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 bg-white">
          {filteredSections.map((s, idx) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="ag-card p-6 bg-white">
              <div className="flex items-center gap-3 mb-3 bg-transparent">
                <div className="p-2 rounded-lg" style={{ background: "rgba(59,130,246,0.08)" }}>
                  <s.icon className="h-5 w-5" style={{ color: "#3b82f6" }} />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "#111111" }}>{s.title}</h3>
              </div>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: "#5f6368" }}>{s.description}</p>
              <ul className="space-y-3.5 bg-transparent">
                {s.items.map((i) => (
                  <li key={i.t} className="group bg-transparent">
                    <Link to={i.to} className="flex items-center text-sm font-semibold transition-colors duration-150 text-blue-600 hover:text-blue-700 bg-transparent">
                      <FileText className="mr-2 h-4 w-4 opacity-60" />
                      {i.t}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}