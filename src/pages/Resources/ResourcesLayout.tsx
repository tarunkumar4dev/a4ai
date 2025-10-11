import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const hx = {
  fontFamily:
    "'Halenoir Expanded DemiBold','Halenoir Expanded','Halenoir','Inter',system-ui,sans-serif",
  fontWeight: 600,
} as const;

export default function ResourcesLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();

  const nav = [
    { to: "/resources", label: "All resources" },
    { to: "/docs", label: "Docs" },
    { to: "/help", label: "Help Center" },
    { to: "/blog", label: "Blog" },
    { to: "/case-studies", label: "Case Studies" },
  ];

  const isActive = (to: string) =>
    pathname === to || (to !== "/resources" && pathname.startsWith(to));

  return (
    <div
      className="
        min-h-screen w-full relative
        bg-[radial-gradient(900px_560px_at_15%_-10%,#EDF1F7_0%,transparent_60%),radial-gradient(900px_560px_at_85%_110%,#F7FAFF_0%,transparent_60%)]
      "
    >
      {/* faint grid (exactly like Pricing) */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />

      <header className="relative z-10 border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <h1 className="text-3xl md:text-4xl tracking-tight text-slate-900" style={hx}>
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm md:text-base text-slate-600 mt-2 max-w-3xl">
              {subtitle}
            </p>
          ) : null}

          {/* Tabs-like nav with active state (matches your UI) */}
          <nav aria-label="Resources navigation" className="mt-6 flex flex-wrap gap-2">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`
                  rounded-xl px-3 py-1.5 text-sm transition
                  border border-transparent hover:border-slate-200 hover:bg-white/80
                  ${isActive(item.to) ? "bg-slate-900 text-white shadow-sm" : "text-slate-700"}
                `}
                style={hx}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
