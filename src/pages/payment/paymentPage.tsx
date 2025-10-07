// src/pages/PaymentPage.tsx
import { useState } from "react";
import { CreditCard, Smartphone, QrCode, Wallet, Shield, CheckCircle } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

/* ----------------------- ENV (Vite) ----------------------- */
const RZP_KEY = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || "";
const RAW_BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) || "https://api.a4ai.in/api";

// join helper: avoids double slashes
const joinUrl = (base: string, path: string) =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

type MethodId = "upi" | "card" | "wallet" | "netbanking";

export default function PaymentPage() {
  const [selectedMethod, setSelectedMethod] = useState<MethodId>("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // ensure Razorpay script
  const ensureRazorpay = () =>
    new Promise<void>((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Razorpay Checkout"));
      document.head.appendChild(script);
    });

  const paymentMethods = [
    { id: "upi" as const, name: "UPI / Google Pay", icon: <Smartphone className="h-6 w-6 md:h-5 md:w-5" />, description: "Instant payment using UPI apps" },
    { id: "card" as const, name: "Credit/Debit Card", icon: <CreditCard className="h-6 w-6 md:h-5 md:w-5" />, description: "Pay using Visa, Mastercard or RuPay" },
    { id: "wallet" as const, name: "Paytm/PhonePe", icon: <Wallet className="h-6 w-6 md:h-5 md:w-5" />, description: "Pay using wallet apps" },
    { id: "netbanking" as const, name: "Net Banking", icon: <QrCode className="h-6 w-6 md:h-5 md:w-5" />, description: "Direct bank transfer" },
  ];

  async function openRazorpay(amountPaise: number) {
    if (!RZP_KEY) {
      alert("Razorpay key missing. Add VITE_RAZORPAY_KEY_ID in your .env and restart the dev server.");
      return;
    }
    setIsProcessing(true);
    try {
      await ensureRazorpay();

      // 1) Create order on backend (amount in paise)
      const body: Record<string, any> = {
        amount: amountPaise,
        payment_method: selectedMethod,
      };
      // TEST UPI shortcut only in non-production
      if (selectedMethod === "upi" && import.meta.env.MODE !== "production") {
        body.vpa = "success@razorpay";
      }

      // NOTE: add trailing slash to avoid 308→405 at edge
      const res = await fetch(joinUrl(RAW_BACKEND_URL, "create-order/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.details || e?.error || `Order create failed (${res.status})`);
      }
      const order = await res.json(); // { id, amount, currency, ... }

      // 2) Open Razorpay Checkout
      const options = {
        key: RZP_KEY,
        order_id: order.id,
        amount: order.amount, // paise
        currency: order.currency || "INR",
        name: "a4ai.in",
        description: "Subscription Payment",
        prefill: { name: "Test User", email: "test@example.com", contact: "9999999999" },
        theme: { color: "#1D4ED8" },
        handler: async (response: any) => {
          // 3) Verify on backend (also with trailing slash)
          try {
            const verifyRes = await fetch(joinUrl(RAW_BACKEND_URL, "verify-payment/"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const result = await verifyRes.json().catch(() => ({}));
            if (verifyRes.ok && result?.success) {
              setPaymentSuccess(true);
            } else {
              throw new Error(result?.error || "Payment Verification Failed");
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
        console.error("Razorpay failed:", resp);
        alert(resp?.error?.description || resp?.error?.reason || "Payment failed");
        setIsProcessing(false);
      });
      rzp.open();
    } catch (error: any) {
      console.error("Payment error:", error);
      alert(error?.message || "Payment failed. Please try again.");
      setIsProcessing(false);
    }
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-[100svh] bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Thank you for your subscription. Your payment has been processed successfully.
          </p>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="w-full rounded-full bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3.5 sm:py-4 px-6 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400/70 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-10 sm:pb-16">
        <div className="text-center mb-6 sm:mb-10 lg:mb-8">
          <h1 className="text-[22px] leading-tight sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 lg:mb-2">
            Complete Your Payment
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Secure payment processed through Razorpay. All transactions are encrypted and secure.
          </p>
        </div>

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
            <SummaryCard />
            <ActionCard isProcessing={isProcessing} onPay={() => openRazorpay(1000)} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------- Subcomponents --------------------- */

function SummaryCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
        Order Summary
      </h2>
      <div className="space-y-3 text-sm sm:text-base">
        <Row label="Plan:" value="Teacher Pro" />
        <Row label="Billing Cycle:" value="Monthly" />
        <Row label="Amount:" value="₹10" />
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
          <div className="flex justify-between text-lg font-semibold">
            <span className="text-gray-900 dark:text-white">Total:</span>
            <span className="text-blue-600 dark:text-blue-400">₹10</span>
          </div>
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

function ActionCard({ isProcessing, onPay }: { isProcessing: boolean; onPay: () => void }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Complete Payment</h2>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-5 sm:mb-8">
        You'll be redirected to a secure payment gateway to complete your transaction.
      </p>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 sm:p-4 mb-6 sm:mb-8">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Secure Payment</h3>
            <p className="text-xs sm:text-sm text-blue-700/90 dark:text-blue-300 mt-1">
              Your payment details are encrypted and secure. We do not store your card information.
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
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </div>
        ) : (
          "Pay ₹10 Now"
        )}
      </button>

      <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-4">
        By completing this payment, you agree to our{" "}
        <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Terms of Service</a>{" "}
        and{" "}
        <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Privacy Policy</a>.
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
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Select Payment Method</h2>
      <div className="space-y-3">
        {paymentMethods.map((method) => (
          <button
            key={method.id}
            type="button"
            className={`w-full text-left p-3.5 sm:p-4 border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              selectedMethod === method.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            onClick={() => setSelectedMethod(method.id)}
          >
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${selectedMethod === method.id ? "bg-blue-100 dark:bg-blue-800" : "bg-gray-100 dark:bg-gray-700"}`}>
                {method.icon}
              </div>
              <div className="ml-3 sm:ml-4">
                <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{method.name}</h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{method.description}</p>
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
