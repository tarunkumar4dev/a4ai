import { useState, useMemo } from "react";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail, Phone, MapPin, Clock, ShieldCheck, ArrowRight, Globe, Loader2, School, Users,
} from "lucide-react";
import { toast } from "sonner";

/* -------------------- utils -------------------- */
const toSlug = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 28) || "yourorganization";

const toShortSlug = (s: string) => {
  const words = (s || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "yourorg";
  const ac = words.map((w) => w[0]?.toLowerCase() || "").join("");
  return (ac.length >= 3 ? ac : toSlug(s).slice(0, 10)) || "yourorg";
};

export default function ContactPage() {
  // cursor-reactive ambient glow
  const mx = useMotionValue(320);
  const my = useMotionValue(140);
  const bg = useMotionTemplate`
    radial-gradient(1200px 600px at ${mx}px ${my}px, rgba(99,102,241,0.12), transparent 70%),
    radial-gradient(1000px 500px at calc(${mx}px + 240px) calc(${my}px + 160px), rgba(59,130,246,0.10), transparent 70%),
    radial-gradient(800px 420px at calc(${mx}px - 220px) calc(${my}px - 120px), rgba(34,197,94,0.08), transparent 70%)
  `;
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  // form
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    organizationType: "School",
    studentCount: "",
    requirements: [] as string[],
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [hp, setHp] = useState("");

  const organizationTypes = ["School", "College", "Institute", "Coaching Center", "University"];
  const reqs = [
    "FREE Landing Page (yourorganization.a4ai.in)",
    "Complete Assessment Software",
    "Attendance Management",
    "Student Analytics Dashboard",
    "Custom Test Generation",
    "Progress Tracking",
    "Bulk Student Management",
    "Parent Portal",
    "Mobile App Access",
    "Advanced Reporting",
  ];

  const onChange =
    (key: keyof typeof form) =>
    (
      e:
        | React.ChangeEvent<HTMLInputElement>
        | React.ChangeEvent<HTMLTextAreaElement>
        | React.ChangeEvent<HTMLSelectElement>
    ) =>
      setForm((s) => ({ ...s, [key]: e.target.value }));

  const toggleReq = (r: string) =>
    setForm((p) => ({
      ...p,
      requirements: p.requirements.includes(r)
        ? p.requirements.filter((x) => x !== r)
        : [...p.requirements, r],
    }));

  const validEmail = (em: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim());
  const slug = useMemo(() => toSlug(form.organization), [form.organization]);
  const shortSlug = useMemo(() => toShortSlug(form.organization), [form.organization]);

  /* ------------ SUBMIT: post to Edge Function ------------- */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hp) return; // honeypot
    if (!form.name.trim() || !validEmail(form.email) || !form.organization.trim()) {
      toast.error("Please fill your name, valid email, and organization name.");
      return;
    }

    setSubmitting(true);
    try {
      // Make sure this ENV is set to: https://<ref>.supabase.co/functions/v1
      const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string;
      const url = `${base.replace(/\/$/, "")}/submit-contact`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          organization: form.organization,
          organization_type: form.organizationType,
          student_count: form.studentCount,
          requirements: form.requirements,
          message: form.message,
          source_page: "/contact",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      toast.success("Thanks! We’ve received your request. Our team will reach out shortly.");
      setForm({
        name: "",
        email: "",
        organization: "",
        organizationType: "School",
        studentCount: "",
        requirements: [],
        message: "",
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Submission failed. Please try again or email a4ai.team@gmail.com");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onMouseMove={onMove} className="relative min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-black">
      {/* ambient mesh */}
      <motion.div aria-hidden style={{ backgroundImage: bg }} className="pointer-events-none fixed inset-0 z-0 opacity-90" />
      {/* subtle grid + grain */}
      <div className="fixed inset-0 -z-10 bg-[url('/images/grid.svg')] opacity-[0.05] dark:opacity-[0.03]" />
      <div className="pointer-events-none fixed inset-0 -z-10 mix-blend-soft-light opacity-[0.08] [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]" />

      {/* Hero */}
      <section className="relative z-10 py-18 md:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs tracking-wide text-gray-700 backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-gray-200">
              🚀 Get your FREE domain within 7 days
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Get Your FREE a4ai Beta 2 Access
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-600 dark:text-gray-300">
              Join hundreds of educational institutions using our smart assessment platform.
              Claim your custom domain and start creating AI-powered tests in minutes.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main */}
      <section className="relative z-10 pb-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:px-8">
          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl border border-black/10 bg-white/80 p-6 md:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_rgba(0,0,0,0.10)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06]"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Register for Beta 2</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Fill this form to get your FREE domain and platform access
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              {/* honeypot */}
              <input
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                placeholder="Leave this field empty"
                aria-hidden="true"
              />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="name" label="Your Name *" value={form.name} onChange={onChange("name")} placeholder="John Doe" />
                <Field id="email" type="email" label="Email Address *" value={form.email} onChange={onChange("email")} placeholder="you@school.edu" />
              </div>

              <div>
                <label htmlFor="organization" className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-200">
                  Organization Name *
                </label>
                <Input
                  id="organization"
                  value={form.organization}
                  onChange={onChange("organization")}
                  placeholder="e.g., Delhi Public School"
                  className="h-11 rounded-lg border-gray-300 bg-white/90 text-gray-900 placeholder:text-gray-400 focus-visible:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-100"
                  required
                />
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Your FREE domain will be: <strong>{slug}.a4ai.in</strong>{" "}
                  <span className="text-gray-500">| Short alias: </span>
                  <strong>{shortSlug}.a4ai.in</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="organizationType" className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-200">
                    Organization Type *
                  </label>
                  <select
                    id="organizationType"
                    value={form.organizationType}
                    onChange={onChange("organizationType")}
                    className="flex h-11 w-full rounded-lg border border-gray-300 bg-white/90 px-3 py-2 text-sm text-gray-900 focus-visible:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-100"
                    required
                  >
                    {organizationTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <Field
                  id="studentCount"
                  type="number"
                  label="Approx. Student Count"
                  value={form.studentCount}
                  onChange={onChange("studentCount")}
                  placeholder="e.g., 500"
                />
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-gray-800 dark:text-gray-200">
                  Requirements (Select all that apply)
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {reqs.map((r) => (
                    <label
                      key={r}
                      className="flex items-center space-x-2 rounded-lg border border-gray-300 bg-white/70 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950/40 dark:hover:bg-gray-900/60"
                    >
                      <input
                        type="checkbox"
                        checked={form.requirements.includes(r)}
                        onChange={() => toggleReq(r)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200">{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="message" className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-200">
                  Additional Requirements / Message
                </label>
                <Textarea
                  id="message"
                  rows={4}
                  value={form.message}
                  onChange={onChange("message")}
                  placeholder="Tell us about your specific needs, preferred features, or any custom requirements..."
                  className="rounded-lg border-gray-300 bg-white/90 text-gray-900 placeholder:text-gray-400 focus-visible:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-100"
                />
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-black/10 bg-white/70 p-3 text-xs text-gray-700 backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="font-medium">What you'll get:</p>
                  <ul className="mt-1 space-y-1">
                    <li>• FREE Custom Domain ({slug}.a4ai.in) within 7 days</li>
                    <li>• Complete platform access for Beta 2</li>
                    <li>• AI-powered test generation</li>
                    <li>• Student analytics dashboard</li>
                    <li>• Dedicated support team</li>
                  </ul>
                </div>
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:from-indigo-700 hover:to-sky-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:ring-offset-transparent"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Get FREE Domain & Access
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>

          {/* Right column */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-6">
              <InfoCard icon={<Globe className="h-5 w-5" />} title="FREE Custom Domain" lines={["Get yourorganization.a4ai.in", "Setup within 7 days", "Professional branding"]} />
              <InfoCard icon={<School className="h-5 w-5" />} title="Complete Platform" lines={["AI-powered test generation", "Student analytics", "Progress tracking"]} />
              <InfoCard icon={<Users className="h-5 w-5" />} title="Student Management" lines={["Bulk imports", "Parent portals", "Attendance system"]} />
              <InfoCard icon={<Clock className="h-5 w-5" />} title="Quick Setup" lines={["Ready in under 2 minutes", "24/7 support", "Training provided"]} />
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your FREE Domain Format</h3>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
                  <code className="text-sm font-mono text-gray-900 dark:text-white">{slug}.a4ai.in</code>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/60">
                  <code className="text-sm font-mono text-gray-900 dark:text-white">{shortSlug}.a4ai.in</code>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Examples: chanakya.a4ai.in, delhipublic.a4ai.in, iitcoaching.a4ai.in
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Support</h3>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <a href="mailto:a4ai.team@gmail.com" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                    a4ai.team@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <a href="tel:+919310200167" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                    +91 9310200167
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

/* ---- Field helper ---- */
function Field({
  id, label, value, onChange, placeholder, type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-11 rounded-lg border-gray-300 bg-white/90 text-gray-900 placeholder:text-gray-400 focus-visible:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-100"
        required={/\*/.test(label)}
      />
    </div>
  );
}

/* ---- Info card ---- */
function InfoCard({
  icon, title, lines, href,
}: {
  icon: React.ReactNode;
  title: string;
  lines: (string | React.ReactNode)[];
  href?: string;
}) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    href ? (
      <a href={href} className="block focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-2xl">
        {children}
      </a>
    ) : (
      <>{children}</>
    );

  return (
    <Wrapper>
      <div className="group relative overflow-hidden rounded-2xl border border-black/10 bg-white/80 p-5 shadow-sm transition-all hover:shadow-md backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition group-hover:opacity-100 [background:linear-gradient(white,white)_padding-box,linear-gradient(90deg,rgba(99,102,241,.35),rgba(59,130,246,.35))_border-box] [border:1px_solid_transparent]" />
        <div className="relative z-10 flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-black/5 text-gray-900 dark:bg-white/10 dark:text-white">
            {icon}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
            <div className="mt-1 space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
              {lines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
