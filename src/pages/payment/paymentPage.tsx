// src/pages/PaymentPage.tsx
import { useEffect, useState } from "react";
import { CreditCard, Smartphone, QrCode, Wallet, Shield, CheckCircle } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

/* ----------------------- ENV (Vite) ----------------------- */
// These are injected at build time. Make sure keys start with VITE_
const RZP_KEY = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || "";
const RAW_BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:5000";

// normalize BACKEND_URL and safely join paths
const joinUrl = (base: string, path: string) =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

type MethodId = "upi" | "card" | "wallet" | "netbanking";

export default function PaymentPage() {
  const [selectedMethod, setSelectedMethod] = useState<MethodId>("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // ---- lazily ensure Razorpay script exists ----
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
    { id: "upi" as const, name: "UPI / Google Pay", icon: <Smartphone className="h-6 w-6" />, description: "Instant payment using UPI apps" },
    { id: "card" as const, name: "Credit/Debit Card", icon: <CreditCard className="h-6 w-6" />, description: "Pay using Visa, Mastercard or RuPay" },
    { id: "wallet" as const, name: "Paytm/PhonePe", icon: <Wallet className="h-6 w-6" />, description: "Pay using wallet apps" },
    { id: "netbanking" as const, name: "Net Banking", icon: <QrCode className="h-6 w-6" />, description: "Direct bank transfer" },
  ];

  const openRazorpay = async (amountPaise: number) => {
    if (!RZP_KEY) {
      alert("Razorpay key missing. Add VITE_RAZORPAY_KEY_ID in your .env and restart the dev server.");
      return;
    }

    setIsProcessing(true);
    try {
      await ensureRazorpay();

      // 1) Create order on backend (amount in paise)
      const res = await fetch(joinUrl(RAW_BACKEND_URL, "/create-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          payment_method: selectedMethod,
          // For Razorpay TEST mode UPI, this helps quick success; prod should NOT force this.
          vpa: selectedMethod === "upi" ? "success@razorpay" : undefined,
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.details || e?.error || `Order create failed (${res.status})`);
      }
      const order = await res.json(); // expect: { id, amount, currency }

      // 2) Open Razorpay Checkout
      const options = {
        key: RZP_KEY,
        order_id: order.id,
        amount: order.amount, // paise
        currency: order.currency || "INR",
        name: "a4ai.in",
        description: "Subscription Payment (Test)",
        prefill: { name: "Test User", email: "test@example.com", contact: "9999999999" },
        theme: { color: "#6366f1" },
        handler: async function (response: any) {
          // 3) Verify on backend
          try {
            const verifyRes = await fetch(joinUrl(RAW_BACKEND_URL, "/verify-payment"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response), // { razorpay_order_id, razorpay_payment_id, razorpay_signature }
            });
            const result = await verifyRes.json();
            if (verifyRes.ok && result?.success) {
              setPaymentSuccess(true);
            } else {
              alert(result?.error || "Payment Verification Failed ❌");
            }
          } catch (e: any) {
            alert(e?.message || "Verification failed");
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
  };

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Thank you for your subscription. Your payment has been processed successfully.
          </p>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Complete Your Payment
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Secure payment processed through Razorpay. All transactions are encrypted and secure.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left: Methods + Summary */}
          <div className="lg:w-2/5">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Select Payment Method</h2>
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${
                      selectedMethod === method.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => setSelectedMethod(method.id)}
                  >
                    <div className="flex items-center">
                      <div
                        className={`p-2 rounded-lg ${
                          selectedMethod === method.id ? "bg-blue-100 dark:bg-blue-800" : "bg-gray-100 dark:bg-gray-700"
                        }`}
                      >
                        {method.icon}
                      </div>
                      <div className="ml-4">
                        <h3 className="font-medium text-gray-900 dark:text-white">{method.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{method.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center text-sm text-gray-5 00 dark:text-gray-400">
                <Shield className="h-4 w-4 mr-2 text-green-500" />
                <span>Secure and encrypted payment processing</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Order Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">Plan:</span><span className="font-medium text-gray-900 dark:text-white">Teacher Pro</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">Billing Cycle:</span><span className="font-medium text-gray-900 dark:text-white">Monthly</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">Amount:</span><span className="font-medium text-gray-900 dark:text-white">₹999</span></div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-gray-900 dark:text-white">Total:</span>
                    <span className="text-blue-600 dark:text-blue-400">₹999</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Action */}
          <div className="lg:w-3/5">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Complete Payment</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                You'll be redirected to a secure payment gateway to complete your transaction.
              </p>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-8">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Secure Payment</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                      Your payment details are encrypted and secure. We do not store your card information.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openRazorpay(99900)} // paise
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-4 px-6 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </div>
                ) : (
                  `Pay ₹999 Now`
                )}
              </button>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                By completing this payment, you agree to our{" "}
                <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Terms of Service</a>{" "}
                and{" "}
                <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </div>  
    </div>
  );
}
