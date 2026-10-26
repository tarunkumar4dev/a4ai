// src/pages/resources/BlogPage.tsx — product notes. Posts have no article
// pages yet, so cards are not links.
import ResourcesLayout from "./ResourcesLayout";

const posts = [
  { title: "Introducing a4ai Test Generator", date: "Aug 2025", excerpt: "Why we built it, how it works, and what’s next." },
  { title: "Multi-LLM Strategy: Reliability First", date: "Aug 2025", excerpt: "Choosing the best answer with keyword scoring + fallbacks." },
];

export default function BlogPage() {
  return (
    <ResourcesLayout title="Blog" subtitle="Product updates and notes from the a4ai team.">
      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {posts.map((p) => (
          <li key={p.title}>
            <article className="h-full rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-[0_8px_30px_rgba(17,17,17,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D93F4D]">{p.date}</p>
              <h2 className="mt-2 font-halenoir text-xl font-bold text-[#1B1B1B]">{p.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[#5D6570]">{p.excerpt}</p>
            </article>
          </li>
        ))}
      </ul>
    </ResourcesLayout>
  );
}
