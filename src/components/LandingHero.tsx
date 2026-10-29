// LandingHero.tsx — two-column hero: message + CTAs on the left, the switchable
// product showcase on the right. On phones the order is text → CTAs → showcase
// → capability chips, so the main CTA stays near the top.
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import FeatureShowcase from "@/components/landing/FeatureShowcase";

const CAPABILITY_CHIPS = [
  "NCERT Question Bank",
  "CBSE-Pattern Assessments",
  "PDF & DOCX Export",
  "Answer Keys Included",
  "Section-Wise Layout",
];

export default function LandingHero() {
  return (
    <section className="relative bg-white w-full pt-[88px] sm:pt-24 lg:pt-[104px] pb-12 sm:pb-16 lg:pb-20">
      <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-[minmax(0,44fr)_minmax(0,56fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12 xl:gap-x-16 lg:gap-y-8 items-start">
          {/* Message */}
          <div className="min-w-0 lg:pt-6 xl:pt-10">
            <span className="inline-flex items-center rounded-full px-3.5 py-1 mb-5 text-xs sm:text-[13px] font-semibold bg-[#FFF1EC] text-[#D93F4D]">
              Practical tools for modern teachers
            </span>

            <h1
              className="font-halenoir font-bold tracking-[-0.02em] text-[#1B1B1B] mb-5"
              style={{ fontSize: "clamp(2.25rem, 1.4rem + 3.2vw, 3.75rem)", lineHeight: 1.08 }}
            >
              <span className="block">You teach.</span>
              <span className="block text-[#F95D6A]">a4ai handles</span>
              <span className="block">the rest.</span>
            </h1>

            <p className="text-[16px] sm:text-[18px] text-[#5D6570] leading-relaxed max-w-[34rem] mb-7 sm:mb-8">
              Create test papers, evaluate student answers, manage attendance, and prepare reports from one
              connected workspace.
            </p>

            <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-3 sm:gap-4">
              <Link
                to="/dashboard/test-generator"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-7 min-h-[50px] text-[15px] font-bold text-white hover:bg-[#222222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F95D6A] focus-visible:ring-offset-2"
              >
                Try for FREE
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center rounded-xl bg-white px-7 min-h-[50px] text-[15px] font-bold text-[#D93F4D] border-2 border-[#F95D6A] hover:bg-[#FFF1EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"
              >
                View Pricing
              </Link>
            </div>
          </div>

          {/* Product showcase */}
          <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <FeatureShowcase />
          </div>

          {/* Capability chips */}
          <ul className="min-w-0 lg:col-start-1 lg:row-start-2 flex flex-wrap gap-2" aria-label="Test Generator capabilities">
            {CAPABILITY_CHIPS.map((chip) => (
              <li
                key={chip}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-medium text-[#5D6570]"
              >
                <Check className="h-3.5 w-3.5 text-[#047857]" aria-hidden="true" />
                {chip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
