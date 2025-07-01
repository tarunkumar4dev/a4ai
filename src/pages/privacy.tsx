// pages/privacy-policy.tsx

import React from "react";

export default function PrivacyPolicyPage() {
  return (
    <div className="p-10">
      <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>
      <p className="mb-4 text-lg">Effective date: June 30, 2025</p>

      <div className="space-y-4 text-black">
        <p>
          At A4AI, we take your privacy seriously. This policy explains how we collect, use, and protect your information.
        </p>

        <h2 className="text-2xl font-semibold mt-6">1. Information We Collect</h2>
        <ul className="list-disc ml-6">
          <li>Personal info (name, email) during registration</li>
          <li>Test interaction data and performance</li>
          <li>Browsing and usage analytics</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6">2. How We Use Your Data</h2>
        <ul className="list-disc ml-6">
          <li>To generate personalized tests and notes</li>
          <li>To show progress reports and leaderboards</li>
          <li>To improve our services using aggregated data</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6">3. Data Protection</h2>
        <p>We store all data securely using encryption and access controls.</p>

        <h2 className="text-2xl font-semibold mt-6">4. Third-Party Sharing</h2>
        <p>We do not sell your data. Only necessary services like payment or analytics may access anonymized data.</p>

        <h2 className="text-2xl font-semibold mt-6">5. Your Rights</h2>
        <p>You can request deletion, correction, or export of your data anytime.</p>
      </div>

      <p className="mt-8 text-gray-500">
        📩 For any privacy-related questions, contact us at <a href="mailto:support@a4ai.in" className="text-blue-600 underline">support@a4ai.in</a>
      </p>
    </div>
  );
}
