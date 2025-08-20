import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Check,
  Minus,
  Sparkles,
  Zap,
  Building2,
  GraduationCap,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

/*
  PricingPage — a4ai
  - Modern, animated pricing inspired by OpenAI
  - Two audiences: Individuals and Institutes/Schools
  - Monthly / Yearly toggle (yearly shows per‑month equivalent and billed‑yearly note)
  - Plan cards + feature comparison table + FAQ
  - Fully responsive, dark‑mode friendly

  Tailwind + shadcn/ui + Framer Motion only
*/

// ----------------------------- Types -----------------------------

type Cycle = "monthly" | "yearly";

type PlanCard = {
  id: string;
  name: string;
  tagline?: string;
  priceMonthly: number | 0 | null; // null => custom
  priceYearly: number | 0 | null; // monthly equivalent when billed yearly
  popular?: boolean;
  highlight?: boolean;
  cta?: string; // defaults based on audience
  features: string[];
};

type ComparisonRow = {
  key: string;
  label: string;
  entries: Array<boolean | string | number | null>;
};

// ----------------------------- Data -----------------------------

const INDIVIDUAL_PLANS: PlanCard[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For trying things out",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "20 AI‑generated test papers / month",
      "Question bank access (core topics)",
      "Single‑model generation",
      "Keyword‑based answer checks",
      "PDF export",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Best for most students",
    priceMonthly: 199,
    priceYearly: 159, // billed yearly
    popular: true,
    features: [
      "150 AI‑generated test papers / month",
      "Full question bank (all topics)",
      "Multi‑LLM engine (OpenAI + DeepSeek)",
      "Precision scoring + answer hints",
      "PDF + DOCX export",
      "Personal analytics dashboard",
      "Email support",
    ],
  },
  {
    id: "power",
    name: "Power",
    tagline: "Creators & power users",
    priceMonthly: 399,
    priceYearly: 319, // billed yearly
    highlight: true,
    features: [
      "500 AI‑generated test papers / month",
      "Advanced question designer",
      "Multi‑LLM with reranking",
      "Proctored practice contests (2 / month)",
      "Brand‑free exports",
      "Priority support",
    ],
  },
];

const INDIVIDUAL_COMPARISON: ComparisonRow[] = [
  { key: "papers", label: "Test papers / month", entries: ["20", "150", "500"] },
  { key: "bank", label: "Question bank coverage", entries: ["Core", "All", "All + Advanced"] },
  { key: "engine", label: "Multi‑LLM engine", entries: [false, true, true] },
  { key: "proctor", label: "Proctored practice contests", entries: ["—", "—", "2 / mo"] },
  { key: "export", label: "PDF / DOCX export", entries: ["PDF", "PDF + DOCX", "PDF + DOCX"] },
  { key: "support", label: "Support", entries: ["Community", "Email", "Priority"] },
];

const INSTITUTION_PLANS: PlanCard[] = [
  {
    id: "classroom",
    name: "Classroom",
    tagline: "Up to 100 students",
    priceMonthly: 2499,
    priceYearly: 1999,
    features: [
      "100 student seats + 5 staff",
      "AI proctoring & screen lock",
      "Contest hosting (2 / month)",
      "Shared question bank",
      "Basic branding",
      "Email support",
    ],
  },
  {
    id: "campus",
    name: "Campus Pro",
    tagline: "Up to 500 students",
    priceMonthly: 7999,
    priceYearly: 6399,
    popular: true,
    features: [
      "500 student seats + 20 staff",
      "Advanced AI proctoring",
      "Contest hosting (8 / month)",
      "Custom sections & rubrics",
      "Custom branding & domains",
      "Priority support",
      "Basic uptime SLA (99.5%)",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Unlimited scale + SSO",
    priceMonthly: null,
    priceYearly: null,
    highlight: true,
    features: [
      "Unlimited seats (flexible)",
      "Dedicated success manager",
      "Private cloud / VPC options",
      "SSO (Google Workspace / SAML)",
      "Advanced analytics & APIs",
      "99.9% uptime SLA",
    ],
  },
];

const INSTITUTION_COMPARISON: ComparisonRow[] = [
  { key: "seats", label: "Included student seats", entries: ["100", "500", "Custom"] },
  { key: "staff", label: "Staff / admin seats", entries: ["5", "20", "Custom"] },
  { key: "proctor", label: "AI proctoring & screen lock", entries: [true, true, true] },
  { key: "hosting", label: "Contest hosting / month", entries: ["2", "8", "Custom"] },
  { key: "branding", label: "Custom branding & domains", entries: [false, true, true] },
  { key: "sso", label: "SSO (Google / SAML)", entries: [false, false, true] },
  { key: "sla", label: "Uptime SLA", entries: ["—", "99.5%", "99.9%"] },
  { key: "support", label: "Support", entries: ["Email", "Priority", "Dedicated manager"] },
];

// ----------------------------- Helpers -----------------------------

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function PriceTag({ n, cycle, billedNote }: { n: number | 0; cycle: Cycle; billedNote?: string }) {
  const isYearly = cycle === "yearly";
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-end gap-1">
        <div className="text-4xl font-semibold tracking-tight">{inr(n)}</div>
        <div className="mb-1 text-sm text-muted-foreground">/mo</div>
      </div>
      {isYearly && billedNote && (
        <div className="mt-1 text-xs text-muted-foreground">{billedNote}</div>
      )}
    </div>
  );
}

function Chip({ children, intent = "default" as "default" | "success" | "warning" }) {
  const map = {
    default: "bg-muted text-foreground/90",
    success: "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[intent]}`}>{children}</span>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <Check className="mt-0.5 h-4 w-4 flex-none" />
      <span>{text}</span>
    </li>
  );
}

// ----------------------------- Component -----------------------------

export default function PricingPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [audience, setAudience] = useState<"individual" | "institutions">("individual");

  const plans = audience === "individual" ? INDIVIDUAL_PLANS : INSTITUTION_PLANS;
  const rows = audience === "individual" ? INDIVIDUAL_COMPARISON : INSTITUTION_COMPARISON;

  const headerIcon = audience === "individual" ? (
    <GraduationCap className="h-5 w-5" />
  ) : (
    <Building2 className="h-5 w-5" />
  );

  // compute billed note for yearly
  const billedNote = (p: PlanCard) => {
    if (p.priceMonthly === 0) return undefined;
    if (p.priceYearly && p.priceYearly > 0) {
      const total = (p.priceYearly ?? 0) * 12;
      return `billed ${inr(total)} / year`;
    }
    return undefined;
  };

  const headerGradient = useMemo(
    () =>
      "bg-[radial-gradient(1200px_600px_at_50%_-10%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(900px_500px_at_80%_0%,hsl(var(--primary)/0.12),transparent_60%)]",
    []
  );

  return (
    <div className="relative">
      {/* Animated background blobs */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className={`absolute inset-0 ${headerGradient}`}
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 18, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Header */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-18">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm backdrop-blur">
            {headerIcon}
            <span className="font-medium">a4ai Pricing</span>
            <Chip intent="success">New</Chip>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple pricing for {audience === "individual" ? "students & self‑learners" : "institutes & schools"}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Choose a plan that scales with you. Switch between Monthly and Yearly at any time.
          </p>

          {/* Switchers */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* Audience toggle */}
            <div className="inline-flex rounded-lg border p-1">
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  audience === "individual" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
                onClick={() => setAudience("individual")}
              >
                Individual
              </button>
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  audience === "institutions" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
                onClick={() => setAudience("institutions")}
              >
                Institutes / Schools
              </button>
            </div>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-2 rounded-lg border p-1">
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  cycle === "monthly" ? "bg-muted" : "opacity-70 hover:opacity-100"
                }`}
                onClick={() => setCycle("monthly")}
              >
                Monthly
              </button>
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  cycle === "yearly" ? "bg-muted" : "opacity-70 hover:opacity-100"
                }`}
                onClick={() => setCycle("yearly")}
              >
                Yearly <span className="ml-1 hidden sm:inline">(save ~20%)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-6xl px-4 pb-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20% 0px" }}
              transition={{ duration: 0.45, delay: 0.05 * idx, ease: "easeOut" }}
            >
              <Card
                className={`relative h-full overflow-hidden transition-all hover:shadow-xl ${
                  p.highlight ? "border-primary/60 shadow-lg" : p.popular ? "border-primary/30" : ""
                }`}
              >
                {/* Accent gradient */}
                <div className="pointer-events-none absolute -inset-px rounded-lg opacity-0 [mask-image:radial-gradient(60%_40%_at_30%_0%,black,transparent)] transition-opacity group-hover:opacity-100">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
                </div>

                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold tracking-tight">{p.name}</h3>
                        {p.popular && <Chip intent="warning">Most popular</Chip>}
                        {p.highlight && <Chip intent="success">Best value</Chip>}
                      </div>
                      {p.tagline && (
                        <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                      )}
                    </div>
                    {audience === "individual" ? (
                      <Sparkles className="h-5 w-5 text-primary" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    )}
                  </div>

                  {/* Price */}
                  <div className="mt-4">
                    {p.priceMonthly === null ? (
                      <div className="text-3xl font-semibold">Custom</div>
                    ) : p.priceMonthly === 0 ? (
                      <div className="text-3xl font-semibold">Free</div>
                    ) : cycle === "monthly" ? (
                      <PriceTag n={p.priceMonthly} cycle={cycle} />
                    ) : (
                      <PriceTag n={p.priceYearly ?? p.priceMonthly} cycle={cycle} billedNote={billedNote(p)} />
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="mt-2 space-y-2">
                    {p.features.map((f) => (
                      <FeatureItem key={f} text={f} />
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="mt-2">
                  {p.priceMonthly === null ? (
                    <Button className="w-full" size="sm">
                      Contact sales <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : p.priceMonthly === 0 ? (
                    <Button variant="outline" className="w-full" size="sm">
                      Get started <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button className="w-full" size="sm">
                      Start {audience === "individual" ? "trial" : "demo"} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tiny note for taxes */}
        <p className="mt-4 text-xs text-muted-foreground">
          Prices are in INR and exclude applicable taxes. You can switch plans or cancel anytime.
        </p>
      </section>

      {/* Comparison Table */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5" />
          <h2 className="text-xl font-semibold tracking-tight">Compare features</h2>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Feature</th>
                {plans.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-left font-medium">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t">
                  <td className="px-4 py-3 text-foreground/90">{row.label}</td>
                  {row.entries.map((val, i) => (
                    <td key={i} className="px-4 py-3">
                      {typeof val === "boolean" ? (
                        val ? (
                          <div className="inline-flex items-center gap-2 text-green-600 dark:text-green-400">
                            <Check className="h-4 w-4" />
                            <span className="hidden sm:inline">Included</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 text-muted-foreground">
                            <Minus className="h-4 w-4" />
                            <span className="hidden sm:inline">Not included</span>
                          </div>
                        )
                      ) : val ? (
                        <span>{val}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <h2 className="text-xl font-semibold tracking-tight">Frequently asked</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FaqItem q="What’s the difference between Monthly and Yearly?" a="Yearly shows a lower per‑month price and is billed once annually. You can switch anytime—changes take effect from your next billing cycle." />
          <FaqItem q="Do you offer student discounts?" a="Yes—Pro plan pricing is already optimized for students. For special circumstances, write to us and we’ll try to help." />
          <FaqItem q="How do institute seats work?" a="Seats are the number of unique students that can be active in a month. You can purchase additional seats as you grow or talk to us for custom tiers." />
          <FaqItem q="Is my data safe?" a="We use industry‑standard security, encryption at rest and in transit, and granular role‑based access controls. Enterprise options include private cloud and SSO." />
        </div>

        <div className="mt-10 rounded-xl border bg-muted/40 p-6">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Need a custom quote or a live demo?</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tell us about your requirements—curriculum, seat counts, branding, SSO—and we’ll tailor a plan for you.</p>
            </div>
            <Button size="sm" className="gap-2">
              Contact sales
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-lg border bg-background/50 p-4">
      <div className="font-medium">{q}</div>
      <p className="mt-1 text-sm text-muted-foreground">{a}</p>
    </div>
  );
}
