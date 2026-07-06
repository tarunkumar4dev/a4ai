// src/pages/ApiPage.tsx
import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";
import {
  KeyRound,
  ShieldCheck,
  Globe,
  Code2,
  Server,
  Webhook as WebhookIcon,
  AlertTriangle,
  Terminal,
  BookOpen,
  Link2,
  Lock,
  Rocket,
  Copy,
  Check,
  Zap,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";

/* ──────────────────────────────────────────────────────────────
   CODE EMBEDDED STRING DATA SNIPPETS
   ────────────────────────────────────────────────────────────── */
const CURL_QUICKSTART = `# Base URL
export BASE=https://api.a4ai.in/v1

# Generate a test paper (Science, Class 10)
curl -X POST "$BASE/tests/generate" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subject": "Science",
    "class": 10,
    "chapters": ["Electricity", "Human Eye"],
    "difficulty": "mixed",
    "num_questions": 20,
    "format": "pdf"
  }'`;

const SDK_INSTALL = `# pick one
npm i @a4ai/sdk
# yarn add @a4ai/sdk
# pnpm add @a4ai/sdk`;

const SDK_TS = `import { A4AI } from "@a4ai/sdk";

const client = new A4AI({ apiKey: process.env.A4AI_API_KEY! });

const test = await client.tests.generate({
  subject: "Science",
  class: 10,
  chapters: ["Electricity", "Human Eye"],
  difficulty: "mixed",
  num_questions: 20,
  format: "pdf",
});

console.log(test.id, test.downloadUrl);`;

const ENDPOINT_GENERATE_REQ = `POST /v1/tests/generate
Content-Type: application/json
Authorization: Bearer {API_KEY}

{
  "subject": "Mathematics",
  "class": 10,
  "chapters": ["Trigonometry"],
  "difficulty": "balanced",
  "blueprint": { "mcq": 10, "short": 5, "long": 5 },
  "num_questions": 20,
  "format": "pdf"
}`;

const ENDPOINT_GENERATE_RES = `200 OK
{
  "id": "tst_9xq2k...",
  "status": "ready",
  "downloadUrl": "https://cdn.a4ai.in/tests/tst_9xq2k.pdf",
  "meta": {
    "subject": "Mathematics",
    "class": 10,
    "chapters": ["Trigonometry"]
  }
}`;

const ENDPOINT_CONTEST_REQ = `POST /v1/contests
Content-Type: application/json
Authorization: Bearer {API_KEY}

{
  "name": "Class X Science Sprint",
  "code": "ClassX_Science",
  "durationMinutes": 45,
  "proctoring": { "camera": true, "screenLock": true }
}`;

const ENDPOINT_CONTEST_RES = `201 Created
{
  "id": "cst_8pLmx...",
  "url": "https://a4ai.in/contests/cst_8pLmx",
  "proctoring": { "camera": true, "screenLock": true }
}`;

const WEBHOOK_PAYLOAD = `{
  "id": "evt_7w2...",
  "type": "contest.proctor.alert",
  "created": 1692851200,
  "data": {
    "contestId": "cst_8pLmx",
    "studentId": "stu_92d...",
    "alerts": [
      { "code": "face_missing", "severity": "high" }
    ]
  }
}`;

/* ──────────────────────────────────────────────────────────────
   UTILITY HELPER COMPONENTS
   ────────────────────────────────────────────────────────────── */
function Chip({ children, intent = "default" }: { children: React.ReactNode; intent?: "default" | "success" | "warning" | "info" }) {
  const map = {
    default: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    success: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${map[intent]}`}>{children}</span>
  );
}

function CodeBlock({ code, lang = "bash", isDark }: { code: string; lang?: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div className="relative group/code w-full">
      <button 
        onClick={copy} 
        className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium backdrop-blur transition-all duration-200 ${
          isDark ? "bg-slate-900/80 border-white/10 text-slate-300" : "bg-white/80 border-black/10 text-slate-700"
        }`}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Copy
          </>
        )}
      </button>
      <pre className={`overflow-x-auto rounded-xl border p-4 text-xs font-mono leading-relaxed max-w-full ${
        isDark ? "bg-slate-950/60 border-white/5 text-slate-300" : "bg-slate-50/80 border-black/5 text-slate-800"
      }`}>
        <code className={`language-${lang}`}>{code}</code>
      </pre>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle, isDark }: { icon: React.ReactNode; title: string; subtitle?: string; isDark: boolean }) {
  return (
    <div className="mb-8 flex items-start gap-4">
      <div className="p-2.5 rounded-xl border flex items-center justify-center"
        style={{ 
          background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)", 
          borderColor: isDark ? "rgba(59,130,246,0.22)" : "rgba(59,130,246,0.14)" 
        }}>
        <span style={{ color: isDark ? "#60a5fa" : "#3b82f6" }}>{icon}</span>
      </div>
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: isDark ? "#f1f5f9" : "#111111" }}>{title}</h2>
        {subtitle && <p className="mt-1 text-sm font-medium" style={{ color: isDark ? "#8a9bb0" : "#5f6368" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   MAIN COMPONENT IMPLEMENTATION
   ────────────────────────────────────────────────────────────── */
export default function ApiPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const prefersReducedMotion = useReducedMotion();
  const [tab, setTab] = useState<"rest" | "sdk">("rest");

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
      .running-gradient-text {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
        display: inline-block;
      }
      .btn-blk {
        position:relative; overflow:hidden;
        background: linear-gradient(180deg,#202124 0%,#111111 100%);
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.3);
        color: white; font-weight:600;
        border-radius: 12px;
        transition: transform 0.2s, opacity 0.2s;
      }
      .btn-glass {
        background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"};
        border: 1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"};
        backdrop-filter: blur(10px);
        border-radius: 12px;
        font-weight: 600;
        transition: all 0.2s;
      }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, [isDark]);

  const mx = useMotionValue(360);
  const my = useMotionValue(180);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const bgGlow = useMotionTemplate`
    radial-gradient(1000px 520px at ${mx}px ${my}px, ${isDark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.04)"}, transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px + 260px) calc(${my}px + 140px), ${isDark ? "rgba(96,165,250,0.06)" : "rgba(96,165,250,0.04)"}, transparent 70%)
  `;

  const headColor = isDark ? "#f1f5f9" : "#111111";
  const mutedColor = isDark ? "#8a9bb0" : "#5f6368";
  const cardClass = `ag-card ${isDark ? "ag-card-dark" : "ag-card-light"}`;

  return (
    <div onMouseMove={onMove} className="lp min-h-screen relative overflow-hidden transition-colors duration-300 pb-24" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      
      {/* Background Glow Canvas & Orbs Grid */}
      <div className="hidden sm:block pointer-events-none">
        <div className="absolute" style={{ width: 600, height: 600, right: -100, top: -100, background: isDark ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.03)", filter: "blur(50px)", borderRadius: "50%" }} />
        <div className="absolute" style={{ width: 500, height: 500, left: -100, bottom: "20%", background: isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)", filter: "blur(50px)", borderRadius: "50%" }} />
      </div>

      <div
        className="absolute inset-0 -z-20 pointer-events-none"
        style={{
          opacity: isDark ? 0.02 : 0.035,
          backgroundImage: `linear-gradient(to right, ${isDark ? "#ffffff" : "#000000"} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? "#ffffff" : "#000000"} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      {!prefersReducedMotion && (
        <motion.div aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-100" style={{ backgroundImage: bgGlow as any }} />
      )}

      {/* DETACHED TOP BAR NAVIGATION */}
      <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
        <nav className={`mx-auto max-w-7xl rounded-2xl border backdrop-blur-xl transition-colors duration-300 relative overflow-hidden ${isDark ? "bg-slate-900/10 border-white/10" : "bg-white/10 border-black/5"}`}
          style={{ boxShadow: isDark ? "0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" : "0 8px 32px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)" }}>
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Link to="/" className="group flex items-center gap-2.5 text-lg font-semibold tracking-tight active:opacity-90 select-none">
              <img src="/ICON.ico" alt="Logo" className="h-6 w-6 object-contain rounded transition-transform duration-200 group-hover:scale-105" />
              <span style={{ color: headColor }}>a4ai <span className="text-xs font-normal opacity-60 ml-1">Developer</span></span>
            </Link>
            <div className="flex items-center gap-5">
              <Link to="/docs" className="text-sm font-semibold transition-colors" style={{ color: mutedColor }}>Docs</Link>
              <Link to="/resources" className="text-sm font-semibold transition-colors" style={{ color: mutedColor }}>Hub</Link>
            </div>
          </div>
        </nav>
      </div>

      {/* Hero Header Section */}
      <section className="mx-auto max-w-6xl px-6 pt-32 pb-14">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="mb-6 inline-flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur"
              style={{ background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)", color: isDark ? "#60a5fa" : "#1d4ed8", borderColor: isDark ? "rgba(59,130,246,0.22)" : "rgba(59,130,246,0.16)" }}>
              <KeyRound className="h-3.5 w-3.5" /> Engine API Reference
            </span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.15]" style={{ color: headColor }}>
            <span className="running-gradient-text">Build with a4ai</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: mutedColor }}>
            Generate programmatically sound tests, spin up proctored contest metrics, and parse parameters natively using a clean REST structural layout engine.
          </p>

          {/* Base URL and Key Credentials Panel */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className={`${cardClass} p-5`}>
              <div className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: mutedColor }}>
                <Globe className="h-4 w-4 text-blue-500" /> Base Endpoint Route
              </div>
              <div className={`rounded-xl border p-3 text-xs font-mono tracking-tight ${isDark ? "bg-slate-950/40 border-white/5 text-slate-300" : "bg-slate-50 border-black/5 text-slate-800"}`}>
                https://api.a4ai.in/v1
              </div>
            </div>

            <div className={`${cardClass} p-5`}>
              <div className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: mutedColor }}>
                <Lock className="h-4 w-4 text-emerald-500" /> Authentication Header Token
              </div>
              <p className="text-sm font-medium leading-relaxed" style={{ color: headColor }}>
                Provide <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">Authorization: Bearer YOUR_API_KEY</span> inside each structural request header framework.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Quickstart Structural Sections */}
      <section className="mx-auto max-w-6xl px-6 py-4">
        <SectionTitle icon={<Terminal className="h-5 w-5" />} title="Quickstart Implementation" subtitle="Execute commands natively via cURL or wire using our core TypeScript SDK modules." isDark={isDark} />

        {/* Custom Glass Tab Selectors */}
        <div className="mb-6 inline-flex rounded-xl p-1 border backdrop-blur" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
          <button onClick={() => setTab("rest")} className={`rounded-lg px-4 py-1.5 text-xs sm:text-sm font-bold transition-all duration-200 ${tab === "rest" ? (isDark ? "bg-white/10 text-white" : "bg-black/5 text-slate-900") : "opacity-60"}`}>
            REST Architecture (curl)
          </button>
          <button onClick={() => setTab("sdk")} className={`rounded-lg px-4 py-1.5 text-xs sm:text-sm font-bold transition-all duration-200 ${tab === "sdk" ? (isDark ? "bg-white/10 text-white" : "bg-black/5 text-slate-900") : "opacity-60"}`}>
            TypeScript Production SDK
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {tab === "rest" ? (
            <div className={`${cardClass} p-6`}>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: isDark ? "#60a5fa" : "#3b82f6" }}>
                <Code2 className="h-3.5 w-3.5" /> Core Request Model
              </div>
              <h3 className="text-lg font-bold mb-4" style={{ color: headColor }}>Generate Blueprint Papers</h3>
              <CodeBlock code={CURL_QUICKSTART} lang="bash" isDark={isDark} />
            </div>
          ) : (
            <div className={`${cardClass} p-6 space-y-4`}>
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: isDark ? "#60a5fa" : "#3b82f6" }}>
                  <Server className="h-3.5 w-3.5" /> Module Dependencies
                </div>
                <h3 className="text-lg font-bold mb-3" style={{ color: headColor }}>SDK Package Distribution</h3>
                <CodeBlock code={SDK_INSTALL} lang="bash" isDark={isDark} />
              </div>
              <CodeBlock code={SDK_TS} lang="ts" isDark={isDark} />
            </div>
          )}

          {/* Secure Key Management Card */}
          <div className={`${cardClass} p-6 h-full flex flex-col justify-between`}>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: isDark ? "#60a5fa" : "#3b82f6" }}>
                <ShieldCheck className="h-3.5 w-3.5" /> Security Vault
              </div>
              <h3 className="text-lg font-bold mb-4" style={{ color: headColor }}>Client Key Distribution</h3>
              <ApiKeyBox isDark={isDark} />
            </div>
            <ul className="mt-6 space-y-2.5 text-sm font-medium" style={{ color: mutedColor }}>
              <li className="flex gap-2 items-start"><Check className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" /> Inject keys explicitly into server configurations.</li>
              <li className="flex gap-2 items-start"><Check className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" /> Restrict deployment pipelines from checking in parameters.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Endpoint Playground Core Showcase */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionTitle icon={<BookOpen className="h-5 w-5" />} title="Endpoint Showcase" subtitle="Inspect full network payload blocks for key platform controllers." isDark={isDark} />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Post Generation Route */}
          <div className={`${cardClass} flex flex-col`}>
            <div className="px-6 py-3.5 border-b font-mono text-sm flex items-center justify-between" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }}>
              <div>
                <span className="rounded font-bold px-2 py-0.5 text-xs text-white" style={{ background: BRAND_GRADIENT }}>POST</span>
                <span className="ml-2.5 font-semibold" style={{ color: headColor }}>/v1/tests/generate</span>
              </div>
            </div>
            <div className="p-6 space-y-4 flex-grow flex flex-col justify-between">
              <p className="text-sm font-medium" style={{ color: mutedColor }}>Compiles complete deterministic test structures mapped explicitly against custom blueprint ratios.</p>
              <div className="grid gap-4 md:grid-cols-2 max-w-full overflow-hidden">
                <CodeBlock code={ENDPOINT_GENERATE_REQ} lang="http" isDark={isDark} />
                <CodeBlock code={ENDPOINT_GENERATE_RES} lang="json" isDark={isDark} />
              </div>
            </div>
          </div>

          {/* Post Contest Host Route */}
          <div className={`${cardClass} flex flex-col`}>
            <div className="px-6 py-3.5 border-b font-mono text-sm flex items-center justify-between" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }}>
              <div>
                <span className="rounded font-bold px-2 py-0.5 text-xs text-white" style={{ background: BRAND_GRADIENT }}>POST</span>
                <span className="ml-2.5 font-semibold" style={{ color: headColor }}>/v1/contests</span>
              </div>
            </div>
            <div className="p-6 space-y-4 flex-grow flex flex-col justify-between">
              <p className="text-sm font-medium" style={{ color: mutedColor }}>Registers and structures automated live online test environments with explicit proctor validation tokens.</p>
              <div className="grid gap-4 md:grid-cols-2 max-w-full overflow-hidden">
                <CodeBlock code={ENDPOINT_CONTEST_REQ} lang="http" isDark={isDark} />
                <CodeBlock code={ENDPOINT_CONTEST_RES} lang="json" isDark={isDark} />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Parameter Micro Pills Grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EndpointPill method="GET" path="/v1/questions/search" desc="Search across systemic outcome banks." isDark={isDark} />
          <EndpointPill method="GET" path="/v1/tests/{id}" desc="Resolve standalone documents by primary ID keys." isDark={isDark} />
          <EndpointPill method="POST" path="/v1/tests/{id}/export" desc="Re-compile asset builds directly to PDF / native docx layouts." isDark={isDark} />
          <EndpointPill method="GET" path="/v1/contests/{id}/results" desc="Fetch student completion matrices." isDark={isDark} />
          <EndpointPill method="POST" path="/v1/contests/{id}/invite" desc="Queue communication hooks out to participant list registries." isDark={isDark} />
          <EndpointPill method="DELETE" path="/v1/keys/{id}" desc="Invalidate and cycle authorization credentials instantly." isDark={isDark} />
        </div>
      </section>

      {/* Webhooks Engine Framework */}
      <section className="mx-auto max-w-6xl px-6 py-4">
        <SectionTitle icon={<WebhookIcon className="h-5 w-5" />} title="Webhook Dispatch Logs" subtitle="Listen to server-sent events for automated platform routing." isDark={isDark} />

        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <div className={`${cardClass} p-6`}>
            <h3 className="text-lg font-bold mb-4" style={{ color: headColor }}>Registered Event Streams</h3>
            <ul className="space-y-3 text-sm font-semibold" style={{ color: headColor }}>
              <li className="flex items-center gap-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded border border-blue-500/20 bg-blue-500/5 text-blue-400">test.ready</span> Document generation resolved</li>
              <li className="flex items-center gap-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded border border-blue-500/20 bg-blue-500/5 text-blue-400">contest.started</span> Live classroom instance initiated</li>
              <li className="flex items-center gap-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded border border-blue-500/20 bg-blue-500/5 text-blue-400">contest.finished</span> Session evaluations locked and stored</li>
              <li className="flex items-center gap-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded border border-rose-500/20 bg-rose-500/5 text-rose-400">contest.proctor.alert</span> Integrity engine boundary check failure triggered</li>
            </ul>
          </div>

          <div className={`${cardClass} p-6`}>
            <h3 className="text-lg font-bold mb-3" style={{ color: headColor }}>Payload Model Schema</h3>
            <CodeBlock code={WEBHOOK_PAYLOAD} lang="json" isDark={isDark} />
          </div>
        </div>
      </section>

      {/* Architectural Boundaries, Error and Rate Limits */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <div className={`${cardClass} p-6`}>
            <div className="flex items-center gap-2 text-sm font-bold mb-4" style={{ color: isDark ? "#60a5fa" : "#3b82f6" }}>
              <Zap className="h-4 w-4" /> Operational Threshold Boundaries
            </div>
            <ul className="space-y-3 text-sm font-medium" style={{ color: mutedColor }}>
              <li className="flex justify-between border-b pb-1.5 border-dashed border-slate-500/20"><span className="font-mono text-xs text-slate-400">/tests/generate</span> <span>60 req/min</span></li>
              <li className="flex justify-between border-b pb-1.5 border-dashed border-slate-500/20"><span className="font-mono text-xs text-slate-400">/contests</span> <span>20 req/min</span></li>
            </ul>
          </div>

          <div className={`${cardClass} p-6`}>
            <div className="flex items-center gap-2 text-sm font-bold mb-4" style={{ color: isDark ? "#60a5fa" : "#3b82f6" }}>
              <AlertTriangle className="h-4 w-4" /> Fault Codes Dictionary
            </div>
            <ul className="space-y-2 text-xs font-mono" style={{ color: mutedColor }}>
              <li><Chip intent="warning">400</Chip> Bad Parameter Arguments</li>
              <li><Chip intent="warning">401</Chip> Key Missing or Unauthorized</li>
              <li><Chip intent="warning">429</Chip> Rate Limit Boundaries Triggered</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Bottom Global Call to Action */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="p-0.5 rounded-2xl shadow-xl overflow-hidden" style={{ background: BRAND_GRADIENT }}>
          <div className="rounded-2xl px-8 py-10 relative flex flex-col sm:flex-row items-center justify-between gap-6" style={{ background: isDark ? "rgba(10,14,24,0.95)" : "rgba(255,255,255,0.95)", backdropFilter: "blur(24px)" }}>
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight" style={{ color: headColor }}>Ready to launch?</h3>
              <p className="mt-1.5 text-sm font-medium max-w-xl" style={{ color: mutedColor }}>Setup your localized environment parameters, generate tests, and deploy custom webhooks instantly.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button className="btn-blk px-5 py-3 text-sm font-semibold flex items-center gap-2 transition-transform duration-150 active:scale-95">
                Get production keys <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   SUB-COMPONENT MODULE WRAPPERS
   ────────────────────────────────────────────────────────────── */
function ApiKeyBox({ isDark }: { isDark: boolean }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const key = show ? "sk_live_51Hh...YourRealKey" : "sk_live_••••••••••••••••••••••";
  
  const copy = async () => {
    try {
      await navigator.clipboard.writeText("sk_live_51Hh...YourRealKey");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className={`flex items-center justify-between rounded-xl border p-3.5 ${isDark ? "bg-slate-950/40 border-white/5" : "bg-slate-50 border-black/5"}`}>
      <div className="font-mono text-xs sm:text-sm tracking-tight overflow-hidden text-ellipsis" style={{ color: isDark ? "#f1f5f9" : "#111111" }}>{key}</div>
      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
        <button onClick={() => setShow((s) => !s)} className="btn-glass px-3 py-1.5 text-xs" style={{ color: isDark ? "#e2e8f0" : "#334155" }}>{show ? "Hide" : "Show"}</button>
        <button onClick={copy} className="btn-blk px-3 py-1.5 text-xs flex items-center gap-1">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function EndpointPill({ method, path, desc, isDark }: { method: "GET" | "POST" | "DELETE"; path: string; desc: string; isDark: boolean }) {
  const map = {
    GET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
  };
  return (
    <div className={`ag-card ${isDark ? "ag-card-dark" : "ag-card-light"} p-4 flex flex-col justify-between`}>
      <div className="mb-2 flex items-center gap-2 max-w-full overflow-hidden">
        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${map[method]}`}>{method}</span>
        <span className="font-mono text-xs font-semibold truncate" style={{ color: isDark ? "#f1f5f9" : "#111111" }}>{path}</span>
      </div>
      <p className="text-xs font-medium leading-relaxed" style={{ color: isDark ? "#8a9bb0" : "#5f6368" }}>{desc}</p>
    </div>
  );
}