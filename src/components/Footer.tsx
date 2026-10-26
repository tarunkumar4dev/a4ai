// src/components/Footer.tsx — Redesigned static footer, clean premium layout
import { Link } from "react-router-dom";
import { Mail, Linkedin, Instagram, Youtube } from "lucide-react";

type FooterLink = { name: string; href: string };
type FooterColumn = { title: string; links: FooterLink[] };

const Footer = () => {
  const footerLinks: FooterColumn[] = [
    {
      title: "Product",
      links: [
        { name: "Test Generator", href: "/dashboard/test-generator" },
        { name: "AI Paper Checker", href: "/dashboard/test-generator?tab=check" },
        { name: "Features", href: "/features" },
        { name: "Pricing", href: "/pricing" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Documentation", href: "/docs" },
        { name: "Help Center", href: "/help" },
        { name: "Blog", href: "/blog" },
        { name: "FAQ", href: "/faq" },
      ],
    },
    {
      title: "Company",
      links: [
        { name: "About Us", href: "/about" },
        { name: "Careers", href: "/careers" },
        { name: "Contact", href: "/contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { name: "Terms of Service", href: "/terms" },
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Cookie Policy", href: "/cookies" },
      ],
    },
  ];

  const socialLinks = [
    { icon: Linkedin, href: "https://www.linkedin.com/company/a4ai-in", label: "LinkedIn" },
    {
      icon: XIcon,
      href: "https://x.com/a4aiOfficial",
      label: "X (Twitter)",
    },
    { icon: Instagram, href: "https://www.instagram.com/a4ai.in?igsh=ODdpajJjNjkzeXp1", label: "Instagram" },
    { icon: Youtube, href: "https://www.youtube.com/@a4ai_Official", label: "YouTube" },
    { icon: Mail, href: "mailto:a4ai.team@gmail.com", label: "Email" },
  ];

  const isExternal = (href: string) =>
    href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:");

  return (
    <footer
      role="contentinfo"
      className="border-t border-gray-200 bg-white"
      style={{ paddingTop: "72px", paddingBottom: "48px" }}
    >
      <div className="max-w-[1200px] mx-auto px-5 sm:px-6 lg:px-8">
        {/* Main grid: brand + 4 link columns */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 md:grid-cols-5">
          {/* Brand Column */}
          <div className="col-span-2 sm:col-span-3 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src="/ICON.ico"
                alt="a4ai"
                className="object-contain flex-shrink-0"
                style={{ width: "36px", height: "36px" }}
              />
              <span
                className="font-bold tracking-tight text-[#1B1B1B]"
                style={{ fontSize: "20px", lineHeight: "1.2" }}
              >
                a4ai
              </span>
            </Link>

            <p className="text-sm text-[#5D6570] mt-4 leading-relaxed font-normal" style={{ maxWidth: "240px" }}>
              AI-powered education platform for Indian teachers and schools.
            </p>

            {/* Social Links */}
            <div className="flex gap-3 mt-6">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  aria-label={s.label}
                  className="text-[#5D6570] hover:text-[#1B1B1B]"
                  title={s.label}
                >
                  <s.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {footerLinks.map((col) => (
            <div key={col.title}>
              <h3 className="text-[13px] font-semibold text-[#1B1B1B] mb-4 uppercase tracking-wide">
                {col.title}
              </h3>

              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={`${col.title}-${link.name}`}>
                    {isExternal(link.href) ? (
                      <a
                        href={link.href}
                        target={link.href.startsWith("http") ? "_blank" : undefined}
                        rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="text-sm text-[#5D6570] hover:text-[#1B1B1B] font-normal"
                      >
                        {link.name}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-[#5D6570] hover:text-[#1B1B1B] font-normal"
                      >
                        {link.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-16 border-t border-gray-200 pt-6">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-[#5D6570] font-normal">
              © {new Date().getFullYear()} a4ai. All rights reserved.
            </p>
            <p className="text-sm text-[#5D6570] font-normal">
              Made in India 🇮🇳
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

/** Inline X / Twitter icon (lucide-react doesn't have a proper X logo) */
function XIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
