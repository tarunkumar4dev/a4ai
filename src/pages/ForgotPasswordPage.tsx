// src/pages/ForgotPasswordPage.tsx
// Route: /forgot — "Forgot Password?" on the login page links here (the route used to be missing → 404).
// Sends a Supabase password-reset email whose link opens /reset-password.
// Also how a Google-created account gets a password (so it can sign in with email too).
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError("Enter a valid email address.");
      return;
    }
    setSending(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(clean, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (err) {
      const wait = err.message.match(/after (\d+) seconds?/i);
      setError(wait
        ? `Please wait ${wait[1]} seconds before requesting another link.`
        : /rate limit/i.test(err.message)
          ? "Too many reset emails were requested. Please try again in a little while."
          : err.message);
      return;
    }
    // Same message whether or not the account exists — don't reveal which emails are registered.
    setSent(true);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#E0E6F7] font-sans">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl shadow-xl p-8">
        <Link to="/login" className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to sign in
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Reset password</h1>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              If an account exists for <b>{email.trim().toLowerCase()}</b>, we've emailed a link to set a new password.
              Open it on this device. The link expires after a while — check your spam folder too.
            </p>
            <p className="text-xs text-slate-500">
              Signed up with Google? You can sign in with Google any time — or use this link to also set a password.
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setError(null); }}
              className="text-sm font-bold underline text-slate-800"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-600">Enter the email you sign in with. We'll send you a link to set a new password.</p>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full h-12 rounded-xl pl-11 pr-4 bg-white/60 border border-white/60 outline-none focus:ring-2 focus:ring-black/20 text-slate-900"
                autoFocus
              />
            </div>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="w-full h-12 rounded-2xl font-bold bg-black text-white hover:bg-slate-900 disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
