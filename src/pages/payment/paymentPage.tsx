// src/pages/PaymentPage.tsx
import { useState, useEffect } from "react";
import {
  CreditCard,
  Smartphone,
  QrCode,
  Wallet,
  Shield,
  CheckCircle,
  Zap,
  Crown,
  Sparkles,
  Check,
} from "lucide-react";
import { useSubscription, type Plan, type PlanSlug } from "@/hooks/useSubscription";
import { useAuth } from "@/providers/AuthProvider";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const RZP_KEY = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || "";
const RAW_BACKEND_URL =
  (import.meta.env.VITE_PAYMENT_API_URL as string) || "https://api.a4ai.in/api/v1/payment";

const joinUrl = (base: string, path: string) =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

type MethodId = "upi" | "card" | "wallet" | "netbanking";
type BillingCycle = "monthly" | "yearly";

// Yearly = 12 months at 20% discount
const YEARLY_DISCOUNT = 0.20;
const YEARLY_MONTHS = 12;

const PLAN_ICONS: Record<PlanSlug, JSX.Element> = {
  free: <Sparkles className="h-5 w-5" />,
  starter: <Zap className="h-5 w-5" />,
  pro: <Crown className="h-5 w-5" />,
};

const PLAN_COLORS: Record<PlanSlug, { ring: string; bg: string; badge: string }> = {
  free: {
    ring: "ring-gray-300 dark:ring-gray-600",
    bg: "bg-gray-50 dark:bg-gray-800/50",
    badge: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  },
  starter: {
    ring: "ring-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  pro: {
    ring: "ring-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
};

/** Calculate price in paise for the given billing cycle */
function getPriceForCycle(plan: Plan, cycle: BillingCycle): number {
  if (plan.slug === "free") return 0;
  if (cycle === "monthly") return plan.price_paise;
  // Yearly: 12 months × monthly price × (1 - discount)
  return Math.round(plan.price_paise * YEARLY_MONTHS * (1 - YEARLY_DISCOUNT));
}

/** Monthly equivalent when paying yearly */
function getMonthlyEquivalent(plan: Plan): number {
  return Math.round((plan.price_paise * YEARLY_MONTHS * (1 - YEARLY_DISCOUNT)) / YEARLY_MONTHS);
}

export default function PaymentPage() {
  const { user } = useAuth();
  const { plans, status, loading: plansLoading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedMethod, setSelectedMethod] = useState<MethodId>("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    if (plans.length && !selectedPlan) {
      const starter = plans.find((p) => p.slug === "starter");
      setSelectedPlan(starter || plans[1] || plans[0]);
    }
  }, [plans, selectedPlan]);

  const ensureRazorpay = () =>
    new Promise<void>((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Razorpay Checkout"));
      document.head.appendChild(s);
    });

  const paymentMethods = [
    { id: "upi" as const, name: "UPI / Google Pay", icon: <Smartphone className="h-6 w-6 md:h-5 md:w-5" />, description: "Instant payment using UPI apps" },
    { id: "card" as const, name: "Credit/Debit Card", icon: <CreditCard className="h-6 w-6 md:h-5 md:w-5" />, description: "Visa, Mastercard or RuPay" },
    { id: "wallet" as const, name: "Paytm/PhonePe", icon: <Wallet className="h-6 w-6 md:h-5 md:w-5" />, description: "Pay using wallet apps" },
    { id: "netbanking" as const, name: "Net Banking", icon: <QrCode className="h-6 w-6 md:h-5 md:w-5" />, description: "Direct bank transfer" },
  ];

  async function openRazorpay() {
    if (!selectedPlan || selectedPlan.slug === "free") return;
    if (!RZP_KEY) {
      alert("Razorpay key missing. Add VITE_RAZORPAY_KEY_ID in .env");
      return;
    }

    setIsProcessing(true);
    try {
      await ensureRazorpay();

      const actualAmount = getPriceForCycle(selectedPlan, billingCycle);

      const body: Record<string, any> = {
        amount: actualAmount,
        payment_method: selectedMethod,
        plan_slug: selectedPlan.slug,
        billing_cycle: billingCycle,
        user_id: user?.id,
      };
      if (selectedMethod === "upi" && import.meta.env.MODE !== "production") {
        body.vpa = "success@razorpay";
      }

      const res = await fetch(joinUrl(RAW_BACKEND_URL, "create-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.details || e?.error || `Order failed (${res.status})`);
      }
      const order = await res.json();

      const cycleLabel = billingCycle === "yearly" ? "Yearly" : "Monthly";
      const options = {
        key: RZP_KEY,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "a4ai.in",
        description: `${selectedPlan.display_name} Plan — ${cycleLabel}`,
        prefill: {
          name: user?.user_metadata?.full_name || "",
          email: user?.email || "",
          contact: user?.user_metadata?.phone || "",
        },
        theme: { color: "#1D4ED8" },
        notes: {
          plan_slug: selectedPlan.slug,
          billing_cycle: billingCycle,
          user_id: user?.id,
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch(joinUrl(RAW_BACKEND_URL, "verify-payment"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...response,
                plan_slug: selectedPlan.slug,
                billing_cycle: billingCycle,
                user_id: user?.id,
              }),
            });
            const result = await verifyRes.json().catch(() => ({}));
            if (verifyRes.ok && result?.success) {
              setPaymentSuccess(true);
            } else {
              throw new Error(result?.error || "Verification Failed");
            }
          } catch (err: any) {
            alert(err?.message || "Verification failed");
          } finally {
            setIsProcessing(false);
          }
        },
        modal: { ondismiss: () => setIsProcessing(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        alert(resp?.error?.description || "Payment failed");
        setIsProcessing(false);
      });
      rzp.open();
    } catch (error: any) {
      alert(error?.message || "Payment failed. Please try again.");
      setIsProcessing(false);
    }
  }

  // ── Success Screen ──
  if (paymentSuccess && selectedPlan) {
    const cycleLabel = billingCycle === "yearly" ? "Yearly" : "Monthly";
    return (
      <div className="min-h-[100svh] bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Payment Successful!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-1">
            You're now on the <strong>{selectedPlan.display_name} ({cycleLabel})</strong> plan.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {selectedPlan.test_limit === -1
              ? "Unlimited test papers!"
              : `${selectedPlan.test_limit} test papers/month unlocked.`}
            {billingCycle === "yearly" && " You saved 20% with annual billing."}
          </p>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="w-full rounded-full bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3.5 sm:py-4 px-6 shadow-md transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (plansLoading) {
    return (
      <div className="min-h-[100svh] bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const formatPrice = (paise: number) => `₹${(paise / 100).toFixed(0)}`;

  return (
    <div className="min-h-[100svh] bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-10 sm:pb-16">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-10 lg:mb-8">
          <h1 className="text-[22px] leading-tight sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
            Upgrade Your Plan
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {status
              ? `You're on the ${status.plan_name} plan (${status.tests_used}/${status.test_limit === -1 ? "∞" : status.test_limit} tests used this month)`
              : "Choose a plan that works for you"}
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════
            BILLING CYCLE TOGGLE (NEW)
           ═══════════════════════════════════════════════════ */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              billingCycle === "monthly"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${
              billingCycle === "yearly"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Yearly
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              billingCycle === "yearly"
                ? "bg-green-400 text-green-900"
                : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
            }`}>
              Save 20%
            </span>
          </button>
        </div>

        {/* Plan Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {plans.map((plan) => {
            const colors = PLAN_COLORS[plan.slug as PlanSlug] || PLAN_COLORS.free;
            const isSelected = selectedPlan?.slug === plan.slug;
            const isCurrent = status?.plan_slug === plan.slug;
            const isFree = plan.slug === "free";

            const displayPrice = getPriceForCycle(plan, billingCycle);
            const monthlyEquiv = billingCycle === "yearly" ? getMonthlyEquivalent(plan) : plan.price_paise;

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => !isFree && setSelectedPlan(plan)}
                disabled={isFree}
                className={`relative text-left p-5 rounded-2xl border-2 transition-all ${
                  isSelected && !isFree
                    ? `${colors.ring} ring-2 ${colors.bg} border-transparent`
                    : isFree
                    ? "border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-2.5 right-4 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    Current
                  </span>
                )}
                {plan.slug === "pro" && !isCurrent && (
                  <span className="absolute -top-2.5 right-4 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    Popular
                  </span>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${colors.badge}`}>
                    {PLAN_ICONS[plan.slug as PlanSlug] || PLAN_ICONS.free}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {plan.display_name}
                    </h3>
                    {isFree ? (
                      <p className="text-lg font-bold text-gray-900 dark:text-white">Free</p>
                    ) : billingCycle === "yearly" ? (
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatPrice(displayPrice)}<span className="text-sm font-normal text-gray-500">/yr</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatPrice(monthlyEquiv)}/mo
                          <span className="ml-1 line-through text-gray-400">{formatPrice(plan.price_paise)}/mo</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatPrice(displayPrice)}<span className="text-sm font-normal text-gray-500">/mo</span>
                      </p>
                    )}
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {(plan.features as string[]).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Payment Section */}
        {selectedPlan && selectedPlan.slug !== "free" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-7 lg:gap-6">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-6">
                <MethodsCard
                  paymentMethods={paymentMethods}
                  selectedMethod={selectedMethod}
                  setSelectedMethod={setSelectedMethod}
                />
              </div>
            </div>
            <div className="lg:col-span-7 space-y-4 sm:space-y-6">
              <SummaryCard plan={selectedPlan} billingCycle={billingCycle} formatPrice={formatPrice} />
              <ActionCard
                isProcessing={isProcessing}
                onPay={openRazorpay}
                plan={selectedPlan}
                billingCycle={billingCycle}
                formatPrice={formatPrice}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function SummaryCard({ plan, billingCycle, formatPrice }: { plan: Plan; billingCycle: BillingCycle; formatPrice: (p: number) => string }) {
  const actualPrice = getPriceForCycle(plan, billingCycle);
  const cycleLabel = billingCycle === "yearly" ? "Yearly" : "Monthly";
  const originalYearlyPrice = plan.price_paise * YEARLY_MONTHS;
  const savings = billingCycle === "yearly" ? originalYearlyPrice - actualPrice : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
        Order Summary
      </h2>
      <div className="space-y-3 text-sm sm:text-base">
        <Row label="Plan:" value={`Teacher ${plan.display_name}`} />
        <Row label="Billing Cycle:" value={cycleLabel} />
        <Row
          label="Test Papers:"
          value={plan.test_limit === -1 ? "Unlimited" : `${plan.test_limit}/month`}
        />
        <Row label="Amount:" value={formatPrice(actualPrice)} />
        {billingCycle === "yearly" && savings > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-green-600 dark:text-green-400 font-medium">You save:</span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {formatPrice(savings)} (20% off)
            </span>
          </div>
        )}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
          <div className="flex justify-between text-lg font-semibold">
            <span className="text-gray-900 dark:text-white">Total:</span>
            <span className="text-blue-600 dark:text-blue-400">
              {formatPrice(actualPrice)}
            </span>
          </div>
          {billingCycle === "yearly" && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-right mt-1">
              Billed annually ({formatPrice(getMonthlyEquivalent(plan))}/mo effective)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <span className="font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

function ActionCard({
  isProcessing,
  onPay,
  plan,
  billingCycle,
  formatPrice,
}: {
  isProcessing: boolean;
  onPay: () => void;
  plan: Plan;
  billingCycle: BillingCycle;
  formatPrice: (p: number) => string;
}) {
  const actualPrice = getPriceForCycle(plan, billingCycle);
  const cycleLabel = billingCycle === "yearly" ? "Yearly" : "Monthly";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Complete Payment
      </h2>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-5 sm:mb-8">
        You'll be redirected to Razorpay for your {plan.display_name} plan ({cycleLabel}).
      </p>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 sm:p-4 mb-6 sm:mb-8">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Secure Payment
            </h3>
            <p className="text-xs sm:text-sm text-blue-700/90 dark:text-blue-300 mt-1">
              Your payment details are encrypted. We do not store your card information.
            </p>
          </div>
        </div>
      </div>
      <button
        onClick={onPay}
        disabled={isProcessing}
        className="w-full rounded-full bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-4 px-6 shadow-[0_6px_20px_rgba(29,78,216,0.25)] focus:outline-none focus:ring-2 focus:ring-blue-400/70 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </div>
        ) : (
          `Pay ${formatPrice(actualPrice)} Now`
        )}
      </button>
      <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-4">
        By completing this payment, you agree to our{" "}
        <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}

function MethodsCard({
  paymentMethods,
  selectedMethod,
  setSelectedMethod,
}: {
  paymentMethods: { id: MethodId; name: string; icon: JSX.Element; description: string }[];
  selectedMethod: MethodId;
  setSelectedMethod: (m: MethodId) => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
        Select Payment Method
      </h2>
      <div className="space-y-3">
        {paymentMethods.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`w-full text-left p-3.5 sm:p-4 border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              selectedMethod === m.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            onClick={() => setSelectedMethod(m.id)}
          >
            <div className="flex items-center">
              <div
                className={`p-2 rounded-lg ${
                  selectedMethod === m.id ? "bg-blue-100 dark:bg-blue-800" : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                {m.icon}
              </div>
              <div className="ml-3 sm:ml-4">
                <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                  {m.name}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {m.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-5 sm:mt-6 flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        <Shield className="h-4 w-4 mr-2 text-green-600" />
        <span>Secure and encrypted payment processing</span>
      </div>
    </div>
  );
}