// src/pages/HelpCenter.tsx
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { LifeBuoy, Search, MessageCircleQuestion, ChevronDown } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";

const FAQS = [
  { q: "I signed in with Google but the dashboard is blank.", a: "Ensure a profile row exists in `profiles`. Our auth callback and `onAuthStateChange` upsert will auto-create it—refresh once after first login.", tag: "Auth" },
  { q: "Edge Function returns 'No test content returned'.", a: "Check API keys, model responses, and that the function returns a non-empty string before ranking. Log errors in the function and view Vercel/Supabase logs.", tag: "API" },
  { q: "Why does PrivateRoute block me after OAuth?", a: "Your `useUserProfile` must wait for session + profile. Add a loading state; redirect only after the profile fetch resolves (even if empty, handle insert).", tag: "Routing" },
];

export default function HelpCenter() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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

  const filteredFaqs = FAQS.filter(f => 
    f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase())
  );

  const headColor = isDark ? "#f1f5f9" : "#111111";
  const mutedColor = isDark ? "#8a9bb0" : "#5f6368";

  return (
    <div className="lp min-h-screen relative overflow-hidden pt-24 pb-20" style={{ background: isDark ? "#07090f" : "#ffffff" }}>
      <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
        <nav className={`mx-auto max-w-7xl rounded-2xl border backdrop-blur-xl ${isDark ? "bg-slate-900/10 border-white/10" : "bg-white/10 border-black/5"}`}
          style={{ boxShadow: isDark ? "0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" : "0 8px 32px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Link to="/" className="group flex items-center gap-2.5 text-lg font-semibold tracking-tight">
              <img src="/ICON.ico" alt="Logo" className="h-6 w-6 object-contain" />
              <span style={{ color: headColor }}>a4ai <span className="text-xs font-normal opacity-60 ml-1">Help</span></span>
            </Link>
            <Link to="/resources" className="text-sm font-semibold" style={{ color: mutedColor }}>Resources</Link>
          </div>
        </nav>
      </div>

      <section className="mx-auto max-w-4xl px-6 pt-14 pb-12 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur mb-6"
          style={{ background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)", color: isDark ? "#60a5fa" : "#3b82f6", borderColor: isDark ? "rgba(59,130,246,0.22)" : "rgba(59,130,246,0.16)" }}>
          <LifeBuoy className="h-3.5 w-3.5" /> Support & Troubleshooting
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          <span className="running-gradient-text">How can we help?</span>
        </h1>
        
        <div className="mt-8 relative w-full max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search for answers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full pl-11 pr-4 bg-transparent border rounded-full outline-none text-sm transition-all duration-200"
            style={{ borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)", color: isDark ? "#ffffff" : "#111111" }}
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6">
        <div className="space-y-4">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className={`ag-card ${isDark ? "ag-card-dark" : "ag-card-light"} overflow-hidden transition-all duration-200`}
                style={{ borderColor: isOpen ? "rgba(59,130,246,0.3)" : "" }}>
                <button onClick={() => setOpenIndex(isOpen ? null : idx)} className="w-full flex items-center justify-between p-5 text-left outline-none">
                  <div className="flex items-center gap-3.5">
                    <MessageCircleQuestion className="h-5 w-5 flex-shrink-0" style={{ color: isOpen ? (isDark ? "#60a5fa" : "#3b82f6") : mutedColor }} />
                    <span className="font-semibold text-sm sm:text-base" style={{ color: headColor }}>{faq.q}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "none", color: mutedColor }} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <div className="px-5 pb-5 pl-14 text-sm leading-relaxed border-t border-transparent" style={{ color: mutedColor }}>
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}