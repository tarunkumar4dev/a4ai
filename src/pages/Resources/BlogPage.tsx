// src/pages/resources/BlogPage.tsx
import React, { useEffect } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { ArrowRight } from "lucide-react";
import ResourcesLayout from "./ResourcesLayout";

const posts = [
  { title: "Introducing a4ai Test Generator", date: "Aug 2025", excerpt: "Why we built it, how it works, and what’s next." },
  { title: "Multi-LLM Strategy: Reliability First", date: "Aug 2025", excerpt: "Choosing the best answer with keyword scoring + fallbacks." },
];

/* ──────────────────────────────────────────────────────────────
   ANTI-INVERSION STYLE ENGINE (Forced Light Only)
   ────────────────────────────────────────────────────────────── */
const GlobalStyles = () => {
  useEffect(() => {
    // Explicitly lock down root layout spaces to clean light space
    document.documentElement.style.background = "#ffffff !important";
    document.documentElement.style.backgroundColor = "#ffffff !important";
    document.documentElement.style.colorScheme = "light only !important";
    document.documentElement.classList.remove("dark");

    const s = document.createElement("style");
    s.textContent = `
      .lp-blog-wrapper, .lp-case-wrapper * {
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }

      .ag-card {
        border-radius: 18px;
        transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s cubic-bezier(.16,1,.3,1);
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.85) !important;
        border: 1px solid rgba(0, 0, 0, 0.07) !important;
        backdrop-filter: blur(30px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(170%) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(59,130,246,0.03), 0 2px 6px rgba(0,0,0,0.02) !important;
      }
      @media (min-width: 640px) { .ag-card { border-radius: 20px; } }
      
      @media (hover: hover) {
        .ag-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 14px 38px rgba(59,130,246,0.08), 0 6px 16px rgba(0,0,0,0.03) !important;
        }
      }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);
  return null;
};

function BlogCard({ p }: { p: typeof posts[0] }) {
  const mx = useMotionValue(160);
  const my = useMotionValue(120);

  return (
    <div
      className="group relative h-full select-none"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onMouseLeave={() => { mx.set(160); my.set(120); }}
    >
      <div className="ag-card h-full flex flex-col p-6 transition-all duration-300 bg-white">
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, rgba(59,130,246,0.06), transparent 80%)` }}
        />
        
        <div className="relative z-10 flex flex-col h-full bg-transparent">
          <p className="text-xs font-bold mb-2 uppercase tracking-wider text-blue-600">{p.date}</p>
          <h3 className="text-lg font-bold mb-2.5 text-neutral-900">{p.title}</h3>
          <p className="text-sm leading-relaxed mb-6 flex-grow text-neutral-500">{p.excerpt}</p>
          
          <button className="flex items-center gap-1.5 text-sm font-semibold transition-colors mt-auto w-fit text-blue-600 hover:text-blue-700 bg-transparent">
            Read article <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BlogPage() {
  return (
    <div className="lp-blog-wrapper bg-white w-full">
      <GlobalStyles />
      <ResourcesLayout title="Blog" subtitle="Updates, architectural insights, and product engineering logs.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
          {posts.map((p) => (
            <BlogCard key={p.title} p={p} />
          ))}
        </div>
      </ResourcesLayout>
    </div>
  );
}