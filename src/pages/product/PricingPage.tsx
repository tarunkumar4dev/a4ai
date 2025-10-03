// src/pages/PricingPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Users, Building, School } from "lucide-react";

type AudienceKey = "individual" | "institute" | "school";
type PeriodKey = "monthly" | "yearly";

// Quick font helpers in case Tailwind font class isn't configured
const hx = {
  fontFamily:
    "'Halenoir Expanded DemiBold','Halenoir Expanded','Halenoir','Inter',system-ui,sans-serif",
  fontWeight: 600,
} as const;

/* -------------------- Cluely-style glossy badge -------------------- */
function LogoBadge() {
  return (
    <span
      className="
        relative inline-flex items-center justify-center
        h-14 w-14 md:h-16 md:w-16
        -rotate-6 hover:rotate-0 transition-transform duration-500
        rounded-2xl
        /* ← BLUE → GREY */
        bg-[linear-gradient(180deg,#f3f5f8_0%,#e6e9ee_55%,#cfd6df_100%)]
        ring-1 ring-white/70
        shadow-[0_18px_44px_-10px_rgba(2,6,23,0.18),0_8px_18px_-6px_rgba(17,24,39,0.18)]
      "
      aria-hidden="true"
    >
      {/* soft inner bevel */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_2px_6px_rgba(255,255,255,0.7),inset_0_-10px_18px_rgba(0,0,0,0.10)]" />
      {/* specular highlight */}
      <div className="pointer-events-none absolute -top-1 -left-1 h-10 w-10 rounded-2xl bg-white/60 blur-md opacity-80" />
      {/* bottom glow — neutral grey */}
      <div className="pointer-events-none absolute -bottom-2 inset-x-2 h-4 rounded-b-2xl bg-slate-400/25 blur-md" />

      <img
  src="/images/LOGO.png"
  alt="a4ai logo"
  className="relative h-12 w-12 md:h-14 md:w-14 object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
/>

    </span>
  );
}


export default function PricingPage() {
  const [audience, setAudience] = useState<AudienceKey>("individual");
  const [billingPeriod, setBillingPeriod] = useState<PeriodKey>("monthly");
  const navigate = useNavigate();

  const plans: Record<
    AudienceKey,
    Array<{
      name: string;
      price: { monthly: string; yearly: string };
      description: string;
      features: string[];
      popular?: boolean;
    }>
  > = {
    individual: [
      {
        name: "Starter",
        price: { monthly: "₹499", yearly: "₹4,999" },
        description: "All essential features.",
        features: [
          "Unlimited Test Generation",
          "Basic Student Analytics",
          "Notes Recommendations",
          "Up to 50 students",
          "Email support",
        ],
      },
      {
        name: "Teacher Pro",
        price: { monthly: "₹999", yearly: "₹9,999" },
        description: "Unlimited access.",
        features: [
          "All Starter features",
          "Advanced Analytics",
          "Custom Test Branding",
          "Up to 200 students",
          "Priority support",
          "PDF Export",
          "Question Bank Access",
        ],
        popular: true,
      },
      {
        name: "Enterprise",
        price: { monthly: "Custom", yearly: "Custom" },
        description: "Custom knowledge for teams.",
        features: [
          "Coaching & advanced analytics",
          "RAG knowledge base",
          "User provisioning & RBAC",
          "SSO & IDP integration",
          "Enterprise security & no data training",
        ],
      },
    ],
    institute: [
      {
        name: "Institute Basic",
        price: { monthly: "₹4,999", yearly: "₹49,999" },
        description: "All essential features.",
        features: [
          "Up to 5 teachers",
          "Institute Analytics Dashboard",
          "Contest Hosting",
          "Branded Certificates",
          "Basic Reporting",
          "500 student capacity",
        ],
      },
      {
        name: "Institute Growth",
        price: { monthly: "₹8,999", yearly: "₹89,999" },
        description: "Unlimited access.",
        features: [
          "All Basic features",
          "Up to 15 teachers",
          "Advanced Reporting",
          "Performance Benchmarking",
          "1,500 student capacity",
          "API Access",
          "Custom Domain",
        ],
        popular: true,
      },
      {
        name: "Institute Elite",
        price: { monthly: "₹14,999", yearly: "₹149,999" },
        description: "Custom knowledge for teams.",
        features: [
          "Unlimited teachers",
          "Unlimited students",
          "White-label Solution",
          "Dedicated Account Manager",
          "SSO Integration",
          "Custom Development Hours",
        ],
      },
    ],
    school: [
      {
        name: "School Standard",
        price: { monthly: "₹19,999", yearly: "₹199,999" },
        description: "All essential features.",
        features: [
          "Up to 25 teachers",
          "School-wide Dashboard",
          "Parent & Admin Portals",
          "Custom Report Cards",
          "1,000 student capacity",
          "Basic SIS Integration",
        ],
      },
      {
        name: "School Premium",
        price: { monthly: "₹34,999", yearly: "₹349,999" },
        description: "Unlimited access.",
        features: [
          "All Standard features",
          "Up to 75 teachers",
          "Advanced Analytics Suite",
          "Custom Integrations",
          "5,000 student capacity",
          "Training & Onboarding",
          "99.9% Uptime SLA",
        ],
        popular: true,
      },
      {
        name: "School Enterprise",
        price: { monthly: "₹59,999", yearly: "₹599,999" },
        description: "Custom knowledge for teams.",
        features: [
          "Unlimited teachers & students",
          "Multi-school Management",
          "Dedicated Infrastructure",
          "Custom Feature Development",
          "24/7 Premium Support",
          "On-site Training",
        ],
      },
    ],
  };

  const cards = plans[audience];

  // CTAs — softened for light UI
  const darkBtn =
    "bg-[linear-gradient(180deg,#2a3038,#0b1220_85%)] text-white border border-black/10 shadow-[0_8px_20px_rgba(2,6,23,0.15)] hover:brightness-[1.06] active:brightness-[1.03] transition";
  const blueBtn =
    "bg-[linear-gradient(180deg,#93c5fd,#3b82f6_85%)] text-white border border-blue-300 shadow-[0_8px_20px_rgba(59,130,246,0.25)] hover:brightness-[1.06] active:brightness-[1.03] transition";

  return (
    <div
      className="
        min-h-screen w-full relative
        bg-[radial-gradient(900px_560px_at_15%_-10%,#EDF1F7_0%,transparent_60%),radial-gradient(900px_560px_at_85%_110%,#F7FAFF_0%,transparent_60%)]
      "
    >
      {/* faint grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-16">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <h1
            className="text-3xl md:text-5xl tracking-tight flex items-center justify-center gap-4"
            style={hx}
          >
            <span className="text-slate-900">Start</span>
            <LogoBadge />
            <span className="text-slate-900">for free.</span>
          </h1>

          <p className="mt-3 text-[15px] md:text-[17px] text-slate-600">
            Whether you're using a4ai for test generation, contests, or analytics, it's free to try.
          </p>

          {/* Audience toggle — centered */}
          <div className="mt-6 flex justify-center">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white/80 backdrop-blur px-1 py-1 shadow-sm">
              {[
                { id: "individual", label: "Teachers", icon: <Users size={16} /> },
                { id: "institute", label: "Institutes", icon: <Building size={16} /> },
                { id: "school", label: "Schools", icon: <School size={16} /> },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setAudience(t.id as AudienceKey)}
                  className={`mx-0.5 flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition
                    ${audience === t.id ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"}`}
                  style={hx}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Billing toggle — already centered by flex wrapper below */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <span
              className={`text-sm ${billingPeriod === "monthly" ? "text-slate-900" : "text-slate-500"}`}
              style={hx}
            >
              Monthly
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={billingPeriod === "yearly"}
              aria-label="Toggle billing period"
              onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "yearly" : "monthly")}
              className="
                relative h-6 w-12 rounded-full
                bg-[linear-gradient(90deg,#e5e7eb,#cbd5e1)]

                p-0 appearance-none border-0 outline-none ring-0 focus:outline-none focus:ring-0
                shadow-inner
              "
            >
              <span
                className={`absolute top-[4px] left-[4px] h-4 w-4 rounded-full bg-white shadow
                  transition-transform duration-300 ${billingPeriod === "yearly" ? "translate-x-[24px]" : ""}`}
              />
            </button>

            <span
              className={`text-sm ${billingPeriod === "yearly" ? "text-slate-900" : "text-slate-500"}`}
              style={hx}
            >
              Yearly
            </span>
            <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
              Save 17%
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((plan, i) => {
            const price = plan.price[billingPeriod];
            const isEnterprise = plan.name.toLowerCase().includes("enterprise");

            return (
              <div
                key={i}
                className={`group relative rounded-[22px] bg-white/90 backdrop-blur p-6
                ring-1 ring-slate-200 shadow-[0_14px_36px_-12px_rgba(2,6,23,0.12)] transition
                hover:shadow-[0_18px_44px_-10px_rgba(2,6,23,0.16)] hover:translate-y-[-2px]
                ${plan.popular ? "outline outline-2 outline-blue-300/60" : ""}`}
              >
                {plan.popular && (
                  <div
                    className="absolute -top-3 right-4 rounded-full bg-blue-600/90 px-3 py-1 text-xs text-white shadow"
                    style={hx}
                  >
                    Popular
                  </div>
                )}

                <div className="text-slate-800/80 text-[13px]" style={hx}>
                  {plan.name}
                </div>

                <div className="mt-2 mb-4">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-4xl tracking-tight text-slate-900"
                      style={hx}
                    >
                      {price}
                    </span>
                    <span className="text-slate-500 text-base">
                      {price === "Custom" ? "" : billingPeriod === "monthly" ? "/ month" : "/ year"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => (isEnterprise ? navigate("/contact") : navigate("/payment"))}
                  className={`inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-[14px]
                    ${isEnterprise ? blueBtn : darkBtn}`}
                  style={hx}
                >
                  {isEnterprise ? "Talk to sales" : plan.name === "Teacher Pro" ? "Subscribe" : "Get Started"}
                </button>

                <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                <p className="mb-3 text-[13px] text-slate-600">{plan.description}</p>

                <ul className="space-y-2.5">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="mt-[2px] rounded-full bg-sky-50 p-1 ring-1 ring-sky-100">
                        <Check className="h-3.5 w-3.5 text-sky-600" />
                      </span>
                      <span className="text-[14px] text-slate-700">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* soft card glow */}
                <div className="pointer-events-none absolute inset-x-0 -bottom-5 h-5 rounded-b-[22px] bg-black/5 blur-xl" />
                {/* frosted rim for enterprise */}
                {isEnterprise && <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-white/70" />}
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-14 max-w-4xl mx-auto">
          <h2 className="text-center text-xl md:text-2xl text-slate-900" style={hx}>
            Frequently Asked Questions
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {[
              { q: "Can I change plans anytime?", a: "Yes, you can upgrade or downgrade your plan at any time." },
              { q: "Is there a free trial?", a: "Yes, all plans include a 7-day free trial with full access to features." },
              { q: "What payment methods do you accept?", a: "All major cards, UPI, Net Banking, and bank transfers." },
              { q: "Do you offer educational discounts?", a: "Yes, for non-profits and educational institutions." },
            ].map((f, i) => (
              <div key={i} className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-slate-900" style={hx}>
                  {f.q}
                </div>
                <p className="mt-1 text-sm text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
