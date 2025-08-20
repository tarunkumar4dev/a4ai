// src/pages/ContactPage.tsx
import { useState } from "react";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  ArrowRight,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function ContactPage() {
  // cursor-reactive ambient glow
  const mx = useMotionValue(320);
  const my = useMotionValue(140);
  const bg = useMotionTemplate`
    radial-gradient(900px 450px at ${mx}px ${my}px, rgba(99,102,241,0.10), transparent 70%),
    radial-gradient(800px 400px at calc(${mx}px + 200px) calc(${my}px + 120px), rgba(168,85,247,0.08), transparent 70%)
  `;

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  // form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    reason: "General",
  });
  const [submitting, setSubmitting] = useState(false);
  const [hp, setHp] = useState(""); // honeypot for bots

  const reasons = ["General", "Sales", "Support", "Press", "Partnerships"];

  const onChange =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value }));

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hp) return; // bot

    if (!form.name.trim() || !validateEmail(form.email) || !form.message.trim()) {
      toast.error("Please fill your name, a valid email, and your message.");
      return;
    }

    setSubmitting(true);
    try {
      const subject =
        form.subject.trim() ||
        `${form.reason} — Message from ${form.name}`;
      const body = [
        `Name: ${form.name}`,
        `Email: ${form.email}`,
        `Reason: ${form.reason}`,
        "",
        form.message,
      ].join("\n");

      // open user's email client with prefilled message (simple, private, no backend needed)
      window.location.href = `mailto:a4ai.team@gmail.com?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;

      toast.success("Opening your email app…");
      setForm({ name: "", email: "", subject: "", message: "", reason: "General" });
    } catch {
      toast.error("Could not open your email app. Please email a4ai.team@gmail.com");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onMouseMove={onMove}
      className="relative min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950"
    >
      {/* ambient grid + soft cursor glow */}
      <motion.div
        aria-hidden
        style={{ backgroundImage: bg }}
        className="pointer-events-none fixed inset-0 z-0 opacity-90"
      />
      <div className="fixed inset-0 -z-10 bg-[url('/images/grid.svg')] opacity-[0.05] dark:opacity-[0.03]" />

      {/* Hero */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs tracking-wide text-gray-700 backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-gray-200">
              We reply within 24 hours
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Contact Us
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-600 dark:text-gray-300">
              Have questions? We’d love to hear from you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main content */}
      <section className="relative z-10 pb-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl border border-black/10 bg-white/80 p-8 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_rgba(0,0,0,0.06)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06]"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Get in touch
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Tell us a bit about what you need. We’ll get back quickly.
            </p>

            {/* reason chips */}
            <div className="mt-6 flex flex-wrap gap-2">
              {reasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={form.reason === r}
                  onClick={() => setForm((s) => ({ ...s, reason: r }))}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                    form.reason === r
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200"
                      : "border-black/10 text-gray-700 hover:bg-black/[0.03] dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              {/* honeypot */}
              <input
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                placeholder="Leave this field empty"
              />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Your Name *
                  </label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={onChange("name")}
                    placeholder="John Doe"
                    className="h-11 rounded-lg border-gray-300 focus-visible:ring-indigo-500 dark:border-gray-700"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Email Address *
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={onChange("email")}
                    placeholder="you@example.com"
                    className="h-11 rounded-lg border-gray-300 focus-visible:ring-indigo-500 dark:border-gray-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Subject
                </label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={onChange("subject")}
                  placeholder="How can we help?"
                  className="h-11 rounded-lg border-gray-300 focus-visible:ring-indigo-500 dark:border-gray-700"
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Message *
                </label>
                <Textarea
                  id="message"
                  rows={6}
                  value={form.message}
                  onChange={onChange("message")}
                  placeholder="Your message here…"
                  className="rounded-lg border-gray-300 focus-visible:ring-indigo-500 dark:border-gray-700"
                  required
                />
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-black/10 bg-white/70 p-3 text-xs text-gray-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <p>
                  We respect your privacy. Your information is only used to respond to your message and will never be sold.
                </p>
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-base font-semibold text-white transition hover:from-indigo-700 hover:to-purple-700"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send Message
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>

          {/* Contact info + map */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            {/* Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <InfoCard
                icon={<Mail className="h-5 w-5" />}
                title="Email"
                lines={[
                  <a
                    key="mail"
                    href="mailto:a4ai.team@gmail.com"
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    a4ai.team@gmail.com
                  </a>,
                ]}
              />
              <InfoCard
                icon={<Phone className="h-5 w-5" />}
                title="Phone"
                lines={[
                  <a
                    key="tel"
                    href="tel:+919310200167"
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    +91 9310200167
                  </a>,
                ]}
              />
              <InfoCard
                icon={<Clock className="h-5 w-5" />}
                title="Office Hours"
                lines={["Mon–Fri · 9:00–18:00 IST", "Avg. response: under 24h"]}
              />
              <InfoCard
                icon={<MessageSquare className="h-5 w-5" />}
                title="Support"
                lines={["Docs & FAQs", "In-app chat (coming soon)"]}
                href="/features#faq"
              />
            </div>

            {/* Office */}
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Office
                </h3>
              </div>
              <p className="mt-1 text-gray-600 dark:text-gray-300">
                New Delhi, India
              </p>

              <div className="mt-4 overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                <iframe
                  title="A4AI Office - New Delhi"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-64 w-full"
                  src="https://www.google.com/maps?q=New+Delhi,+India&output=embed"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

/* ---- Small info card ---- */
function InfoCard({
  icon,
  title,
  lines,
  href,
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
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition group-hover:opacity-100 [background:linear-gradient(white,white)_padding-box,linear-gradient(90deg,rgba(99,102,241,.35),rgba(168,85,247,.35))_border-box] [border:1px_solid_transparent]" />
        <div className="relative z-10 flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-black/5 text-gray-900 dark:bg-white/10 dark:text-white">
            {icon}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </h4>
            <div className="mt-1 space-y-0.5 text-sm text-gray-600 dark:text-gray-300">
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
