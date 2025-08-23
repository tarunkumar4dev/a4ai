// src/components/Footer.tsx
import { Link } from "react-router-dom";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { Mail, Twitter, Linkedin, Github, Instagram, Zap, ArrowRight } from "lucide-react";

type FooterLink = { name: string; href: string };
type FooterColumn = { title: string; links: FooterLink[] };

const Footer = () => {
  const footerLinks: FooterColumn[] = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "/features" },
        { name: "Pricing", href: "/pricing" },
        { name: "Demo", href: "/demo" },
        { name: "API", href: "/api" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Documentation", href: "/docs" },
        { name: "Help Center", href: "/help" },
        { name: "Blog", href: "/blog" },
        { name: "Case Studies", href: "/case-studies" },
      ],
    },
    {
      title: "Company",
      links: [
        { name: "About Us", href: "/about" },
        { name: "Careers", href: "/careers" },
        { name: "Contact", href: "/contact" },
        { name: "Privacy Policy", href: "/privacy" },
      ],
    },
  ];

  // Social links
  const socialLinks = [
    { icon: Linkedin,  href: "https://www.linkedin.com/company/a4ai-in",                 label: "LinkedIn" },
    { icon: Twitter,   href: "https://x.com/a4aiOfficial",                                label: "X (Twitter)" },
    { icon: Instagram, href: "https://www.instagram.com/a4ai.in?igsh=ODdpajJjNjkzeXp1",  label: "Instagram" },
    { icon: Github,    href: "https://github.com",                                        label: "GitHub" },
    { icon: Mail,      href: "mailto:a4ai.team@gmail.com",                                label: "Email" },
  ];

  const isExternal = (href: string) =>
    href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:");

  // cursor-reactive glow
  const mx = useMotionValue(300);
  const my = useMotionValue(120);
  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const glow = useMotionTemplate`
    radial-gradient(700px 350px at ${mx}px ${my}px, rgba(99,102,241,0.18), transparent 70%),
    radial-gradient(700px 350px at calc(${mx}px + 220px) calc(${my}px + 160px), rgba(168,85,247,0.16), transparent 70%)
  `;

  return (
    <motion.footer
      role="contentinfo"
      onMouseMove={onMouseMove}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="relative border-t border-gray-200/80 dark:border-gray-800/70 bg-gradient-to-b from-white to-[#f9f9fb] dark:from-gray-950 dark:to-gray-950/95 pt-24 pb-12 overflow-hidden"
    >
      {/* cursor glow + soft grain */}
      <motion.div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-80 dark:opacity-60"
        style={{ backgroundImage: glow }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%2240%22 height=%2240%22 filter=%22url(%23n)%22 opacity=%220.25%22/></svg>')",
        }}
      />

      {/* animated top hairline */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

      {/* floating orbs — make them click-through */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -bottom-14 -right-10 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Column */}
          <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
            <div className="flex items-center gap-2">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
                <Zap className="h-6 w-6 text-indigo-600" />
              </motion.div>
              <h2 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                a4ai
              </h2>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">
              Smart test generation for modern educators. Empower your classroom with AI.
            </p>

            {/* Newsletter */}
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Stay Updated
              </h4>
              <div className="relative rounded-xl p-[1px] bg-gradient-to-r from-indigo-500/60 to-purple-500/60">
                <div className="flex items-center rounded-[11px] bg-white dark:bg-gray-950">
                  <input
                    type="email"
                    placeholder="Your email"
                    className="w-full py-2.5 px-4 rounded-[11px] bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none"
                  />
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                    aria-label="Subscribe"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-4 mt-6">
              {socialLinks.map((s, i) => (
                <motion.a
                  key={s.label}
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  aria-label={s.label}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.08 * i }}
                  whileHover={{ y: -3, rotate: 2 }}
                  className="text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title={s.label}
                >
                  <s.icon size={20} />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Link Columns */}
          {footerLinks.map((col, colIndex) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + colIndex * 0.05 }}
            >
              <h3 className="relative inline-block text-sm font-semibold text-gray-900 dark:text-white mb-4">
                {col.title}
                <motion.span
                  className="absolute -bottom-1 left-0 h-0.5 w-full bg-gradient-to-r from-indigo-600 to-purple-600"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  style={{ transformOrigin: "left" }}
                />
              </h3>

              <ul className="space-y-3">
                {col.links.map((link, linkIndex) => {
                  const content = (
                    <>
                      <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                      {link.name}
                    </>
                  );
                  return (
                    <motion.li
                      key={`${col.title}-${link.name}`}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.15 + colIndex * 0.05 + linkIndex * 0.03 }}
                    >
                      {isExternal(link.href) ? (
                        <a
                          href={link.href}
                          target={link.href.startsWith("http") ? "_blank" : undefined}
                          rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="group flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 transition-colors"
                        >
                          {content}
                        </a>
                      ) : (
                        <Link
                          to={link.href}
                          className="group flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 transition-colors"
                        >
                          {content}
                        </Link>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom row */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-16 border-t border-gray-200 dark:border-gray-800 pt-6 text-sm text-gray-500 dark:text-gray-400"
        >
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p>© {new Date().getFullYear()} a4ai — All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Terms of Service
              </Link>
              <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Privacy Policy
              </Link>
              <Link to="/cookies" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.footer>
  );
};

export default Footer;
