// LegalLayout.tsx — frame for the legal pages (Terms, Cookie Policy): the
// landing Navbar/Footer and a narrow, readable text column. No animation.
import type { ReactNode } from "react";
import PageShell, { Container } from "@/components/site/PageShell";

export default function LegalLayout({
  title,
  updated,
  description,
  path,
  children,
}: {
  title: string;
  updated: string;
  description: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <PageShell meta={{ title: `${title} — a4ai`, description, path }}>
      <Container className="py-12 sm:py-16">
        <article className="mx-auto max-w-[720px]">
          <h1
            className="font-halenoir font-bold tracking-[-0.02em] text-[#1B1B1B]"
            style={{ fontSize: "clamp(2rem, 1.4rem + 2.2vw, 2.75rem)", lineHeight: 1.1 }}
          >
            {title}
          </h1>
          <p className="mt-2 text-[14px] font-medium text-[#5D6570]">{updated}</p>
          <div className="a4-legal mt-8">{children}</div>
        </article>
      </Container>
    </PageShell>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[#E5E7EB] py-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-bold text-[#1B1B1B]">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-[#374151] [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_a]:font-semibold [&_a]:text-[#D93F4D] [&_a:hover]:underline">
        {children}
      </div>
    </section>
  );
}
