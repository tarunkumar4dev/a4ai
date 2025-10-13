import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, GraduationCap, Award, Phone, Mail, MapPin, ExternalLink, ShieldCheck, Info, ListChecks } from "lucide-react";

// ------------------------------------------------------------
// Chankya Institute Public Page (subdomain site)
// - Drop-in React component for `[subdomain].a4ai.in`
// - Tailwind + Framer Motion, clean and responsive
// - Replace `mockFetchInstitute()` with Supabase call later
// ------------------------------------------------------------

// Types
interface Institute {
  id: string;
  name: string;
  slug: string; // subdomain (e.g., "chankya")
  logoUrl?: string;
  motto?: string;
  about?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  website?: string;
  achievements?: Array<{ title: string; description?: string; year?: string }>; 
  notices?: Array<{ id: string; title: string; date?: string; href?: string }>; 
  makeMarksPublic?: boolean; // admin-controlled toggle
}

// Helpers
const EASE: [number, number, number, number] = [0.18, 0.67, 0.27, 0.94];

function getSubdomain(win: Window): string | null {
  const host = win.location.host; // e.g., chankya.a4ai.in or localhost:5173
  // In local dev, allow ?sub=chankya override
  const url = new URL(win.location.href);
  const override = url.searchParams.get("sub");
  if (override) return override.toLowerCase();

  const parts = host.split(".");
  // localhost or preview: no subdomain
  if (host.includes("localhost") || parts.length < 3) return null;
  // subdomain.a4ai.in ⇒ first part is subdomain
  return parts[0].toLowerCase();
}

// Mock data loader (replace with Supabase)
async function mockFetchInstitute(slug: string): Promise<Institute | null> {
  // Simulate network
  await new Promise((r) => setTimeout(r, 250));
  if (slug !== "chankya") return null;
  return {
    id: "inst_001",
    name: "Chankya Institute",
    slug: "chankya",
    logoUrl: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?q=80&w=2400&auto=format&fit=crop",
    motto: "Discipline. Curiosity. Excellence.",
    about:
      "Chankya Institute is committed to shaping future-ready learners with a strong foundation in STEM and humanities. We blend rigorous academics with character-building and modern pedagogy.",
    address: "Sector 7, Dwarka",
    city: "New Delhi",
    state: "Delhi",
    phone: "+91-98XX-XXXX45",
    email: "contact@chankya.edu",
    website: "https://chankya.a4ai.in",
    achievements: [
      { title: "100+ Selections in JEE/NEET (2024)", year: "2024" },
      { title: "State Topper – Class 12 Physics", year: "2023" },
      { title: "National Robotics Finalists", year: "2022" },
    ],
    notices: [
      { id: "n1", title: "Midterm schedule published (Classes 9–12)", date: "Oct 12, 2025", href: "#" },
      { id: "n2", title: "Inter-school Coding Contest – Register now", date: "Oct 20, 2025", href: "#" },
      { id: "n3", title: "Parent–Teacher Meeting (Oct 26)", date: "Oct 26, 2025", href: "#" },
    ],
    makeMarksPublic: false,
  };
}

// Badge
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs tracking-wide">
      {children}
    </span>
  );
}

// Section Wrapper
function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="relative py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm md:text-base text-black/60 dark:text-white/60 mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export default function ChankyaInstitutePublic() {
  const [inst, setInst] = useState<Institute | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    const s = getSubdomain(window);
    setSlug(s);
    const load = async () => {
      if (!s) {
        setLoading(false);
        setNotFound(true);
        return;
      }
      const data = await mockFetchInstitute(s);
      if (!data) setNotFound(true);
      setInst(data);
      setLoading(false);
    };
    load();
  }, []);

  const title = useMemo(() => inst?.name ?? slug ?? "Institute", [inst, slug]);

  if (loading) {
    return (
      <div className="min-h-[70vh] grid place-items-center">
        <div className="text-center">
          <div className="animate-pulse text-lg">Loading {slug ?? "institute"}…</div>
        </div>
      </div>
    );
  }

  if (notFound || !inst) {
    return (
      <div className="min-h-[70vh] grid place-items-center px-4 text-center">
        <div className="max-w-lg">
          <h1 className="text-2xl md:text-3xl font-semibold">Institute not found</h1>
          <p className="text-black/60 dark:text-white/60 mt-2">
            This subdomain isn’t registered yet. If you are an institute owner, you can claim your free page in 2 minutes.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link to="https://a4ai.in/onboard?role=institute" className="rounded-xl px-4 py-2 bg-black text-white hover:opacity-90">
              Create my free page
            </Link>
            <Link to="https://a4ai.in" className="rounded-xl px-4 py-2 border border-black/10 dark:border-white/10 hover:bg-black/5">
              Go to a4ai.in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(60%_60%_at_20%_10%,rgba(99,102,241,.08),transparent),radial-gradient(50%_50%_at_80%_20%,rgba(16,185,129,.08),transparent)]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black/30 border-b border-black/10 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {inst.logoUrl && (
              <img src={inst.logoUrl} alt={`${inst.name} logo`} className="h-8 w-8 rounded-lg object-cover" />
            )}
            <span className="font-semibold tracking-tight">{inst.name}</span>
            <Pill>Powered by a4ai</Pill>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#about" className="hover:opacity-80">About</a>
            <a href="#achievements" className="hover:opacity-80">Achievements</a>
            <a href="#notices" className="hover:opacity-80">Notices</a>
            <a href="#contact" className="hover:opacity-80">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5">Login</Link>
            <Link to="/admin" className="px-3 py-1.5 rounded-lg bg-black text-white hover:opacity-90">Admin</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-10 md:pt-16 pb-10 md:pb-14">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs">
              <ShieldCheck className="h-4 w-4" /> Official Institute Page
            </div>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight mt-4">
              {inst.name}
            </h1>
            {inst.motto && <p className="text-black/70 dark:text-white/70 mt-3 md:text-lg">{inst.motto}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#notices" className="rounded-xl px-4 py-2 bg-black text-white hover:opacity-90">View Notices</a>
              {inst.makeMarksPublic ? (
                <a href="#results" className="rounded-xl px-4 py-2 border border-black/10 dark:border-white/10 hover:bg-black/5">Results</a>
              ) : (
                <button disabled className="rounded-xl px-4 py-2 border border-black/10 text-black/50 dark:text-white/40 cursor-not-allowed">Results (Private)</button>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE, delay: 0.05 } }} className="relative">
            <div className="aspect-video rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/10 dark:ring-white/10">
              <img src={inst.logoUrl} alt="Campus" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-3 -right-3 bg-white dark:bg-black rounded-xl shadow px-3 py-2 text-xs border border-black/10 dark:border-white/10 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Public info managed by institute admin
            </div>
          </motion.div>
        </div>
      </section>

      {/* About */}
      <Section id="about" title="About the Institute" subtitle="Overview & mission">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <p className="leading-7 text-black/80 dark:text-white/80">
              {inst.about}
            </p>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex gap-3">
                <Building2 className="h-5 w-5 mt-1" />
                <div>
                  <div className="text-sm font-medium">Address</div>
                  <div className="text-sm text-black/70 dark:text-white/70">{inst.address}, {inst.city}, {inst.state}</div>
                </div>
              </div>
              <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex gap-3">
                <Phone className="h-5 w-5 mt-1" />
                <div>
                  <div className="text-sm font-medium">Phone</div>
                  <div className="text-sm text-black/70 dark:text-white/70">{inst.phone}</div>
                </div>
              </div>
              <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex gap-3">
                <Mail className="h-5 w-5 mt-1" />
                <div>
                  <div className="text-sm font-medium">Email</div>
                  <div className="text-sm text-black/70 dark:text-white/70">{inst.email}</div>
                </div>
              </div>
              <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex gap-3">
                <MapPin className="h-5 w-5 mt-1" />
                <div>
                  <div className="text-sm font-medium">Website</div>
                  <a href={inst.website ?? "#"} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                    {inst.website ?? "—"} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 dark:border-white/10 p-5 bg-white/60 dark:bg-white/5 backdrop-blur">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Quick Links
            </div>
            <ul className="space-y-2 text-sm">
              <li><a href="#notices" className="hover:underline">Latest Notices</a></li>
              <li><a href="#achievements" className="hover:underline">Achievements</a></li>
              <li><Link to="/student" className="hover:underline">Student Login</Link></li>
              <li><Link to="/teacher" className="hover:underline">Teacher Login</Link></li>
              <li><Link to="/admin" className="hover:underline">Admin Panel</Link></li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Achievements */}
      <Section id="achievements" title="Achievements" subtitle="Recent highlights">
        <div className="grid md:grid-cols-3 gap-4">
          {inst.achievements?.map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, ease: EASE, delay: i * 0.05 }} className="rounded-xl border border-black/10 dark:border-white/10 p-4">
              <div className="flex items-center gap-2 mb-1"><Award className="h-4 w-4" /><span className="text-sm font-medium">{a.title}</span></div>
              <div className="text-xs text-black/60 dark:text-white/60">{a.year ?? "—"}</div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Notices */}
      <Section id="notices" title="Notices" subtitle="Announcements & circulars">
        <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 text-xs font-medium bg-black/[.03] dark:bg-white/5">
            <div className="col-span-8 md:col-span-9 px-3 py-2">Title</div>
            <div className="col-span-4 md:col-span-3 px-3 py-2">Date</div>
          </div>
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {(inst.notices ?? []).map((n) => (
              <li key={n.id} className="grid grid-cols-12 text-sm">
                <a className="col-span-8 md:col-span-9 px-3 py-3 hover:bg-black/5 dark:hover:bg-white/5" href={n.href ?? "#"}>{n.title}</a>
                <div className="col-span-4 md:col-span-3 px-3 py-3 text-black/60 dark:text-white/60">{n.date ?? "—"}</div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Optional Results */}
      <Section id="results" title="Results" subtitle={inst.makeMarksPublic ? "Published mark sheets (as enabled by admin)" : "Admin has kept results private"}>
        {inst.makeMarksPublic ? (
          <div className="rounded-2xl border border-black/10 dark:border-white/10 p-6 text-sm">
            <p>
              Public results are enabled. You can plug your Supabase view/API here to list class-wise toppers, PDFs, or searchable results.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/10 dark:border-white/10 p-6 text-sm">
            <p>Results are private. Institute admin can enable public boards from the dashboard.</p>
          </div>
        )}
      </Section>

      {/* Contact */}
      <Section id="contact" title="Contact" subtitle="Reach out to the institute">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex gap-3">
            <Phone className="h-5 w-5 mt-1" />
            <div>
              <div className="text-sm font-medium">Phone</div>
              <div className="text-sm text-black/70 dark:text-white/70">{inst.phone}</div>
            </div>
          </div>
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex gap-3">
            <Mail className="h-5 w-5 mt-1" />
            <div>
              <div className="text-sm font-medium">Email</div>
              <div className="text-sm text-black/70 dark:text-white/70">{inst.email}</div>
            </div>
          </div>
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex gap-3">
            <MapPin className="h-5 w-5 mt-1" />
            <div>
              <div className="text-sm font-medium">Address</div>
              <div className="text-sm text-black/70 dark:text-white/70">{inst.address}, {inst.city}</div>
            </div>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <footer className="py-10 border-t border-black/10 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span>{inst.name}</span>
          </div>
          <div className="text-black/60 dark:text-white/60">© {new Date().getFullYear()} – Powered by a4ai</div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/terms" className="hover:underline">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
