// LandingHero.tsx — Static layout, Black and Peach buttons
import { Link } from "react-router-dom";
import { ArrowRight, Crown, Sparkles } from "lucide-react";

const features = [
  { text: "1 Lakh+ NCERT Bank" },
  { text: "CBSE Pattern Ready" },
  { text: "PDF & DOCX Export" },
  { text: "Answer Key Included" },
  { text: "Section-wise Papers" },
  { text: "Bloom's Taxonomy" },
];

export default function LandingHero() {
  return (
    <section
      className="relative isolate overflow-hidden flex items-center justify-center bg-white w-full"
      style={{ minHeight: "min(90vh, 860px)" }}
    >
      {/* ── Background: COMPLETELY WHITE ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-white z-0" />

      {/* ── Content Layout ── */}
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8 pt-28 sm:pt-32 md:pt-36 pb-12 sm:pb-16 md:pb-24 bg-transparent relative z-10 flex flex-col items-center">

        {/* Badge — Peach */}
        <div className="flex justify-center w-full">
          <div
            className="mb-5 sm:mb-7 inline-flex items-center gap-2 rounded-[12px] px-4 py-2 border shadow-xs"
            style={{ backgroundColor: "#fff0f1", borderColor: "#fecdd3", color: "#f75961" }}
          >
            <Sparkles className="h-4 w-4" style={{ color: "#f75961" }} />
            <span className="text-xs sm:text-sm font-bold">1 Lakh+ NCERT Questions Ready</span>
          </div>
        </div>

        {/* ── Headline Block ── */}
        <div className="text-center relative z-10 w-full">
          <h1 className="font-halenoir font-bold tracking-[-0.02em]" style={{ lineHeight: 1 }}>
            <span className="block lg:whitespace-nowrap text-neutral-900" style={{ fontSize: "clamp(2.4rem, 8vw, 7.2rem)" }}>
              You Teach.{" "}
              <span className="text-[#f75961]" style={{ color: "#f75961" }}>
                a4ai Handles
              </span>
            </span>

            <span
              className="mt-3 sm:mt-5 md:mt-6 block font-bold tracking-[-0.01em] text-neutral-700"
              style={{ fontSize: "clamp(0.95rem, 2.5vw, 2.2rem)", lineHeight: 1.2 }}
            >
              the Test Papers, Attendance &amp; Report Cards.
            </span>
          </h1>

          <p
            className="mx-auto mt-4 sm:mt-5 md:mt-7 max-w-[90%] sm:max-w-lg md:max-w-2xl leading-relaxed text-neutral-600 font-medium"
            style={{ fontSize: "clamp(0.85rem, 1.3vw, 1.1rem)" }}
          >
            Drag &amp; drop from 1 Lakh+ NCERT questions — paper ready in 10 seconds.
            Or let AI build it — done in under 2 minutes. Section-wise, with answer keys, ready to print.
          </p>

          {/* ── Action Buttons: Black & Peach ── */}
          <div className="relative mt-8 sm:mt-10 md:mt-12 flex flex-col items-center justify-center gap-3 sm:gap-4 sm:flex-row">
            {/* Try for FREE — Black Button */}
            <div className="w-full sm:w-auto">
              <Link to="/dashboard/test-generator" className="w-full block">
                <button
                  className="w-full sm:w-auto bg-black text-white rounded-[14px] px-8 py-3.5 font-bold flex items-center justify-center gap-2.5 hover:bg-neutral-800 transition-colors cursor-pointer"
                  style={{ minHeight: 48, fontSize: "0.95rem" }}
                >
                  <span>Try for FREE</span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0" />
                </button>
              </Link>
            </div>

            {/* View Pricing — Peach Button */}
            <div className="w-full sm:w-auto">
              <Link to="/pricing" className="w-full block">
                <button
                  className="w-full sm:w-auto bg-[#f75961] hover:bg-[#e8454d] text-white rounded-[14px] px-8 py-3.5 font-bold flex items-center justify-center gap-2.5 transition-colors cursor-pointer border border-[#f75961]"
                  style={{
                    minHeight: 48,
                    fontSize: "0.95rem",
                  }}
                >
                  <Crown className="h-4 w-4 flex-shrink-0 text-white" />
                  <span>View Pricing</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Feature Pills — static flex wrap */}
          <div className="mt-10 sm:mt-12 md:mt-16 w-full max-w-4xl mx-auto flex flex-wrap justify-center gap-3">
            {features.map((f, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 border border-gray-200 rounded-[10px] px-4 py-2 text-xs font-bold text-gray-700 bg-white shadow-xs"
              >
                {f.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}