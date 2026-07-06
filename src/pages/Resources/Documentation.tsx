// src/pages/Documentation.tsx
import React, { useEffect, useState } from "react";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen, Search, Server, Rocket, FileText, TerminalSquare } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

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

export default function Documentation() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [query, setQuery] = useState("");

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
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
      }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);

  const filteredSections = SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.t.toLowerCase().includes(query.toLowerCase()) ||
      section.title.toLowerCase().includes(query.toLowerCase())
    )
  })).filter(section => section.items.length > 0);

  const headColor = isDark ? "#f1f5f9" : "#111111";
  const mutedColor = isDark ? "#8a9bb0" : "#5f6368";

  return (
    <div className="lp min-h-screen relative overflow-hidden pt-24 pb-20" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="hidden sm:block pointer-events-none">
        <div className="absolute" style={{ width: 600, height: 600, right: -100, top: -50, background: isDark ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.03)", filter: "blur(50px)", borderRadius: "50%" }} />
      </div>

      {/* FLOATING NAVBAR */}
      <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
        <nav className={`mx-auto max-w-7xl rounded-2xl border backdrop-blur-xl ${isDark ? "bg-slate-900/10 border-white/10" : "bg-white/10 border-black/5"}`}
          style={{ boxShadow: isDark ? "0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" : "0 8px 32px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Link to="/" className="group flex items-center gap-2.5 text-lg font-semibold tracking-tight">
              <img src="/ICON.ico" alt="Logo" className="h-6 w-6 object-contain" />
              <span style={{ color: headColor }}>a4ai <span className="text-xs font-normal opacity-60 ml-1">Docs</span></span>
            </Link>
            <Link to="/resources" className="text-sm font-semibold" style={{ color: mutedColor }}>Back to Hub</Link>
          </div>
        </nav>
      </div>

      <section className="mx-auto max-w-6xl px-6 pt-14 pb-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur mb-6"
            style={{ background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)", color: isDark ? "#60a5fa" : "#1d4ed8", borderColor: isDark ? "rgba(59,130,246,0.22)" : "rgba(59,130,246,0.16)" }}>
            <BookOpen className="h-3.5 w-3.5" /> a4ai Documentation v2.0
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight" style={{ color: headColor }}>
            <span className="running-gradient-text">Build with confidence</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: mutedColor }}>
            Official guides, API notes, and architectural patterns for integrating a4ai into your platform.
          </p>

          <div className="mt-8 relative max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="search"
              placeholder="Search docs, guides, or keywords…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 w-full pl-11 pr-4 bg-transparent border rounded-xl outline-none text-base transition-all duration-200"
              style={{ borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)", color: isDark ? "#ffffff" : "#111111" }}
            />
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredSections.map((s, idx) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className={`ag-card ${isDark ? "ag-card-dark" : "ag-card-light"} p-6`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg" style={{ background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)" }}>
                  <s.icon className="h-5 w-5" style={{ color: isDark ? "#60a5fa" : "#3b82f6" }} />
                </div>
                <h3 className="text-lg font-bold" style={{ color: headColor }}>{s.title}</h3>
              </div>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: mutedColor }}>{s.description}</p>
              <ul className="space-y-3.5">
                {s.items.map((i) => (
                  <li key={i.t} className="group">
                    <Link to={i.to} className="flex items-center text-sm font-semibold transition-colors duration-150 hover:opacity-80" style={{ color: isDark ? "#60a5fa" : "#3b82f6" }}>
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