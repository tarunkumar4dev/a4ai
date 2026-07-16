import React from "react";
import { motion } from "framer-motion";
import LegalLayout, { head, accent } from "./LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" subtitle="Effective: Aug 2025">
      <div 
        className="legal-doc" 
        style={{ color: "#334155" }}
      >
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          Welcome to <span className="font-bold text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #818cf8, #34d399, #38bdf8)" }}>a4ai</span>. By using our website, apps, or services, you agree to these terms.
        </motion.p>

        <Section delay={0.35} title="1. Your Account">
          <ul>
            <li>You are responsible for maintaining the confidentiality of your account.</li>
            <li>You must provide accurate information and comply with applicable laws.</li>
          </ul>
        </Section>

        <Section delay={0.4} title="2. Acceptable Use">
          <ul>
            <li>No misuse, reverse engineering, scraping, or interfering with service integrity.</li>
            <li>No generation or distribution of harmful or illegal content.</li>
          </ul>
        </Section>

        <Section delay={0.45} title="3. Content & IP">
          <ul>
            <li>You own your input and the outputs you generate, subject to third-party model terms.</li>
            <li>a4ai owns the platform, brand, and all underlying technology.</li>
          </ul>
        </Section>

        <Section delay={0.5} title="4. Paid Plans">
          <ul>
            <li>Fees are billed per the plan; taxes may apply.</li>
            <li>We may change prices with notice; refunds are discretionary unless required by law.</li>
          </ul>
        </Section>

        <Section delay={0.55} title="5. Disclaimers">
          <p>Services are provided “as is.” We do not guarantee error-free or uninterrupted operation.</p>
        </Section>

        <Section delay={0.6} title="6. Limitation of Liability">
          <p>To the fullest extent permitted by law, a4ai shall not be liable for indirect, incidental, or consequential damages.</p>
        </Section>

        <Section delay={0.65} title="7. Termination">
          <p>We may suspend or terminate accounts for policy or legal violations. You may stop using the service at any time.</p>
        </Section>

        <Section delay={0.7} title="8. Changes">
          <p>We may update these Terms. Continued use after changes constitutes acceptance.</p>
        </Section>

        <Section delay={0.75} title="9. Contact">
          <p>
            Questions? <a href="mailto:a4ai.team@gmail.com" className="font-medium hover:underline" style={{ color: accent() }}>a4ai.team@gmail.com</a>
          </p>
        </Section>
      </div>
    </LegalLayout>
  );
}

function Section({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ delay, duration: 0.4 }}
    >
      <h2 style={{ color: head() }}>{title}</h2>
      {children}
    </motion.div>
  );
}