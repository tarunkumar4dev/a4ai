import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  LifeBuoy, 
  Search, 
  MessageCircleQuestion, 
  ChevronDown,
  Wrench
} from "lucide-react";

const FAQS = [
  { 
    q: "I signed in with Google but the dashboard is blank.", 
    a: "Ensure a profile row exists in `profiles`. Our auth callback and `onAuthStateChange` upsert will auto-create it—refresh once after first login.",
    tag: "Auth"
  },
  { 
    q: "Edge Function returns 'No test content returned'.", 
    a: "Check API keys, model responses, and that the function returns a non-empty string before ranking. Log errors in the function and view Vercel/Supabase logs.",
    tag: "API"
  },
  { 
    q: "Why does PrivateRoute block me after OAuth?", 
    a: "Your `useUserProfile` must wait for session + profile. Add a loading state; redirect only after the profile fetch resolves (even if empty, handle insert).",
    tag: "Routing"
  },
];

export default function HelpCenter() {
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0); // First item open by default

  const headerGradient = useMemo(
    () =>
      "bg-[radial-gradient(1200px_600px_at_50%_-10%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(900px_500px_at_80%_0%,hsl(var(--primary)/0.12),transparent_60%)]",
    []
  );

  const filteredFaqs = FAQS.filter(f => 
    f.q.toLowerCase().includes(query.toLowerCase()) || 
    f.a.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative min-h-screen pb-20">
      {/* Animated background */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, -10, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 14, ease: "easeInOut" }}
      >
        <div className={`absolute inset-0 ${headerGradient}`} />
      </motion.div>

      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-4 py-14 sm:py-18 text-center flex flex-col items-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm backdrop-blur mb-6">
            <LifeBuoy className="h-4 w-4 text-primary" />
            <span className="font-medium">Support & Troubleshooting</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            How can we help?
          </h1>
          <p className="mt-4 mx-auto max-w-xl text-lg text-muted-foreground">
            Search our knowledge base for quick fixes, common errors, and best practices.
          </p>

          {/* Search */}
          <div className="mt-8 relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search for answers..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-14 pl-12 rounded-full bg-background/80 backdrop-blur border-muted-foreground/20 text-base shadow-sm focus-visible:ring-primary/20"
            />
          </div>
        </motion.div>
      </section>

      {/* FAQs List */}
      <section className="mx-auto max-w-3xl px-4">
        <motion.div 
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`overflow-hidden rounded-xl border transition-colors ${isOpen ? "bg-muted/30 border-primary/20 shadow-sm" : "bg-background/50 border-muted-foreground/10 hover:border-muted-foreground/30 backdrop-blur-sm"}`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircleQuestion className={`h-5 w-5 flex-shrink-0 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-medium text-[15px] pr-4">{faq.q}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="secondary" className="hidden sm:inline-flex bg-background/50">{faq.tag}</Badge>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    </motion.div>
                  </div>
                </button>
                
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                      <div className="px-5 pb-5 pt-1 pl-13 ml-8 text-muted-foreground leading-relaxed text-sm border-t border-transparent">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          
          {filteredFaqs.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Wrench className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No answers found</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">We couldn't find anything matching "{query}". Try adjusting your search.</p>
            </div>
          )}
        </motion.div>
      </section>
    </div>
  );
}