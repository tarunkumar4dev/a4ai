import ResourcesLayout from "./ResourcesLayout";
import { Link } from "react-router-dom";

const sections = [
  {
    title: "Getting Started",
    items: [
      { t: "What is a4ai?", to: "#" },
      { t: "Quickstart (5 min)", to: "#" },
      { t: "Project setup (React + TS)", to: "#" },
    ],
  },
  {
    title: "Backend & APIs",
    items: [
      { t: "Supabase Auth (email + Google OAuth)", to: "#" },
      { t: "Edge Functions for multi-LLM generation", to: "#" },
      { t: "Keyword scoring & best-response selection", to: "#" },
    ],
  },
  {
    title: "Production",
    items: [
      { t: "Vercel deployment checklist", to: "#" },
      { t: "Env vars & secrets", to: "#" },
      { t: "Monitoring & logs", to: "#" },
    ],
  },
];

export default function Documentation() {
  return (
    <ResourcesLayout title="Documentation" subtitle="Official guides and API notes for a4ai.">
      <div className="mb-8">
        <input
          type="search"
          placeholder="Search docs…"
          className="w-full md:w-96 rounded-lg border px-3 py-2 bg-white dark:bg-gray-900"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sections.map((s) => (
          <div key={s.title} className="border rounded-xl p-5 bg-white/70 dark:bg-gray-950/60">
            <h3 className="font-semibold mb-3">{s.title}</h3>
            <ul className="space-y-2">
              {s.items.map((i) => (
                <li key={i.t}>
                  <Link to={i.to} className="text-indigo-600 hover:underline">{i.t}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-10 text-sm text-gray-600 dark:text-gray-400">
        Tip: you can also visit our <Link to="/help" className="text-indigo-600">Help Center</Link> for quick fixes.
      </p>
    </ResourcesLayout>
  );
}
