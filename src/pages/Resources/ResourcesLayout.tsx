// src/pages/resources/ResourcesLayout.tsx
import React, { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";

const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";

export default function ResourcesLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const prefersReducedMotion = useReducedMotion();

  // CSS Injection to completely force clean light mode execution layers universally
  useEffect(() => {
    document.documentElement.style.background = "#ffffff !important";
    document.documentElement.style.backgroundColor = "#ffffff !important";
    document.documentElement.style.colorScheme = "light only !important";
    document.documentElement.classList.remove("dark");

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
        forced-color-adjust: none !important;
      }
      
      /* Immutable Global Light Background Enforcements */
      .layout-forced-light-bg, .layout-forced-light-bg * {
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }

      /* Clean White Frosted Nav Dock Bar Element */
      .force-light-layout-dock {
        background-color: rgba(255, 255, 255, 0.45) !important;
        background: rgba(255, 255, 255, 0.45) !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        border: 1px solid rgba(255, 255, 255, 0.5) !important;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6), 0 8px 32px rgba(0, 0, 0, 0.03) !important;
      }

      /* Active Link Navigation Pill State */
      .active-pill-forced {
        background: rgba(59, 130, 246, 0.1) !important;
        border-color: rgba(59, 130, 246, 0.25) !important;
        color: #1d4ed8 !important;
      }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);

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

  const nav = [
    { to: "/resources", label: "All resources" },
    { to: "/docs", label: "Docs" },
    { to: "/help", label: "Help Center" },
    { to: "/blog", label: "Blog" },
    { to: "/case-studies", label: "Case Studies" },
  ];

  const isActive = (to: string) =>
    pathname === to || (to !== "/resources" && pathname.startsWith(to));

  const headColor = "#111111";
  const mutedColor = "#5f6368";

  return (
    <div 
      onMouseMove={onMove} 
      className="layout-forced-light-bg min-h-screen relative overflow-hidden pb-20 bg-white"
    >
      {/* Background Glow Elements */}
      <div className="hidden sm:block pointer-events-none">
        <div className="absolute" style={{ width: 600, height: 600, right: -150, top: -100, background: "rgba(59,130,246,0.03)", filter: "blur(50px)", borderRadius: "50%" }} />
        <div className="absolute" style={{ width: 500, height: 500, left: -100, bottom: "10%", background: "rgba(129,140,248,0.03)", filter: "blur(50px)", borderRadius: "50%" }} />
      </div>

      <div
        className="absolute inset-0 -z-20 pointer-events-none"
        style={{
          opacity: 0.015,
          backgroundImage: `linear-gradient(to right, #000000 1px, transparent 1px), linear-gradient(to bottom, #000000 1px, transparent 1px)`,
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

      {/* DETACHED FLOATING TOP BAR DOCK */}
      <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
        <nav 
          className="mx-auto max-w-7xl rounded-2xl border transition-all duration-300 relative overflow-hidden force-light-layout-dock"
        >
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Link to="/" className="group flex items-center gap-2.5 select-none text-lg font-semibold tracking-tight active:opacity-90">
              <img src="/ICON.ico" alt="Logo" className="h-6 w-6 object-contain rounded transition-transform duration-200 group-hover:scale-105" />
              <span style={{ color: headColor }}>
                a4ai <span className="text-xs font-normal opacity-60 ml-1">Hub</span>
              </span>
            </Link>

            <div className="flex items-center gap-5">
              <Link to="/docs" className="text-sm font-semibold transition-colors" style={{ color: mutedColor }}>Docs</Link>
              <Link to="/login" className="text-sm font-semibold transition-colors" style={{ color: mutedColor }}>Sign In</Link>
            </div>
          </div>
        </nav>
      </div>

      {/* Header Container Banner */}
      <header className="relative z-10 border-b pt-24 border-neutral-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10 bg-transparent">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            <span className="running-gradient-text">{title}</span>
          </h1>
          {subtitle && (
            <p className="text-base mt-2 max-w-3xl leading-relaxed text-neutral-500">
              {subtitle}
            </p>
          )}

          {/* Navigation Bar Pills */}
          <nav aria-label="Resources navigation" className="mt-8 flex flex-wrap gap-2.5">
            {nav.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 border ${
                    active ? "active-pill-forced" : "border-neutral-200/70 bg-transparent text-neutral-500"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10 bg-white">{children}</main>
    </div>
  );
}