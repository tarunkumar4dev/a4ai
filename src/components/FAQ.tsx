import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export type FAQItem = { q: string; a: React.ReactNode };

const DEFAULT_FAQS: FAQItem[] = [
  {
    q: "Why real-time vs. a regular AI notetaker?",
    a: "Real-time guidance lets a4ai adapt questions and test blueprints as you set constraints—no back-and-forth regeneration, less rework, and better alignment.",
  },
  {
    q: "Who is a4ai for?",
    a: "Teachers, coaching institutes, and schools that want fast, consistent, curriculum-aligned assessments with analytics.",
  },
  {
    q: "Is a4ai free?",
    a: "We offer a generous free plan to try generation and exporting. Pro unlocks larger limits, branding controls, and advanced analytics.",
  },
  {
    q: "How does it stay aligned with my syllabus?",
    a: "We score content against your outcomes and keywords, apply rubric checks, and surface coverage gaps before you export.",
  },
  {
    q: "What question types are supported?",
    a: "MCQ (single/multi), short/long answer, cloze, match-the-following, case-based passages, and more—plus auto answer keys.",
  },
  {
    q: "Can I talk to support?",
    a: (
      <>
        Absolutely. Email <a href="mailto:support@a4ai" className="underline">support@a4ai</a> or use the contact page—average response time under 24h.
      </>
    ),
  },
];

type Props = {
  title?: string;
  subtitle?: string;
  items?: FAQItem[];
  id?: string;
};

export default function FAQ({ 
  title = "Frequently asked questions",
  subtitle = "Short, practical answers about a4ai.",
  items = DEFAULT_FAQS,
  id = "faq",
}: Props) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id={id} className="relative py-20 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
      {/* faint grid */}
      <div className="pointer-events-none absolute inset-0 bg-[url('/images/grid.svg')] opacity-[0.04] dark:opacity-[0.02]" />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">{subtitle}</p>
        </div>

        <div className="divide-y divide-black/10 rounded-2xl border border-black/10 bg-white shadow-sm dark:divide-white/10 dark:border-white/10 dark:bg-gray-900">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="group">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left hover:bg-black/[.02] dark:hover:bg-white/[.03] focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                    {item.q}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="shrink-0 rounded-full border border-black/10 p-1 text-gray-700 dark:border-white/10 dark:text-gray-200"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-5 pb-6 pt-0 text-base md:text-[1.05rem] text-gray-700 dark:text-gray-300">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* tiny CTA under list */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-300">
          Didn’t find what you were looking for?{" "}
          <a href="/contact" className="underline underline-offset-4 hover:no-underline">
            Contact support
          </a>
          .
        </div>
      </div>
    </section>
  );
}
