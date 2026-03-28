// src/pages/PaymentPage.tsx
// Reads ?plan=starter&cycle=yearly from URL (set by PricingPage)
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  CreditCard, Smartphone, QrCode, Wallet, Shield,
  CheckCircle, Check, ArrowLeft, Zap, Crown,
  Building2, Users, BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/providers/AuthProvider";

declare global {
  interface Window { Razorpay: any; }
}

const RZP_KEY = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || "";
const RAW_BACKEND_URL =
  (import.meta.env.VITE_PAYMENT_API_URL as string) || "https://api.a4ai.in/api/v1/payment";

const joinUrl = (b: string, p: string) => `${b.replace(/\/+$/, "")}/${p.replace(/^\/+/, "")}`;

type MethodId = "upi" | "card" | "wallet" | "netbanking";
type BillingCycle = "monthly" | "yearly";

const YEARLY_DISCOUNT = 0.20;

// ═══════════════════════════════════════════════════════════
// PLAN CONFIG (must match PricingPage + DB)
// ═══════════════════════════════════════════════════════════
interface PlanInfo {
  slug: string;
  name: string;
  monthlyPaise: number;
  testLimit: number;
  features: string[];
  icon: React.ReactNode;
  studentLimit?: number;
}

const PLAN_MAP: Record<string, PlanInfo> = {
  starter: {
    slug: "starter", name: "Starter", monthlyPaise: 14900, testLimit: 10,
    features: ["10 test papers/month", "All formats", "PDF & DOCX", "2 free contests"],
    icon: <Zap className="h-5 w-5" />,
  },
  pro: {
    slug: "pro", name: "Pro", monthlyPaise: 29900, testLimit: 50,
    features: ["Unlimited test papers", "All formats", "Unlimited contests", "Priority generation"],
    icon: <Crown className="h-5 w-5" />,
  },
  institute_start: {
    slug: "institute_start", name: "Institute Start", monthlyPaise: 99900, testLimit: 75,
    features: ["100 students", "75 papers/month", "Attendance", "Contests"],
    icon: <Building2 className="h-5 w-5" />, studentLimit: 100,
  },
  institute_scale: {
    slug: "institute_scale", name: "Institute Scale", monthlyPaise: 149900, testLimit: 120,
    features: ["250 students", "120 papers/month", "Analytics", "Priority support"],
    icon: <Users className="h-5 w-5" />, studentLimit: 250,
  },
  institute_enterprise: {
    slug: "institute_enterprise", name: "Institute Enterprise", monthlyPaise: 199900, testLimit: 200,
    features: ["500 students", "Unlimited papers", "Advanced analytics", "Dedicated support"],
    icon: <BarChart3 className="h-5 w-5" />, studentLimit: 500,
  },
};

function getPrice(paise: number, cycle: BillingCycle): number {
  if (cycle === "yearly") return Math.round(paise * 12 * (1 - YEARLY_DISCOUNT));
  return paise;
}
function getMonthlyEquiv(paise: number): number {
  return Math.round((paise * 12 * (1 - YEARLY_DISCOUNT)) / 12);
}
function fmt(paise: number): string { return `₹${(paise / 100).toFixed(0)}`; }
function fmtPerDay(paise: number, cycle: BillingCycle): string {
  const total = getPrice(paise, cycle);
  const days = cycle === "yearly" ? 365 : 30;
  return `₹${(total / 100 / days).toFixed(0)}`;
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { refreshStatus } = useSubscription();

  const planSlug = searchParams.get("plan") || "starter";
  const cycleParm = searchParams.get("cycle") as BillingCycle | null;

  const plan = PLAN_MAP[planSlug];
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(cycleParm || "monthly");
  const [selectedMethod, setSelectedMethod] = useState<MethodId>("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    if (!plan) navigate("/pricing");
  }, [plan, navigate]);

  const ensureRazorpay = () =>
    new Promise<void>((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Razorpay"));
      document.head.appendChild(s);
    });

  const actualPrice = plan ? getPrice(plan.monthlyPaise, billingCycle) : 0;
  const monthlyEquiv = plan && billingCycle === "yearly" ? getMonthlyEquiv(plan.monthlyPaise) : plan?.monthlyPaise || 0;
  const savings = plan && billingCycle === "yearly" ? (plan.monthlyPaise * 12) - actualPrice : 0;

  async function handlePay() {
    if (!plan || !user) return;
    if (!RZP_KEY) { alert("Razorpay key missing"); return; }

    setIsProcessing(true);
    try {
      await ensureRazorpay();

      const res = await fetch(joinUrl(RAW_BACKEND_URL, "create-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: actualPrice,
          payment_method: selectedMethod,
          plan_slug: plan.slug,
          billing_cycle: billingCycle,
          user_id: user.id,
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.detail || e?.error || `Order failed (${res.status})`);
      }
      const order = await res.json();

      const cycleLabel = billingCycle === "yearly" ? "Yearly" : "Monthly";
      const rzp = new window.Razorpay({
        key: RZP_KEY,
        order_id: order.id,
        amount: order.amount,
        currency: "INR",
        name: "a4ai.in",
        description: `${plan.name} Plan — ${cycleLabel}`,
        prefill: {
          name: user.user_metadata?.full_name || "",
          email: user.email || "",
        },
        theme: { color: "#111827" },
        notes: { plan_slug: plan.slug, billing_cycle: billingCycle, user_id: user.id },
        handler: async (response: any) => {
          try {
            const vRes = await fetch(joinUrl(RAW_BACKEND_URL, "verify-payment"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...response,
                plan_slug: plan.slug,
                billing_cycle: billingCycle,
                user_id: user.id,
              }),
            });
            const result = await vRes.json().catch(() => ({}));
            if (vRes.ok && result?.success) {
              setPaymentSuccess(true);
              refreshStatus();
            } else {
              throw new Error(result?.error || "Verification failed");
            }
          } catch (err: any) {
            alert(err?.message || "Verification failed");
          } finally {
            setIsProcessing(false);
          }
        },
        modal: { ondismiss: () => setIsProcessing(false) },
      });
      rzp.on("payment.failed", (r: any) => {
        alert(r?.error?.description || "Payment failed");
        setIsProcessing(false);
      });
      rzp.open();
    } catch (err: any) {
      alert(err?.message || "Payment failed");
      setIsProcessing(false);
    }
  }

  if (!plan) return null;

  // ── SUCCESS ──
  if (paymentSuccess) {
    const cycleLabel = billingCycle === "yearly" ? "Yearly" : "Monthly";
    return (
      <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl ring-1 ring-gray-100 p-8 max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="h-9 w-9 text-green-500" />
          </motion.div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">You're all set!</h1>
          <p className="text-gray-500 mb-1">
            <strong>{plan.name} ({cycleLabel})</strong> is now active.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            {plan.testLimit >= 200 ? "Unlimited" : plan.testLimit} test papers unlocked.
            {billingCycle === "yearly" && " You saved 20% with annual billing."}
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // ── CHECKOUT ──
  const methods = [
    { id: "upi" as const, name: "UPI / Google Pay", icon: Smartphone, sub: "Instant payment" },
    { id: "card" as const, name: "Credit/Debit Card", icon: CreditCard, sub: "Visa, Mastercard, RuPay" },
    { id: "wallet" as const, name: "Paytm / PhonePe", icon: Wallet, sub: "Mobile wallets" },
    { id: "netbanking" as const, name: "Net Banking", icon: QrCode, sub: "Bank transfer" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/pricing")} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
            <p className="text-xs text-gray-400">{plan.name} Plan · Secure payment via Razorpay</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left: Payment Method ── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Billing toggle */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Billing Cycle</h2>
              <div className="grid grid-cols-2 gap-3">
                {(["monthly", "yearly"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setBillingCycle(c)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      billingCycle === c
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="text-sm font-bold text-gray-900 capitalize">{c}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c === "monthly"
                        ? `${fmt(plan.monthlyPaise)}/month`
                        : `${fmt(getPrice(plan.monthlyPaise, "yearly"))}/year`}
                    </p>
                    {c === "yearly" && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        -20%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment methods */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Payment Method</h2>
              <div className="space-y-2">
                {methods.map((m) => {
                  const Icon = m.icon;
                  const active = selectedMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMethod(m.id)}
                      className={`w-full flex items-center gap-4 p-3.5 rounded-xl border-2 transition-all text-left ${
                        active ? "border-gray-900 bg-gray-50" : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                        <p className="text-[11px] text-gray-400">{m.sub}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        active ? "border-gray-900 bg-gray-900" : "border-gray-300"
                      }`}>
                        {active && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Security */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
              <Shield className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-600">
                <strong>256-bit encrypted</strong> · Powered by Razorpay · We never store card details
              </p>
            </div>
          </div>

          {/* ── Right: Order Summary ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-5 lg:sticky lg:top-6">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Order Summary</h2>

              {/* Plan card */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100 mb-4">
                <div className="p-2 rounded-lg bg-gray-900 text-white">
                  {plan.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{plan.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{billingCycle} billing</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-2.5 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">{plan.name} plan</span>
                  <span className="font-medium text-gray-900">
                    {billingCycle === "yearly"
                      ? `${fmt(plan.monthlyPaise)} × 12`
                      : fmt(plan.monthlyPaise)}
                  </span>
                </div>
                {billingCycle === "yearly" && (
                  <div className="flex justify-between text-green-600">
                    <span>Annual discount (20%)</span>
                    <span className="font-medium">-{fmt(savings)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500">
                  <span>Test papers</span>
                  <span className="font-medium text-gray-900">
                    {plan.testLimit >= 200 ? "Unlimited" : `${plan.testLimit}/mo`}
                  </span>
                </div>
                {plan.studentLimit && (
                  <div className="flex justify-between text-gray-500">
                    <span>Students</span>
                    <span className="font-medium text-gray-900">Up to {plan.studentLimit}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-3 mb-5">
                <div className="flex justify-between items-baseline">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-gray-900">{fmt(actualPrice)}</span>
                    {billingCycle === "yearly" && (
                      <p className="text-[11px] text-gray-400">{fmt(monthlyEquiv)}/mo effective</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1 text-right">
                  That's just {fmtPerDay(plan.monthlyPaise, billingCycle)}/day
                </p>
              </div>

              {/* Pay button */}
              <button
                onClick={handlePay}
                disabled={isProcessing}
                className="w-full py-4 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  `Pay ${fmt(actualPrice)} Now`
                )}
              </button>

              <p className="text-center text-[11px] text-gray-400 mt-3">
                Cancel anytime · No hidden charges
              </p>

              {/* Features list */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">What you get</p>
                <ul className="space-y-1.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-gray-500">
                      <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}