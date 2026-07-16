// src/pages/HelpCenter.tsx
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { LifeBuoy, Search, MessageCircleQuestion, ChevronDown } from "lucide-react";

const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";

const FAQS = [
  { q: "I signed in with Google but the dashboard is blank.", a: "Ensure a profile row exists in `profiles`. Our auth callback and `onAuthStateChange` upsert will auto-create it—refresh once after first login.", tag: "Auth" },
  { q: "Edge Function returns 'No test content returned'.", a: "Check API keys, model responses, and that the function returns a non-empty string before ranking. Log errors in the function and view Vercel/Supabase logs.", tag: "API" },
  { q: "Why does PrivateRoute block me after OAuth?", a: "Your `useUserProfile` must wait for session + profile. Add a loading state; redirect only after the profile fetch resolves (even if empty, handle insert).", tag: "Routing" },
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

export default function HelpCenter() {
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = FAQS.filter(f => 
    f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="lp min-h-screen relative overflow-hidden pt-24 pb-20 bg-white">
      <GlobalStyles />
      <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
        <nav className="mx-auto max-w-7xl rounded-2xl border backdrop-blur-xl force-light-dock">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Link to="/" className="group flex items-center gap-2.5 text-lg font-semibold tracking-tight">
              <img src="/ICON.ico" alt="Logo" className="h-6 w-6 object-contain" />
              <span style={{ color: "#111111" }}>a4ai <span className="text-xs font-normal opacity-60 ml-1">Help</span></span>
            </Link>
            <Link to="/resources" className="text-sm font-semibold" style={{ color: "#5f6368" }}>Resources</Link>
          </div>
        </nav>
      </div>

      <section className="mx-auto max-w-4xl px-6 pt-14 pb-12 text-center flex flex-col items-center bg-white">
        <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur mb-6"
          style={{ background: "rgba(59,130,246,0.08)", color: "#3b82f6", borderColor: "rgba(59,130,246,0.16)" }}>
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
            className="h-12 w-full pl-11 pr-4 outline-none text-sm transition-all duration-200 search-box-forced rounded-full"
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 bg-white">
        <div className="space-y-4 bg-white">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="ag-card overflow-hidden transition-all duration-200 bg-white"
                style={{ borderColor: isOpen ? "rgba(59,130,246,0.35)" : "" }}>
                <button onClick={() => setOpenIndex(isOpen ? null : idx)} className="w-full flex items-center justify-between p-5 text-left outline-none bg-transparent">
                  <div className="flex items-center gap-3.5 bg-transparent">
                    <MessageCircleQuestion className="h-5 w-5 flex-shrink-0" style={{ color: isOpen ? "#3b82f6" : "#5f6368" }} />
                    <span className="font-semibold text-sm sm:text-base" style={{ color: "#111111" }}>{faq.q}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "none", color: "#5f6368" }} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <div className="px-5 pb-5 pl-14 text-sm leading-relaxed border-t border-transparent" style={{ color: "#5f6368" }}>
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