// src/pages/resources/ResourcesHome.tsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { BookOpen, LifeBuoy, Newspaper, Briefcase, Search, ArrowRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import ResourcesLayout from "./ResourcesLayout";

const cards = [
  { to: "/docs", title: "Documentation", desc: "Install, configure, and integrate the a4ai test generator.", Icon: BookOpen, tags: ["setup", "api", "sdk", "integration"] },
  { to: "/help", title: "Help Center", desc: "FAQs, troubleshooting, and how-tos for common issues.", Icon: LifeBuoy, tags: ["faq", "errors", "troubleshoot", "account"] },
  { to: "/blog", title: "Blog", desc: "Product updates, tips, and behind-the-scenes notes.", Icon: Newspaper, tags: ["updates", "release", "tips", "news"] },
  { to: "/case-studies", title: "Case Studies", desc: "How schools and teachers use a4ai in the real world.", Icon: Briefcase, tags: ["schools", "teachers", "impact", "stories"] },
];

function ResourceHubCard({ c, isDark }: { c: typeof cards[0]; isDark: boolean }) {
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
      className={`ag-card ${isDark ? "ag-card-dark" : "ag-card-light"} p-6 group block relative h-full transition-all duration-300`}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: useMotionTemplate`radial-gradient(200px 160px at ${mx}px ${my}px, ${isDark ? "rgba(96,165,250,0.12)" : "rgba(59,130,246,0.08)"}, transparent 80%)` }}
      />
      <div className="relative z-10 flex flex-col h-full">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl mb-4"
          style={{ background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)", border: isDark ? "1px solid rgba(59,130,246,0.18)" : "1px solid rgba(59,130,246,0.12)" }}>
          <Icon className="h-6 w-6" style={{ color: isDark ? "#60a5fa" : "#3b82f6" }} />
        </div>
        <h3 className="text-lg font-bold mb-2" style={{ color: isDark ? "#f1f5f9" : "#111111" }}>{c.title}</h3>
        <p className="text-sm leading-relaxed mb-6 flex-grow" style={{ color: isDark ? "#8a9bb0" : "#5f6368" }}>{c.desc}</p>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold transition-transform duration-200 group-hover:translate-x-0.5" style={{ color: isDark ? "#60a5fa" : "#3b82f6" }}>
          Explore Hub <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

export default function ResourcesHome() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
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
    <ResourcesLayout title="Resources" subtitle="Everything you need to build, learn, and succeed with a4ai.">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search docs, help, blog, case studies…"
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all duration-200 border bg-transparent"
            style={{
              borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
              color: isDark ? "#ffffff" : "#111111"
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((c) => (
          <ResourceHubCard key={c.to} c={c} isDark={isDark} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className={`mt-10 rounded-xl border border-dashed p-10 text-center ${isDark ? "border-white/10" : "border-slate-200"}`}>
          <p className="text-sm" style={{ color: isDark ? "#8a9bb0" : "#5f6368" }}>
            No matches found for <span className="font-semibold">“{q}”</span>.
          </p>
        </div>
      )}
    </ResourcesLayout>
  );
}