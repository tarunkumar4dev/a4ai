import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import LegalLayout, { head, accent } from "./LegalLayout";

export default function CookiePolicyPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <LegalLayout title="Cookie Policy" subtitle="Updated: Aug 2025">
      <div 
        className="legal-doc" 
        style={{ color: isDark ? "#cbd5e1" : "#334155" }}
      >
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          We use cookies to ensure the site works correctly, remember your
          preferences, and help us improve the experience.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.35, duration: 0.4 }}>
          <h2 style={{ color: head(isDark) }}>Types of Cookies</h2>
          <ul>
            <li><strong style={{ color: head(isDark) }}>Essential:</strong> Required for login, navigation, and security.</li>
            <li><strong style={{ color: head(isDark) }}>Preferences:</strong> Save your theme/language settings.</li>
            <li><strong style={{ color: head(isDark) }}>Analytics:</strong> Anonymous usage insights (e.g., page views, clicks).</li>
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.4 }}>
          <h2 style={{ color: head(isDark) }}>Managing Cookies</h2>
          <p>
            You can disable cookies in your browser settings. Some features may
            stop working without essential cookies.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.45, duration: 0.4 }}>
          <h2 style={{ color: head(isDark) }}>Contact</h2>
          <p>
            For any cookie-related queries, email{" "}
            <a href="mailto:a4ai.team@gmail.com" className="font-medium hover:underline" style={{ color: accent(isDark) }}>a4ai.team@gmail.com</a>
          </p>
        </motion.div>
      </div>
    </LegalLayout>
  );
}