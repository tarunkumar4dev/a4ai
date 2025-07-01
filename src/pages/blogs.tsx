// pages/blog.tsx

import React from "react";

export default function BlogPage() {
  return (
    <div className="p-10">
      <h1 className="text-4xl font-bold mb-6">Blog</h1>
      <p className="text-lg mb-4">Latest thoughts on education, AI, and assessments:</p>

      <div className="space-y-6">
        <div className="p-4 border rounded bg-white text-black shadow">
          <h2 className="text-2xl font-semibold">📚 Revolutionizing Education with LLMs</h2>
          <p>How large language models are changing test creation and learning methods.</p>
        </div>

        <div className="p-4 border rounded bg-white text-black shadow">
          <h2 className="text-2xl font-semibold">📊 Understanding Student Analytics</h2>
          <p>Why performance tracking and insights matter more than ever.</p>
        </div>

        <div className="p-4 border rounded bg-white text-black shadow">
          <h2 className="text-2xl font-semibold">🧠 Smart Notes Generation with AI</h2>
          <p>Creating personalized notes based on student interest using AI.</p>
        </div>
      </div>
    </div>
  );
}
