// pages/api.tsx

import React from "react";

export default function APIPage() {
  return (
    <div className="p-10">
      <h1 className="text-4xl font-bold mb-6">A4AI Public API</h1>
      <p className="text-lg mb-4">
        Use our public APIs to integrate test generation, performance analytics, and personalized notes.
      </p>

      <div className="bg-gray-800 text-white p-6 rounded-lg space-y-4 max-w-2xl">
        <div>
          <p className="font-mono text-sm text-purple-300">POST /api/generate-test</p>
          <p className="text-sm">Input subject, topic, difficulty → returns LLM-generated questions.</p>
        </div>

        <div>
          <p className="font-mono text-sm text-purple-300">GET /api/performance/:studentId</p>
          <p className="text-sm">Returns performance data, accuracy, and trends for a student.</p>
        </div>

        <div>
          <p className="font-mono text-sm text-purple-300">POST /api/generate-notes</p>
          <p className="text-sm">Input interest or topic → returns summarized learning notes.</p>
        </div>
      </div>

      <p className="mt-6 text-gray-500">
        📌 Full API authentication, rate limits, and documentation coming soon.
      </p>
    </div>
  );
}
