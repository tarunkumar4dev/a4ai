// src/pages/resources/ResourcesLayout.tsx — shared frame for the Resources
// section (landing Navbar/Footer, page header, section tabs).
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import PageShell, { Container } from "@/components/site/PageShell";

const NAV = [
  { to: "/resources", label: "All resources" },
  { to: "/docs", label: "Docs" },
  { to: "/help", label: "Help Center" },
  { to: "/faq", label: "FAQ" },
  { to: "/blog", label: "Blog" },
];

export default function ResourcesLayout({
  title,
  subtitle,
  description,
  children,
}: {
  title: string;
  subtitle?: string;
  /** meta description; defaults to the subtitle */
  description?: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const isActive = (to: string) => pathname === to || (to !== "/resources" && pathname.startsWith(to));

  return (
    <PageShell
      meta={{
        title: title === "Resources" ? "Resources — a4ai" : `${title} — a4ai Resources`,
        description: description ?? subtitle ?? "Guides, help and updates for teachers using a4ai.",
        path: pathname,
        jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: `a4ai ${title}`, url: `https://a4ai.in${pathname}` },
      }}
    >
      <header
        className="border-b border-[#E5E7EB]"
        style={{ background: "radial-gradient(900px 360px at 50% 0%, #FFF1EC 0%, rgba(255,255,255,0) 70%)" }}
      >
        <Container className="py-12 sm:py-16">
          <nav aria-label="Breadcrumb" className="text-[13px] font-medium text-[#5D6570]">
            <Link to="/" className="hover:text-[#1B1B1B]">Home</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            {title === "Resources" ? (
              <span aria-current="page" className="text-[#1B1B1B]">Resources</span>
            ) : (
              <>
                <Link to="/resources" className="hover:text-[#1B1B1B]">Resources</Link>
                <span aria-hidden="true" className="mx-2">/</span>
                <span aria-current="page" className="text-[#1B1B1B]">{title}</span>
              </>
            )}
          </nav>
          <h1
            className="mt-4 font-halenoir font-bold tracking-[-0.02em] text-[#1B1B1B]"
            style={{ fontSize: "clamp(2rem, 1.4rem + 2.4vw, 3rem)", lineHeight: 1.1 }}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-3 max-w-2xl text-[16px] sm:text-[18px] leading-relaxed text-[#5D6570]">{subtitle}</p>}

          <nav aria-label="Resources sections" className="mt-7">
            <ul className="flex flex-wrap gap-2">
              {NAV.map((item) => {
                const active = isActive(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex min-h-[40px] items-center rounded-full border px-4 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] ${
                        active
                          ? "bg-[#111111] border-[#111111] text-white"
                          : "bg-white border-[#E5E7EB] text-[#374151] hover:border-[#111111]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Container>
      </header>

      <Container className="py-10 sm:py-14">{children}</Container>
    </PageShell>
  );
}
