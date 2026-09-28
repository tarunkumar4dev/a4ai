// src/components/Footer.tsx — Completely static footer
import { Link } from "react-router-dom";
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
    { icon: Linkedin,  href: "https://www.linkedin.com/company/a4ai-in",                label: "LinkedIn" },
    { icon: Twitter,   href: "https://x.com/a4aiOfficial",                               label: "X (Twitter)" },
    { icon: Instagram, href: "https://www.instagram.com/a4ai.in?igsh=ODdpajJjNjkzeXp1", label: "Instagram" },
    { icon: Github,    href: "https://github.com",                                       label: "GitHub" },
    { icon: Mail,      href: "mailto:a4ai.team@gmail.com",                               label: "Email" },
  ];

  const isExternal = (href: string) =>
    href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:");

  return (
    <footer
      role="contentinfo"
      className="relative border-t border-gray-200 bg-white pt-16 pb-12"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6" style={{ color: "#f75961" }} />
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                a4ai
              </h2>
            </div>

            <p className="text-sm text-gray-600 mt-3 leading-relaxed font-medium">
              Smart test generation for modern educators. Empower your classroom with AI.
            </p>

            {/* Newsletter */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Stay Updated
              </h4>
              <div className="flex items-center rounded-[12px] border border-gray-300 bg-white p-1 shadow-xs max-w-sm">
                <input
                  type="email"
                  placeholder="Your email"
                  className="w-full py-2 px-3 rounded-[10px] bg-transparent text-sm text-gray-900 focus:outline-none font-medium"
                />
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-black text-white hover:bg-neutral-800 cursor-pointer flex-shrink-0"
                  aria-label="Subscribe"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-4 mt-6">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  aria-label={s.label}
                  className="text-gray-500 hover:text-gray-900 transition-colors"
                  title={s.label}
                >
                  <s.icon size={20} />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {footerLinks.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-bold text-gray-900 mb-4 tracking-tight">
                {col.title}
              </h3>

              <ul className="space-y-3">
                {col.links.map((link) => {
                  const content = (
                    <>
                      <ArrowRight className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                      <span>{link.name}</span>
                    </>
                  );
                  return (
                    <li key={`${col.title}-${link.name}`}>
                      {isExternal(link.href) ? (
                        <a
                          href={link.href}
                          target={link.href.startsWith("http") ? "_blank" : undefined}
                          rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="group flex items-center gap-2 text-sm text-gray-600 hover:text-black font-medium transition-colors"
                        >
                          {content}
                        </a>
                      ) : (
                        <Link
                          to={link.href}
                          className="group flex items-center gap-2 text-sm text-gray-600 hover:text-black font-medium transition-colors"
                        >
                          {content}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-16 border-t border-gray-200 pt-6 text-sm text-gray-500 font-medium">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p>© {new Date().getFullYear()} a4ai — All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/terms" className="hover:text-black transition-colors">
                Terms of Service
              </Link>
              <Link to="/privacy" className="hover:text-black transition-colors">
                Privacy Policy
              </Link>
              <Link to="/cookies" className="hover:text-black transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
