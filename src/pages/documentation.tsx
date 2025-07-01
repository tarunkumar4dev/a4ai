// pages/documentation.tsx

import React from "react";

export default function DocumentationPage() {
  return (
    <div className="p-10">
      <h1 className="text-4xl font-bold mb-6">A4AI Developer Documentation</h1>
      <p className="mb-4 text-lg">
        Learn how to integrate and interact with A4AI’s APIs and features.
      </p>

      <ul className="list-disc ml-6 space-y-3 text-black">
        <li>
          <strong>Authentication:</strong> Use API keys for secure access
        </li>
        <li>
          <strong>Test Generator API:</strong> `/api/generate-test`
        </li>
        <li>
          <strong>Student Analytics:</strong> `/api/performance/:studentId`
        </li>
        <li>
          <strong>Notes Generator:</strong> `/api/generate-notes`
        </li>
        <li>
          <strong>Error Codes:</strong> Standard HTTP status responses with JSON messages
        </li>
      </ul>

      <p className="mt-6 text-gray-500">More documentation and SDKs coming soon!</p>
    </div>
  );
}
