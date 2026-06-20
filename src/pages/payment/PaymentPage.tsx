// src/pages/PaymentPage.tsx
// Reads ?plan=starter&cycle=yearly from URL (set by PricingPage)
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  CreditCard, Smartphone, QrCode, Wallet, Shield,
  CheckCircle, Check, ArrowLeft, Zap, Crown,
  Building2, Users, BarChart3,
} from "lucide-react";
import { 
  motion, 
  useMotionValue, 
  useMotionTemplate, 
  useReducedMotion 
} from "framer-motion";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/context/ThemeContext";

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

/* ──────────────────────────────────────────────────────────────
   BRAND STYLES & GLOBAL INJECTION
   ────────────────────────────────────────────────────────────── */
const BRAND_GRADIENT =
  "linear-gradient(90deg, #818cf8, #34d399, #38bdf8, #6366f1, #818cf8, #34d399, #38bdf8, #6366f1)";

const GlobalStyles = () => {
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      .lp { font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .ag-card {
        border-radius: 18px;
        transition: transform 0.2s cubic-bezier(.16,1,.3,1), box-shadow 0.2s cubic-bezier(.16,1,.3,1);
        position: relative;
        overflow: hidden;
      }
      @media (min-width: 640px) { .ag-card { border-radius: 20px; } }
      .ag-card-light {
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(0,0,0,0.08);
        backdrop-filter: blur(24px) saturate(160%);
        -webkit-backdrop-filter: blur(24px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(59,130,246,0.07), 0 2px 6px rgba(0,0,0,0.05);
      }
      .ag-card-dark {
        background: rgba(20,25,40,0.65);
        border: 1px solid rgba(255,255,255,0.09);
        backdrop-filter: blur(24px) saturate(160%);
        -webkit-backdrop-filter: blur(24px) saturate(160%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 6px 24px rgba(0,0,0,0.45);
      }
      @keyframes fast-gradient {
        0% { background-position: 0% center; }
        100% { background-position: -200% center; }
      }
      .nlm-text {
        background: ${BRAND_GRADIENT};
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: fast-gradient 4s linear infinite;
      }
      .btn-blk {
        position:relative; overflow:hidden;
        background: linear-gradient(180deg,#202124 0%,#111111 100%);
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2);
        color: white; font-weight:600;
        border-radius: 14px;
        transition: transform 0.2s, box-shadow 0.2s;
        -webkit-tap-highlight-color: transparent;
      }
      .btn-blk:active { transform: scale(0.98); }
      .sorb { position:absolute; border-radius:50%; pointer-events:none; filter: blur(50px); }
    `;
    document.head.appendChild(s);
    return () => {
      if (document.head.contains(s)) document.head.removeChild(s);
    };
  }, []);
  return null;
};

const card = (isDark: boolean) => `ag-card ${isDark ? "ag-card-dark" : "ag-card-light"}`;
const muted = (isDark: boolean) => (isDark ? "#8a9bb0" : "#5f6368");
const head = (isDark: boolean) => (isDark ? "#f1f5f9" : "#111111");
const accent = (isDark: boolean) => (isDark ? "#60a5fa" : "#3b82f6");

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
  const { theme } = useTheme();
  
  const isDark = theme === "dark";
  const prefersReducedMotion = useReducedMotion();

  // Ambient glow follows cursor
  const mx = useMotionValue(360);
  const my = useMotionValue(180);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const bgGlow = useMotionTemplate`
    radial-gradient(1000px 520px at ${mx}px ${my}px, ${isDark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.04)"}, transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px + 260px) calc(${my}px + 140px), ${isDark ? "rgba(96,165,250,0.06)" : "rgba(96,165,250,0.04)"}, transparent 70%),
    radial-gradient(1000px 520px at calc(${mx}px - 260px) calc(${my}px + 220px), ${isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)"}, transparent 70%)
  `;

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
      <div 
        onMouseMove={onMove} 
        className="lp min-h-screen relative overflow-hidden transition-colors duration-300 flex items-center justify-center p-4" 
        style={{ background: isDark ? "#07090f" : "#ffffff" }}
      >
        <GlobalStyles />
        {!prefersReducedMotion && (
          <motion.div aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-100" style={{ backgroundImage: bgGlow as any }} />
        )}
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-8 max-w-md w-full text-center ${card(isDark)}`}
        >
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: isDark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.1)" }}
          >
            <CheckCircle className="h-9 w-9 text-green-500" />
          </motion.div>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: head(isDark) }}>You're all set!</h1>
          <p className="mb-1" style={{ color: muted(isDark) }}>
            <strong style={{ color: head(isDark) }}>{plan.name} ({cycleLabel})</strong> is now active.
          </p>
          <p className="text-sm mb-6" style={{ color: muted(isDark) }}>
            {plan.testLimit >= 200 ? "Unlimited" : plan.testLimit} test papers unlocked.
            {billingCycle === "yearly" && " You saved 20% with annual billing."}
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="btn-blk w-full py-3.5"
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
    <div 
      onMouseMove={onMove} 
      className="lp min-h-screen relative overflow-hidden transition-colors duration-300" 
      style={{ background: isDark ? "#07090f" : "#ffffff" }}
    >
      <GlobalStyles />

      {/* Background Orbs */}
      <div className="hidden sm:block">
        <div className="sorb" style={{ width: 600, height: 600, right: -150, top: -100, background: isDark ? "rgba(59,130,246,0.05)" : "rgba(59,130,246,0.03)" }} />
        <div className="sorb" style={{ width: 500, height: 500, left: -100, bottom: "20%", background: isDark ? "rgba(129,140,248,0.05)" : "rgba(129,140,248,0.03)" }} />
      </div>

      {/* Grid Overlay */}
      <div
        className="absolute inset-0 -z-20 pointer-events-none"
        style={{
          opacity: isDark ? 0.02 : 0.035,
          backgroundImage: `linear-gradient(to right, ${isDark ? "#ffffff" : "#000000"} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? "#ffffff" : "#000000"} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      
      {!prefersReducedMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-100"
          style={{ backgroundImage: bgGlow as any }}
        />
      )}

      {/* Top bar (Glassy) */}
      <div className="relative z-10 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", background: isDark ? "rgba(10,14,24,0.4)" : "rgba(255,255,255,0.4)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button 
            onClick={() => navigate("/pricing")} 
            className="p-2 rounded-lg transition-colors"
            style={{ color: muted(isDark), background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold" style={{ color: head(isDark) }}>Checkout</h1>
            <p className="text-xs" style={{ color: muted(isDark) }}>{plan.name} Plan · Secure payment via Razorpay</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left: Payment Method ── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Billing toggle */}
            <div className={`p-5 ${card(isDark)}`}>
              <h2 className="text-sm font-bold mb-3" style={{ color: head(isDark) }}>Billing Cycle</h2>
              <div className="grid grid-cols-2 gap-3">
                {(["monthly", "yearly"] as const).map((c) => {
                  const active = billingCycle === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setBillingCycle(c)}
                      className="relative p-4 rounded-xl border text-left transition-all"
                      style={{
                        borderColor: active ? accent(isDark) : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"),
                        background: active ? (isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.05)") : "transparent"
                      }}
                    >
                      <p className="text-sm font-bold capitalize" style={{ color: head(isDark) }}>{c}</p>
                      <p className="text-xs mt-0.5" style={{ color: muted(isDark) }}>
                        {c === "monthly"
                          ? `${fmt(plan.monthlyPaise)}/month`
                          : `${fmt(getPrice(plan.monthlyPaise, "yearly"))}/year`}
                      </p>
                      {c === "yearly" && (
                        <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: isDark ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.1)", color: isDark ? "#4ade80" : "#166534" }}>
                          -20%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment methods */}
            <div className={`p-5 ${card(isDark)}`}>
              <h2 className="text-sm font-bold mb-3" style={{ color: head(isDark) }}>Payment Method</h2>
              <div className="space-y-2">
                {methods.map((m) => {
                  const Icon = m.icon;
                  const active = selectedMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMethod(m.id)}
                      className="w-full flex items-center gap-4 p-3.5 rounded-xl border transition-all text-left"
                      style={{
                        borderColor: active ? accent(isDark) : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"),
                        background: active ? (isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.05)") : "transparent"
                      }}
                    >
                      <div className="p-2 rounded-lg" style={{ background: active ? accent(isDark) : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"), color: active ? "#fff" : muted(isDark) }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: head(isDark) }}>{m.name}</p>
                        <p className="text-[11px]" style={{ color: muted(isDark) }}>{m.sub}</p>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors" style={{ 
                        borderColor: active ? accent(isDark) : (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"),
                        background: active ? accent(isDark) : "transparent"
                      }}>
                        {active && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Security */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ background: isDark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.05)", borderColor: isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.1)" }}>
              <Shield className="h-4 w-4 flex-shrink-0" style={{ color: accent(isDark) }} />
              <p className="text-xs" style={{ color: isDark ? "#93c5fd" : "#2563eb" }}>
                <strong>256-bit encrypted</strong> · Powered by Razorpay · We never store card details
              </p>
            </div>
          </div>

          {/* ── Right: Order Summary ── */}
          <div className="lg:col-span-2">
            <div className={`p-5 lg:sticky lg:top-6 ${card(isDark)}`}>
              <h2 className="text-sm font-bold mb-4" style={{ color: head(isDark) }}>Order Summary</h2>

              {/* Plan card */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl border mb-4" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}>
                <div className="p-2 rounded-lg" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#111", color: isDark ? head(isDark) : "#fff" }}>
                  {plan.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: head(isDark) }}>{plan.name}</p>
                  <p className="text-xs capitalize" style={{ color: muted(isDark) }}>{billingCycle} billing</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-2.5 text-sm mb-4">
                <div className="flex justify-between">
                  <span style={{ color: muted(isDark) }}>{plan.name} plan</span>
                  <span className="font-medium" style={{ color: head(isDark) }}>
                    {billingCycle === "yearly"
                      ? `${fmt(plan.monthlyPaise)} × 12`
                      : fmt(plan.monthlyPaise)}
                  </span>
                </div>
                {billingCycle === "yearly" && (
                  <div className="flex justify-between" style={{ color: isDark ? "#4ade80" : "#16a34a" }}>
                    <span>Annual discount (20%)</span>
                    <span className="font-medium">-{fmt(savings)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: muted(isDark) }}>Test papers</span>
                  <span className="font-medium" style={{ color: head(isDark) }}>
                    {plan.testLimit >= 200 ? "Unlimited" : `${plan.testLimit}/mo`}
                  </span>
                </div>
                {plan.studentLimit && (
                  <div className="flex justify-between">
                    <span style={{ color: muted(isDark) }}>Students</span>
                    <span className="font-medium" style={{ color: head(isDark) }}>Up to {plan.studentLimit}</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-3 mb-5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}>
                <div className="flex justify-between items-baseline">
                  <span className="text-base font-bold" style={{ color: head(isDark) }}>Total</span>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold" style={{ color: head(isDark) }}>{fmt(actualPrice)}</span>
                    {billingCycle === "yearly" && (
                      <p className="text-[11px]" style={{ color: muted(isDark) }}>{fmt(monthlyEquiv)}/mo effective</p>
                    )}
                  </div>
                </div>
                <p className="text-xs mt-1 text-right" style={{ color: muted(isDark) }}>
                  That's just {fmtPerDay(plan.monthlyPaise, billingCycle)}/day
                </p>
              </div>

              {/* Pay button */}
              <button
                onClick={handlePay}
                disabled={isProcessing}
                className="btn-blk w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50"
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

              <p className="text-center text-[11px] mt-3" style={{ color: muted(isDark) }}>
                Cancel anytime · No hidden charges
              </p>

              {/* Features list */}
              <div className="mt-4 pt-4 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: muted(isDark) }}>What you get</p>
                <ul className="space-y-1.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs" style={{ color: head(isDark) }}>
                      <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: isDark ? "#4ade80" : "#22c55e" }} /> {f}
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