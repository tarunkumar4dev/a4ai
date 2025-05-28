import { Mail, Twitter, Linkedin, Github } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[#f9f9fb] border-t border-gray-200 py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Zolvio.ai</h2>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              Smart test generation for modern educators. Empower your classroom with AI.
            </p>
            <div className="flex gap-4 mt-6 text-gray-500">
              <a
                href="https://x.com/zolvio"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X.com"
                className="hover:text-black transition"
              >
                <Twitter size={20} />
              </a>
              <a
                href="https://linkedin.com/company/zolvio"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="hover:text-black transition"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="https://github.com/zolvio"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="hover:text-black transition"
              >
                <Github size={20} />
              </a>
              <a
                href="mailto:support@zolvio.ai"
                aria-label="Email"
                className="hover:text-black transition"
              >
                <Mail size={20} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="/features" className="hover:text-black transition">Features</a></li>
              <li><a href="/pricing" className="hover:text-black transition">Pricing</a></li>
              <li><a href="/demo" className="hover:text-black transition">Demo</a></li>
              <li><a href="/api" className="hover:text-black transition">API</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="/docs" className="hover:text-black transition">Documentation</a></li>
              <li><a href="/help" className="hover:text-black transition">Help Center</a></li>
              <li><a href="/blog" className="hover:text-black transition">Blog</a></li>
              <li><a href="/case-studies" className="hover:text-black transition">Case Studies</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="/about" className="hover:text-black transition">About Us</a></li>
              <li><a href="/careers" className="hover:text-black transition">Careers</a></li>
              <li><a href="/contact" className="hover:text-black transition">Contact</a></li>
              <li><a href="/privacy" className="hover:text-black transition">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 text-sm text-center text-gray-500">
          © {new Date().getFullYear()} Zolvio.ai — All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
