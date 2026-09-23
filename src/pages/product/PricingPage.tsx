// src/pages/product/PricingPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Check,
  Users,
  Building,
  School,
  Clock,
  Sparkles,
  ArrowRight,
  Gift,
  GraduationCap,
  UserCheck,
  Phone,
  Mail,
} from "lucide-react";

type AudienceKey = "individual" | "institute" | "college";
type PeriodKey = "monthly" | "yearly";

const hx = {
  fontFamily:
    "'Plus Jakarta Sans', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

      .lp-pricing-wrapper, .lp-pricing-wrapper * {
        font-family: 'Plus Jakarta Sans', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        color-scheme: light only !important;
        forced-color-adjust: none !important;
        -webkit-font-smoothing: antialiased;
      }

      .force-light-dock {
        background-color: rgba(255, 255, 255, 0.7) !important;
        background: rgba(255, 255, 255, 0.7) !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        border: 1px solid rgba(226, 232, 240, 0.8) !important;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 32px rgba(0, 0, 0, 0.04) !important;
      }

      .pricing-card {
        border-radius: 24px;
        transition: transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s cubic-bezier(.16,1,.3,1);
        position: relative;
        background: rgba(255, 255, 255, 0.95) !important;
        border: 1px solid rgba(226, 232, 240, 0.9) !important;
        backdrop-filter: blur(30px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(170%) !important;
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02) !important;
      }

      @media (hover: hover) {
        .pricing-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 20px 40px -12px rgba(59, 130, 246, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04) !important;
        }
      }

      .btn-blue-gradient {
        background: linear-gradient(180deg, #93c5fd 0%, #3b82f6 85%) !important;
        color: #ffffff !important;
        border: 1px solid #60a5fa !important;
        box-shadow: 0 4px 14px rgba(59, 130, 246, 0.25) !important;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      .btn-blue-gradient * { color: #ffffff !important; stroke: #ffffff !important; }
      @media (hover: hover) { 
        .btn-blue-gradient:hover { 
          filter: brightness(1.05); 
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.38) !important; 
        } 
      }

      .btn-white-action {
        background: #ffffff !important;
        color: #0f172a !important;
        border: 1px solid #e2e8f0 !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      .btn-white-action * { color: #0f172a !important; stroke: #0f172a !important; }
      @media (hover: hover) {
        .btn-white-action:hover {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.07) !important;
        }
      }

      .per-student-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #eff6ff;
        border: 1px solid #dbeafe;
        color: #1d4ed8;
        font-size: 11px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 999px;
      }

      .sales-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #fef3c7;
        border: 1px solid #fde68a;
        color: #92400e;
        font-size: 11px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 999px;
      }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);
  return null;
};

/* ──────────────────────────────────────────────────────────────
   PLAN DATA
   ────────────────────────────────────────────────────────────── */

interface PlanCard {
  name: string;
  price: { monthly: string; yearly: string };
  priceNote?: { monthly: string; yearly: string };
  description: string;
  features: string[];
  popular?: boolean;
  free?: boolean;
  studentLimit?: string;
  teacherLimit?: string;
  perStudent?: string;
  buttonGradient?: string;
  buttonLabel?: { normal: string; popular: string };
  unavailable?: string[];
  isSales?: boolean;
}

const plans: Record<AudienceKey, PlanCard[]> = {
  individual: [
    {
      name: "Free",
      price: { monthly: "₹0", yearly: "₹0" },
      priceNote: { monthly: "forever", yearly: "forever" },
      description: "Try it out. No card needed.",
      features: [
        "1 test paper per month",
        "1 assignment per month",
        "All question types (MCQ, Short, Long)",
        "PDF download — no watermark",
        "NCERT-aligned content",
      ],
      free: true,
    },
    {
      name: "Starter",
      price: { monthly: "₹199", yearly: "₹1,990" },
      priceNote: { monthly: "/ month", yearly: "/ year" },
      description: "Save 2+ hours daily. Perfect for working teachers.",
      features: [
        "10 test papers per month",
        "10 assignments per month",
        "All question types (MCQ, Short, Long)",
        "Clean PDF & DOCX — no watermark",
        "Quiz sharing via WhatsApp link",
        "Chapter-wise question bank",
        "Print-ready school format",
        "Email support",
      ],
      unavailable: ["Analytics — available in Pro"],
      popular: true,
    },
    {
      name: "Pro",
      price: { monthly: "₹299", yearly: "₹2,990" },
      priceNote: { monthly: "/ month", yearly: "/ year" },
      description: "Unlimited power. Live contests. Full analytics.",
      features: [
        "25 test papers per month",
        "25 assignments per month",
        "All Starter features",
        "Live proctored contest with camera",
        "Tab-switch detection & auto-submit",
        "Advanced analytics & tracking",
        "Custom school logo on papers",
        "Priority WhatsApp support",
      ],
    },
  ],

  institute: [
    {
      name: "Starter",
      price: { monthly: "₹999", yearly: "₹9,999" },
      priceNote: { monthly: "/ month", yearly: "/ year" },
      description: "Everything a small coaching center needs to go digital.",
      studentLimit: "Up to 100 students",
      teacherLimit: "Up to 3 teachers",
      perStudent: "~₹10/student",
      features: [
        "Test papers & assignments/modules",
        "Share tests as contest link (no camera)",
        "Brand logo on test papers",
        "Teacher & student attendance",
        "PDF & DOCX download",
        "Email support",
      ],
      unavailable: [
        "Report cards — available in Plus",
        "Analytics — available in Plus",
      ],
    },
    {
      name: "Plus",
      price: { monthly: "₹1,999", yearly: "₹19,999" },
      priceNote: { monthly: "/ month", yearly: "/ year" },
      description: "Analytics, report cards & batch management included.",
      studentLimit: "Up to 200 students",
      teacherLimit: "Up to 8 teachers",
      perStudent: "~₹10/student",
      features: [
        "Everything in Starter",
        "Instant report card generation",
        "Performance analytics & tracking",
        "Batch-wise test management",
        "Calendar — schedule classes & events",
        "Contest with link sharing",
        "Priority email support",
      ],
      popular: true,
    },
    {
      name: "Pro",
      price: { monthly: "₹2,999", yearly: "₹29,999" },
      priceNote: { monthly: "/ month", yearly: "/ year" },
      description: "Full-featured. AI answer checking. Phone support.",
      studentLimit: "Up to 500 students",
      teacherLimit: "Up to 15 teachers",
      perStudent: "~₹6/student",
      features: [
        "Everything in Plus",
        "AI answer sheet checker",
        "Proctored contests with camera",
        "Department-wise tracking",
        "Module/PPT creator from PDF",
        "Advanced analytics & insights",
        "Phone call support",
      ],
    },
  ],

  college: [
    {
      name: "Starter",
      price: { monthly: "₹4,999", yearly: "₹49,999" },
      priceNote: { monthly: "/ month", yearly: "/ year" },
      description: "Department hierarchy. Admin dashboards. Everything digital.",
      studentLimit: "Up to 1,000 students",
      teacherLimit: "Unlimited teachers",
      perStudent: "~₹5/student",
      features: [
        "Unlimited teacher accounts",
        "Full department hierarchy (HOD → Admin)",
        "Attendance management",
        "AI test generation from syllabus",
        "Assignments & module creator",
        "Report cards & analytics",
        "Branded materials & exports",
        "Calendar & scheduling",
        "Email + chat support",
      ],
      buttonGradient: "btn-blue-gradient",
    },
    {
      name: "Plus",
      price: { monthly: "₹9,999", yearly: "₹79,999" },
      priceNote: { monthly: "/ month", yearly: "/ year" },
      description: "Advanced analytics. Priority support. Full control.",
      studentLimit: "Up to 2,000 students",
      teacherLimit: "Unlimited teachers",
      perStudent: "~₹5/student",
      features: [
        "All Starter features",
        "AI answer sheet checker",
        "Advanced analytics suite",
        "Proctored online exams with camera",
        "Multi-batch & section management",
        "Custom branding & white-label exports",
        "Onboarding & training included",
        "Priority phone support",
      ],
      popular: true,
      buttonGradient: "btn-blue-gradient",
    },
    {
      name: "Enterprise",
      price: { monthly: "Custom", yearly: "Custom" },
      priceNote: { monthly: "", yearly: "" },
      description: "For schools with 2,000+ students. Custom pricing & features.",
      studentLimit: "2,000+ students",
      teacherLimit: "Unlimited teachers",
      perStudent: "Custom pricing",
      features: [
        "All Plus features",
        "Custom feature development",
        "Dedicated account manager",
        "On-site deployment option",
        "Custom integrations (ERP/SIS)",
        "Advanced benchmarking & insights",
        "24/7 priority support",
        "Quarterly review meetings",
        "White-label branding",
        "Data migration assistance",
      ],
      buttonGradient: "btn-blue-gradient",
      buttonLabel: { normal: "Talk to Sales", popular: "Talk to Sales" },
      isSales: true,
    },
  ],
};

/* ──────────────────────────────────────────────────────────────
   SUMMARY TABLE DATA
   ────────────────────────────────────────────────────────────── */

interface SummaryRow {
  plan: string;
  students: string;
  teachers: string;
  monthly: string;
  yearly: string;
  perStudent: string;
  highlight?: boolean;
  section?: "institute" | "college";
  action: "get-started" | "popular" | "contact" | "sales";
}

const summaryRows: SummaryRow[] = [
  { plan: "Starter", students: "Up to 100", teachers: "Up to 3", monthly: "₹999", yearly: "₹9,999", perStudent: "~₹10", section: "institute", action: "get-started" },
  { plan: "Plus", students: "Up to 200", teachers: "Up to 8", monthly: "₹1,999", yearly: "₹19,999", perStudent: "~₹10", section: "institute", highlight: true, action: "popular" },
  { plan: "Pro", students: "Up to 500", teachers: "Up to 15", monthly: "₹2,999", yearly: "₹29,999", perStudent: "~₹6", section: "institute", action: "get-started" },
  { plan: "College Starter", students: "Up to 1,000", teachers: "Unlimited", monthly: "₹4,999", yearly: "₹49,999", perStudent: "~₹5", section: "college", action: "contact" },
  { plan: "College Plus", students: "Up to 2,000", teachers: "Unlimited", monthly: "₹9,999", yearly: "₹79,999", perStudent: "~₹5", section: "college", highlight: true, action: "popular" },
  { plan: "Enterprise", students: "2,000+", teachers: "Unlimited", monthly: "Custom", yearly: "Custom", perStudent: "Custom", section: "college", action: "sales" },
];

/* ──────────────────────────────────────────────────────────────
   COMPONENT
   ────────────────────────────────────────────────────────────── */

export default function PricingPage() {
  const [audience, setAudience] = useState<AudienceKey>("individual");
  const [billingPeriod, setBillingPeriod] = useState<PeriodKey>("monthly");
  const navigate = useNavigate();

  const cards = plans[audience];

  const handleSalesClick = () => {
    window.location.href = "mailto:sales@a4ai.in?subject=Enterprise%20Plan%20Inquiry%20-%20School%20with%202000%2B%20students";
  };

  return (
    <div className="lp-pricing-wrapper min-h-screen w-full relative bg-white">
      <GlobalStyles />
      <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] [background-size:48px_48px]" />

      {/* ── FLOATING TOP NAV ── */}
      <div className="fixed top-4 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8">
        <nav className="mx-auto max-w-7xl rounded-2xl border backdrop-blur-xl force-light-dock">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 bg-transparent">
            <Link to="/" className="group flex items-center gap-2.5 text-lg font-semibold tracking-tight bg-transparent">
              <img src="/ICON.ico" alt="Logo" className="h-6 w-6 object-contain" />
              <span style={{ color: "#111111" }}>
                a4ai{" "}
                <span className="text-xs font-normal opacity-60 ml-1">Pricing</span>
              </span>
            </Link>
            <Link to="/resources" className="text-sm font-semibold text-neutral-500 hover:text-neutral-800">
              Resources
            </Link>
          </div>
        </nav>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pt-24 pb-16 bg-white">
        {/* ── HEADER ── */}
        <div className="mx-auto max-w-3xl text-center bg-white">
          <h1 className="text-3xl md:text-4xl tracking-tight text-neutral-900" style={hx}>
            Test papers in 10 seconds. Starting at ₹5/day.
          </h1>
          
          <div className="mt-4 space-y-2">
            <p className="text-[15px] text-slate-600" style={hx}>
              Drag &amp; drop NCERT questions —{" "}
              <span className="text-blue-600 font-semibold">paper ready in 10 sec.</span>
            </p>
            <p className="text-[15px] text-slate-600" style={hx}>
              Let AI build it for you —{" "}
              <span className="text-blue-600 font-semibold">done in under 2 minutes.</span>
            </p>
          </div>

          {/* ── AUDIENCE TOGGLE ── */}
          <div
            className="mt-6 inline-flex items-center gap-1 rounded-2xl border px-1 py-1 shadow-sm backdrop-blur bg-white/80 border-slate-200"
            role="tablist"
          >
            {([
              { id: "individual", label: "Teachers", icon: <Users size={16} /> },
              { id: "institute", label: "Institutes", icon: <Building size={16} /> },
              { id: "college", label: "Colleges & Schools", icon: <GraduationCap size={16} /> },
            ] as const).map((t) => {
              const active = audience === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setAudience(t.id)}
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

          {/* ── BILLING TOGGLE ── */}
          <div className="mt-4 flex items-center justify-center gap-3 bg-white">
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
              onClick={() => setBillingPeriod((p) => (p === "monthly" ? "yearly" : "monthly"))}
              className="relative h-6 w-12 rounded-full bg-[linear-gradient(90deg,#93c5fd,#3b82f6)] p-0 appearance-none border-0 outline-none ring-0 focus:outline-none focus:ring-0 shadow-inner cursor-pointer"
            >
              <span
                className={`absolute top-[4px] left-[4px] h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${
                  billingPeriod === "yearly" ? "translate-x-[24px]" : ""
                }`}
              />
            </button>
            <span
              className={`text-sm ${billingPeriod === "yearly" ? "text-slate-900" : "text-slate-500"}`}
              style={hx}
            >
              Yearly
            </span>
            <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
              2 months FREE
            </span>
          </div>
        </div>

        {/* ── PRICING CARDS ── */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 bg-white">
          {cards.map((plan, i) => {
            const price = plan.price[billingPeriod];
            const note = plan.priceNote?.[billingPeriod] || "";
            const isFree = plan.free;
            const buttonGradient = plan.buttonGradient || "btn-blue-gradient";
            const isSales = plan.isSales || false;

            /* per-day badge for yearly billing */
            const showPerDay =
              !isFree && !isSales && billingPeriod === "yearly" && price !== "Custom";
            const perDay = showPerDay
              ? Math.round(
                  parseInt(price.replace(/[^0-9]/g, ""), 10) / 365
                )
              : 0;

            return (
              <div
                key={i}
                className={`pricing-card p-6 flex flex-col ${
                  plan.popular ? "outline outline-2 outline-blue-300/60" : ""
                } ${isSales ? "border-2 border-amber-300/60" : ""}`}
              >
                {plan.popular && !isSales && (
                  <div
                    className="absolute -top-3 right-4 rounded-full bg-blue-600/90 px-3 py-1 text-xs text-white shadow z-10"
                    style={hx}
                  >
                    Popular
                  </div>
                )}
                {isSales && (
                  <div
                    className="absolute -top-3 right-4 rounded-full bg-blue-600/90 px-3 py-1 text-xs text-white shadow z-10 flex items-center gap-1"
                    style={hx}
                  >
                    <Phone size={12} /> Talk to Sales
                  </div>
                )}
                {isFree && (
                  <div
                    className="absolute -top-3 right-4 rounded-full bg-emerald-600/90 px-3 py-1 text-xs text-white shadow flex items-center gap-1 z-10"
                    style={hx}
                  >
                    <Gift size={11} /> Free Forever
                  </div>
                )}

                {/* Plan name */}
                <div className="text-slate-800/80 text-[13px]" style={hx}>
                  {plan.name}
                </div>

                {/* Student / teacher limits */}
                {plan.studentLimit && (
                  <div className="mt-1 text-xs font-medium text-slate-500">
                    {plan.studentLimit}
                  </div>
                )}

                {/* Price */}
                <div className="mt-2 mb-1">
                  <div className="flex items-baseline gap-2 bg-transparent">
                    <span className={`text-4xl tracking-tight ${isSales ? "text-slate-900" : "text-slate-900"}`} style={hx}>
                      {price}
                    </span>
                    {note && <span className="text-slate-500 text-base">{note}</span>}
                  </div>
                </div>

                {/* Teacher limit */}
                {plan.teacherLimit && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    {plan.teacherLimit}
                  </div>
                )}

                {/* Per-student pill (institutes & colleges) */}
                {plan.perStudent && !isSales && (
                  <div className="per-student-pill mt-1.5">
                    <UserCheck size={10} />
                    {plan.perStudent}/month
                  </div>
                )}

                {isSales && (
                  <div className="sales-badge">
                    <Mail size={12} />
                    Custom pricing for 2,000+ students
                  </div>
                )}

                {/* Per-day badge on yearly */}
                {showPerDay && (
                  <div className="mt-2 mb-1 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium px-2.5 py-1 rounded-full w-fit">
                    <Clock size={10} />
                    Just ₹{perDay}/day
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={() => {
                    if (isSales) {
                      handleSalesClick();
                    } else if (isFree) {
                      navigate("/signup");
                    } else {
                      navigate("/payment");
                    }
                  }}
                  className={`mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-[14px] cursor-pointer ${buttonGradient}`}
                  style={hx}
                >
                  {isSales
                    ? "Talk to Sales"
                    : isFree
                    ? "Start Free"
                    : plan.popular
                    ? "Subscribe"
                    : "Get Started"}
                </button>

                <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                <p className="mb-3 text-[13px] text-slate-600">
                  {plan.description}
                </p>

                {/* Features */}
                <ul className="space-y-2.5 bg-transparent flex-1">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-3 bg-transparent">
                      <span className={`mt-[2px] flex-shrink-0 rounded-full p-1 ring-1 ${
                        isSales 
                          ? "bg-amber-50 ring-amber-200" 
                          : "bg-sky-50 ring-sky-100"
                      }`}>
                        <Check className={`h-3.5 w-3.5 ${
                          isSales ? "text-amber-600" : "text-sky-600"
                        }`} />
                      </span>
                      <span className="text-[14px] text-slate-700">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Unavailable features (greyed out) */}
                {plan.unavailable && plan.unavailable.length > 0 && (
                  <ul className="mt-3 space-y-2 bg-transparent border-t border-dashed border-slate-200 pt-3">
                    {plan.unavailable.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-3 bg-transparent opacity-50">
                        <span className="mt-[2px] flex-shrink-0 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200">
                          <Check className="h-3.5 w-3.5 text-slate-400" />
                        </span>
                        <span className="text-[13px] text-slate-500 italic">{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {/* ── CTA BANNER ── */}
        <div className="mt-14 bg-slate-900 rounded-2xl p-6 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-transparent">
            <div className="bg-transparent">
              <h3
                className="text-xl sm:text-2xl tracking-tight text-white bg-transparent"
                style={hx}
              >
                Still making test papers manually?
              </h3>
              <p className="mt-2 text-slate-300 text-sm sm:text-[15px] leading-relaxed bg-transparent">
                Teachers spend 3-4 hours creating one test. With a4ai —
                drag &amp; drop in{" "}
                <span className="text-amber-400 font-semibold bg-transparent">10 seconds</span>
                , or let AI build it in{" "}
                <span className="text-amber-400 font-semibold bg-transparent">under 2 minutes</span>.
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

        {/* ── PRICING SUMMARY TABLE ── */}
        <div className="mt-16 pricing-card p-6 sm:p-8 bg-white/95 rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 mb-2">
                <Building size={13} /> Institutional Plans Comparison
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight" style={hx}>
                Pricing Summary — Institutes &amp; Colleges
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                Compare student limits, teacher accounts, and per-student rates side-by-side. Transparent pricing with zero hidden fees.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs font-medium text-slate-400">Billing:</span>
              <button
                type="button"
                onClick={() => setBillingPeriod("monthly")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  billingPeriod === "monthly"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                style={hx}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod("yearly")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  billingPeriod === "yearly"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                style={hx}
              >
                Yearly
                <span className="rounded-full bg-emerald-500 text-white px-1.5 py-0.2 text-[10px]">
                  FREE 2mo
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto mt-4 -mx-6 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {["Plan", "Students", "Teachers", "Monthly", "Yearly", "Per Student", ""].map(
                    (h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${
                          i === 6 ? "text-right" : "text-left"
                        }`}
                        style={hx}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryRows.map((r, i) => {
                  const isSales = r.action === "sales";
                  const showSubheader = i === 0 || i === 3;
                  const subheaderTitle =
                    i === 0
                      ? "Coaching Centres & Institutes (Up to 500 Students)"
                      : "Colleges & Schools (1,000+ Students)";

                  return (
                    <React.Fragment key={i}>
                      {showSubheader && (
                        <tr className="bg-slate-50/80 border-t border-slate-100">
                          <td
                            colSpan={7}
                            className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
                            style={hx}
                          >
                            {subheaderTitle}
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`transition-colors duration-150 ${
                          r.highlight
                            ? "bg-blue-50/30 hover:bg-blue-50/50"
                            : isSales
                            ? "bg-amber-50/20 hover:bg-amber-50/40"
                            : "hover:bg-slate-50/60"
                        }`}
                      >
                        {/* Plan */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[14px] text-slate-900" style={hx}>
                              {r.plan}
                            </span>
                            {r.highlight && (
                              <span
                                className="rounded-full bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 shadow-xs"
                                style={hx}
                              >
                                Popular
                              </span>
                            )}
                            {isSales && (
                              <span
                                className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 border border-amber-200"
                                style={hx}
                              >
                                Enterprise
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Students */}
                        <td className="px-4 py-3.5 text-slate-600 text-[13px] font-medium whitespace-nowrap">
                          {r.students}
                        </td>

                        {/* Teachers */}
                        <td className="px-4 py-3.5 text-slate-600 text-[13px] font-medium whitespace-nowrap">
                          {r.teachers}
                        </td>

                        {/* Monthly */}
                        <td className="px-4 py-3.5 text-slate-900 text-[14px] font-bold whitespace-nowrap" style={hx}>
                          {r.monthly}
                        </td>

                        {/* Yearly */}
                        <td className="px-4 py-3.5 text-slate-900 text-[14px] font-bold whitespace-nowrap" style={hx}>
                          {r.yearly}
                        </td>

                        {/* Per Student */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {isSales ? (
                            <span className="sales-badge">
                              <Mail size={11} /> Custom/mo
                            </span>
                          ) : (
                            <span className="per-student-pill">
                              <UserCheck size={11} /> {r.perStudent}/mo
                            </span>
                          )}
                        </td>

                        {/* Action CTA */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {r.action === "popular" ? (
                            <button
                              onClick={() => navigate("/payment")}
                              className="btn-blue-gradient h-8 px-3.5 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1 shadow-sm"
                              style={hx}
                            >
                              Popular <ArrowRight size={12} />
                            </button>
                          ) : r.action === "sales" ? (
                            <button
                              onClick={handleSalesClick}
                              className="bg-slate-900 hover:bg-slate-800 text-white h-8 px-3.5 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1 shadow-sm transition-colors"
                              style={hx}
                            >
                              Talk to Sales <Mail size={12} />
                            </button>
                          ) : r.action === "contact" ? (
                            <button
                              onClick={() => navigate("/contact")}
                              className="btn-white-action h-8 px-3.5 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1 shadow-sm"
                              style={hx}
                            >
                              Contact <ArrowRight size={12} />
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate("/payment")}
                              className="btn-white-action h-8 px-3.5 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1 shadow-sm"
                              style={hx}
                            >
                              Get Started <ArrowRight size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="mt-14 max-w-4xl mx-auto bg-white">
          <h2 className="text-center text-xl md:text-2xl text-slate-900" style={hx}>
            Frequently Asked Questions
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 bg-transparent">
            {[
              {
                q: "Is the free plan really free?",
                a: "Yes, forever. 1 test + 1 assignment per month with full NCERT content. No credit card needed.",
              },
              {
                q: "Can I change plans anytime?",
                a: "Yes. Upgrade instantly, downgrade applies next billing cycle.",
              },
              {
                q: "What payment methods do you accept?",
                a: "UPI, all major cards, net banking, and bank transfers via Razorpay.",
              },
              {
                q: "Do you offer discounts for schools with 2000+ students?",
                a: "Yes! We offer custom enterprise pricing. Contact our sales team for a tailored quote.",
              },
              {
                q: "How accurate are the questions?",
                a: "Generated from actual NCERT textbooks using RAG. Review & edit before sharing.",
              },
              {
                q: "Can students take tests on mobile?",
                a: "Yes! Full proctoring works on mobile, tablet, and laptop.",
              },
            ].map((f, i) => (
              <div key={i} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-slate-900" style={hx}>
                  {f.q}
                </div>
                <p className="mt-1 text-sm text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── FINAL CTA ── */}
        <div className="mt-14 text-center bg-white">
          <p className="text-slate-500 text-sm mb-4">
            Join 500+ teachers who save 2+ hours every day
          </p>
          <button
            onClick={() => navigate("/signup")}
            className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[15px] btn-blue-gradient cursor-pointer"
            style={hx}
          >
            <Sparkles size={16} />
            Start Creating Tests for Free
            <ArrowRight size={14} />
          </button>
          <p className="mt-3 text-xs text-slate-400" style={hx}>
            No credit card required &nbsp;·&nbsp; 1 free test every month &nbsp;·&nbsp; Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}