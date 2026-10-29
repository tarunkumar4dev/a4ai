// ContactPage.tsx — short contact form for schools and institutes. Posts to the
// `submit-contact` Edge Function (same payload as before; requirements stay empty).
import { useState } from "react";
import { Loader2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import PageShell, { BTN_PRIMARY, Container } from "@/components/site/PageShell";

const ORG_TYPES = ["School", "College", "Institute", "Coaching Center", "University", "Individual teacher"];
const EMPTY = { name: "", email: "", organization: "", organizationType: "School", studentCount: "", message: "" };

const FIELD =
  "h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-[15px] text-[#1B1B1B] outline-none focus:border-[#111111] focus-visible:ring-2 focus-visible:ring-[#F95D6A]";
const LABEL = "mb-1.5 block text-[13px] font-semibold text-[#374151]";

export default function ContactPage() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [hp, setHp] = useState("");

  const set =
    (key: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hp) return; // honeypot
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || !form.organization.trim()) {
      toast.error("Please fill your name, a valid email and your institute's name.");
      return;
    }
    setSubmitting(true);
    try {
      const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string;
      const res = await fetch(`${base.replace(/\/$/, "")}/submit-contact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          organization: form.organization,
          organization_type: form.organizationType,
          student_count: form.studentCount,
          requirements: [],
          message: form.message,
          source_page: "/contact",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok !== true) throw new Error(data?.error || `Request failed (${res.status})`);
      toast.success("Thanks! We've got your message and will get back to you soon.");
      setForm(EMPTY);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send your message. Please try again or email a4ai.team@gmail.com");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      meta={{
        title: "Contact — a4ai",
        description: "Talk to the a4ai team about using a4ai in your school, college or coaching institute.",
        path: "/contact",
      }}
    >
      <Container className="py-12 sm:py-16">
        <div className="mx-auto grid max-w-[960px] gap-8 lg:grid-cols-[1fr_300px] lg:gap-10">
          <div>
            <h1
              className="font-halenoir font-bold tracking-[-0.02em] text-[#1B1B1B]"
              style={{ fontSize: "clamp(2rem, 1.4rem + 2.2vw, 2.75rem)", lineHeight: 1.1 }}
            >
              Talk to us
            </h1>
            <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-[#5D6570]">
              Using a4ai for a school, college or coaching institute? Tell us a little about it and we'll reply by email.
            </p>

            <form onSubmit={onSubmit} className="mt-7 grid gap-4 sm:grid-cols-2" noValidate>
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
              />
              <div>
                <label htmlFor="c-name" className={LABEL}>Your name *</label>
                <input id="c-name" className={FIELD} autoComplete="name" value={form.name} onChange={set("name")} />
              </div>
              <div>
                <label htmlFor="c-email" className={LABEL}>Email *</label>
                <input id="c-email" type="email" className={FIELD} autoComplete="email" value={form.email} onChange={set("email")} />
              </div>
              <div>
                <label htmlFor="c-org" className={LABEL}>Institute / school name *</label>
                <input id="c-org" className={FIELD} autoComplete="organization" value={form.organization} onChange={set("organization")} />
              </div>
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div>
                  <label htmlFor="c-type" className={LABEL}>Type</label>
                  <select id="c-type" className={FIELD} value={form.organizationType} onChange={set("organizationType")}>
                    {ORG_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="c-students" className={LABEL}>Students</label>
                  <input id="c-students" inputMode="numeric" className={FIELD} placeholder="e.g. 200" value={form.studentCount} onChange={set("studentCount")} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="c-message" className={LABEL}>Message</label>
                <textarea
                  id="c-message"
                  rows={4}
                  className={`${FIELD} h-auto py-3`}
                  placeholder="What would you like to use a4ai for?"
                  value={form.message}
                  onChange={set("message")}
                />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={submitting} className={`${BTN_PRIMARY} w-full sm:w-auto disabled:opacity-60`}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {submitting ? "Sending…" : "Send message"}
                </button>
              </div>
            </form>
          </div>

          <aside className="h-fit rounded-[24px] border border-[#E5E7EB] bg-[#F7F8FA] p-6">
            <h2 className="text-base font-bold text-[#1B1B1B]">Reach us directly</h2>
            <ul className="mt-4 space-y-3 text-[15px]">
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[#5D6570]" aria-hidden="true" />
                <a href="mailto:a4ai.team@gmail.com" className="font-semibold text-[#D93F4D] hover:underline">
                  a4ai.team@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[#5D6570]" aria-hidden="true" />
                <a href="tel:+919310200167" className="font-semibold text-[#D93F4D] hover:underline">
                  +91 93102 00167
                </a>
              </li>
            </ul>
          </aside>
        </div>
      </Container>
    </PageShell>
  );
}
