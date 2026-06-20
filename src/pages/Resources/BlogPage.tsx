import React from "react";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import ResourcesLayout from "./ResourcesLayout";

const posts = [
  { title: "Introducing a4ai Test Generator", date: "Aug 2025", excerpt: "Why we built it, how it works, and what’s next." },
  { title: "Multi-LLM Strategy: Reliability First", date: "Aug 2025", excerpt: "Choosing the best answer with keyword scoring + fallbacks." },
];

const card = (isDark: boolean) => `ag-card ${isDark ? "ag-card-dark" : "ag-card-light"}`;
const muted = (isDark: boolean) => (isDark ? "#8a9bb0" : "#5f6368");
const head = (isDark: boolean) => (isDark ? "#f1f5f9" : "#111111");
const accent = (isDark: boolean) => (isDark ? "#60a5fa" : "#3b82f6");

function BlogCard({ p, isDark }: { p: typeof posts[0]; isDark: boolean }) {
  const mx = useMotionValue(160);
  const my = useMotionValue(120);

  return (
    <div
      className="group relative h-full"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        mx.set(160);
        my.set(120);
      }}
    >
      <motion.article className={`h-full flex flex-col p-6 transition-all duration-300 ${card(isDark)}`}>
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, ${isDark ? "rgba(96,165,250,0.12)" : "rgba(59,130,246,0.08)"}, transparent 80%)` }}
        />
        <div className="relative z-10 flex flex-col h-full">
          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: accent(isDark) }}>{p.date}</p>
          <h3 className="text-lg font-bold mb-3" style={{ color: head(isDark) }}>{p.title}</h3>
          <p className="text-sm leading-relaxed mb-6 flex-grow" style={{ color: muted(isDark) }}>{p.excerpt}</p>
          
          <button className="flex items-center gap-1.5 text-sm font-semibold transition-colors mt-auto w-fit hover:opacity-80" style={{ color: accent(isDark) }}>
            Read more <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.article>
    </div>
  );
}

export default function BlogPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <ResourcesLayout title="Blog" subtitle="Updates, ideas, and product notes.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((p) => (
          <BlogCard key={p.title} p={p} isDark={isDark} />
        ))}
      </div>
    </ResourcesLayout>
  );
}