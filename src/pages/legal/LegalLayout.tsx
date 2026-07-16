import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useMotionValue, useMotionTemplate, useReducedMotion } from "framer-motion";
import { FileText, Shield, Cookie, Scale } from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   BRAND STYLES & GLOBAL INJECTION (Forced Light Only)
   ────────────────────────────────────────────────────────────── */
const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";

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
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.85) !important;
        border: 1px solid rgba(0, 0, 0, 0.07) !important;
        backdrop-filter: blur(30px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(170%) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(59,130,246,0.03), 0 2px 6px rgba(0,0,0,0.02) !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }
      @media (min-width: 640px) { .ag-card { border-radius: 20px; } }
      
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
      .sorb { position:absolute; border-radius:50%; pointer-events:none; filter: blur(70px); }
      @media (min-width: 640px) { .sorb { filter: blur(100px); } }
      
      /* Legal Document Typography Overrides */
      .legal-doc h2 { font-weight: 800; font-size: 1.25rem; margin-top: 2rem; margin-bottom: 1rem; letter-spacing: -0.025em; }
      .legal-doc p { margin-bottom: 1rem; line-height: 1.7; }
      .legal-doc ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.5rem; line-height: 1.7; }
      .legal-doc li { margin-bottom: 0.5rem; }
      .legal-doc a { text-decoration: underline; text-underline-offset: 4px; transition: color 0.2s; }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);
  return null;
};

// Static Design Helpers for Forced Light Mode
export const cardTheme = () => "ag-card";
export const muted = () => "#5f6368";
export const head = () => "#111111";
export const accent = () => "#3b82f6";

export default function LegalLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  // Ambient glow follows cursor
  const mx = useMotionValue(360);
  const my = useMotionValue(180);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const bgGlow = useMotionTemplate`
    radial-gradient(1000px 520px at ${mx}px ${my}px, rgba(59,130,246,0.04), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px + 260px) calc(${my}px + 140px), rgba(96,165,250,0.04), transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px - 260px) calc(${my}px + 220px), rgba(129,140,248,0.03), transparent 70%)
  `;

  const links = [
    { name: "Terms", path: "/terms", icon: Scale },
    { name: "Privacy", path: "/privacy", icon: Shield },
    { name: "Cookies", path: "/cookies", icon: Cookie },
  ];

  return (
    <div onMouseMove={onMove} className="lp min-h-screen relative overflow-hidden bg-white">
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
          backgroundImage: "linear-gradient(to right, #000000 1px, transparent 1px), linear-gradient(to bottom, #000000 1px, transparent 1px)",
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

      <header className="relative z-10 pt-20 pb-10 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center bg-transparent">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 mb-6 rounded-full text-xs font-semibold" style={{ background: "rgba(59,130,246,0.08)", color: accent(), border: "1px solid rgba(59,130,246,0.16)" }}>
              <FileText className="h-3.5 w-3.5" />
              Legal & Compliance
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight" style={{ color: head() }}>
              {title}
            </h1>
            {subtitle && (
              <p className="mt-4 text-lg" style={{ color: muted() }}>
                {subtitle}
              </p>
            )}
          </motion.div>

          <motion.nav initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="mt-10 flex flex-wrap justify-center gap-2 bg-transparent">
            {links.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${isActive ? "" : "hover:bg-black/5"}`}
                  style={{
                    background: isActive ? "#f1f5f9" : "transparent",
                    color: isActive ? head() : muted(),
                    boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  <link.icon className="h-4 w-4" style={{ color: isActive ? accent() : "inherit" }} />
                  {link.name}
                </Link>
              );
            })}
          </motion.nav>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-24 bg-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className={`${cardTheme()} p-8 md:p-12 bg-white`}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}