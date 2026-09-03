import { useMemo, useState } from "react";
import CompanyLayout from "./CompanyLayout";
import { Briefcase, MapPin, Clock, Search, Plus } from "lucide-react";

type Job = {
  id: string;
  title: string;
  department: "Engineering" | "Design" | "Product" | "Marketing" | "Operations";
  type: "Full-time" | "Part-time" | "Internship" | "Contract";
  location:
    | "Remote (India)"
    | "Remote (Global)"
    | "Delhi NCR"
    | "Hybrid - Delhi NCR";
  intro: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave?: string[];
  compensation?: string;
  applyEmail?: string;
};

const JOBS: Job[] = [
  {
    id: "swe-frontend",
    title: "Frontend Engineer (React + TypeScript)",
    department: "Engineering",
    type: "Full-time",
    location: "Remote (India)",
    intro:
      "Help craft delightful, fast, and accessible UIs for a4ai's test generation and contest platform.",
    responsibilities: [
      "Ship well-tested components and pages with React + TypeScript.",
      "Own performance, accessibility, and DX (Storybook or equivalent).",
      "Collaborate across Product/Design to refine requirements.",
    ],
    requirements: [
      "Strong React + TS; state mgmt patterns; routing; data fetching.",
      "Solid CSS/Tailwind fundamentals; eye for spacing/contrast.",
      "Experience integrating APIs; basic auth/session flows.",
    ],
    niceToHave: [
      "shadcn/ui, Framer Motion, or Supabase familiarity",
      "Vercel CI, Lighthouse perf budgets",
    ],
    compensation: "Competitive stipend/salary + early builder perks.",
    applyEmail: "a4ai.team@gmail.com",
  },
  {
    id: "backend-developer-intern",
    title: "Backend Developer Intern",
    department: "Engineering",
    type: "Internship",
    location: "Remote (India)",
    intro:
      "Build and improve the backend systems powering a4ai's AI-powered education platform, APIs, data pipelines, and core product features.",
    responsibilities: [
      "Build and maintain backend APIs and services for a4ai.",
      "Work with Python and FastAPI to design reliable and scalable APIs.",
      "Integrate databases, authentication, AI/LLM APIs, and third-party services.",
      "Debug production issues, improve API performance, and write clean maintainable code.",
      "Work closely with the product and frontend team to turn ideas into working features.",
    ],
    requirements: [
      "Good understanding of Python and backend development fundamentals.",
      "Familiarity with REST APIs and HTTP concepts.",
      "Basic understanding of databases and SQL.",
      "Willingness to learn FastAPI and modern backend development practices.",
      "Ability to read existing code, debug problems, and take ownership of assigned tasks.",
    ],
    niceToHave: [
      "FastAPI experience",
      "PostgreSQL / Supabase",
      "Authentication and API integrations",
      "Experience working with OpenAI, Gemini, DeepSeek, or other LLM APIs",
      "Git/GitHub and basic deployment experience",
    ],
    compensation:
      "Stipend; potential PPO based on performance and contribution.",
    applyEmail: "a4ai.team@gmail.com",
  },
  {
    id: "ml-research-intern",
    title: "ML Research Intern (LLMs & Evaluation)",
    department: "Engineering",
    type: "Internship",
    location: "Remote (India)",
    intro:
      "Prototype and evaluate multi-LLM pipelines, keyword scoring, and safety filters for exam content.",
    responsibilities: [
      "Design prompt/finetune experiments for reliability.",
      "Benchmark answer quality and build evaluation harnesses.",
      "Work closely with engineering to productionize ideas.",
    ],
    requirements: [
      "Python + notebooks; basic stats; clean experimentation habits.",
      "Understanding of prompt engineering and retrieval basics.",
    ],
    niceToHave: ["Supabase Edge Functions, OpenAI/DeepSeek/Gemini APIs"],
    compensation: "Stipend; potential PPO for exceptional performance.",
    applyEmail: "a4ai.team@gmail.com",
  },
  {
    id: "designer-1",
    title: "Product Designer (UI/UX)",
    department: "Design",
    type: "Contract",
    location: "Remote (Global)",
    intro:
      "Define flows and visual systems that feel fast, modern, and friendly for teachers and students.",
    responsibilities: [
      "Own end-to-end flows: wireframes → hi-fi → dev handoff.",
      "Create reusable tokens/components and motion guidelines.",
      "Partner with engineers; audit real screens and refine.",
    ],
    requirements: [
      "Portfolio showing product thinking and crisp visuals.",
      "Figma power-user; auto-layout; variables; prototyping.",
    ],
    niceToHave: ["Education/EdTech experience", "Design systems at small teams"],
    compensation: "Monthly retainer or per-project basis.",
    applyEmail: "a4ai.team@gmail.com",
  },
  {
    id: "marketing-sales-intern",
    title: "Marketing & Growth Intern",
    department: "Marketing",
    type: "Internship",
    location: "Hybrid - Delhi NCR",
    intro:
      "We're looking for someone who understands that great marketing isn't just posting content — it's understanding people, communicating value, and knowing how to sell.",
    responsibilities: [
      "Understand the daily problems, workload, and pain points teachers face.",
      "Figure out how a4ai can communicate its value in a simple, relatable way.",
      "Create and test messaging that shows teachers how a4ai can save time, reduce effort, and make their work easier.",
      "Talk to teachers, students, and potential users to understand objections and what actually makes them interested in a product.",
      "Develop outreach, sales, and growth strategies to bring schools, teachers, and educators onto a4ai.",
      "Create compelling content, campaigns, demos, and pitches that communicate the product's real-world value.",
      "Track what messaging and campaigns work, learn from the results, and continuously improve.",
    ],
    requirements: [
      "Strong communication skills — you should be able to explain a product clearly and confidently.",
      "A genuine understanding of selling: identifying a problem, communicating value, handling objections, and convincing someone to take action.",
      "Ability to understand the customer's perspective rather than simply promoting features.",
      "Creative thinking and willingness to experiment with different approaches.",
      "Comfort speaking to people, conducting outreach, and getting direct feedback.",
      "Basic understanding of social media and digital marketing is useful, but practical thinking matters more than certificates.",
    ],
    niceToHave: [
      "Sales, business development, growth, or marketing experience",
      "Experience selling or promoting a product/service",
      "EdTech or education-sector experience",
      "Content creation, copywriting, or video scripting",
      "Experience talking directly with teachers, schools, students, or educators",
    ],
    compensation:
      "Stipend; potential PPO based on performance and contribution.",
    applyEmail: "a4ai.team@gmail.com",
  },
];

const DEPARTMENTS = [
  "All",
  "Engineering",
  "Design",
  "Product",
  "Marketing",
  "Operations",
] as const;

const TYPES = [
  "All",
  "Full-time",
  "Part-time",
  "Internship",
  "Contract",
] as const;

const LOCATIONS = [
  "All",
  "Remote (India)",
  "Remote (Global)",
  "Delhi NCR",
  "Hybrid - Delhi NCR",
] as const;

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs " +
        "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 " +
        "bg-white/80 dark:bg-slate-950/60 shadow-sm " +
        className
      }
    >
      {children}
    </span>
  );
}

export default function CareersPage() {
  const [dept, setDept] =
    useState<(typeof DEPARTMENTS)[number]>("All");
  const [type, setType] =
    useState<(typeof TYPES)[number]>("All");
  const [loc, setLoc] =
    useState<(typeof LOCATIONS)[number]>("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return JOBS.filter((j) => {
      const okDept = dept === "All" || j.department === dept;
      const okType = type === "All" || j.type === type;
      const okLoc = loc === "All" || j.location === loc;

      const search = q.toLowerCase().trim();

      const okQ =
        !search ||
        j.title.toLowerCase().includes(search) ||
        j.intro.toLowerCase().includes(search) ||
        j.department.toLowerCase().includes(search) ||
        j.requirements.some((item) =>
          item.toLowerCase().includes(search)
        );

      return okDept && okType && okLoc && okQ;
    });
  }, [dept, type, loc, q]);

  const getMailtoLink = (job: Job) => {
    const subject = encodeURIComponent(
      `Application: ${job.title} — ${job.id}`
    );

    const body = encodeURIComponent(
      [
        `Hi a4ai team,`,
        ``,
        `I'm applying for ${job.title}.`,
        ``,
        `Why me (2–3 lines):`,
        `- `,
        `- `,
        ``,
        `Relevant experience / skills:`,
        `- `,
        ``,
        `Availability:`,
        `- `,
        ``,
        `Links:`,
        `- Resume:`,
        `- Portfolio/GitHub/LinkedIn:`,
        ``,
        `Cheers,`,
        `Your Name`,
      ].join("\n")
    );

    return `mailto:${
      job.applyEmail || "a4ai.team@gmail.com"
    }?subject=${subject}&body=${body}`;
  };

  return (
    <CompanyLayout
      title="Careers"
      subtitle="We're a small team building fast. If you like ownership, craft, and impact—join us."
    >
      {/* Hero strip — glossy BLUE only */}
      <div className="rounded-2xl border border-sky-200/60 dark:border-sky-900/40 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/20 p-6 mb-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        <div className="flex flex-wrap items-center gap-3">
          <Pill>
            <Plus className="h-3.5 w-3.5 mr-1 text-sky-600" />
            Early team
          </Pill>
          <Pill>Fast ship cadence</Pill>
          <Pill>Founder-led product</Pill>
          <Pill>Remote-friendly</Pill>
        </div>

        <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
          Don't see a perfect role? Write to us at{" "}
          <a
            href="mailto:a4ai.team@gmail.com"
            className="text-sky-600 hover:text-sky-700"
          >
            a4ai.team@gmail.com
          </a>
          .
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="flex items-center gap-2 rounded-xl border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search roles…"
            className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400"
          />
        </div>

        <select
          value={dept}
          onChange={(e) =>
            setDept(e.target.value as (typeof DEPARTMENTS)[number])
          }
          className="rounded-xl border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) =>
            setType(e.target.value as (typeof TYPES)[number])
          }
          className="rounded-xl border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <select
          value={loc}
          onChange={(e) =>
            setLoc(e.target.value as (typeof LOCATIONS)[number])
          }
          className="rounded-xl border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          {LOCATIONS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Jobs */}
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No matching roles right now. Try different filters.
        </p>
      ) : (
        <ul className="space-y-5">
          {filtered.map((j) => (
            <li
              key={j.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-5 transition hover:border-sky-300/70 hover:shadow-[0_8px_30px_rgba(2,132,199,0.12)]"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    {j.title}
                  </h3>

                  <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-4 w-4 text-sky-600" />
                      {j.department}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-4 w-4 text-sky-600" />
                      {j.type}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-sky-600" />
                      {j.location}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href={getMailtoLink(j)}
                    className="rounded-lg bg-[linear-gradient(180deg,#60a5fa,#2563eb_85%)] text-white text-sm px-3.5 py-2 border border-blue-600/60 shadow-[0_10px_20px_rgba(37,99,235,0.25)] hover:brightness-110 active:brightness-[1.05] transition inline-block"
                  >
                    Apply
                  </a>

                  <a
                    href={`#${j.id}`}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 text-sm px-3.5 py-2 bg-white/70 dark:bg-slate-950/60 hover:bg-slate-50 dark:hover:bg-slate-900 transition inline-block"
                  >
                    Details
                  </a>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                {j.intro}
              </p>

              {/* Details */}
              <div
                id={j.id}
                className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <section className="border rounded-xl p-4 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                  <h4 className="font-medium mb-2">
                    Responsibilities
                  </h4>

                  <ul className="list-disc list-inside text-sm space-y-1">
                    {j.responsibilities.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </section>

                <section className="border rounded-xl p-4 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                  <h4 className="font-medium mb-2">
                    Requirements
                  </h4>

                  <ul className="list-disc list-inside text-sm space-y-1">
                    {j.requirements.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </section>

                <section className="border rounded-xl p-4 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                  <h4 className="font-medium mb-2">
                    Perks & More
                  </h4>

                  <ul className="list-disc list-inside text-sm space-y-1">
                    {j.niceToHave?.map((x) => (
                      <li key={x}>{x}</li>
                    ))}

                    {j.compensation ? (
                      <li>
                        <strong>Compensation:</strong>{" "}
                        {j.compensation}
                      </li>
                    ) : null}
                  </ul>
                </section>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Bottom CTA */}
      <div className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 bg-white/80 dark:bg-slate-950/60">
        <h3 className="font-semibold">General Application</h3>

        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Passionate about building for education but unsure where you fit?
          Email us your resume and a short note at{" "}
          <a
            href="mailto:a4ai.team@gmail.com"
            className="text-sky-600 hover:text-sky-700"
          >
            a4ai.team@gmail.com
          </a>
          .
        </p>
      </div>
    </CompanyLayout>
  );
}