// PageShell.tsx — shared frame for the marketing pages (About, Features,
// Resources): the landing page's Navbar + Footer, its container width and its
// section-heading style, so every page looks like the landing page.
import type { ReactNode } from "react";
import { Helmet } from "react-helmet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-6 min-h-[48px] text-[15px] font-bold text-white hover:bg-[#222222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F95D6A] focus-visible:ring-offset-2";
export const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 min-h-[48px] text-[15px] font-bold text-[#D93F4D] border-2 border-[#F95D6A] hover:bg-[#FFF1EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "center" | "left";
}) {
  const center = align === "center";
  return (
    <div className={center ? "text-center" : ""}>
      {eyebrow && (
        <p className="text-xs sm:text-[13px] font-semibold uppercase tracking-[0.14em] text-[#D93F4D]">{eyebrow}</p>
      )}
      <h2
        id={id}
        className="mt-3 font-halenoir font-bold tracking-[-0.02em] text-[#1B1B1B] text-[1.75rem] leading-tight sm:text-[2.25rem]"
      >
        {title}
      </h2>
      {sub && (
        <p className={`mt-3 text-[15px] sm:text-[17px] leading-relaxed text-[#5D6570] ${center ? "mx-auto max-w-2xl" : "max-w-2xl"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown>;
}

export default function PageShell({ meta, children }: { meta: PageMeta; children: ReactNode }) {
  const url = `https://a4ai.in${meta.path}`;
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1B1B1B]">
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        {meta.jsonLd && <script type="application/ld+json">{JSON.stringify(meta.jsonLd)}</script>}
      </Helmet>
      <Navbar />
      <main id="main-content" className="flex-grow pt-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}
