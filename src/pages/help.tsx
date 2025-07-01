// pages/help-centre.tsx

import React from "react";

export default function HelpCentrePage() {
  return (
    <div className="p-10">
      <h1 className="text-4xl font-bold mb-6">Help Centre</h1>

      <div className="space-y-4">
        <details className="bg-white p-4 rounded shadow">
          <summary className="font-semibold cursor-pointer">How to generate a test?</summary>
          <p className="mt-2 text-sm text-gray-700">
            Go to the Demo or Dashboard, enter the subject/topic/difficulty and submit. The LLMs will generate questions automatically.
          </p>
        </details>

        <details className="bg-white p-4 rounded shadow">
          <summary className="font-semibold cursor-pointer">What is tab-freeze mode?</summary>
          <p className="mt-2 text-sm text-gray-700">
            During tests, the screen enters full-screen mode and prevents switching tabs or copying content.
          </p>
        </details>

        <details className="bg-white p-4 rounded shadow">
          <summary className="font-semibold cursor-pointer">How do I access analytics?</summary>
          <p className="mt-2 text-sm text-gray-700">
            Login as a teacher or school, go to the dashboard, and view student performance charts.
          </p>
        </details>
      </div>
    </div>
  );
}
