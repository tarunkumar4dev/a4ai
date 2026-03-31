// src/components/LoginModal.tsx
// Popup login modal for guest users trying to download/share/save
// Shows phone OTP + Google login options
// After login, stays on same page (no redirect)

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Phone, Download, Share2, Save } from "lucide-react";

const formatPhoneForIndia = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith("91")) return `+${cleaned}`;
  if (phone.startsWith("+")) return phone;
  return phone;
};

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  action?: string; // "download" | "share" | "save" — what triggered the modal
  onLoginSuccess?: () => void; // callback after successful login
}

export default function LoginModal({ isOpen, onClose, action = "download", onLoginSuccess }: LoginModalProps) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) interval = setInterval(() => setTimer(p => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Listen for auth state change (for Google OAuth popup return)
  useEffect(() => {
    if (!isOpen) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setSuccess("Login successful!");
        setTimeout(() => {
          onLoginSuccess?.();
          onClose();
        }, 500);
      }
    });
    return () => subscription.unsubscribe();
  }, [isOpen, onClose, onLoginSuccess]);

  if (!isOpen) return null;

  const actionIcon = action === "share" ? Share2 : action === "save" ? Save : Download;
  const ActionIcon = actionIcon;
  const actionText = action === "share" ? "share this test" : action === "save" ? "save this test" : "download this test";

  const handleSendOTP = async () => {
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      setError("Enter valid 10-digit mobile number");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: formatPhoneForIndia(phone),
      });
      if (otpError) throw otpError;
      setOtpSent(true);
      setTimer(60);
      setSuccess("OTP sent! Check your phone.");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Enter 6-digit OTP");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: formatPhoneForIndia(phone),
        token: code,
        type: "sms",
      });
      if (verifyError) throw verifyError;
      if (data.user) {
        // Set default role
        await supabase.auth.updateUser({ data: { role: "teacher" } });
        setSuccess("Login successful!");
        setTimeout(() => {
          onLoginSuccess?.();
          onClose();
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || "Invalid OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      localStorage.setItem("a4ai_pending_role", "teacher");
      // Store current URL so we come back here after OAuth
      localStorage.setItem("a4ai_redirect_after_login", window.location.pathname + window.location.search);

      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.pathname)}`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (googleError) throw googleError;
    } catch (err: any) {
      setError(err.message || "Google login failed");
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const next = [...otp];
    next[index] = value.substring(value.length - 1);
    setOtp(next);
    if (value && index < 5) {
      document.getElementById(`modal-otp-${index + 1}`)?.focus();
    }
    // Auto-submit on last digit
    if (value && index === 5) {
      const code = [...next].join("");
      if (code.length === 6) setTimeout(() => handleVerifyOTP(), 100);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`modal-otp-${index - 1}`)?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-[420px] bg-white rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.2)] overflow-hidden"
        style={{ animation: "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
      >
        {/* Header gradient */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 px-8 pt-8 pb-10 text-white text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-16 h-16 mx-auto mb-4 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
            <ActionIcon className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Quick Login</h2>
          <p className="text-sm text-indigo-200 mt-2 font-medium">
            Sign in to {actionText}
          </p>
        </div>

        {/* Content */}
        <div className="px-8 py-8 space-y-5">
          {/* Error/Success */}
          {error && (
            <div className="bg-red-50 text-red-600 text-sm font-semibold px-4 py-3 rounded-2xl border border-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 text-emerald-600 text-sm font-semibold px-4 py-3 rounded-2xl border border-emerald-100">
              {success}
            </div>
          )}

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Phone OTP */}
          {!otpSent ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-2 border-slate-200 rounded-2xl overflow-hidden focus-within:border-indigo-400 transition-colors">
                <span className="pl-4 text-slate-500 font-bold text-sm select-none">+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Mobile number"
                  className="flex-1 py-4 pr-4 text-sm font-bold outline-none placeholder-slate-400 text-slate-800"
                  maxLength={10}
                  onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                />
              </div>
              <button
                onClick={handleSendOTP}
                disabled={isLoading || phone.replace(/\D/g, "").length < 10}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                {isLoading ? "Sending..." : "Send OTP"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-slate-500 font-medium">
                OTP sent to <span className="font-bold text-slate-800">+91 {phone}</span>
              </p>
              <div className="flex justify-center gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`modal-otp-${idx}`}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-colors text-slate-800"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>
              <button
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.join("").length !== 6}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Verify & Continue"}
              </button>
              <div className="text-center">
                {timer > 0 ? (
                  <span className="text-xs text-slate-400 font-medium">Resend in {timer}s</span>
                ) : (
                  <button onClick={handleSendOTP} className="text-xs text-indigo-600 font-bold hover:underline">Resend OTP</button>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-[11px] text-slate-400 font-medium pt-2">
            Your test paper is safe — it'll be here after login!
          </p>
        </div>
      </div>
    </div>
  );
}