import React, { memo } from "react";
import Navbar from "@/components/Navbar";
import LandingHero from "@/components/LandingHero";
import Footer from "@/components/Footer";
import Partners from "@/components/landing/Partners";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  FileText,
  Download,
  Settings,
  User,
  Crown,
  Brain,
  Youtube,
  Grid,
  BookOpen,
  Search,
  Wand2,
  GraduationCap,
  Clock,
  CheckCircle2,
  Users,
  BarChart3,
  Building,
  School,
  ChevronDown
} from "lucide-react";

/* ══════════════════════════════════════════════
   ERROR BOUNDARY
   ══════════════════════════════════════════════ */
class Safe extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; label?: string },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown, info: unknown) {
    console.error(`[a4ai] Section "${this.props.label ?? "section"}" failed:`, err, info);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

/* ══════════════════════════════════════════════
   VERIFIED DATA CONSTANTS
   ══════════════════════════════════════════════ */

const CAPABILITY_STRIP_DATA = [
  {
    icon: BookOpen,
    value: "1 Lakh+",
    label: "NCERT Questions",
    desc: "Classes 6–12 CBSE aligned",
    tint: "bg-[#FFF1EC] text-[#D93F4D]"
  },
  {
    icon: FileText,
    value: "PDF & DOCX",
    label: "Export Ready",
    desc: "Print-ready with answer keys",
    tint: "bg-[#E8F6F1] text-[#047857]"
  },
  {
    icon: GraduationCap,
    value: "CBSE & State",
    label: "Curricula Covered",
    desc: "Chapter-wise & Bloom's tagged",
    tint: "bg-[#F0EDFF] text-[#6019C5]"
  },
  {
    icon: Clock,
    value: "< 2 Mins",
    label: "Per Assessment",
    desc: "Section-wise balanced layout",
    tint: "bg-[#FFF7E0] text-[#B45309]"
  }
];

const PROBLEM_SOLUTIONS = [
  {
    icon: FileText,
    title: "Preparing Assessments",
    desc: "Generate balanced CBSE-pattern papers with answer keys from our 1 Lakh+ NCERT question bank in seconds."
  },
  {
    icon: CheckCircle2,
    title: "Evaluating Answer Copies",
    desc: "AI-assisted checking of handwritten student sheets with question-by-question scoring and rubric feedback."
  },
  {
    icon: Users,
    title: "Classroom Operations",
    desc: "Manage class attendance, timetables, and batch assignments from one connected, role-based dashboard."
  },
  {
    icon: BarChart3,
    title: "Academic Performance Reports",
    desc: "Track student growth, subject weak areas, and department analytics without manual spreadsheet entry."
  }
];

const AI_TOOLS_DATA = [
  {
    icon: Wand2,
    title: "AI Paper Checker",
    tagline: "Instant answer sheet & assignment grading",
    desc: "Scan and grade student handwritten copies and test sheets with question-by-question scoring, rubric feedback, and step analysis.",
    cta: "Check Papers",
    href: "/dashboard/test-generator?tab=check",
    highlights: ["Handwritten copies supported", "Rubric & step-wise grading", "Instant student analysis"],
    tint: "bg-[#FFF1EC] text-[#D93F4D]"
  },
  {
    icon: Brain,
    title: "Test Generator",
    tagline: "CBSE & State Board papers in < 2 mins",
    desc: "Select subject, chapters, and question types. Generates a balanced, print-ready PDF or Word document with complete answer keys.",
    cta: "Create Test",
    href: "/dashboard/test-generator",
    highlights: ["Bloom's taxonomy spread", "Bilingual English & Hindi", "1-click PDF/DOCX export"],
    tint: "bg-[#FFF1EC] text-[#D93F4D]"
  },
  {
    icon: Youtube,
    title: "Video to Live Quiz",
    tagline: "Turn educational videos into quizzes",
    desc: "Paste any educational YouTube URL. AI extracts the core concepts, generates timed MCQs, and launches a live contest.",
    cta: "Create Quiz",
    href: "/teacher/community-quiz/new",
    highlights: ["Automatic video transcripts", "Multiplayer live contest", "Instant class leaderboards"],
    tint: "bg-[#F0EDFF] text-[#6019C5]"
  },
  {
    icon: Grid,
    title: "Worksheet Studio",
    tagline: "Custom homework & drill sheets",
    desc: "Design structured practice drill sheets with diagrams, step spaces, and formulas tailored to your classroom syllabus.",
    cta: "Open Studio",
    href: "/dashboard",
    highlights: ["Curriculum aligned", "Formatted for clean print", "Difficulty progression"],
    tint: "bg-[#E8F6F1] text-[#047857]"
  },
  {
    icon: BookOpen,
    title: "Smart Flashcards",
    tagline: "High-retention study cards",
    desc: "Convert lengthy textbook chapters and complex formulas into active-recall digital flashcards for high-retention revision.",
    cta: "Explore Cards",
    href: "/dashboard/flashcards",
    highlights: ["Spaced recall format", "Chapter-wise summaries", "Mobile-friendly revision"],
    tint: "bg-[#FFF7E0] text-[#B45309]"
  },
  {
    icon: Search,
    title: "PYQ Question Bank",
    tagline: "Past 10-year board questions",
    desc: "Search, filter, and assign verified Previous Year Questions with official marking rubrics and step-by-step solutions.",
    cta: "Browse PYQs",
    href: "/practice/zone",
    highlights: ["CBSE past 10 years", "Chapter-wise breakdown", "Marking scheme included"],
    tint: "bg-[#FFF1EC] text-[#D93F4D]"
  }
];

const HOW_STEPS = [
  {
    step: "01",
    title: "Set Your Parameters",
    desc: "Select subject, class, chapters, difficulty level, and marks distribution matching your syllabus.",
    Icon: Settings
  },
  {
    step: "02",
    title: "Generate from 1 Lakh+ NCERT",
    desc: "Questions are pulled directly from our verified NCERT bank with Bloom's taxonomy tags and complete answer keys.",
    Icon: FileText
  },
  {
    step: "03",
    title: "Download, Print or Share",
    desc: "Export print-ready CBSE-pattern PDF or DOCX files, or share digital links directly to your class via WhatsApp.",
    Icon: Download
  }
];

const AUDIENCES = [
  {
    icon: User,
    title: "Individual Teachers",
    desc: "Eliminate repetitive paper formatting. Create unique test papers and auto-grade assignments in minutes, freeing up time for direct student mentoring.",
    features: ["1 Lakh+ NCERT question bank", "PDF & Word export with answer keys", "AI handwritten copy checking", "1 free test paper every month"],
    cta: "Start as Teacher",
    href: "/dashboard/test-generator"
  },
  {
    icon: Building,
    title: "Coaching Institutes",
    desc: "Standardize test series across multiple batches, run proctored weekly tests, and track comparative batch analytics from a centralized portal.",
    features: ["Batch-wise test distribution", "Live contest leaderboards", "Custom institute branding on papers", "Student assignment portals"],
    cta: "View Institute Plans",
    href: "/pricing"
  },
  {
    icon: School,
    title: "Schools & Colleges",
    desc: "Role-based academic governance for Principals, HODs, proctors, and subject teachers with attendance tracking and department performance analytics.",
    features: ["HOD & proctor access hierarchy", "Section attendance & timetable", "Unified question repository", "Official marks & reports export"],
    cta: "Explore Solutions",
    href: "/pricing"
  }
];

const TESTIMONIALS = [
  {
    quote: "a4ai has saved me hours every week. The questions actually match what's in the NCERT textbook — no random internet stuff.",
    name: "Rahul Verma",
    role: "Director, Education Beast"
  },
  {
    quote: "Perfect for creating differentiated assessments. I set chapters and difficulty, and the paper comes out section-wise ready to print.",
    name: "Abhay Gupta",
    role: "Director, Chanakya Institute"
  },
  {
    quote: "Surprised by the accuracy. Questions come straight from NCERT content with proper Bloom's levels. Saves me 3-4 hours per week.",
    name: "Aman Singh",
    role: "Chemistry Teacher (10+ Years Exp)"
  }
];

const FAQ_ITEMS = [
  {
    question: "What is a4ai?",
    answer: "a4ai (AI for All India) is an EdTech SaaS platform designed specifically for Indian teachers, coaching centres, and schools. It streamlines test paper generation, handwritten copy evaluation, classroom attendance, and student progress reports in one unified system."
  },
  {
    question: "Which classes and curricula are supported?",
    answer: "a4ai natively supports CBSE curriculum for Classes 6 through 12 across major subjects (Mathematics, Science, Social Science, Physics, Chemistry, Biology, and others) with a verified bank of 1 Lakh+ NCERT questions tagged by chapter, topic, and Bloom's taxonomy."
  },
  {
    question: "How does the test generator work?",
    answer: "You simply select your subject, class, chapters, question types (MCQ, short answer, long answer, case-based), and total marks. The system generates a structured, section-wise CBSE assessment with matching answer keys and solutions in under two minutes."
  },
  {
    question: "What export formats are available?",
    answer: "Assessments can be exported as clean, print-ready PDF documents or editable Word (DOCX) files. Paid plans allow adding custom institute logos and headers without any watermarks."
  },
  {
    question: "Can coaching institutes and schools use a4ai?",
    answer: "Yes. a4ai includes multi-tier institutional management supporting Admins, Department HODs, Section Proctors, and Subject Teachers with batch timetables, attendance tracking, and student upload portals."
  },
  {
    question: "What is included in the free plan?",
    answer: "The Free plan allows you to generate test papers and evaluate student work each month with complete access to the NCERT question bank and unwatermarked PDF export. No credit card or payment info is ever required to get started."
  }
];

/* ══════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ══════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1B1B1B]">
      <Navbar />

      <main id="main-content" className="flex-grow bg-white">
        {/* 1. Hero */}
        <Safe label="Hero" fallback={<div className="min-h-[500px]" />}>
          <LandingHero />
        </Safe>

        {/* 2. Capability / Trust Strip */}
        <Safe label="CapabilityStrip">
          <CapabilityStrip />
        </Safe>

        {/* 3. Problem and Solution */}
        <Safe label="ProblemSolution">
          <ProblemSolution />
        </Safe>

        {/* 4. AI Tools / Product Ecosystem */}
        <Safe label="AiToolsSuite">
          <AiToolsSuite />
        </Safe>

        {/* 5. How It Works */}
        <Safe label="HowItWorks">
          <HowItWorks />
        </Safe>

        {/* 6. Audience & Use-Cases */}
        <Safe label="AudienceSection">
          <AudienceSection />
        </Safe>

        {/* 7. Partners (pricing lives on /pricing, linked from the navbar) */}
        <Safe label="Partners">
          <Partners />
        </Safe>

        {/* 8. Testimonials */}
        <Safe label="Testimonials">
          <Testimonials />
        </Safe>

        {/* 9. FAQ */}
        <Safe label="FAQ">
          <FAQ />
        </Safe>

        {/* 10. Final CTA */}
        <Safe label="FinalCTA">
          <FinalCTA />
        </Safe>
      </main>

      <Footer />
    </div>
  );
}

/* ══════════════════════════════════════════════
   SECTION COMPONENTS
   ══════════════════════════════════════════════ */

/** 2. Capability Strip */
const CapabilityStrip = memo(function CapabilityStrip() {
  return (
    <section className="border-y border-[#E5E7EB] bg-[#F7F8FA] py-8 sm:py-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {CAPABILITY_STRIP_DATA.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-start gap-3.5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tint}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-bold text-[#1B1B1B] sm:text-xl">{item.value}</div>
                  <div className="text-xs font-semibold text-[#1B1B1B] sm:text-sm">{item.label}</div>
                  <div className="text-xs text-[#5D6570]">{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

/** 3. Problem and Solution */
const ProblemSolution = memo(function ProblemSolution() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-white">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16 items-center">
          {/* Left Column: Problem context */}
          <div className="lg:col-span-5">
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-[#FFF1EC] text-[#D93F4D] mb-4">
              Grounded Education SaaS
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1B1B1B] leading-tight mb-4">
              Spend time teaching, not typing question papers.
            </h2>
            <p className="text-base text-[#5D6570] leading-relaxed mb-6 font-normal">
              Indian educators spend up to 6 hours every week searching question banks, formatting paper layouts, creating answer keys, and grading student tests.
            </p>
            <p className="text-base text-[#5D6570] leading-relaxed mb-8 font-normal">
              a4ai replaces disconnected tools and handwritten routines with a single, curriculum-aligned workspace engineered for Indian classrooms.
            </p>

            <div className="flex items-center gap-3">
              <Link
                to="/dashboard/test-generator"
                className="inline-flex items-center gap-2 rounded-xl bg-[#111111] px-6 py-3 text-sm font-semibold text-white hover:bg-[#222222]"
                style={{ minHeight: 44 }}
              >
                <span>Try the Generator</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-5 py-3 text-sm font-medium text-[#1B1B1B] hover:bg-[#F7F8FA]"
                style={{ minHeight: 44 }}
              >
                Learn Our Story
              </Link>
            </div>
          </div>

          {/* Right Column: 4 Workflow cards */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PROBLEM_SOLUTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F8FA] border border-[#E5E7EB] text-[#F95D6A] mb-4">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-[#1B1B1B] mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#5D6570] leading-relaxed font-normal">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

/** 4. AI Tools / Product Ecosystem */
const AiToolsSuite = memo(function AiToolsSuite() {
  return (
    <section id="ai-tools" className="border-t border-[#E5E7EB] bg-[#F7F8FA] py-16 sm:py-20 lg:py-24 scroll-mt-16">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 sm:mb-16 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-[#FFF1EC] text-[#D93F4D] mb-3">
            Product Ecosystem
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1B1B1B]">
            Everything you need for your teaching workflow
          </h2>
          <p className="mt-3 text-base text-[#5D6570] font-normal">
            A cohesive suite of tools built for individual teachers, coaching institutes, and schools across India.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {AI_TOOLS_DATA.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.title}
                className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-7 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tool.tint}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-[#1B1B1B]">
                    {tool.title}
                  </h3>
                  <p className="text-xs font-semibold text-[#D93F4D] mt-1 mb-2">
                    {tool.tagline}
                  </p>
                  <p className="text-sm text-[#5D6570] leading-relaxed mb-6 font-normal">
                    {tool.desc}
                  </p>

                  <div className="space-y-2 mb-6">
                    {tool.highlights.map((h) => (
                      <div key={h} className="flex items-center gap-2 text-xs font-medium text-[#1B1B1B]">
                        <Check className="h-3.5 w-3.5 text-[#047857] shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#F1F3F5]">
                  <Link
                    to={tool.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B1B1B] hover:text-[#F95D6A]"
                  >
                    <span>{tool.cta}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

/** 5. How It Works */
const HowItWorks = memo(function HowItWorks() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-white border-t border-[#E5E7EB]">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 sm:mb-16 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-[#FFF1EC] text-[#D93F4D] mb-3">
            Streamlined Workflow
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1B1B1B]">
            How It Works
          </h2>
          <p className="mt-3 text-base text-[#5D6570] font-normal">
            From syllabus selection to print-ready test papers in three simple steps.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 list-none p-0">
          {HOW_STEPS.map((step) => {
            const Icon = step.Icon;
            return (
              <li
                key={step.title}
                className="relative flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-[#F7F8FA] p-6 sm:p-8"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-2xl font-black text-[#F95D6A] font-halenoir">
                      {step.step}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-[#E5E7EB] text-[#5D6570]">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-[#1B1B1B] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#5D6570] leading-relaxed font-normal">
                    {step.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
});

/** 6. Audience & Use-Cases */
const AudienceSection = memo(function AudienceSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-[#F7F8FA] border-t border-[#E5E7EB]">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 sm:mb-16 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-[#FFF1EC] text-[#D93F4D] mb-3">
            Built For Indian Education
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1B1B1B]">
            Tailored for every educational setting
          </h2>
          <p className="mt-3 text-base text-[#5D6570] font-normal">
            Whether you are an independent teacher preparing weekly tests or an institute head managing hundreds of students.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {AUDIENCES.map((aud) => {
            const Icon = aud.icon;
            return (
              <div
                key={aud.title}
                className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-xs"
              >
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF1EC] text-[#D93F4D] mb-5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1B1B1B] mb-2">
                    {aud.title}
                  </h3>
                  <p className="text-sm text-[#5D6570] leading-relaxed mb-6 font-normal">
                    {aud.desc}
                  </p>

                  <div className="space-y-2.5 mb-8">
                    {aud.features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-xs font-medium text-[#1B1B1B]">
                        <Check className="h-3.5 w-3.5 text-[#047857] shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  to={aud.href}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 py-3 text-sm font-semibold text-white hover:bg-[#222222]"
                  style={{ minHeight: 44 }}
                >
                  <span>{aud.cta}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

/** 8. Testimonials */
const Testimonials = memo(function Testimonials() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-[#F7F8FA] border-t border-[#E5E7EB]">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 sm:mb-16 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-[#FFF1EC] text-[#D93F4D] mb-3">
            Verified Feedback
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1B1B1B]">
            What Educators Say
          </h2>
          <p className="mt-3 text-base text-[#5D6570] font-normal">
            Trusted by teachers and coaching directors across CBSE schools and institutes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-xs"
            >
              <p className="text-sm text-[#1B1B1B] leading-relaxed mb-6 font-normal">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-[#F1F3F5]">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F8FA] border border-[#E5E7EB] text-[#5D6570]">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#1B1B1B]">{t.name}</div>
                  <div className="text-xs text-[#5D6570]">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/** 9. FAQ */
const FAQ = memo(function FAQ() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-white border-t border-[#E5E7EB]">
      <div className="mx-auto max-w-[800px] px-4 sm:px-6 lg:px-8">
        <div className="mb-12 sm:mb-16 text-center">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-[#FFF1EC] text-[#D93F4D] mb-3">
            Got Questions?
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1B1B1B]">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-base text-[#5D6570] font-normal">
            Everything you need to know about a4ai and how it works.
          </p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl border border-[#E5E7EB] bg-white p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-[#1B1B1B] text-base select-none">
                <span>{item.question}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#5D6570] group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-[#5D6570] leading-relaxed font-normal pt-2 border-t border-[#F1F3F5]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
});

/** 10. Final CTA */
const FinalCTA = memo(function FinalCTA() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-[#F7F8FA] border-t border-[#E5E7EB]">
      <div className="mx-auto max-w-[800px] px-4 sm:px-6 lg:px-8 text-center">
        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-[#FFF1EC] text-[#D93F4D] mb-4">
          Get Started Today
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1B1B1B] leading-tight mb-4">
          Ready to save hours on paper-setting?
        </h2>
        <p className="text-base sm:text-lg text-[#5D6570] leading-relaxed max-w-xl mx-auto mb-8 font-normal">
          Join educators across India who create curriculum-accurate test papers and grade assignments in minutes.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6">
          <Link
            to="/dashboard/test-generator"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-8 py-3.5 text-[15px] font-bold text-white hover:bg-[#222222]"
            style={{ minHeight: 48 }}
          >
            <span>Try for FREE</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/pricing"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-[15px] font-bold text-[#F95D6A] border-2 border-[#F95D6A] hover:bg-[#FFF1EC]"
            style={{ minHeight: 48 }}
          >
            <Crown className="h-4 w-4" />
            <span>View Pricing</span>
          </Link>
        </div>

        <p className="text-xs sm:text-sm text-[#5D6570]">
          2 free test papers every month · No credit card required · Instant download
        </p>
      </div>
    </section>
  );
});
