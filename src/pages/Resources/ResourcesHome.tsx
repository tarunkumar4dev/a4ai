import { Link } from "react-router-dom";
import ResourcesLayout from "./ResourcesLayout";
import { BookOpen, LifeBuoy, Newspaper, Briefcase } from "lucide-react";

const cards = [
  { to: "/docs", title: "Documentation", desc: "Install, configure, and integrate the a4ai test generator.", Icon: BookOpen },
  { to: "/help", title: "Help Center", desc: "FAQs, troubleshooting, and how-tos for common issues.", Icon: LifeBuoy },
  { to: "/blog", title: "Blog", desc: "Product updates, tips, and behind-the-scenes notes.", Icon: Newspaper },
  { to: "/case-studies", title: "Case Studies", desc: "How schools and teachers use a4ai in the real world.", Icon: Briefcase },
];

export default function ResourcesHome() {
  return (
    <ResourcesLayout title="Resources" subtitle="Everything you need to build, learn, and succeed with a4ai.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map(({ to, title, desc, Icon }) => (
          <Link to={to} key={to} className="group border rounded-xl p-5 hover:border-indigo-500/60 transition-colors bg-white/70 dark:bg-gray-950/60">
            <Icon className="h-6 w-6 mb-3 text-indigo-600" />
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{desc}</p>
            <span className="inline-block mt-3 text-sm text-indigo-600 group-hover:translate-x-0.5 transition-transform">Open →</span>
          </Link>
        ))}
      </div>
    </ResourcesLayout>
  );
}
