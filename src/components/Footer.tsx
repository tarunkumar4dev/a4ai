import { motion } from "framer-motion";   // edited 19-06-2025
import { Mail, Twitter, Linkedin, Github, Zap, ArrowRight } from "lucide-react";

const Footer = () => {
  const footerLinks = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "/features" },
        { name: "Pricing", href: "/pricing" },
        { name: "Demo", href: "/demo" },
        { name: "API", href: "/api" },
      ]
    },
    {
      title: "Resources",
      links: [
        { name: "Documentation", href: "/docs" },
        { name: "Help Center", href: "/help" },
        { name: "Blog", href: "/blog" },
        { name: "Case Studies", href: "/case-studies" },
      ]
    },
    {
      title: "Company",
      links: [
        { name: "About Us", href: "/about" },
        { name: "Careers", href: "/careers" },
        { name: "Contact", href: "/contact" },
        { name: "Privacy Policy", href: "/privacy" },
      ]
    }
  ];

  const socialLinks = [
    { icon: Twitter, href: "https://x.com/a4ai", label: "Twitter" },
    { icon: Linkedin, href: "https://linkedin.com/company/a4ai", label: "LinkedIn" },
    { icon: Github, href: "https://github.com/a4ai", label: "GitHub" },
    { icon: Mail, href: "mailto:support@a4ai", label: "Email" }
  ];

  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="bg-gradient-to-b from-white to-[#f9f9fb] border-t border-gray-200 pt-24 pb-12"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Column */}
          <motion.div
            whileHover={{ y: -5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  transition: { repeat: Infinity, duration: 3 }
                }}
              >
                <Zap className="h-6 w-6 text-purple-600" />
              </motion.div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                a4ai
              </h2>
            </div>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              Smart test generation for modern educators. Empower your classroom with AI.
            </p>
            
            {/* Newsletter */}
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Stay Updated
              </h4>
              <div className="relative">
                <input
                  type="email"
                  placeholder="Your email"
                  className="w-full py-2 px-4 pr-10 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-600"
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-4 mt-6">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ 
                    y: -3,
                    color: "#7c3aed",
                    transition: { type: "spring", stiffness: 500 }
                  }}
                  className="text-gray-500 hover:text-purple-600 transition-colors"
                >
                  <social.icon size={20} />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Link Columns */}
          {footerLinks.map((column, colIndex) => (
            <motion.div
              key={colIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + colIndex * 0.05 }}
            >
              <h3 className="text-sm font-semibold text-gray-900 mb-4 relative inline-block">
                {column.title}
                <motion.span
                  className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  viewport={{ once: true }}
                />
              </h3>
              <ul className="space-y-3">
                {column.links.map((link, linkIndex) => (
                  <motion.li
                    key={linkIndex}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + colIndex * 0.05 + linkIndex * 0.03 }}
                  >
                    <motion.a
                      href={link.href}
                      whileHover={{ 
                        x: 5,
                        color: "#7c3aed",
                        transition: { type: "spring", stiffness: 300 }
                      }}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                    >
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {link.name}
                    </motion.a>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Copyright */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 border-t border-gray-200 pt-6 text-sm text-center text-gray-500"
        >
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p>© {new Date().getFullYear()} a4ai — All rights reserved.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="/terms" className="hover:text-purple-600 transition-colors">Terms of Service</a>
              <a href="/privacy" className="hover:text-purple-600 transition-colors">Privacy Policy</a>
              <a href="/cookies" className="hover:text-purple-600 transition-colors">Cookie Policy</a>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.footer>
  );
};

export default Footer;