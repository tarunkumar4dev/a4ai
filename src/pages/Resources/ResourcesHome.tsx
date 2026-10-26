// src/pages/resources/ResourcesHome.tsx — the Resources landing: one card per
// section that has content, with a simple client-side search.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, HelpCircle, LifeBuoy, Newspaper, Search, type LucideIcon } from "lucide-react";
import ResourcesLayout from "./ResourcesLayout";

const CARDS: { to: string; title: string; desc: string; Icon: LucideIcon; tags: string[]; bg: string; accent: string }[] = [
  {
    to: "/docs",
    title: "Documentation",
    desc: "How to set up a4ai and use the test generator.",
    Icon: BookOpen,
    tags: ["setup", "guide", "test generator", "docs"],
    bg: "linear-gradient(135deg, #FFEDEF 0%, #FFD9DE 100%)",
    accent: "#D93F4D",
  },
  {
    to: "/help",
    title: "Help Center",
    desc: "Troubleshooting and how-tos for common issues.",
    Icon: LifeBuoy,
    tags: ["help", "errors", "troubleshoot", "account", "login"],
    bg: "linear-gradient(135deg, #E4F8F3 0%, #C9EFE4 100%)",
    accent: "#047857",
  },
  {
    to: "/faq",
    title: "FAQ",
    desc: "Quick answers about plans, classes, exports and accounts.",
    Icon: HelpCircle,
    tags: ["faq", "questions", "pricing", "plans"],
    bg: "linear-gradient(135deg, #EFEDFF 0%, #DCD7FF 100%)",
    accent: "#5B4BC4",
  },
  {
    to: "/blog",
    title: "Blog",
    desc: "Product updates and notes from the team.",
    Icon: Newspaper,
    tags: ["updates", "release", "news", "blog"],
    bg: "linear-gradient(135deg, #FFF7D9 0%, #FFE9AD 100%)",
    accent: "#9A6B00",
  },
];

export default function ResourcesHome() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return CARDS;
    return CARDS.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        c.desc.toLowerCase().includes(needle) ||
        c.tags.some((t) => t.includes(needle)),
    );
  }, [q]);

  return (
    <ResourcesLayout title="Resources" subtitle="Guides, help and updates for teachers and institutes using a4ai.">
      <div className="relative mb-8 w-full sm:max-w-md">
        <label htmlFor="resources-search" className="sr-only">
          Search resources
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" aria-hidden="true" />
        <input
          id="resources-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search docs, help, FAQ, blog…"
          className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-4 text-[15px] text-[#1B1B1B] outline-none focus:border-[#111111] focus-visible:ring-2 focus-visible:ring-[#F95D6A]"
        />
      </div>

      {filtered.length > 0 ? (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                className="flex h-full flex-col rounded-[24px] border border-black/[0.04] p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
                style={{ backgroundImage: c.bg }}
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/80" style={{ color: c.accent }}>
                  <c.Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-halenoir text-xl font-bold text-[#1B1B1B]">{c.title}</h2>
                <p className="mt-2 flex-grow text-[15px] leading-relaxed text-[#374151]">{c.desc}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-bold text-[#111111]">
                  Open {c.title} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[24px] border border-dashed border-[#D1D5DB] p-10 text-center" role="status">
          <p className="text-[15px] text-[#5D6570]">
            No results for <span className="font-semibold text-[#1B1B1B]">“{q}”</span>.
          </p>
          <button
            type="button"
            onClick={() => setQ("")}
            className="mt-3 min-h-[44px] rounded-md text-[15px] font-bold text-[#111111] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
          >
            Clear search
          </button>
        </div>
      )}
    </ResourcesLayout>
  );
}
