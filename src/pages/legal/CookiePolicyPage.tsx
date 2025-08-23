import LegalLayout from "./LegalLayout";

export default function CookiePolicyPage() {
  return (
    <LegalLayout title="Cookie Policy" subtitle="Updated: Aug 2025">
      <div className="prose prose-indigo dark:prose-invert max-w-none">
        <p>
          We use cookies to ensure the site works correctly, remember your
          preferences, and help us improve the experience.
        </p>

        <h2>Types of Cookies</h2>
        <ul>
          <li><strong>Essential:</strong> Required for login, navigation, and security.</li>
          <li><strong>Preferences:</strong> Save your theme/language settings.</li>
          <li><strong>Analytics:</strong> Anonymous usage insights (e.g., page views, clicks).</li>
        </ul>

        <h2>Managing Cookies</h2>
        <p>
          You can disable cookies in your browser settings. Some features may
          stop working without essential cookies.
        </p>

        <h2>Contact</h2>
        <p>
          For any cookie-related queries, email{" "}
          <a href="mailto:a4ai.team@gmail.com">a4ai.team@gmail.com</a>
        </p>
      </div>
    </LegalLayout>
  );
}
