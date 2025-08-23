import LegalLayout from "./LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" subtitle="Effective: Aug 2025">
      <div className="prose prose-indigo dark:prose-invert max-w-none">
        <p>Welcome to a4ai. By using our website, apps, or services, you agree to these terms.</p>

        <h2>1. Your Account</h2>
        <ul>
          <li>You are responsible for maintaining the confidentiality of your account.</li>
          <li>You must provide accurate information and comply with applicable laws.</li>
        </ul>

        <h2>2. Acceptable Use</h2>
        <ul>
          <li>No misuse, reverse engineering, scraping, or interfering with service integrity.</li>
          <li>No generation or distribution of harmful or illegal content.</li>
        </ul>

        <h2>3. Content & IP</h2>
        <ul>
          <li>You own your input and the outputs you generate, subject to third-party model terms.</li>
          <li>a4ai owns the platform, brand, and all underlying technology.</li>
        </ul>

        <h2>4. Paid Plans</h2>
        <ul>
          <li>Fees are billed per the plan; taxes may apply.</li>
          <li>We may change prices with notice; refunds are discretionary unless required by law.</li>
        </ul>

        <h2>5. Disclaimers</h2>
        <p>Services are provided “as is.” We do not guarantee error-free or uninterrupted operation.</p>

        <h2>6. Limitation of Liability</h2>
        <p>To the fullest extent permitted by law, a4ai shall not be liable for indirect, incidental, or consequential damages.</p>

        <h2>7. Termination</h2>
        <p>We may suspend or terminate accounts for policy or legal violations. You may stop using the service at any time.</p>

        <h2>8. Changes</h2>
        <p>We may update these Terms. Continued use after changes constitutes acceptance.</p>

        <h2>9. Contact</h2>
        <p>Questions? <a href="mailto:a4ai.team@gmail.com">a4ai.team@gmail.com</a></p>
      </div>
    </LegalLayout>
  );
}
