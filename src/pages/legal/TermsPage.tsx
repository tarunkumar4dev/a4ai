// TermsPage.tsx — Terms of Service. Plain language; keeps the commitments of
// the previous version (refunds at our discretion unless the law requires them).
import { Link } from "react-router-dom";
import LegalLayout, { LegalSection } from "./LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      updated="Updated: 26 October 2026"
      description="The terms for using a4ai — accounts, acceptable use, your content, AI features, paid plans and more."
      path="/terms"
    >
      <LegalSection title="1. About these terms">
        <p>
          These terms apply when you use a4ai (a4ai.in, our apps and student links). By creating an account or using
          a4ai you agree to them. If you use a4ai for a school or institute, you confirm you're allowed to accept them on
          its behalf.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <ul>
          <li>Give accurate details and keep your password private. You're responsible for activity on your account.</li>
          <li>Institute admins decide who joins their institute and which classes teachers and students can see.</li>
          <li>Students may use an access code or an upload link shared by their teacher; keep codes private.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Using a4ai responsibly">
        <ul>
          <li>Don't misuse the service: no scraping, reverse engineering, overloading or getting around limits or security.</li>
          <li>Don't upload content that is illegal, harmful, or that you don't have the right to use.</li>
          <li>Only upload student information you are allowed to share, and only for teaching purposes.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Your content">
        <ul>
          <li>
            You own what you upload (question papers, answer sheets, notes) and what you create with a4ai, subject to
            the terms of the AI models we use.
          </li>
          <li>You let us store and process it only to run a4ai for you.</li>
          <li>a4ai owns the platform, the a4ai name and logo, and our question bank and software.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. AI features">
        <p>
          Test generation, copy checking and other AI features can make mistakes. Teachers should review AI marks,
          comments and questions before sharing them with students — copy-checking results are published only after a
          teacher approves them (unless the teacher turns on automatic publishing).
        </p>
      </LegalSection>

      <LegalSection title="6. Plans and payments">
        <ul>
          <li>
            Paid plans are billed as shown on the <Link to="/pricing">pricing page</Link>; taxes may apply. Payments are
            processed by Razorpay.
          </li>
          <li>Each plan has monthly limits (for example, test papers per month). Unused limits don't carry over.</li>
          <li>We may change prices with notice. Refunds are at our discretion unless the law requires them.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Availability">
        <p>
          We work to keep a4ai running smoothly but can't promise it will always be available or error-free. a4ai is
          provided "as is".
        </p>
      </LegalSection>

      <LegalSection title="8. Liability">
        <p>
          To the extent the law allows, a4ai is not liable for indirect, incidental or consequential losses arising from
          your use of the service.
        </p>
      </LegalSection>

      <LegalSection title="9. Ending your use">
        <p>
          You can stop using a4ai at any time. We may suspend or close accounts that break these terms or the law.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p>
          We may update these terms. We'll change the date at the top when we do; using a4ai after an update means you
          accept the new terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Questions about these terms? Email <a href="mailto:a4ai.team@gmail.com">a4ai.team@gmail.com</a>. See also our{" "}
          <Link to="/privacy">Privacy Policy</Link> and <Link to="/cookies">Cookie Policy</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
