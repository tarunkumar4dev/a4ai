// FeaturesPage.tsx — what a4ai does today, grouped by job. Only capabilities
// that exist in this codebase are listed, each with a route that works. Rows
// reuse the landing showcase's screenshots and pastel themes; a row without a
// screenshot is a text card.
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck,
  Check,
  ClipboardList,
  FileText,
  ScanLine,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import PageShell, { BTN_PRIMARY, BTN_SECONDARY, Container } from "@/components/site/PageShell";
import TestGeneratorPreview from "@/components/landing/TestGeneratorPreview";
import { THEMES, getScreenshot, type ShowcaseTheme } from "@/components/landing/featureSlides";

interface Category {
  id: string;
  label: string;
  Icon: LucideIcon;
  title: string;
  description: string;
  bullets: string[];
  theme: ShowcaseTheme;
  /** screenshot id in src/assets/features, or the coded Test Generator preview */
  shot?: string | "test-generator";
  alt?: string;
  links: { label: string; to: string }[];
}

const CATEGORIES: Category[] = [
  {
    id: "assessments",
    label: "Test papers",
    Icon: FileText,
    title: "Create exam-ready test papers",
    description:
      "Pick a subject and chapters from the NCERT question library, add questions by type and marks, and export a print-ready paper with its answer key.",
    bullets: [
      "Chapter-wise NCERT question library",
      "MCQ, short and long answer questions with answer keys",
      "PDF & DOCX export with your institute logo and watermark",
    ],
    theme: "coral",
    shot: "test-generator",
    alt: "a4ai Test Generator: subject, class and chapter selection for a new test paper",
    links: [{ label: "Open Test Generator", to: "/dashboard/test-generator" }],
  },
  {
    id: "evaluation",
    label: "Copy checking",
    Icon: ScanLine,
    title: "Check handwritten copies with AI",
    description:
      "Photograph each student's answer sheet. AI marks every question against your answer key; you review the marks and comments before anything is published.",
    bullets: [
      "Multi-page photos from your phone camera",
      "Question-wise marks and comments",
      "Teacher review and approval before results go out",
    ],
    theme: "aqua",
    shot: "paper-checker",
    alt: "A handwritten answer sheet with question-wise marks and comments from the a4ai copy checker",
    links: [{ label: "Check copies", to: "/dashboard/test-generator?tab=check" }],
  },
  {
    id: "assignments",
    label: "Assignments",
    Icon: ClipboardList,
    title: "Collect assignments with one link",
    description:
      "Share an upload link on WhatsApp. Students submit photos or PDFs before the deadline, and you see every submission, its status and marks in one table.",
    bullets: [
      "Upload link with deadline, attempts and late policy",
      "Submission tracking and AI checking",
      "Publish results to students",
    ],
    theme: "magenta",
    shot: "assignments",
    alt: "a4ai assignment page with a student upload link and a table of submitted copies",
    links: [{ label: "Open dashboard", to: "/dashboard" }],
  },
  {
    id: "attendance",
    label: "Attendance",
    Icon: CalendarCheck,
    title: "Attendance and the academic calendar",
    description:
      "Teachers mark their own classes. Admins and HODs see which classes are marked today and export day sheets and monthly reports. Deadlines, exams and events sit on a shared calendar.",
    bullets: [
      "Faculty marking tracker for admins and HODs",
      "Batch-wise monthly report and day-sheet export",
      "Calendar with month, week and agenda views",
    ],
    theme: "green",
    shot: "attendance",
    alt: "a4ai attendance page with the faculty marking tracker and daily summary cards",
    links: [{ label: "Open dashboard", to: "/dashboard" }],
  },
  {
    id: "analytics",
    label: "Analytics",
    Icon: BarChart3,
    title: "See how each class is doing",
    description:
      "Marks and attendance analytics per batch: trends over time, a marking breakdown and a watchlist of students below the attendance cutoff.",
    bullets: ["Marks and attendance views", "Defaulter watchlist", "Export reports"],
    theme: "lavender",
    shot: "analytics",
    alt: "a4ai attendance analytics with attendance rate, trajectory chart and marking breakdown (sample data)",
    links: [{ label: "Open dashboard", to: "/dashboard" }],
  },
  {
    id: "engagement",
    label: "Contests",
    Icon: Trophy,
    title: "Live contests and quizzes",
    description:
      "Run timed contests for your class with camera-based proctoring and tab-switch detection, then show the results with a podium and full ranking. Turn a YouTube lesson into a live quiz.",
    bullets: [
      "Timed contests with camera proctoring and tab-switch detection",
      "Leaderboard with podium, ranking table and CSV export",
      "Video to live quiz from a YouTube link",
    ],
    theme: "pink",
    links: [
      { label: "View contests", to: "/contests" },
      { label: "Create a video quiz", to: "/teacher/community-quiz/new" },
    ],
  },
  {
    id: "institute",
    label: "Institutes",
    Icon: Building2,
    title: "Run a whole institute",
    description:
      "Departments, sections and batches with a role for every admin, HOD, proctor and subject teacher — each sees only their own classes. Students get a portal with an access code.",
    bullets: [
      "Admin, HOD, proctor and teacher roles",
      "Bulk student upload from Excel",
      "Student portal for assignments and results",
    ],
    theme: "orange",
    shot: "institute-management",
    alt: "a4ai institute dashboard showing departments, teachers, students and batches",
    links: [{ label: "Talk to us", to: "/contact" }],
  },
];

function Media({ c }: { c: Category }) {
  if (c.shot === "test-generator") {
    return (
      <div role="img" aria-label={c.alt} className="a4-showcase-media relative aspect-[4/3] sm:aspect-[16/10] bg-[#F7F8FA]">
        <div aria-hidden="true" className="absolute inset-0">
          <TestGeneratorPreview />
        </div>
      </div>
    );
  }
  const shot = c.shot ? getScreenshot(c.shot) : null;
  if (!shot) return null;
  return (
    <div className="relative aspect-[16/10] bg-white">
      <img
        src={shot.src}
        srcSet={shot.srcSet}
        sizes="(min-width: 1024px) 560px, 92vw"
        width={shot.width}
        height={shot.height}
        alt={c.alt ?? ""}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}

function CategoryRow({ c, flip }: { c: Category; flip: boolean }) {
  const theme = THEMES[c.theme];
  const hasMedia = c.shot === "test-generator" || Boolean(c.shot && getScreenshot(c.shot));
  return (
    <section
      id={c.id}
      aria-labelledby={`${c.id}-title`}
      className="scroll-mt-24 rounded-[28px] border border-black/[0.04] p-5 sm:p-8 lg:p-10"
      style={{ backgroundImage: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
    >
      <div className={hasMedia ? "grid items-center gap-8 lg:grid-cols-2 lg:gap-12" : ""}>
        <div className={flip && hasMedia ? "lg:order-2" : ""}>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/80" style={{ color: theme.accent }}>
            <c.Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2
            id={`${c.id}-title`}
            className="mt-4 font-halenoir font-bold tracking-[-0.02em] text-[#1B1B1B] text-[1.6rem] sm:text-[2rem] leading-tight"
          >
            {c.title}
          </h2>
          <p className="mt-3 max-w-xl text-[15px] sm:text-[17px] leading-relaxed text-[#374151]">{c.description}</p>
          <ul className={`mt-5 gap-2.5 ${hasMedia ? "grid" : "grid sm:grid-cols-3"}`}>
            {c.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[15px] font-medium text-[#1B1B1B]">
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.accent }} aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {c.links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md text-[15px] font-bold text-[#111111] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
              >
                {l.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>

        {hasMedia && (
          <div className={`overflow-hidden rounded-[18px] border border-black/[0.08] bg-white shadow-[0_10px_30px_rgba(17,17,17,0.08)] ${flip ? "lg:order-1" : ""}`}>
            <Media c={c} />
          </div>
        )}
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <PageShell
      meta={{
        title: "Features — a4ai",
        description:
          "Test papers from the NCERT question library, AI copy checking, assignment upload links, attendance, analytics, live contests and institute management.",
        path: "/features",
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "a4ai features",
          url: "https://a4ai.in/features",
        },
      }}
    >
      <section
        className="pt-16 pb-10 sm:pt-20 sm:pb-12"
        style={{ background: "radial-gradient(900px 420px at 50% 0%, #FFF1EC 0%, rgba(255,255,255,0) 70%)" }}
      >
        <Container className="text-center">
          <span className="inline-flex items-center rounded-full px-3.5 py-1 text-xs sm:text-[13px] font-semibold bg-[#FFF1EC] text-[#D93F4D]">
            Features
          </span>
          <h1
            className="mx-auto mt-5 max-w-3xl font-halenoir font-bold tracking-[-0.02em] text-[#1B1B1B]"
            style={{ fontSize: "clamp(2.1rem, 1.3rem + 3vw, 3.5rem)", lineHeight: 1.1 }}
          >
            Everything you teach with, <span className="text-[#F95D6A]">in one place</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] sm:text-[18px] leading-relaxed text-[#5D6570]">
            From the test paper to the checked copy to the attendance report — the tools teachers and institutes use
            every day.
          </p>
          <div className="mt-7 flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center justify-center gap-3">
            <Link to="/dashboard/test-generator" className={BTN_PRIMARY}>
              Try for FREE <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/pricing" className={BTN_SECONDARY}>
              View Pricing
            </Link>
          </div>

          <nav aria-label="Feature categories" className="mt-10">
            <ul className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    className="inline-flex min-h-[40px] items-center rounded-full border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#374151] hover:border-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </section>

      <Container className="space-y-6 sm:space-y-8 pb-16 sm:pb-24">
        {CATEGORIES.map((c, i) => (
          <CategoryRow key={c.id} c={c} flip={i % 2 === 1} />
        ))}
      </Container>
    </PageShell>
  );
}
