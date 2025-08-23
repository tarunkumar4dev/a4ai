import ResourcesLayout from "./ResourcesLayout";
import { useState } from "react";

const faqs = [
  { q: "I signed in with Google but the dashboard is blank.", a: "Ensure a profile row exists in `profiles`. Our auth callback and `onAuthStateChange` upsert will auto-create it—refresh once after first login." },
  { q: "Edge Function returns 'No test content returned'.", a: "Check API keys, model responses, and that the function returns a non-empty string before ranking. Log errors in the function and view Vercel/Supabase logs." },
  { q: "Why does PrivateRoute block me after OAuth?", a: "Your `useUserProfile` must wait for session + profile. Add a loading state; redirect only after the profile fetch resolves (even if empty, handle insert)." },
];

export default function HelpCenter() {
  const [query, setQuery] = useState("");
  const items = faqs.filter(f => f.q.toLowerCase().includes(query.toLowerCase()));

  return (
    <ResourcesLayout title="Help Center" subtitle="Troubleshooting and quick answers.">
      <div className="mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search FAQs…"
          className="w-full md:w-[32rem] rounded-lg border px-3 py-2 bg-white dark:bg-gray-900"
        />
      </div>

      <div className="space-y-4">
        {items.map((f, i) => (
          <details key={i} className="rounded-xl border bg-white/70 dark:bg-gray-950/60 p-4">
            <summary className="cursor-pointer font-medium">{f.q}</summary>
            <p className="mt-2 text-gray-700 dark:text-gray-300">{f.a}</p>
          </details>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-500">No results. Try another keyword.</p>}
      </div>
    </ResourcesLayout>
  );
}
