import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Search, 
  Server, 
  Rocket, 
  ArrowRight, 
  FileText,
  TerminalSquare
} from "lucide-react";

const SECTIONS = [
  {
    title: "Getting Started",
    icon: Rocket,
    description: "Core concepts and setup guides.",
    items: [
      { t: "What is a4ai?", to: "#" },
      { t: "Quickstart (5 min)", to: "#" },
      { t: "Project setup (React + TS)", to: "#" },
    ],
  },
  {
    title: "Backend & APIs",
    icon: Server,
    description: "Authentication and serverless integrations.",
    items: [
      { t: "Supabase Auth (email + Google OAuth)", to: "#" },
      { t: "Edge Functions for multi-LLM generation", to: "#" },
      { t: "Keyword scoring & best-response selection", to: "#" },
    ],
  },
  {
    title: "Production",
    icon: TerminalSquare,
    description: "Deployment, monitoring, and scaling.",
    items: [
      { t: "Vercel deployment checklist", to: "#" },
      { t: "Env vars & secrets", to: "#" },
      { t: "Monitoring & logs", to: "#" },
    ],
  },
];

export default function Documentation() {
  const [query, setQuery] = useState("");

  const headerGradient = useMemo(
    () =>
      "bg-[radial-gradient(1200px_600px_at_50%_-10%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(900px_500px_at_80%_0%,hsl(var(--primary)/0.12),transparent_60%)]",
    []
  );

  const filteredSections = SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.t.toLowerCase().includes(query.toLowerCase()) ||
      section.title.toLowerCase().includes(query.toLowerCase())
    )
  })).filter(section => section.items.length > 0);

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
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-18">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm backdrop-blur mb-6">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-medium">a4ai Documentation</span>
            <Badge variant="secondary" className="ml-1">v2.0</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Build with confidence
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Official guides, API notes, and architectural patterns for integrating a4ai into your platform.
          </p>

          {/* Search */}
          <div className="mt-8 relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search docs, guides, or keywords…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 pl-10 bg-background/50 backdrop-blur-sm border-muted-foreground/20 text-base"
            />
          </div>
        </motion.div>
      </section>

      {/* Content Grid */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
          {filteredSections.map((s, idx) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 * idx, ease: "easeOut" }}
            >
              <Card className="h-full bg-background/60 backdrop-blur border-muted-foreground/10 hover:border-primary/30 transition-colors">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {s.items.map((i) => (
                      <li key={i.t} className="group">
                        <Link 
                          to={i.to} 
                          className="flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                        >
                          <FileText className="mr-2 h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                          {i.t}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          
          {filteredSections.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No documentation found for "{query}". Try another search term.
            </div>
          )}
        </div>

        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.4 }}
          className="mt-16 flex items-center justify-between rounded-xl border bg-muted/40 p-6"
        >
          <div>
            <h3 className="font-semibold tracking-tight">Need immediate help?</h3>
            <p className="text-sm text-muted-foreground mt-1">Check out our troubleshooting guides.</p>
          </div>
          <Link to="/help" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2">
            Visit Help Center <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>
    </div>
  );
}