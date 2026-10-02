import CompanyLayout from "./CompanyLayout";

export default function PrivacyPolicyPage() {
  return (
    <CompanyLayout title="Privacy Policy" subtitle="Updated: Oct 2026">
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
          <li>
            <strong>WhatsApp data:</strong> if you message our WhatsApp number, we receive your phone number
            and the messages you send to the bot (class, subject, chapter, marks), and keep a monthly count
            of papers generated for your number.
          </li>
          <li><strong>Payment data:</strong> plan, amount and payment status. Card, UPI and bank details are handled by Razorpay; we never see or store them.</li>
        </ul>

        <h2>How We Use Data</h2>
        <ul>
          <li>To provide and improve core features (test generation, contests, exports).</li>
          <li>To secure accounts and prevent abuse.</li>
          <li>To communicate important updates about the service.</li>
        </ul>

        <h2>Data Sharing</h2>
        <p>
          We do not sell your personal data. These processors handle data strictly to run the service:
        </p>
        <ul>
          <li>Supabase (database and sign-in) and Vercel (hosting)</li>
          <li>Google Gemini and OpenRouter (AI generation of questions and chat answers)</li>
          <li>Razorpay (payments)</li>
          <li>Meta / WhatsApp (delivering messages and test papers on WhatsApp)</li>
        </ul>

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

        <h2 id="data-deletion">Data Deletion</h2>
        <p>To delete your data:</p>
        <ol>
          <li>
            Email <a href="mailto:a4ai.team@gmail.com?subject=Data%20deletion%20request">a4ai.team@gmail.com</a> with
            the subject "Data deletion request" from the email address or phone number registered with a4ai
            (for WhatsApp, include the WhatsApp number you used).
          </li>
          <li>We confirm the request and delete your account, generated tests and WhatsApp records within 30 days.</li>
          <li>
            Payment records that we must keep for tax and accounting law are retained for the legally required
            period and then deleted.
          </li>
        </ol>

        <h2>Contact</h2>
        <p>
          Questions? Email <a href="mailto:a4ai.team@gmail.com">a4ai.team@gmail.com</a>
        </p>
      </div>
    </CompanyLayout>
  );
}
