// pages/careers.tsx

import React from "react";

export default function CareersPage() {
  return (
    <div className="p-10">
      <h1 className="text-4xl font-bold mb-6">Join Our Team - Careers at A4AI</h1>
      <p className="mb-6 text-lg">
        We're building the future of AI-driven education and assessment. Be part of the movement!
      </p>

      <div className="space-y-6">
        <div className="p-6 border rounded bg-white text-black shadow">
          <h2 className="text-2xl font-semibold">🚀 Frontend Developer</h2>
          <p className="mb-2">Build intuitive, fast user interfaces for our test platform and analytics tools.</p>
          <p><strong>Location:</strong> Remote | <strong>Type:</strong> Full-time</p>
        </div>

        <div className="p-6 border rounded bg-white text-black shadow">
          <h2 className="text-2xl font-semibold">🧠 AI Prompt Engineer</h2>
          <p className="mb-2">Design and optimize prompts for our multi-LLM system that generates educational content.</p>
          <p><strong>Location:</strong> Hybrid | <strong>Type:</strong> Internship/Contract</p>
        </div>

        <div className="p-6 border rounded bg-white text-black shadow">
          <h2 className="text-2xl font-semibold">📊 Product Manager - EdTech</h2>
          <p className="mb-2">Lead product design for schools and institutes using A4AI.</p>
          <p><strong>Location:</strong> India | <strong>Type:</strong> Full-time</p>
        </div>
      </div>

      <p className="mt-8 text-gray-500">
        📩 To apply, email your resume to <a href="mailto:careers@a4ai.in" className="text-blue-600 underline">careers@a4ai.in</a>
      </p>
    </div>
  );
}
