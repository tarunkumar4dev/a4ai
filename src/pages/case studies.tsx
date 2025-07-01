// pages/case-studies.tsx

import React from "react";

export default function CaseStudiesPage() {
  return (
    <div className="p-10">
      <h1 className="text-4xl font-bold mb-6">Case Studies</h1>
      <p className="text-lg mb-4">See how institutions are using A4AI:</p>

      <div className="space-y-6">
        <div className="p-4 border rounded bg-white text-black shadow">
          <h2 className="text-xl font-semibold">🏫 Green Valley School</h2>
          <p>Increased teacher productivity by 3x with automatic test generation and analytics.</p>
        </div>

        <div className="p-4 border rounded bg-white text-black shadow">
          <h2 className="text-xl font-semibold">📖 BrightEdge Coaching Institute</h2>
          <p>Hosted weekly contests with live leaderboard and performance boost in student ranks.</p>
        </div>

        <div className="p-4 border rounded bg-white text-black shadow">
          <h2 className="text-xl font-semibold">🎓 Excel Academy</h2>
          <p>Reduced paper workload using AI-generated notes tailored for individual batches.</p>
        </div>
      </div>
    </div>
  );
}
