import ResourcesLayout from "./ResourcesLayout";

const posts = [
  { title: "Introducing a4ai Test Generator", date: "Aug 2025", excerpt: "Why we built it, how it works, and what’s next." },
  { title: "Multi-LLM Strategy: Reliability First", date: "Aug 2025", excerpt: "Choosing the best answer with keyword scoring + fallbacks." },
];

export default function BlogPage() {
  return (
    <ResourcesLayout title="Blog" subtitle="Updates, ideas, and product notes.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((p) => (
          <article key={p.title} className="border rounded-xl p-5 bg-white/70 dark:bg-gray-950/60">
            <p className="text-xs text-gray-500">{p.date}</p>
            <h3 className="mt-1 font-semibold">{p.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{p.excerpt}</p>
            <button className="mt-3 text-indigo-600 text-sm">Read more →</button>
          </article>
        ))}
      </div>
    </ResourcesLayout>
  );
}
