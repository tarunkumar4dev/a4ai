import CompanyLayout from "./CompanyLayout";

export default function PrivacyPolicyPage() {
  return (
    <CompanyLayout title="Privacy Policy" subtitle="Updated: Aug 2025">
      <div className="prose prose-indigo dark:prose-invert max-w-none">
        <p>
          We respect your privacy. This policy explains what data we collect,
          why we collect it, and how we handle it across the a4ai platform.
        </p>

        <h2>Information We Collect</h2>
        <ul>
          <li><strong>Account data:</strong> name, email, authentication metadata (via Supabase).</li>
          <li><strong>Usage data:</strong> basic analytics (page views, feature usage) to improve product quality.</li>
          <li><strong>Content data:</strong> prompts/outputs you generate for tests; stored securely for your use.</li>
        </ul>

        <h2>How We Use Data</h2>
        <ul>
          <li>To provide and improve core features (test generation, contests, exports).</li>
          <li>To secure accounts and prevent abuse.</li>
          <li>To communicate important updates about the service.</li>
        </ul>

        <h2>Data Sharing</h2>
        <p>
          We do not sell your personal data. Limited third-party processors (e.g., Supabase, Vercel)
          may handle data strictly to run the service.
        </p>

        <h2>Security</h2>
        <p>
          We use industry-standard practices (encryption in transit, least-privilege access).
          No method is 100% secure, but we continuously improve safeguards.
        </p>

        <h2>Data Retention</h2>
        <p>
          We retain data for as long as your account is active or as needed to provide the service.
          You can request deletion at any time.
        </p>

        <h2>Your Rights</h2>
        <ul>
          <li>Access, update, or delete your data.</li>
          <li>Export your data (on request).</li>
          <li>Opt out of non-essential communications.</li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions? Email <a href="mailto:a4ai.team@gmail.com">a4ai.team@gmail.com</a>
        </p>
      </div>
    </CompanyLayout>
  );
}
