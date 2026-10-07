// src/pages/ResetPasswordPage.tsx
// Route: /reset-password — target of the password-reset email (ForgotPasswordPage).
// The link signs the user in for recovery (PKCE ?code=…); this page then sets the new password.
// Not behind AuthGateForAuthPages: the recovery session must NOT bounce the user to a dashboard.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { rememberPassword } from "@/lib/authHelpers";

type Phase = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = new URL(window.location.href);
    const linkError = url.searchParams.get("error_description") || new URLSearchParams(url.hash.slice(1)).get("error_description");
    if (linkError) {
      setPhase("invalid");
      return;
    }

    (async () => {
      // The client may already have exchanged the code (detectSessionInUrl); only exchange if it hasn't.
      let { data: { session } } = await supabase.auth.getSession();
      const code = url.searchParams.get("code");
      if (!session && code) {
        await supabase.auth.exchangeCodeForSession(window.location.href).catch(() => undefined);
        session = (await supabase.auth.getSession()).data.session;
      }
      if (!session) {
        // Give the automatic URL detection a moment before giving up.
        await new Promise((r) => setTimeout(r, 800));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (cancelled) return;
      window.history.replaceState({}, "", `${window.location.origin}/reset-password`); // drop the one-time code
      setPhase(session ? "ready" : "invalid");
    })();

    return () => { cancelled = true; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");

    setSaving(true);
    const { data, error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) {
      setError(/same|different from the old/i.test(err.message)
        ? "Choose a password different from your old one."
        : /session|expired|jwt/i.test(err.message)
          ? "This reset link has expired. Request a new one."
          : err.message);
      return;
    }
    if (data.user?.email) await rememberPassword(data.user.email, password);
    setPhase("done");
  };

  const goHome = async () => {
    try {
      const { data } = await supabase.rpc("get_my_access");
      window.location.assign(data?.[0]?.home_route || "/dashboard");
    } catch {
      window.location.assign("/dashboard");
    }
  };

  const field = "w-full h-12 rounded-xl px-4 pr-11 bg-white/60 border border-white/60 outline-none focus:ring-2 focus:ring-black/20 text-slate-900";

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#E0E6F7] font-sans">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl shadow-xl p-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-4">Set a new password</h1>

        {phase === "checking" && <p className="text-sm text-slate-600">Checking your reset link…</p>}

        {phase === "invalid" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">This reset link is invalid or has expired. Links work once and only for a limited time.</p>
            <Link to="/forgot" className="inline-block font-bold underline text-slate-900">Request a new link</Link>
          </div>
        )}

        {phase === "ready" && (
          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className={field}
                autoFocus
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type={showPw ? "text" : "password"}
              name="confirmPassword"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              className={field}
            />
            {error && (
              <p className="text-sm font-semibold text-red-600">
                {error}{" "}
                {/expired/i.test(error) && <Link to="/forgot" className="underline">Get a new link</Link>}
              </p>
            )}
            <button type="submit" disabled={saving} className="w-full h-12 rounded-2xl font-bold bg-black text-white hover:bg-slate-900 disabled:opacity-60">
              {saving ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}

        {phase === "done" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Your password is updated. From now on you can sign in with your email and this password (Google sign-in keeps working too).</p>
            <button type="button" onClick={goHome} className="w-full h-12 rounded-2xl font-bold bg-black text-white hover:bg-slate-900">
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
