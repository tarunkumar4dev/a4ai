// src/pages/product/PricingPage.tsx
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Check, Users, Building, School, Clock, Sparkles, ArrowRight, Gift } from "lucide-react";

type AudienceKey = "individual" | "institute" | "school";
type PeriodKey = "monthly" | "yearly";

const hx = {
  fontFamily:
    "'Halenoir Expanded DemiBold','Halenoir Expanded','Halenoir','Inter',system-ui,sans-serif",
  fontWeight: 600,
} as const;

/* ──────────────────────────────────────────────────────────────
   ANTI-INVERSION STYLE ENGINE (Forced Light Only)
   ────────────────────────────────────────────────────────────── */
const GlobalStyles = () => {
  useEffect(() => {
    document.documentElement.style.background = "#ffffff !important";
    document.documentElement.style.backgroundColor = "#ffffff !important";
    document.documentElement.style.colorScheme = "light only !important";
    document.documentElement.classList.remove("dark");

    const s = document.createElement("style");
    s.textContent = `
      .lp-pricing-wrapper, .lp-pricing-wrapper * {
        color-scheme: light only !important;
        forced-color-adjust: none !important;
      }

      .force-light-dock {
        background-color: rgba(255, 255, 255, 0.45) !important;
        background: rgba(255, 255, 255, 0.45) !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        border: 1px solid rgba(255, 255, 255, 0.5) !important;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6), 0 8px 32px rgba(0, 0, 0, 0.03) !important;
      }

      .pricing-card {
        border-radius: 22px;
        transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s cubic-bezier(.16,1,.3,1);
        position: relative;
        background: rgba(255, 255, 255, 0.9) !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
        backdrop-filter: blur(30px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(170%) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 14px 36px -12px rgba(2,6,23,0.12) !important;
      }
      
      @media (hover: hover) {
        .pricing-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 18px 44px -10px rgba(2,6,23,0.18) !important;
        }
      }

      /* Premium Glossy Button Gradients */
      .btn-blue-gradient {
        background: linear-gradient(180deg, #93c5fd 0%, #3b82f6 85%) !important;
        color: #ffffff !important;
        border: 1px solid #60a5fa !important;
        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.2) !important;
        transition: filter 0.2s;
      }
      .btn-blue-gradient * { color: #ffffff !important; }
      @media (hover: hover) { .btn-blue-gradient:hover { filter: brightness(1.06); } }

      .btn-green-gradient {
        background: linear-gradient(180deg, #a7f3d0 0%, #10b981 85%) !important;
        color: #ffffff !important;
        border: 1px solid #34d399 !important;
        box-shadow: 0 8px 20px rgba(16, 185, 129, 0.15) !important;
        transition: filter 0.2s;
      }
      .btn-green-gradient * { color: #ffffff !important; }
      @media (hover: hover) { .btn-green-gradient:hover { filter: brightness(1.06); } }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);
  return null;
};

export default function PricingPage() {
  const [audience, setAudience] = useState<AudienceKey>("individual");
  const [billingPeriod, setBillingPeriod] = useState<PeriodKey>("monthly");
  const navigate = useNavigate();

  const plans: Record<
    AudienceKey,
    Array<{
      name: string;
      price: { monthly: string; yearly: string };
      priceNote?: { monthly: string; yearly: string };
      description: string;
      features: string[];
      popular?: boolean;
      free?: boolean;
    }>
  > = {
    individual: [
      {
        name: "Free",
        price: { monthly: "₹0", yearly: "₹0" },
        priceNote: { monthly: "forever", yearly: "forever" },
        description: "Try before you buy. No card needed.",
        features: [
          "2 test papers per month",
          "Basic MCQ questions",
          "PDF download with watermark",
          "NCERT-aligned content",
          "Email support",
        ],
        free: true,
      },
      {
        name: "Starter",
        price: { monthly: "₹149", yearly: "₹1,499" },
        priceNote: { monthly: "/ month", yearly: "/ year" },
        description: "Save 2+ hours daily. Everything you need.",
        features: [
          "8 test papers per month",
          "All question types (MCQ, Short, Long)",
          "Clean PDF & DOCX — no watermark",
          "Quiz sharing via WhatsApp link",
          "Chapter-wise question bank",
          "Basic student analytics",
          "Print-ready school format",
        ],
        popular: true,
      },
      {
        name: "Pro",
        price: { monthly: "₹299", yearly: "₹2,999" },
        priceNote: { monthly: "/ month", yearly: "/ year" },
        description: "Unlimited tests. Full proctored contests.",
        features: [
          "Unlimited test papers",
          "All Starter features",
          "Proctored quiz/contest with camera",
          "Tab-switch detection & auto-submit",
          "Advanced analytics & tracking",
          "Custom school logo on papers",
          "PYQ practice sets (coming soon)",
          "Priority WhatsApp support",
        ],
      },
    ],
    institute: [
      {
        name: "Growth",
        price: { monthly: "₹1,999", yearly: "₹19,999" },
        priceNote: { monthly: "/ month", yearly: "/ year" },
        description: "For small coaching centers. Up to 5 teachers.",
        features: [
          "Up to 5 teacher accounts",
          "500 student capacity",
          "Institute admin dashboard",
          "Teacher & student attendance",
          "Contest hosting for batches",
          "Basic performance analytics",
          "Branded test papers",
          "Email + chat support",
        ],
      },
      {
        name: "Scale",
        price: { monthly: "₹4,999", yearly: "₹49,999" },
        priceNote: { monthly: "/ month", yearly: "/ year" },
        description: "Advanced analytics & full control. Up to 15 teachers.",
        features: [
          "All Growth features",
          "Up to 15 teacher accounts",
          "1,500 student capacity",
          "Advanced reporting & benchmarking",
          "Batch-wise performance comparison",
          "Custom domain (yourname.a4ai.in)",
          "API access for integration",
          "Dedicated account manager",
        ],
        popular: true,
      },
      {
        name: "Enterprise",
        price: { monthly: "Custom", yearly: "Custom" },
        description: "Unlimited everything. White-label solution.",
        features: [
          "Unlimited teachers & students",
          "Multi-branch management",
          "White-label solution",
          "SSO & custom integrations",
          "Dedicated infrastructure",
          "On-site training & onboarding",
          "24/7 premium support",
          "Custom feature development",
        ],
      },
    ],
    school: [
      {
        name: "Standard",
        price: { monthly: "₹8,333", yearly: "₹99,999" },
        priceNote: { monthly: "/ month", yearly: "/ year" },
        description: "Complete school package. Up to 30 teachers.",
        features: [
          "Up to 30 teacher accounts",
          "2,000 student capacity",
          "School admin dashboard",
          "Parent & teacher portals",
          "Custom report cards",
          "School-wide analytics",
          "Attendance management",
          "Print-ready with school letterhead",
        ],
      },
      {
        name: "Premium",
        price: { monthly: "₹16,666", yearly: "₹1,99,999" },
        priceNote: { monthly: "/ month", yearly: "/ year" },
        description: "Full-featured school management. Up to 75 teachers.",
        features: [
          "All Standard features",
          "Up to 75 teacher accounts",
          "5,000 student capacity",
          "Advanced analytics suite",
          "Custom integrations (ERP/SIS)",
          "Training & onboarding included",
          "99.9% uptime SLA",
          "Priority phone support",
        ],
        popular: true,
      },
      {
        name: "Enterprise",
        price: { monthly: "Custom", yearly: "Custom" },
        description: "For school chains. Fully customized.",
        features: [
          "Unlimited everything",
          "Multi-school dashboard",
          "Dedicated infrastructure",
          "Custom feature development",
          "White-label solution",
          "On-site deployment option",
          "24/7 premium support",
          "Dedicated success manager",
        ],
      },
    ],
  };

  const cards = plans[audience];

  return (
    <div className="lp-pricing-wrapper min-h-screen w-full relative bg-white">
      <GlobalStyles />
      <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />

      {/* FLOATING TOP NAVIGATION DOCK */}
      <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
        <nav className="mx-auto max-w-7xl rounded-2xl border backdrop-blur-xl force-light-dock">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 bg-transparent">
            <Link to="/" className="group flex items-center gap-2.5 text-lg font-semibold tracking-tight bg-transparent">
              <img src="/ICON.ico" alt="Logo" className="h-6 w-6 object-contain" />
              <span style={{ color: "#111111" }}>a4ai <span className="text-xs font-normal opacity-60 ml-1">Pricing</span></span>
            </Link>
            <Link to="/resources" className="text-sm font-semibold text-neutral-500 hover:text-neutral-800">Resources</Link>
          </div>
        </nav>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pt-24 pb-16 bg-white">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center bg-white">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium px-3.5 py-1.5 rounded-full mb-5">
            <Sparkles size={12} />
            14-day free trial on all paid plans
          </div>

          <h1 className="text-3xl md:text-4xl tracking-tight text-neutral-900" style={hx}>
            Save 2+ hours daily. Starting at ₹5/day.
          </h1>
          <p className="mt-2 text-[15px] text-slate-600">
            AI-powered test papers in 30 seconds. Choose the perfect plan for your needs.
          </p>

          {/* Audience toggle */}
          <div
            className="mt-6 inline-flex items-center gap-1 rounded-2xl border px-1 py-1 shadow-sm backdrop-blur bg-white/80 border-slate-200"
            role="tablist"
          >
            {[
              { id: "individual", label: "Teachers", icon: <Users size={16} /> },
              { id: "institute", label: "Institutes", icon: <Building size={16} /> },
              { id: "school", label: "Schools", icon: <School size={16} /> },
            ].map((t) => {
              const active = audience === (t.id as AudienceKey);
              return (
                <button
                  key={t.id}
                  onClick={() => setAudience(t.id as AudienceKey)}
                  role="tab"
                  aria-selected={active}
                  className={
                    "mx-0.5 flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition " +
                    (active
                      ? "bg-slate-900 text-white shadow-sm ring-1 ring-black/5"
                      : "text-slate-700 hover:bg-white/70 ring-1 ring-transparent")
                  }
                  style={hx}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Billing toggle */}
          <div className="mt-4 flex items-center justify-center gap-3 bg-white">
            <span className={`text-sm ${billingPeriod === "monthly" ? "text-slate-900" : "text-slate-500"}`} style={hx}>
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={billingPeriod === "yearly"}
              onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "yearly" : "monthly")}
              className="relative h-6 w-12 rounded-full bg-[linear-gradient(90deg,#93c5fd,#3b82f6)] p-0 appearance-none border-0 outline-none ring-0 focus:outline-none focus:ring-0 shadow-inner cursor-pointer"
            >
              <span className={`absolute top-[4px] left-[4px] h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${billingPeriod === "yearly" ? "translate-x-[24px]" : ""}`} />
            </button>
            <span className={`text-sm ${billingPeriod === "yearly" ? "text-slate-900" : "text-slate-500"}`} style={hx}>
              Yearly
            </span>
            <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
              2 months FREE
            </span>
          </div>
        </div>

        {/* Cards container wrapper without overflow-hidden inside CSS to prevent badge truncation */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 bg-white">
          {cards.map((plan, i) => {
            const price = plan.price[billingPeriod];
            const note = plan.priceNote?.[billingPeriod] || "";
            const isEnterprise = plan.name.toLowerCase().includes("enterprise");
            const isFree = plan.free;

            return (
              <div
                key={i}
                className={`pricing-card p-6 ${plan.popular ? "outline outline-2 outline-blue-300/60" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 right-4 rounded-full bg-blue-600/90 px-3 py-1 text-xs text-white shadow z-10" style={hx}>
                    Popular
                  </div>
                )}
                {isFree && (
                  <div className="absolute -top-3 right-4 rounded-full bg-emerald-600/90 px-3 py-1 text-xs text-white shadow flex items-center gap-1 z-10" style={hx}>
                    <Gift size={11} /> Free Forever
                  </div>
                )}

                <div className="text-slate-800/80 text-[13px]" style={hx}>
                  {plan.name}
                </div>

                <div className="mt-2 mb-1">
                  <div className="flex items-baseline gap-2 bg-transparent">
                    <span className="text-4xl tracking-tight text-slate-900" style={hx}>{price}</span>
                    <span className="text-slate-500 text-base">
                      {price === "Custom" ? "" : note}
                    </span>
                  </div>
                </div>

                {!isFree && !isEnterprise && billingPeriod === "yearly" && audience === "individual" && (
                  <div className="mb-3 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium px-2.5 py-1 rounded-full">
                    <Clock size={10} />
                    {plan.name === "Starter" ? "Just ₹4/day" : "Just ₹8/day"}
                  </div>
                )}

                {/* Hardcoded Premium Button Components (Free is now matching Light-Green theme metrics) */}
                <button
                  onClick={() => isEnterprise ? navigate("/contact") : isFree ? navigate("/signup") : navigate("/payment")}
                  className={`inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-[14px] cursor-pointer ${
                    isFree ? "btn-green-gradient" : "btn-blue-gradient"
                  }`}
                  style={hx}
                >
                  {isFree ? "Start Free" : isEnterprise ? "Talk to Sales" : plan.popular ? "Subscribe" : "Get Started"}
                </button>

                <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                <p className="mb-3 text-[13px] text-slate-600">{plan.description}</p>

                <ul className="space-y-2.5 bg-transparent">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-3 bg-transparent">
                      <span className="mt-[2px] rounded-full bg-sky-50 p-1 ring-1 ring-sky-100">
                        <Check className="h-3.5 w-3.5 text-sky-600" />
                      </span>
                      <span className="text-[14px] text-slate-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Comparison banner */}
        <div className="mt-14 bg-slate-900 rounded-2xl p-6 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-transparent">
            <div className="bg-transparent">
              <h3 className="text-xl sm:text-2xl tracking-tight text-white bg-transparent" style={hx}>Still making test papers manually?</h3>
              <p className="mt-2 text-slate-300 text-sm sm:text-[15px] leading-relaxed bg-transparent">
                Teachers spend 3-4 hours creating one test. With a4ai, it takes 30 seconds.
                That's <span className="text-amber-400 font-semibold bg-transparent">2+ hours saved every day</span>.
              </p>
            </div>
            <button
              onClick={() => navigate("/signup")}
              className="flex-shrink-0 bg-white text-slate-900 text-sm px-6 py-3.5 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-2 shadow-lg cursor-pointer"
              style={hx}
            >
              Try Free — No card needed
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-14 max-w-4xl mx-auto bg-white">
          <h2 className="text-center text-xl md:text-2xl text-slate-900" style={hx}>
            Frequently Asked Questions
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 bg-transparent">
            {[
              { q: "Is the free plan really free?", a: "Yes, forever. 2 tests/month with NCERT content. No credit card needed." },
              { q: "Can I change plans anytime?", a: "Yes. Upgrade instantly, downgrade applies next billing cycle." },
              { q: "What payment methods do you accept?", a: "UPI, all major cards, net banking, and bank transfers via Razorpay." },
              { q: "Do you offer discounts for schools?", a: "Yes, special pricing for government schools and non-profits. Contact us." },
              { q: "How accurate are the questions?", a: "Generated from actual NCERT textbooks using RAG. Review & edit before sharing." },
              { q: "Can students take tests on mobile?", a: "Yes! Full proctoring works on mobile, tablet, and laptop." },
            ].map((f, i) => (
              <div key={i} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-slate-900" style={hx}>{f.q}</div>
                <p className="mt-1 text-sm text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-14 text-center bg-white">
          <p className="text-slate-500 text-sm mb-4">Join 500+ teachers who save 2+ hours every day</p>
          <button
            onClick={() => navigate("/signup")}
            className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[15px] btn-blue-gradient cursor-pointer"
            style={hx}
          >
            <Sparkles size={16} />
            Start Creating Tests for Free
            <ArrowRight size={14} />
          </button>
          <p className="mt-3 text-xs text-slate-400">No credit card required · 2 free tests every month · Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}