import { useRef, useState } from "react";
import { toast } from "sonner";
import { Briefcase, MapPin, Clock, Upload, CheckCircle2, Loader2, FileText } from "lucide-react";
import CompanyLayout from "./CompanyLayout";
import { supabase } from "@/lib/supabaseClient";

// Open roles. Keep ids in sync with submit_job_application (supabase/migrations/14_job_applications.sql).
// Applications land in public.job_applications; resumes in the private "resumes" bucket.
type Job = {
  id: "android-developer" | "backend-engineer";
  title: string;
  stack: string;
  intro: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
};

const JOBS: Job[] = [
  {
    id: "android-developer",
    title: "Android Developer",
    stack: "React Native / Flutter",
    intro:
      "Build a4ai's Android app for teachers, institute admins and students: attendance, tests, assignments and the student portal on the phone.",
    responsibilities: [
      "Build and ship our Android app with React Native or Flutter.",
      "Turn existing web flows (attendance, test generation, assignment submission) into fast, phone-first screens.",
      "Integrate Supabase auth/data and our FastAPI backend.",
      "Camera and file flows: answer-sheet photos, PDF uploads.",
      "Play Store releases, crash and performance monitoring.",
    ],
    requirements: [
      "At least one Android app built in React Native or Flutter (college, personal or production).",
      "Solid JavaScript/TypeScript or Dart fundamentals.",
      "REST APIs, auth flows and state management.",
      "Can read existing code and own a feature end to end.",
    ],
    niceToHave: ["Supabase", "Offline-first apps", "Push notifications", "Play Store publishing"],
  },
  {
    id: "backend-engineer",
    title: "Backend Engineer",
    stack: "Python · FastAPI · Supabase",
    intro:
      "Build the APIs and AI pipelines behind a4ai: test generation, answer-sheet checking and institute tools.",
    responsibilities: [
      "Build and maintain FastAPI services used by the web and mobile apps.",
      "Design Postgres/Supabase schemas, RLS policies and RPCs.",
      "Turn LLM APIs (Gemini, DeepSeek and others) into reliable pipelines with evaluations.",
      "Performance, usage limits and production debugging.",
      "Work closely with frontend and mobile to ship features.",
    ],
    requirements: [
      "Strong Python and backend fundamentals.",
      "REST/HTTP, SQL and database basics.",
      "Git/GitHub and clean, readable code.",
      "Ownership: you take a task from idea to production.",
    ],
    niceToHave: ["FastAPI", "PostgreSQL / Supabase RLS", "LLM APIs", "Vercel / serverless deployment"],
  },
];

const ACCENT = "#E8643A";
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

type FormState = {
  job_id: Job["id"];
  full_name: string;
  email: string;
  phone: string;
  city: string;
  engagement: "internship" | "full-time";
  work_mode: "remote" | "delhi-ncr" | "either";
  experience: "" | "student" | "fresher" | "1-2" | "3+";
  college_or_company: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  skills: string;
  why_a4ai: string;
  available_from: string;
};

const EMPTY: FormState = {
  job_id: "android-developer",
  full_name: "",
  email: "",
  phone: "",
  city: "",
  engagement: "internship",
  work_mode: "remote",
  experience: "",
  college_or_company: "",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  skills: "",
  why_a4ai: "",
  available_from: "",
};

const inputCls =
  "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 dark:focus:ring-orange-500/40";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {required && <span style={{ color: ACCENT }}> *</span>}
      </span>
      {children}
    </label>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1 text-xs font-semibold">
      {children}
    </span>
  );
}

export default function CareersPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [resume, setResume] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneFor, setDoneFor] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const applyFor = (id: Job["id"]) => {
    set("job_id", id);
    setDoneFor(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pickResume = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload your resume as a PDF.");
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      toast.error("Resume must be 5 MB or smaller.");
      return;
    }
    setResume(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume) {
      toast.error("Please attach your resume (PDF).");
      return;
    }
    if (!form.experience) {
      toast.error("Please choose your experience.");
      return;
    }
    setSubmitting(true);
    try {
      const path = `${crypto.randomUUID()}/resume.pdf`;
      const { error: upErr } = await supabase.storage
        .from("resumes")
        .upload(path, resume, { upsert: false, contentType: "application/pdf" });
      if (upErr) throw new Error("Resume upload failed. Please try again.");

      const { error } = await supabase.rpc("submit_job_application", {
        p_job_id: form.job_id,
        p_full_name: form.full_name,
        p_email: form.email,
        p_phone: form.phone,
        p_engagement: form.engagement,
        p_work_mode: form.work_mode,
        p_experience: form.experience,
        p_resume_path: path,
        p_resume_name: resume.name,
        p_city: form.city || null,
        p_college_or_company: form.college_or_company || null,
        p_linkedin_url: form.linkedin_url || null,
        p_github_url: form.github_url || null,
        p_portfolio_url: form.portfolio_url || null,
        p_skills: form.skills || null,
        p_why_a4ai: form.why_a4ai || null,
        p_available_from: form.available_from || null,
        p_user_agent: navigator.userAgent,
      });
      if (error) throw new Error(error.message || "Could not submit your application.");

      setDoneFor(JOBS.find((j) => j.id === form.job_id)?.title || "the role");
      setForm({ ...EMPTY, job_id: form.job_id });
      setResume(null);
      if (fileRef.current) fileRef.current.value = "";
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CompanyLayout title="Careers" subtitle="Building the operating system for coaching institutes and schools.">
      {/* Hero */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8 mb-8">
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
          We're Hiring!
        </h2>
        <div className="mt-4 h-1.5 w-28 rounded-full" style={{ background: ACCENT }} />
        <p className="mt-4 text-slate-600 dark:text-slate-300">
          Small team, real users, fast shipping. You'll own features that teachers and students use every day.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Chip>Internship / Full-time</Chip>
          <Chip>Remote / Delhi NCR</Chip>
        </div>
      </div>

      {/* Jobs */}
      <ul className="space-y-5">
        {JOBS.map((j) => (
          <li
            key={j.id}
            id={j.id}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-5 sm:p-6 border-l-4"
            style={{ borderLeftColor: ACCENT }}
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{j.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{j.stack}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-4 w-4" style={{ color: ACCENT }} /> Engineering
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" style={{ color: ACCENT }} /> Internship / Full-time
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" style={{ color: ACCENT }} /> Remote / Delhi NCR
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => applyFor(j.id)}
                className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition"
                style={{ background: ACCENT }}
              >
                Apply now
              </button>
            </div>

            <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">{j.intro}</p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { h: "What you'll do", items: j.responsibilities },
                { h: "What we look for", items: j.requirements },
                { h: "Nice to have", items: j.niceToHave },
              ].map((s) => (
                <section
                  key={s.h}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4"
                >
                  <h4 className="font-semibold mb-2 text-slate-900 dark:text-white">{s.h}</h4>
                  <ul className="list-disc list-inside text-sm space-y-1 text-slate-700 dark:text-slate-300">
                    {s.items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {/* Apply form */}
      <div ref={formRef} className="mt-10 scroll-mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 sm:p-8">
        {doneFor ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: ACCENT }} />
            <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">Application received</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Thanks for applying for {doneFor}. We read every application and will reach out by email or phone if
              it's a fit.
            </p>
            <button
              type="button"
              onClick={() => setDoneFor(null)}
              className="mt-5 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              Apply for another role
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Apply</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Takes about 3 minutes. Fields with * are required.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Role" required>
                <select className={inputCls} value={form.job_id} onChange={(e) => set("job_id", e.target.value as Job["id"])}>
                  {JOBS.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.stack})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Full name" required>
                <input className={inputCls} required maxLength={120} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Email" required>
                <input className={inputCls} required type="email" maxLength={200} value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
              </Field>
              <Field label="Phone (WhatsApp)" required>
                <input className={inputCls} required type="tel" maxLength={20} placeholder="+91 98xxxxxxxx" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
              </Field>
              <Field label="City">
                <input className={inputCls} maxLength={100} value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="College / current company">
                <input className={inputCls} maxLength={200} value={form.college_or_company} onChange={(e) => set("college_or_company", e.target.value)} />
              </Field>
              <Field label="Looking for" required>
                <select className={inputCls} value={form.engagement} onChange={(e) => set("engagement", e.target.value as FormState["engagement"])}>
                  <option value="internship">Internship</option>
                  <option value="full-time">Full-time</option>
                </select>
              </Field>
              <Field label="Work mode" required>
                <select className={inputCls} value={form.work_mode} onChange={(e) => set("work_mode", e.target.value as FormState["work_mode"])}>
                  <option value="remote">Remote</option>
                  <option value="delhi-ncr">Delhi NCR (in person)</option>
                  <option value="either">Either</option>
                </select>
              </Field>
              <Field label="Experience" required>
                <select className={inputCls} required value={form.experience} onChange={(e) => set("experience", e.target.value as FormState["experience"])}>
                  <option value="">Select…</option>
                  <option value="student">Student</option>
                  <option value="fresher">Fresher (graduated)</option>
                  <option value="1-2">1–2 years</option>
                  <option value="3+">3+ years</option>
                </select>
              </Field>
              <Field label="Can start from">
                <input className={inputCls} type="date" value={form.available_from} onChange={(e) => set("available_from", e.target.value)} />
              </Field>
              <Field label="LinkedIn">
                <input className={inputCls} type="url" placeholder="https://linkedin.com/in/…" value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} />
              </Field>
              <Field label="GitHub">
                <input className={inputCls} type="url" placeholder="https://github.com/…" value={form.github_url} onChange={(e) => set("github_url", e.target.value)} />
              </Field>
            </div>

            <Field label="Portfolio / app / project link">
              <input className={inputCls} type="url" placeholder="Play Store link, deployed project, portfolio…" value={form.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)} />
            </Field>
            <Field label="Key skills">
              <textarea className={inputCls} rows={2} maxLength={2000} placeholder="e.g. Flutter, Dart, Firebase / Python, FastAPI, PostgreSQL" value={form.skills} onChange={(e) => set("skills", e.target.value)} />
            </Field>
            <Field label="Why a4ai? What have you built that you're proud of?">
              <textarea className={inputCls} rows={4} maxLength={3000} value={form.why_a4ai} onChange={(e) => set("why_a4ai", e.target.value)} />
            </Field>

            <Field label="Resume (PDF, max 5 MB)" required>
              <div
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 px-4 py-4 cursor-pointer hover:border-orange-300"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  pickResume(e.dataTransfer.files?.[0]);
                }}
              >
                {resume ? <FileText className="h-6 w-6 shrink-0" style={{ color: ACCENT }} /> : <Upload className="h-6 w-6 shrink-0 text-slate-400" />}
                <span className="text-sm text-slate-600 dark:text-slate-300 truncate">
                  {resume ? `${resume.name} (${(resume.size / 1024 / 1024).toFixed(1)} MB)` : "Click or drop your resume here"}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => pickResume(e.target.files?.[0])}
                />
              </div>
            </Field>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition disabled:opacity-60"
                style={{ background: ACCENT }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Submitting…" : "Submit application"}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your details are used only for hiring at a4ai.
              </p>
            </div>
          </form>
        )}
      </div>

      {/* Email option */}
      <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
        Prefer email? Send your resume to{" "}
        <a href="mailto:a4ai.team@gmail.com" className="font-medium hover:underline" style={{ color: ACCENT }}>
          a4ai.team@gmail.com
        </a>{" "}
        or{" "}
        <a href="mailto:tarun@a4ai.in" className="font-medium hover:underline" style={{ color: ACCENT }}>
          tarun@a4ai.in
        </a>
        .
      </p>
    </CompanyLayout>
  );
}
