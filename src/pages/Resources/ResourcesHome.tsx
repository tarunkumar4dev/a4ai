// src/pages/resources/ResourcesHome.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ResourcesLayout from "./ResourcesLayout";
import { BookOpen, LifeBuoy, Newspaper, Briefcase, Search } from "lucide-react";

const hx = {
  fontFamily:
    "'Halenoir Expanded DemiBold','Halenoir Expanded','Halenoir','Inter',system-ui,sans-serif",
  fontWeight: 600,
} as const;

const cards = [
  {
    to: "/docs",
    title: "Documentation",
    desc: "Install, configure, and integrate the a4ai test generator.",
    Icon: BookOpen,
    tags: ["setup", "api", "sdk", "integration"],
  },
  {
    to: "/help",
    title: "Help Center",
    desc: "FAQs, troubleshooting, and how-tos for common issues.",
    Icon: LifeBuoy,
    tags: ["faq", "errors", "troubleshoot", "account"],
  },
  {
    to: "/blog",
    title: "Blog",
    desc: "Product updates, tips, and behind-the-scenes notes.",
    Icon: Newspaper,
    tags: ["updates", "release", "tips", "news"],
  },
  {
    to: "/case-studies",
    title: "Case Studies",
    desc: "How schools and teachers use a4ai in the real world.",
    Icon: Briefcase,
    tags: ["schools", "teachers", "impact", "stories"],
  },
];

export default function ResourcesHome() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cards;
    return cards.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        c.desc.toLowerCase().includes(needle) ||
        c.tags?.some((t) => t.toLowerCase().includes(needle))
    );
  }, [q]);

  return (
    <ResourcesLayout
      title="Resources"
      subtitle="Everything you need to build, learn, and succeed with a4ai."
    >
      {/* Search bar */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <label htmlFor="resource-search" className="sr-only">
            Search resources
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <Search className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
          </div>
          <input
            id="resource-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search docs, help, blog, case studies…"
            className="
              w-full rounded-xl border bg-white/85 pl-9 pr-3 py-2 text-sm
              outline-none ring-0 transition
              border-slate-200 placeholder-slate-500
              focus:border-slate-300 focus:ring-2 focus:ring-indigo-200/60
              dark:bg-white/[0.06] dark:text-white dark:placeholder-slate-400
              dark:border-white/15 dark:focus:border-white/20 dark:focus:ring-indigo-400/25
              backdrop-blur
            "
          />
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-300/90">
          Tip: Try “setup”, “errors”, or “release”.
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map(({ to, title, desc, Icon }) => (
          <Link
            to={to}
            key={to}
            className="
              group relative rounded-2xl p-5
              bg-white/90 ring-1 ring-slate-200 backdrop-blur
              shadow-[0_14px_36px_-12px_rgba(2,6,23,0.12)]
              transition hover:translate-y-[-2px]
              hover:shadow-[0_18px_44px_-10px_rgba(2,6,23,0.16)]
              focus:outline-none focus:ring-2 focus:ring-indigo-300/60
              dark:bg-white/[0.06] dark:ring-white/10
            "
            aria-label={`${title} – ${desc}`}
          >
            {/* hover wash */}
            <div
              aria-hidden
              className="
                absolute inset-0 rounded-2xl opacity-0 transition-opacity
                bg-[linear-gradient(180deg,rgba(147,197,253,0.06),rgba(59,130,246,0.06))]
                group-hover:opacity-100
                dark:bg-[linear-gradient(180deg,rgba(99,102,241,0.10),rgba(59,130,246,0.10))]
              "
            />
            <Icon className="relative mb-3 h-6 w-6 text-indigo-600 dark:text-indigo-300" />
            <h3 className="relative text-slate-900 dark:text-white" style={hx}>
              {title}
            </h3>
            <p className="relative mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {desc}
            </p>
            <span
              className="relative mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-300"
              style={hx}
            >
              Open{" "}
              <span
                aria-hidden
                className="translate-x-0 transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>

            {/* soft base glow */}
            <div className="pointer-events-none absolute inset-x-0 -bottom-4 h-5 rounded-b-2xl bg-black/5 blur-xl dark:bg-white/5" />
          </Link>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div
          className="
            mt-10 rounded-xl border border-dashed p-8 text-center
            bg-white/80 backdrop-blur
            border-slate-300 text-slate-700
            dark:bg-white/[0.06] dark:border-white/15 dark:text-slate-200
          "
        >
          <p className="text-sm">
            No matches for <span className="font-semibold">“{q}”</span>. Try a different keyword.
          </p>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-12">
        <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white" style={hx}>
          Quick links
        </h4>
        <div className="flex flex-wrap gap-2">
          {[
            { to: "/docs/get-started", label: "Get started" },
            { to: "/help/authentication", label: "Fix sign-in issues" },
            { to: "/blog", label: "Latest updates" },
            { to: "/case-studies", label: "Success stories" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="
                rounded-lg border px-3 py-1.5 text-xs transition-colors
                border-slate-200 bg-white/80 text-slate-800 hover:border-indigo-300/60 hover:bg-white
                dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200
                dark:hover:border-indigo-400/30 dark:hover:bg-white/[0.10]
              "
              style={hx}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </ResourcesLayout>
  );
}
