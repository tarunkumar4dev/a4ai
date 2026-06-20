import React, { useRef, useEffect, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
} from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Helmet } from "react-helmet";
import { useTheme } from "@/context/ThemeContext";
import {
  Sparkles,
  Target,
  ShieldCheck,
  Rocket,
  Bolt,
  BookOpenCheck,
  Quote,
  ArrowRight,
  Gauge,
  Shield,
  BookOpen,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   BRAND STYLES & GLOBAL INJECTION (From Features Page)
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
      .stat-n {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
      }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);
  return null;
};

const card = (isDark: boolean) => `ag-card ${isDark ? "ag-card-dark" : "ag-card-light"}`;
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

/* ================== Anim Helpers ================== */
const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
} as const;

const sectionX = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

/* ================== Data ================== */
const team = [
  { name: "Tarun Pathak", role: "Co-Founder", description: "Product · Marketing", image: "/images/tarun_a4ai.jpeg" },
  { name: "Yash Dubey", role: "Co-Founder", description: "Full Stack Developer", image: "/images/yash_a4ai.jpg" },
  { name: "Aakash Singh", role: "Co-Founder", description: "Cloud · Infra · Frontend", image: "/images/aakash_a4ai.jpg" },
  { name: "Krishna Gupta", role: "Co-Founder", description: "Operations", image: "/images/krishna_a4ai.jpg" },
];

const values = [
  { icon: Target, k: "Outcomes > Outputs", v: "We obsess over student learning gains and teacher time saved." },
  { icon: ShieldCheck, k: "Trust by design", v: "Privacy‑first data handling with clear controls and audit trails." },
  { icon: BookOpenCheck, k: "Pedagogy‑aware AI", v: "Questions that align to curriculum, not just prompt magic." },
  { icon: Bolt, k: "Speed with dignity", v: "From prompt to paper in under 2 min—without cutting corners." },
];

const milestones = [
  { date: "Apr 2025", title: "a4ai is founded", detail: "Validated the pain: teachers spend 6–10 hrs/week creating papers." },
  { date: "Jun 2025", title: "Private alpha", detail: "First 50 teachers, 1K+ papers generated; tight build‑with loop." },
  { date: "Aug 2025", title: "Contest engine MVP", detail: "Proctored live contests with camera checks & screen‑lock." },
  { date: "Q4 2025", title: "Institutes beta", detail: "Custom branding, SSO, and advanced analytics for campuses." },
];

const testimonials = [
  {
    quote: "We cut paper‑setting time by 80% and finally standardised difficulty across sections.",
    name: "Ritika Sharma",
    title: "HOD Science, Delhi",
  },
  {
    quote: "Proctoring is surprisingly humane—alerts were actionable and didn't overwhelm invigilators.",
    name: "Arvind Rao",
    title: "Principal, Pune",
  },
];

const partners = [
  { name: "Chanakya", logo: "/images/partner-msit.svg" },
  { name: "CBSE schools", logo: "/images/partner-cbse.svg" },
  { name: "SkillED", logo: "/images/partner-skilled.svg" },
  { name: "EduLabs", logo: "/images/partner-edulabs.svg" },
];

/* ================== Page ================== */
export default function AboutPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
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
    radial-gradient(1000px 520px at ${mx}px ${my}px, ${isDark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.04)"}, transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px + 260px) calc(${my}px + 140px), ${isDark ? "rgba(96,165,250,0.06)" : "rgba(96,165,250,0.04)"}, transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px - 260px) calc(${my}px + 220px), ${isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)"}, transparent 70%)
  `;

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-12% 0px" });

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "a4ai",
    url: "https://a4ai.in",
    logo: "https://a4ai.in/images/logo.png",
    sameAs: ["https://x.com/a4ai", "https://www.linkedin.com/company/a4ai"],
  };

  return (
    <>
      <Helmet>
        <title>About a4ai — Smart, simple, secure assessments</title>
        <meta name="description" content="We're a small team building AI‑powered test generation, proctoring, and analytics that respect pedagogy and privacy." />
        <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
        <meta property="og:title" content="About a4ai" />
        <meta property="og:description" content="AI-powered assessments for real classrooms." />
        <meta property="og:type" content="website" />
      </Helmet>

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
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <span {...pillProps(isDark)}><Sparkles className="h-3.5 w-3.5"/> Founded 2025</span>
              <span {...pillProps(isDark)}><Rocket className="h-3.5 w-3.5"/> Contest engine live</span>
              <span {...pillProps(isDark)}><ShieldCheck className="h-3.5 w-3.5"/> Privacy‑first</span>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="text-center text-[34px] md:text-5xl lg:text-6xl leading-[1.15] font-extrabold tracking-tight"
              style={{ color: head(isDark) }}
            >
              About <span className="nlm-text">a4ai</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
              className="mx-auto mt-6 max-w-3xl text-center text-lg md:text-xl"
              style={{ color: muted(isDark) }}
            >
              Building the assessment stack for Indian classrooms—fast, fair, and aligned to how teachers actually teach.
            </motion.p>

            {/* Stats */}
            <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { k: "Papers", v: "3.5K+" },
                { k: "Schools", v: "25+" },
                { k: "Uptime", v: "99.9%" },
                { k: "Avg. Gen Time", v: "< 2 min" },
              ].map((s, i) => (
                <motion.div
                  key={s.k}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i, duration: 0.5, ease: "easeOut" }}
                  className={`p-6 text-center ${card(isDark)}`}
                >
                  <div className="text-2xl md:text-3xl font-extrabold tracking-tight stat-n">{s.v}</div>
                  <div className="mt-1 text-sm font-medium" style={{ color: muted(isDark) }}>{s.k}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* MISSION */}
        <section ref={sectionRef} className="relative z-10 py-20">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="[&_h2]:tracking-tight"
            >
              <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: head(isDark) }}>Our mission</h2>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: muted(isDark) }}>
                Give teachers superpowers with AI that respects context and curriculum. Save hours weekly and return that time to students.
              </p>
              <p className="mt-4 text-lg leading-relaxed" style={{ color: muted(isDark) }}>
                We combine multi‑LLM generation with rubric checks, plagiarism guards,
                and contest‑grade proctoring to ensure quality from day one.
              </p>

              {/* Buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <button className="btn-blk px-8 py-3.5 text-base sm:text-lg">
                  <span className="relative z-10 flex items-center justify-center gap-2">See how it works</span>
                </button>
                <button className={`px-8 py-3.5 text-base sm:text-lg ${isDark ? "btn-glass-dark" : "btn-glass-light"}`} style={{ color: isDark ? "#e8eaed" : "#202124" }}>
                  <span className="relative z-10 flex items-center justify-center gap-2">Talk to us</span>
                </button>
              </div>

              {/* Feature chips */}
              <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { icon: Gauge, title: "Faster prep", copy: "Create aligned tests in minutes, not evenings." },
                  { icon: Shield, title: "Safer data", copy: "Privacy-first storage, clear consent, audit trails." },
                  { icon: BookOpen, title: "Better pedagogy", copy: "Curriculum mapping + rubric checks by default." },
                ].map((item) => (
                  <div key={item.title} className={`p-5 ${card(isDark)}`}>
                    <div className="flex items-center gap-2 font-semibold" style={{ color: head(isDark) }}>
                      <item.icon className="h-4 w-4" style={{ color: accent(isDark) }} />
                      {item.title}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: muted(isDark) }}>{item.copy}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
              <div className={`overflow-hidden p-0 ${card(isDark)}`}>
                <img
                  src="/images/bg.jpg"
                  alt="Educators using a4ai"
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* VALUES */}
        <section className="relative z-10 py-20">
          <div className={sectionX}>
            <div className="mb-12 text-center">
              <h3 className="text-3xl font-extrabold" style={{ color: head(isDark) }}>What we value</h3>
              <p className="mt-3" style={{ color: muted(isDark) }}>Principles that steer product and policy.</p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((x, i) => (
                <motion.div
                  key={x.k}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i, duration: 0.5, ease: "easeOut" }}
                  className={`p-6 ${card(isDark)}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="relative flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)", border: isDark ? "1px solid rgba(59,130,246,0.18)" : "1px solid rgba(59,130,246,0.12)" }}
                    >
                      <x.icon className="h-5 w-5" style={{ color: accent(isDark) }} />
                    </div>
                    <div className="font-semibold" style={{ color: head(isDark) }}>{x.k}</div>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: muted(isDark) }}>{x.v}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* TIMELINE */}
        <section className="relative z-10 py-20">
          <div className="mx-auto max-w-5xl px-4">
            <h3 className="text-3xl font-extrabold text-center" style={{ color: head(isDark) }}>Milestones</h3>
            <div className="mt-12 space-y-6">
              {milestones.map((m, i) => (
                <motion.div
                  key={m.title}
                  initial={{ opacity: 0, x: i % 2 ? 40 : -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`grid grid-cols-1 gap-4 p-6 md:grid-cols-[140px_1fr] ${card(isDark)}`}
                >
                  <div className="text-sm font-semibold mt-1" style={{ color: accent(isDark) }}>{m.date}</div>
                  <div>
                    <div className="text-lg font-bold" style={{ color: head(isDark) }}>{m.title}</div>
                    <div className="mt-2 text-sm leading-relaxed" style={{ color: muted(isDark) }}>{m.detail}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* TEAM */}
        <section className="relative z-10 py-20">
          <div className={sectionX}>
            <div className="text-center">
              <motion.h2 {...fadeUp} className="text-3xl md:text-4xl font-extrabold mb-6" style={{ color: head(isDark) }}>
                Team Behind a4ai
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mx-auto max-w-3xl text-lg"
                style={{ color: muted(isDark) }}
              >
               A small team building a4ai — step by step, every day.
              </motion.p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((m, i) => (
                <TeamCard key={m.name} index={i} member={m} isDark={isDark} />
              ))}
            </div>

            <p className="mt-12 text-center text-sm font-medium" style={{ color: muted(isDark) }}>
            …and many more people who quietly help shape a4ai every moment.
            </p>
          </div>
        </section>

        {/* PARTNERS */}
        <section className="relative z-10 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <h3 className="text-3xl font-extrabold" style={{ color: head(isDark) }}>Schools & partners</h3>
              <p className="mt-3" style={{ color: muted(isDark) }}>Pilots and early adopters we're grateful for.</p>
            </div>
            <div className="mt-12 grid grid-cols-2 items-center gap-6 sm:grid-cols-4">
              {partners.map((p) => (
                <div key={p.name} className={`flex items-center justify-center p-8 ${card(isDark)}`}>
                  <img
                    src={p.logo}
                    alt={p.name}
                    className={`h-8 transition-all duration-300 ${isDark ? "opacity-70 hover:opacity-100 invert" : "opacity-70 hover:opacity-100 grayscale hover:grayscale-0"}`}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="relative z-10 py-20">
          <div className="mx-auto max-w-5xl px-4">
            <div className="grid gap-6 md:grid-cols-2">
              {testimonials.map((t, i) => (
                <motion.blockquote
                  key={t.name}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.05 * i, ease: "easeOut" }}
                  className={`relative p-8 ${card(isDark)}`}
                >
                  <Quote className="absolute -top-3 -left-3 h-8 w-8" style={{ color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }} />
                  <p className="text-base leading-relaxed italic" style={{ color: head(isDark) }}>"{t.quote}"</p>
                  <footer className="mt-6 text-sm">
                    <span className="font-semibold" style={{ color: head(isDark) }}>{t.name}</span>,{" "}
                    <span style={{ color: muted(isDark) }}>{t.title}</span>
                  </footer>
                </motion.blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="relative z-10 pb-24 pt-10">
          <div className={sectionX}>
            <motion.div {...fadeUp} viewport={{ once: true }} className="rounded-2xl p-[1px] shadow-lg overflow-hidden" style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}>
              <div className="rounded-2xl px-6 py-16 text-center relative" style={{ background: isDark ? "rgba(10,14,24,0.95)" : "rgba(255,255,255,0.95)", backdropFilter: "blur(24px) saturate(160%)" }}>
                <motion.h2
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="text-3xl md:text-4xl font-extrabold tracking-tight"
                  style={{ color: head(isDark) }}
                >
                  Ready to transform your assessments?
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="mx-auto mt-4 max-w-2xl text-lg"
                  style={{ color: muted(isDark) }}
                >
                  Join educators using a4ai to save time and improve outcomes.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.25, duration: 0.5 }}
                  className="mt-8 flex flex-col sm:flex-row justify-center gap-4"
                >
                  <button className="btn-blk px-8 py-3.5 text-base sm:text-lg">
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Get started for free
                    </span>
                  </button>
                  <button className={`px-8 py-3.5 text-base sm:text-lg flex items-center justify-center gap-2 ${isDark ? "btn-glass-dark" : "btn-glass-light"}`} style={{ color: isDark ? "#e8eaed" : "#202124" }}>
                    <span className="relative z-10 flex items-center gap-2">Book a demo <ArrowRight className="h-5 w-5" /></span>
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

      </div>
    </>
  );
}

/* ================== Team Card ================== */
function TeamCard({
  member,
  index,
  isDark,
}: {
  member: { name: string; role: string; description: string; image: string };
  index: number;
  isDark: boolean;
}) {
  const mx = useMotionValue(160);
  const my = useMotionValue(120);
  const rotateX = useTransform(my, [0, 260], [8, -8]);
  const rotateY = useTransform(mx, [0, 300], [-10, 10]);

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
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.08 * index, ease: EASE }}
      className="relative"
    >
      <div onMouseMove={onMove} onMouseLeave={onLeave} style={{ perspective: 1000 }} className="group cursor-pointer h-full">
        <motion.div
          style={{ rotateX, rotateY }}
          className={`relative h-full p-6 transition-all duration-300 ${card(isDark)}`}
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: useMotionTemplate`radial-gradient(180px 140px at ${mx}px ${my}px, ${isDark ? "rgba(96,165,250,0.12)" : "rgba(59,130,246,0.08)"}, transparent 80%)` }}
          />
          <div className="relative za-10 text-center">
            <Avatar className="mx-auto mb-4 h-28 w-28 ring-2" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}>
              <AvatarImage src={member.image} alt={member.name} className="object-cover" />
              <AvatarFallback className="text-xl font-bold" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", color: head(isDark) }}>
                {member.name.substring(0, 2)}
              </AvatarFallback>
            </Avatar>

            <h3 className="text-xl font-extrabold" style={{ color: head(isDark) }}>{member.name}</h3>
            <p className="mt-1 text-sm font-semibold" style={{ color: accent(isDark) }}>{member.role}</p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: muted(isDark) }}>{member.description}</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}